# Campaign Workbench

A local laptop workspace for discovering campaign material, writing Markdown, preparing frozen sessions and running play. Independent campaign directories retain authoritative content; the backend never rewrites their sources. PostgreSQL owns application state.

The Angular frontend and Kotlin/Spring modular backend provide four workspaces:

- **Library:** search captured Sources and saved Drafts, read full documents, edit associated material and explicitly Add a whole card to a chosen session.
- **Write:** edit durable Drafts, preview illustrated cards/documents and download reviewed Markdown for manual incorporation into campaign files.
- **Prepare:** assemble ordered frozen items, edit preparation notes, plan explicit Scene associations and accept same-type revision replacements.
- **Play:** arrange Session Cards, two covered piles, Used and an explicit active Scene; read frozen documents and record independent PlayNotes with pins and cross-session history.

T1/T2 and P5–P8 have delivery and formal evidence. The latest P8 assessment passed 91 backend tests, 131 frontend tests and 51 Chromium journeys. Owner functional/visual acceptance remains separate. AI assistance, authority assignments and general source history remain future work.

## Reading map

Read [AGENTS.md](AGENTS.md) and its required workflow documents before development.

| Need | Reference |
| --- | --- |
| Setup, local startup and checks | Sections below; [runtime baseline](docs/runtime-baseline.md) |
| Using Library, Write, Prepare and Play | [User guide](docs/user-guide.md) |
| Approved behavior and precedence | [Product specification](docs/product-specification.md) |
| Current architecture and delivered increments | [Implementation plan](docs/implementation-plan.md) |
| Current UX | [Unified workspace](docs/unified-workspace-ux-design.md), [tabletop design](docs/play-tabletop-ux-design.md) |
| Verification, findings and limitations | [Verification](docs/verification.md) |
| Deferred features and proposed architecture improvements | [Future work](docs/future-work.md) |
| Historical plans, evidence and concept notes | [History index](docs/history/README.md), [implementation records](docs/implementation-history.md) |

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

The setup check builds/tests the backend, starts an isolated PostgreSQL Compose project on port 55432 and backend on port 18080, obtains OpenAPI from Spring, generates the Angular client, checks version drift, runs frontend tests/build and the Chromium browser suite, and checks PostgreSQL persistence across restart. It stops its backend and containers afterward. Its test-only volume is retained separately from development data. Testcontainers also creates temporary PostgreSQL containers. Ports 4200, 55432 and 18080 must be free. If the development frontend already uses 4200, run `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` to use a separate browser-check frontend; the existing server is not reused or stopped.

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

### Optional development database reset

P1 adds Flyway V15 and removes the obsolete Preparation table-state column without converting its contents. No development reset was executed for P1; tests use isolated disposable Testcontainers databases. A reset is optional, destructive and limited to the development database. Obtain explicit owner authorization for that operation, stop the development launcher, and inspect the target before executing these commands from this repository:

```sh
docker volume inspect campaign-workbench_postgres-data
docker compose -p campaign-workbench down
docker volume rm campaign-workbench_postgres-data
docker compose -p campaign-workbench up -d --wait database
```

The volume name follows the explicit Compose project `campaign-workbench` and declared `postgres-data` volume. Verify its Compose labels match that project/volume; stop if they differ or the volume is used by another project. Do not use `docker volume prune`, wildcard deletion or another project's volume. This removes application database records (including Writing recovery); campaign directories, downloaded files and other volumes are outside reset scope. Flyway recreates the schema on the next backend start. Historical session archive conversion is not provided.

<details>
<summary>Earlier section links (preserved for existing references)</summary>

- <a id="campaign-source-library"></a> [Campaign source library](docs/history/readme-2026-10-24.md#campaign-source-library)
- <a id="manual-writing-and-card-previews"></a> [Manual writing and card previews](docs/history/readme-2026-10-24.md#manual-writing-and-card-previews)
- <a id="writing-recovery"></a> [Writing recovery](docs/history/readme-2026-10-24.md#writing-recovery)
- <a id="session-preparation-and-reading"></a> [Session preparation and reading](docs/history/readme-2026-10-24.md#session-preparation-and-reading)
- <a id="design-and-evidence"></a> [Design and evidence](docs/history/readme-2026-10-24.md#design-and-evidence)

</details>
