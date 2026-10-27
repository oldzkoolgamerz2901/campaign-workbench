# Campaign Workbench

A local laptop workspace for discovering campaign material, writing Markdown, preparing frozen sessions and running play. Independent campaign directories retain authoritative content; the backend never rewrites their sources. PostgreSQL owns application state.

The Angular frontend and Kotlin/Spring modular backend provide four content workspaces and a Share onboarding surface:

- **Library:** search captured Sources and saved Drafts, read full documents, edit associated material and explicitly Add a whole card to a chosen session.
- **Write:** edit durable Drafts with separate card-back text, check physical front/back text fit, preview illustrated cards/documents and download reviewed Markdown for manual incorporation into campaign files.
- **Prepare:** assemble ordered frozen items, edit preparation notes, plan explicit Scene associations and accept same-type revision replacements.
- **Play:** arrange Session Cards, two covered piles, Used and an explicit active Scene; read frozen documents and record independent PlayNotes with pins and cross-session history.
- **Share:** manage campaign players, pair tablets by QR and explicitly distribute frozen card fronts/backs/artwork to Group or one player's Unsorted. Tablets read separate Group/My Cards collections, claim Group Inventory and confirm removal of their own Inventory. DM transfer, removal/withdrawal and same-instance recovery are available; piles remain subsequent increments.

T1/T2, P5–P8 and FC1–FC3 have delivery and formal evidence. Full cards now flip between canonical scroll-free fronts and plain-text backs, with complete external reading when a side cannot fit. The latest FC3 assessment passed 103 backend tests, 134 frontend tests, 55 Chromium journeys and four layout journeys. Owner functional/visual acceptance of FC3 remains separate. AI assistance, authority assignments and general source history remain future work.

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

The task loads `.env`, starts/waits for PostgreSQL, starts Spring, generates the API client from its live OpenAPI contract, builds the compiled player application, then starts Angular for the DM. Open **http://127.0.0.1:4200** when the console prints `[dev] Ready`. Logs have service prefixes. Ports 8080 and 4200 must be available; existing unrelated processes are never terminated to free them.

Press Ctrl-C or IntelliJ's Stop button to stop the owned backend/frontend processes. Startup failures also clean up owned processes. PostgreSQL remains running and its data is preserved; stop it separately from the repository root with `docker compose stop database`. The automated lifecycle check exercises Gradle Tooling API cancellation; the IntelliJ GUI itself has not been manually tested.

Run-configuration/environment variables override `.env`. The launcher accepts `KEY=value`, optional `export`, quoted values, and comments; it treats values as data and does not execute shell commands or expand variables. Missing configuration/dependencies produce startup errors. Initial dependency installation remains `npm ci` in `frontend/`. Backend-only development remains available through `scripts/backend-dev.sh` with PostgreSQL already running; ordinary `bootRun` is unchanged.

Startup lifecycle checks: `cd backend && ./gradlew checkDevStartup`. This opt-in task uses the separate `campaign-workbench-startup-check` Compose project/database volume on port 55433 and the usual server ports 8080/4200. It tests occupied-port failure, real startup and proxy connectivity, cancellation/relaunch, database preservation, and cleanup after client-generation and player-build failure. It stops its isolated database afterward. It is not part of ordinary `test` or `build`.

Backend checks: `cd backend && ./gradlew test bootJar`. Frontend checks after client generation: `cd frontend && npm run check:versions && npm test && npm run build`. The `test:e2e` command expects an isolated backend on port 18080; prefer the complete setup script.

Session-use packaging, a session-use launcher, backup/restore and populated player card collections remain future work. Spring serves the separately compiled player onboarding assets; the current development startup is not the session-use distribution.

### Local gateway foundation (G1)

The player gateway is disabled on every startup. G1 provides listener/lifecycle infrastructure and a content-free readiness response; player pairing, cards and the tablet interface remain future work. The private API stays bound to `127.0.0.1`, including when `server.address` is overridden. PostgreSQL's existing localhost binding is unchanged.

With the application running and a campaign selected, enable from the laptop:

```sh
curl -fsS -X POST -H 'Content-Type: application/json' http://127.0.0.1:8080/api/gateway/enable
curl -fsS http://127.0.0.1:8080/api/gateway
```

The response reports enabled state, campaign, bound port and active requests. By default the player listener binds to `0.0.0.0:8081`; `workbench.gateway.address` and `workbench.gateway.port` configure that listener separately. On a device on the same trusted home Wi-Fi, open `http://<laptop-LAN-IP>:8081/player-api/readiness`. A successful response is `{"status":"ready"}`. Local HTTP is unencrypted. A successful enable response proves local binding, not device-to-device reachability.

Disable from the laptop:

```sh
curl -fsS -X POST -H 'Content-Type: application/json' http://127.0.0.1:8080/api/gateway/disable
```

Switching to a different campaign disables the gateway. Admitted synchronous requests finish against their original campaign before selection changes; newcomers are rejected. The default drain timeout is 5000 milliseconds (`workbench.gateway.drain-timeout-ms`). On timeout/cleanup failure, selection fails and admission remains closed; retry after outstanding operations finish. Selecting the same campaign preserves an enabled gateway. Re-enabling creates a new activation. Only the readiness GET is admitted over the LAN in G1; DM APIs, OpenAPI, static files and gateway controls remain private.

### Player identity and pairing backend (G2)

G2 provides the identity backend; G3.1 adds the Share/onboarding UI described below. Flyway V23 adds Sharing-owned player, invitation and device tables, and V24 adds invitation identity/replacement state without replacing existing credentials. Existing content and archives are unchanged; session/Writing archives do not back up Sharing records or credentials.

Private operations use the laptop API under `/api/campaigns/<campaign>/sharing`:

| Method | Path below that prefix | Purpose |
| --- | --- | --- |
| GET / POST | `/players` | List players / create with `{"displayName":"Mira"}` |
| PUT | `/players/<player>/active` | Set `{"active":false}` or `true` |
| PUT | `/players/<player>/name` | Rename with `{"displayName":"Mira"}`; identity and credentials remain |
| POST | `/players/<player>/pairing` | Issue a one-use token and its expiry |
| GET | `/players/<player>/pairing/<id>` | Inspect non-secret invitation status |
| POST | `/players/<player>/pairing/<id>/replace` | Replace that invitation without revoking devices |
| GET | `/players/<player>/devices` | Inspect devices without exposing credentials or hashes |
| POST | `/devices/<device>/revoke` | Permanently revoke that device |

Send `Content-Type: application/json` for mutations, including bodyless pairing issuance and revocation. Enable the gateway for the selected campaign before using its player port. `POST /player-api/pair` accepts `{"token":"<invitation-token>"}` and returns a new `credential` plus the paired identity. `GET /player-api/me` requires `Authorization: Bearer <credential>`. Do not place secrets in query strings. Issuance/redemption responses are not cached, and only credential hashes are persisted. A lost redemption response requires a new invitation; replay cannot recover the credential.

Invitations expire after 300 seconds by default (`workbench.sharing.invitation-lifetime-seconds`). Device credentials have no automatic expiry; they survive restart and gateway disable/re-enable for the same campaign until revoked. Inactive players are denied without deleting their devices; reactivation restores access for non-revoked devices. Wrong-campaign, expired, consumed or revoked credentials return 401; an inactive authenticated player returns 403. All management routes remain unreachable through the LAN listener. Trusted-LAN HTTP remains unencrypted.

### Share tab and tablet onboarding (G3.1)

Run the normal `./gradlew dev` task after installing dependencies. Startup generates the client from live Spring, builds the separate player application, then starts the private DM frontend. Open **Share** in the existing navigation. Select a campaign/session to inspect its prepared card fronts/backs; distribution and populated collections are subsequent increments.

Add a player using a display name. Adding a player does not enable sharing. Click **Enable sharing**, select the correct local address (Wi-Fi is commonly `en0` on this laptop), then choose **Pair device** for an active player. The modal shows a real QR and matching selectable link with expiry. Scan with the tablet's normal camera on the same Wi-Fi. No browser-camera permission, registration or second DM approval is required. Successful pairing opens Group Cards with the player's name; My Cards is separate. Both collections are empty shells in G3.1; no cards or piles are fabricated.

Rename/deactivate and device management are in the player's contextual menu. Device counts exclude revoked devices; inactive players retain their pairings. Regenerate invalidates the displayed invitation but never revokes a device that already paired. Closing the modal makes no pairing-success claim. Temporary tokens stay in URL fragments until player bootstrap removes them, then travel in the exchange body. Permanent credentials stay in origin/campaign-scoped localStorage and Authorization headers. Reload reconnects at the same origin; changing LAN IP/port can require re-pairing. Denied access hides identity/collections; unknown network loss retains stale in-memory information while reconnecting.

Player assets come only from the completed `frontend/dist/player/browser` build manifest through Spring; the Angular dev server and DM assets remain private. Missing/partial builds disable QR readiness. For backend-only startup, build the player after generating the client (`cd frontend && npm run build:player`) and set `workbench.gateway.player-assets` to that directory's absolute path if the working directory is not the repository root. Full session-use packaging remains future work.

### Frozen card distribution and tablet reading (G3.2)

In Share, choose a prepared session and use the source card's **Share** action. Review the front, back and artwork, choose Group or one player's Unsorted, explicitly choose Handout or Inventory, and **Confirm sharing**. Artwork must finish loading before confirmation. Changed prepared content requires a fresh review. If delivery is uncertain, **Retry delivery** recovers the original instance; closing/reopening the dialog in the same workspace retains that retry identity. A new explicit distribution creates a separate copy.

DM collection selection shows actual distributed cards. Paired tablets receive Group and their own collection only. Tap/click or keyboard-activate a card to expand, use its on-card flip, and read complete side text when layout is unavailable or does not fit. Close returns focus and preserves the tray's scroll position. New personal arrivals mark the My Cards destination without switching screens or interrupting reading. Network loss retains stale in-memory reading; authoritative denial hides collections. Reload requires reconnecting; no offline content storage or queued mutations is provided.

Flyway V25 adds Sharing-owned frozen content/artwork, instances, Unsorted placement, distribution retry records and initial lifecycle events. Copies survive prepared-source removal and restart, independently of Preparation image pruning. Session/Writing archives do not include Sharing records or artwork. G3.2 delivered readable Inventory; G3.3 adds Claim, Transfer and Remove/Restore below. Piles and drag/drop remain G3.4–G3.5. Existing G3.1 shell descriptions above describe that earlier increment's scope.

### Inventory lifecycle and recovery (G3.3)

Use **Card actions** on a distributed card. On tablets, **Claim** takes Group Inventory into your My Cards Unsorted immediately, keeping you on Group; a competing claim refreshes the view with concise feedback. My Cards Inventory offers **Remove** with confirmation. Handouts remain read-only for players.

In Share, the DM can **Transfer** active Inventory to Group or another player's Unsorted, **Remove** Inventory or **Withdraw** Handouts with confirmation. **Removed cards** opens one DM-only recovery view showing mode, state and previous recipient. **Restore** returns the same instance and frozen content to that recipient's Unsorted, including inactive players; it does not reactivate access. Transfer and recovery preserve instance identity. Named piles and drag/drop remain G3.4–G3.5.

Every command rechecks current access/state in its transaction. Unknown connection loss disables mutations while retaining in-memory reading; reconnect refreshes authoritative state. Sharing lifecycle state and history survive restart, but remain outside session/Writing archives. No database migration or reset is needed beyond G3.2's V25.

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
