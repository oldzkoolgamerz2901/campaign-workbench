# Campaign Workbench

A local laptop workspace for campaign preparation and play. Setup increment 0 provides the application shell and validates its toolchain; campaign registration, source reading, preparation, play and AI are not implemented.

The Angular frontend and Kotlin/Spring modular backend live here. Independent campaign directories retain authoritative Markdown. PostgreSQL owns application state. This setup never reads or rewrites campaign sources.

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

```sh
docker compose up -d --wait database
./scripts/backend-dev.sh
```

In a second terminal, after the backend is ready:

```sh
cd backend
./gradlew generateFrontendClient
cd ../frontend
npm start
```

Open `http://127.0.0.1:4200`. The dev server proxies `/api` to the local backend on port 8080. `Check connection` calls the operational status endpoint. Both servers and PostgreSQL listen on loopback. Stop the backend/dev server with Ctrl-C; stop the development database with `docker compose stop database`. Do not remove its volume to restart it.

Backend checks: `cd backend && ./gradlew test bootJar`. Frontend checks after client generation: `cd frontend && npm run check:versions && npm test && npm run build`. The `test:e2e` command expects an isolated backend on port 18080; prefer the complete setup script.

Session-use packaging, serving frontend assets through Spring, a single launcher, backup/restore and tablet/network access remain future work. The current development startup is not the session-use distribution.

## Design and evidence

- [Approved requirements](docs/product-specification.md)
- [Accepted architecture, setup scope, superseded history and developer-check evidence](docs/implementation-plan.md)
- [Historical Sea Witch assessment](../sea_witch/repository-app-assessment.md), in a separate campaign repository; its suggestions are not approved requirements.

Read [AGENTS.md](AGENTS.md) before agent development. Workflow documents and skills are under `.agents/`. Developer checks do not constitute formal verification; no formal verification record exists yet. No product requirement is claimed complete by this setup increment.
