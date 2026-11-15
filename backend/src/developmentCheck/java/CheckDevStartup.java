import org.gradle.tooling.*;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;

/** Run with the selected Gradle distribution's lib/* on the classpath. Uses IntelliJ's cancellation API. */
class CheckDevStartup {
    static final Map<String, String> environment = new HashMap<>(System.getenv());
    static Path root;
    public static void main(String[] args) throws Exception {
        root = Path.of(args[0]).toAbsolutePath();
        environment.put("COMPOSE_PROJECT_NAME", "campaign-workbench-startup-check");
        environment.put("WORKBENCH_DATABASE_PORT", "55433");
        try (var connection = GradleConnector.newConnector().useInstallation(new File(args[1]))
                .forProjectDirectory(root.resolve("backend").toFile()).connect()) {
            try {
                // Occupied ports must fail without terminating their owner or starting servers.
                try (var occupied = new ServerSocket(4200, 1, InetAddress.getByName("127.0.0.1"))) {
                    var failed = launch(connection, "occupied-port");
                    if (failed.done.get(30, TimeUnit.SECONDS) == null) throw new AssertionError("Occupied port accepted");
                    if (!failed.log.text().contains("Port 4200 is already in use")) throw new AssertionError(failed.log.text());
                    if (occupied.isClosed()) throw new AssertionError("Unrelated port owner was stopped");
                }
                for (int attempt = 0; attempt < 2; attempt++) {
                    var run = launch(connection, "run-" + attempt);
                    try {
                        run.log.ready.get(120, TimeUnit.SECONDS);
                        var response = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(java.time.Duration.ofSeconds(2)).build().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:4200/api/status")).timeout(java.time.Duration.ofSeconds(5)).GET().build(), HttpResponse.BodyHandlers.ofString());
                        if (response.statusCode() != 200 || !response.body().contains("ready")) throw new AssertionError("Frontend proxy unavailable");
                        String before = databaseState();
                        run.cancel.cancel();
                        Throwable result = run.done.get(25, TimeUnit.SECONDS);
                        if (!(result instanceof BuildCancelledException)) throw new AssertionError("Expected Tooling API cancellation, got " + result);
                        awaitClosed(8080); awaitClosed(4200);
                        if (!before.equals(databaseState())) throw new AssertionError("Database state changed on stop");
                        if (attempt == 1 && !Files.readString(root.resolve("backend/build/dev-check-state.txt")).equals(before)) throw new AssertionError("Database state did not survive relaunch");
                        Files.writeString(root.resolve("backend/build/dev-check-state.txt"), before);
                    } finally { run.cancel.cancel(); }
                }
                // Fail after Spring is ready, not just during preflight: publication must clean up Spring.
                var failureLog = root.resolve("backend/build/dev-check-generator-failure.log");
                var broken = new ProcessBuilder(Path.of(System.getProperty("java.home"), "bin", "java").toString(),
                    "-cp", root.resolve("backend/build/classes/java/development").toString(), "workbench.dev.DevLauncher",
                    root.toString(), root.resolve("backend/build/libs/campaign-workbench-0.0.1-SNAPSHOT.jar").toString(),
                    "/missing-generator", "unused").directory(root.toFile()).redirectErrorStream(true).redirectOutput(failureLog.toFile());
                broken.environment().putAll(environment);
                var process = broken.start();
                try {
                    if (!process.waitFor(60, TimeUnit.SECONDS) || process.exitValue() == 0) throw new AssertionError("Expected client generation failure");
                    if (!Files.readString(failureLog).contains("API client failed")) throw new AssertionError(Files.readString(failureLog));
                    awaitClosed(8080); awaitClosed(4200);
                    databaseState();
                } finally { process.destroy(); }
                environment.put("WORKBENCH_DEV_PLAYER_BUILD_SCRIPT", "missing-player-build");
                try {
                    var failed = launch(connection, "player-build-failure");
                    if (failed.done.get(120, TimeUnit.SECONDS) == null) throw new AssertionError("Expected player build failure");
                    if (!failed.log.text().contains("Player build failed")) throw new AssertionError(failed.log.text());
                    awaitClosed(8080); awaitClosed(4200); databaseState();
                } finally { environment.remove("WORKBENCH_DEV_PLAYER_BUILD_SCRIPT"); }
                System.out.println("PASS: occupied-port failure, two real stack launches, proxied API, Tooling API cancellation, released ports, generation/player-build failure cleanup and retained database state.");
            } finally {
                var stop = new ProcessBuilder("docker", "compose", "stop", "database").directory(root.toFile());
                stop.environment().putAll(environment);
                if (stop.inheritIO().start().waitFor() != 0) throw new AssertionError("Could not stop isolated check database");
            }
        }
    }
    static String databaseState() throws Exception {
        var builder = new ProcessBuilder("docker", "compose", "exec", "-T", "database", "sh", "-c",
                "psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atc 'select created_at from workbench_setup.installation where id = 1'").directory(root.toFile());
        builder.environment().putAll(environment);
        var process = builder.start();
        String result = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        if (process.waitFor() != 0 || result.isEmpty()) throw new AssertionError("Isolated database unavailable");
        return result;
    }
    record Run(CancellationTokenSource cancel, CompletableFuture<Throwable> done, Log log) {}
    static Run launch(ProjectConnection connection, String label) throws IOException {
        var log = new Log(root.resolve("backend/build/dev-check-" + label + ".log"));
        var cancellation = GradleConnector.newCancellationTokenSource();
        var done = new CompletableFuture<Throwable>();
        connection.newBuild().forTasks("dev").withArguments("--console=plain").setEnvironmentVariables(environment)
            .setStandardOutput(log).setStandardError(log).withCancellationToken(cancellation.token())
            .run(new ResultHandler<Void>() {
                public void onComplete(Void ignored) { done.complete(null); log.close(); }
                public void onFailure(GradleConnectionException error) { done.complete(error); log.ready.completeExceptionally(error); log.close(); }
            });
        return new Run(cancellation, done, log);
    }
    static void awaitClosed(int port) throws Exception {
        for (int i = 0; i < 100; i++) {
            try (var socket = new Socket()) { socket.connect(new InetSocketAddress("127.0.0.1", port), 100); }
            catch (IOException expected) { return; }
            Thread.sleep(100);
        }
        throw new AssertionError("Orphaned server on port " + port);
    }
    static final class Log extends OutputStream {
        final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        final CompletableFuture<Void> ready = new CompletableFuture<>();
        final OutputStream file;
        Log(Path path) throws IOException { Files.createDirectories(path.getParent()); file = Files.newOutputStream(path); }
        public synchronized void write(int value) throws IOException { write(new byte[]{(byte)value}, 0, 1); }
        public synchronized void write(byte[] values, int offset, int length) throws IOException {
            buffer.write(values, offset, length); file.write(values, offset, length); file.flush();
            if (text().contains("[dev] Ready:")) ready.complete(null);
        }
        synchronized String text() { return buffer.toString(StandardCharsets.UTF_8); }
        public synchronized void close() { try { file.close(); } catch (IOException ignored) {} }
    }
}
