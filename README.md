# Campaign Workbench

A local laptop workspace for campaign preparation and play. Increment 1 provides campaign registration, switching, Markdown browsing, and passage search. Preparation, play, authority assignments, retained source history, and AI remain future work.

The Angular frontend and Kotlin/Spring modular backend live here. Independent campaign directories retain authoritative Markdown. PostgreSQL owns application state. The backend reads explicitly registered campaign directories and never rewrites their sources.

## Prerequisites and first setup

Use the exact versions in [the runtime baseline](docs/runtime-baseline.md) and [version catalog](docs/versions.toml). Start Docker Desktop. Java 25, Node 26.12.0 and npm 11.20.0 must be available; runtime installation is not automated.

Create `.env` from `.env.example` with a unique local database password. The initial setup generated a private, ignored `.env` on this machine. Keep it out of Git. Do not use the example password.

```sh
cd frontend
npm ci
npx playwright install chromium
cd ..
./scripts/check-setup.sh
```

The setup check builds/tests the backend, starts an isolated PostgreSQL Compose project on port 55432 and backend on port 18080, obtains OpenAPI from Spring, generates the Angular client, checks version drift, runs frontend tests/build and a Chromium browser flow, and checks PostgreSQL persistence across restart. It stops its backend and containers afterward. Its test-only volume is retained separately from development data. Testcontainers also creates temporary PostgreSQL containers. Ports 4200, 55432 and 18080 must be free.

Generated client files are ignored and must be regenerated after changing the API or on a fresh checkout. The setup check generates them before frontend compilation. No hand-maintained contract or mock server substitutes for the Spring contract.

## Development

With Docker Desktop running and the first setup completed, start everything with:

```sh
cd backend
./gradlew dev
```

In IntelliJ, open the repository root and link `backend/build.gradle.kts` as a Gradle project. Select the shared **Campaign Workbench** run configuration and click Run, or run **application → dev** in the Gradle panel. Ensure IntelliJ's environment can find `docker`, `node`, and `npm` on `PATH`.

The task loads `.env`, starts/waits for PostgreSQL, starts Spring, generates the API client from its live OpenAPI contract, then starts Angular. Open **http://127.0.0.1:4200** when the console prints `[dev] Ready`. Logs have service prefixes. Ports 8080 and 4200 must be available; existing unrelated processes are never terminated to free them.

Press Ctrl-C or IntelliJ's Stop button to stop the owned backend/frontend processes. Startup failures also clean up owned processes. PostgreSQL remains running and its data is preserved; stop it separately from the repository root with `docker compose stop database`. The automated lifecycle check exercises Gradle Tooling API cancellation; the IntelliJ GUI itself has not been manually tested.

Run-configuration/environment variables override `.env`. The launcher accepts `KEY=value`, optional `export`, quoted values, and comments; it treats values as data and does not execute shell commands or expand variables. Missing configuration/dependencies produce startup errors. Initial dependency installation remains `npm ci` in `frontend/`. Backend-only development remains available through `scripts/backend-dev.sh` with PostgreSQL already running; ordinary `bootRun` is unchanged.

Startup lifecycle checks: `cd backend && ./gradlew checkDevStartup`. This opt-in task uses the separate `campaign-workbench-startup-check` Compose project/database volume on port 55433 and the usual server ports 8080/4200. It tests occupied-port failure, real startup and proxy connectivity, cancellation/relaunch, database preservation, and cleanup after client-generation failure. It stops its isolated database afterward. It is not part of ordinary `test` or `build`.

Backend checks: `cd backend && ./gradlew test bootJar`. Frontend checks after client generation: `cd frontend && npm run check:versions && npm test && npm run build`. The `test:e2e` command expects an isolated backend on port 18080; prefer the complete setup script.

Session-use packaging, serving frontend assets through Spring, a session-use launcher, backup/restore and tablet/network access remain future work. The current development startup is not the session-use distribution.

## Campaign source library

Register a campaign using a display name and an available folder path. Registrations, source rules, and the last selected campaign persist in PostgreSQL. Opening a campaign scans its Markdown; **Refresh library** explicitly captures later edits. Reading and search use the same captured text until refresh succeeds. If scanning fails, the previous capture remains readable and the error identifies the affected read. Before a first successful capture, the library remains empty.

**Source rules** shows editable include/exclude patterns, one per line. Paths are relative to the registered folder, with `/` separators. `*` and `?` match within a segment; `**` spans directories. `**/*.md` includes root and nested Markdown, case-insensitively. Exclusions win. Defaults exclude hidden files/directories, `node_modules`, `build`, `dist`, `target`, `coverage`, and `AGENTS.md`/`CLAUDE.md`. Symlinks are not followed. Changing rules marks the current capture as needing refresh; it stays readable until successful refresh. Duplicate resolved directories are rejected.

Search matches the trimmed query literally and case-insensitively against document paths, headings, and section text. Results open their matching block, including under repeated headings. Markdown supports headings, lists, tables, and code; raw HTML is escaped and images are omitted. Relative Markdown links (including encoded spaces) and heading anchors resolve within the capture. Heading anchors use lowercase heading text, remove punctuation except `_`/`-`, replace spaces with `-`, and add numeric suffixes for collisions. Missing, excluded, or unsupported targets are identified. External HTTP(S) links open only after a click.

A refresh replaces the current capture rather than retaining history. Old references prompt a library reload. There is one refresh at a time per campaign; scans are outside database transactions and publication is atomic. Concurrent filesystem edits cannot be guaranteed to represent one instant; detected unreliable reads fail the scan. No background watching, source authority classification, assets, campaign-file editing, backup/restore, or live-session functionality is included. Chromium is the current developer acceptance browser; Safari/WebKit support is deferred. The development startup above remains required.

## Design and evidence

- [Approved requirements](docs/product-specification.md)
- [Accepted architecture, setup scope, superseded history and developer-check evidence](docs/implementation-plan.md)
- [Historical Sea Witch assessment](../sea_witch/repository-app-assessment.md), in a separate campaign repository; its suggestions are not approved requirements.

Read [AGENTS.md](AGENTS.md) before agent development. Workflow documents and skills are under `.agents/`. Developer checks do not constitute formal verification; no formal verification record exists yet. No product requirement is claimed complete by this setup increment.
