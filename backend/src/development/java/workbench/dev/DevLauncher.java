package workbench.dev;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/** Development-only process owner. Never packaged with the application. */
public final class DevLauncher implements AutoCloseable {
    private final Path root;
    private final Map<String, String> environment;
    private final List<Process> children = new ArrayList<>();
    private boolean stopping;

    private DevLauncher(Path root) throws IOException {
        this.root = root;
        environment = readEnvironment(root.resolve(".env"));
    }

    public static void main(String[] args) {
        int result = 0;
        try (var launcher = new DevLauncher(Path.of(args[0]))) {
            Runtime.getRuntime().addShutdownHook(new Thread(launcher::close, "dev-shutdown"));
            launcher.run(Path.of(args[1]), args[2], args[3]);
        } catch (Exception error) {
            System.err.println("[dev] " + error.getMessage());
            result = 1;
        }
        System.exit(result);
    }

    private void run(Path jar, String generatorClasspath, String angularVersion) throws Exception {
        requireAvailablePort(8080);
        requireAvailablePort(4200);
        if (!Files.isRegularFile(root.resolve("frontend/node_modules/@angular/cli/bin/ng.js"))) {
            throw new IOException("Frontend dependencies are missing. Run npm ci in frontend first.");
        }
        command("Docker Desktop check", root, List.of("docker", "info", "--format", "{{.ServerVersion}}"), 20);
        command("Node check", root, List.of("node", "--version"), 10);
        command("npm check", root, List.of("npm", "--version"), 10);
        command("PostgreSQL", root, List.of("docker", "compose", "up", "-d", "--wait", "--wait-timeout", "90", "database"), 120);

        // Match Compose's database configuration, including a non-default local port/name.
        environment.putIfAbsent("WORKBENCH_DATABASE_URL", "jdbc:postgresql://127.0.0.1:"
                + environment.getOrDefault("WORKBENCH_DATABASE_PORT", "5432") + "/" + required("POSTGRES_DB"));
        var backend = start("backend", root, List.of(java(), "-jar", jar.toString(), "--server.port=8080"));
        waitFor("backend", "http://127.0.0.1:8080/api/status", backend, 90);

        command("API client", root, List.of(java(), "-cp", generatorClasspath,
                "org.openapitools.codegen.OpenAPIGenerator", "generate", "-g", "typescript-angular",
                "-i", "http://127.0.0.1:8080/v3/api-docs", "-o", "frontend/src/api/generated",
                "--additional-properties", "ngVersion=" + angularVersion + ",providedInRoot=true,hideGenerationTimestamp=true"), 120);
        if (!backend.isAlive()) throw new IOException("Backend stopped during client generation.");
        var frontend = start("frontend", root.resolve("frontend"),
                List.of("npm", "start", "--", "--host", "127.0.0.1", "--port", "4200"));
        waitFor("frontend", "http://127.0.0.1:4200/api/status", frontend, 90);
        System.out.println("[dev] Ready: http://127.0.0.1:4200 — stop this Gradle task to stop both servers.");
        CompletableFuture.anyOf(backend.onExit(), frontend.onExit()).join();
        throw new IOException("A development server exited. Stopping the other server; PostgreSQL remains running.");
    }

    private String required(String key) throws IOException {
        String value = environment.get(key);
        if (value == null || value.isBlank()) throw new IOException("Missing " + key + " in .env or the run configuration.");
        return value;
    }

    private static String java() {
        return Path.of(System.getProperty("java.home"), "bin", "java").toString();
    }

    private synchronized Process start(String label, Path directory, List<String> command) throws IOException {
        if (stopping) throw new IOException("Development startup was cancelled.");
        System.out.println("[dev] Starting " + label + "…");
        var builder = new ProcessBuilder(command).directory(directory.toFile()).redirectErrorStream(true);
        builder.environment().clear();
        builder.environment().putAll(environment);
        builder.environment().put("CI", "true");
        Process process;
        try { process = builder.start(); }
        catch (IOException error) {
            throw new IOException("Cannot start " + label + ". Check its executable is on IntelliJ's PATH.");
        }
        children.add(process);
        Thread.startVirtualThread(() -> {
            try (var lines = process.inputReader()) {
                String line;
                while ((line = lines.readLine()) != null) System.out.println("[" + label + "] " + line);
            } catch (IOException ignored) { /* Process shutdown closes the stream. */ }
        });
        return process;
    }

    private void command(String label, Path directory, List<String> command, int seconds) throws Exception {
        Process process = start(label, directory, command);
        if (!process.waitFor(seconds, TimeUnit.SECONDS)) throw new IOException(label + " timed out.");
        if (process.exitValue() != 0) throw new IOException(label + " failed. See its logs above.");
    }

    private static void waitFor(String label, String address, Process process, int seconds) throws Exception {
        var client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(1)).build();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
        while (System.nanoTime() < deadline) {
            if (!process.isAlive()) throw new IOException(label + " exited before it was ready. See its logs above.");
            try {
                var request = HttpRequest.newBuilder(URI.create(address)).timeout(Duration.ofSeconds(2)).GET().build();
                var response = client.sendAsync(request, HttpResponse.BodyHandlers.ofString()).orTimeout(3, TimeUnit.SECONDS).get();
                if (response.statusCode() == 200 && response.body().contains("\"ready\"")) return;
            } catch (java.util.concurrent.ExecutionException ignored) { /* Not ready yet. */ }
            Thread.sleep(200);
        }
        throw new IOException(label + " readiness timed out. See its logs above.");
    }

    private static void requireAvailablePort(int port) throws IOException {
        try (var socket = new ServerSocket()) {
            // Allow an immediate restart after accepted connections enter TIME_WAIT.
            socket.setReuseAddress(true);
            socket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port));
        } catch (IOException error) {
            throw new IOException("Port " + port + " is already in use. Stop the existing service first; it will not be terminated automatically.");
        }
    }

    // Parse data rather than sourcing shell code. Process/run-configuration variables override .env.
    static Map<String, String> readEnvironment(Path file) throws IOException {
        if (!Files.isRegularFile(file)) throw new IOException("Missing .env. Copy .env.example and set a local database password.");
        var values = new LinkedHashMap<String, String>();
        for (String original : Files.readAllLines(file)) {
            String line = original.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            if (line.startsWith("export ")) line = line.substring(7).trim();
            int equal = line.indexOf('=');
            if (equal < 1 || !line.substring(0, equal).trim().matches("[A-Za-z_][A-Za-z0-9_]*")) {
                throw new IOException("Invalid .env entry. Use KEY=value assignments; shell commands are unsupported.");
            }
            String key = line.substring(0, equal).trim();
            String value = line.substring(equal + 1).trim();
            if (value.startsWith("\"") || value.startsWith("'")) {
                char quote = value.charAt(0);
                int end = value.indexOf(quote, 1);
                if (end < 0 || (!value.substring(end + 1).trim().isEmpty() && !value.substring(end + 1).trim().startsWith("#"))) {
                    throw new IOException("Invalid quoted .env value for " + key + ".");
                }
                value = value.substring(1, end);
            } else {
                value = value.replaceFirst("\\s+#.*$", "");
            }
            values.put(key, value);
        }
        values.putAll(System.getenv());
        for (String key : List.of("POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD")) {
            if (values.getOrDefault(key, "").isBlank()) throw new IOException("Missing " + key + " in .env or the run configuration.");
        }
        return values;
    }

    @Override public synchronized void close() {
        if (stopping) return;
        stopping = true;
        // Snapshot descendants before terminating npm/shell parents, which could otherwise orphan Node.
        var owned = new ArrayList<ProcessHandle>();
        for (Process child : children) {
            if (child.isAlive()) {
                owned.addAll(child.descendants().toList());
                owned.add(child.toHandle());
            }
        }
        owned.forEach(ProcessHandle::destroy);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (owned.stream().anyMatch(ProcessHandle::isAlive) && System.nanoTime() < deadline) {
            try { Thread.sleep(50); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); break; }
        }
        owned.stream().filter(ProcessHandle::isAlive).forEach(ProcessHandle::destroyForcibly);
        System.out.println("[dev] Owned processes stopped. PostgreSQL remains running; its data is preserved.");
    }
}
