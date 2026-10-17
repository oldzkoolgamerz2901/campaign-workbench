# Campaign Workbench — Architecture and implementation plan

Date: 2026-10-17

## Status and scope

The owner revised the architectural direction during stack discussion: Angular frontend and local Kotlin/Spring backend in a separate application monorepo, hexagonal architecture and DDD, independent Markdown campaign directories, and database-owned application state. Multiple campaigns can be registered, with one selected at a time. Laptop preparation and play come first; tablet support is deferred.

**The browser-local architecture and first increment preserved below are superseded and must not be implemented.** React, Dexie, snapshot upload, a TypeScript backend, campaign-specific packaging, and service-worker offline startup are not current selections. Setup increment 0, increment 1, and the increment 2 architecture are accepted below; increment 2 implementation planning remains proposed. The historical browser-local increment 1 remains superseded.

## Current accepted direction

- Application name: **Campaign Workbench**. Repository: `campaign-workbench`, at `/Users/huibvanstraten/campaign-workbench/`, with `frontend/`, `backend/`, `docs/`, and root `compose.yaml`. Setup increment 0 establishes this repository and transfers application documents; Sea Witch content stays in its existing repository.
- Run the backend locally and use an Angular interface on the laptop. Hosted deployment is not required initially.
- During development, run the Angular dev server and Spring Boot separately, with PostgreSQL through Docker Compose. For session use, serve the built Angular assets from Spring Boot and provide one launcher to start the required application and database services. Frontend and backend remain separate source projects. Exact launcher implementation and local runtime packaging remain to be designed; no Angular dev server is required during session use.
- Keep frontend and backend in one application repository, separate from all campaign repositories. The Sea Witch repository remains campaign content. This application repository owns the transferred design records; application setup must not rewrite campaign content.
- Read the selected campaign directory through a filesystem adapter and detect Markdown changes. Preserve prepared versions until explicit acceptance of updates.
- Keep Markdown as campaign-content authority. Persist classifications, relationships, drafts, sessions, discoveries, outcomes, and immutable prepared snapshots in the database. Derived indexes can be rebuilt.
- Register independent campaigns and work with one selected campaign at a time. Use configurable campaign conventions rather than Sea Witch-specific paths, lore, or mechanics.
- Keep domain and application logic independent of Angular, Spring, filesystem APIs, database mapping, and AI providers through ports and adapters.
- Use idiomatic Kotlin with a functional style: prefer immutable values and pure domain functions returning new state; represent meaningful states and expected business failures with sealed types. Application services coordinate side effects through ports; adapters perform filesystem, database, and AI operations. Permit controlled mutation in JPA entities and infrastructure where appropriate. Arrow is selected by the owner, superseding the earlier decision to defer it. The selected Arrow conventions follow below; additional Arrow libraries are not selected, and compatible versions remain to be agreed.
- Use `arrow-core`, with `Either<Error, Value>` at application and module boundaries, the Raise DSL inside implementations, and sealed error types for expected business failures. Handle unexpected infrastructure exceptions separately. Define and test rollback behavior explicitly: returning `Either.Left` must not commit partial writes. Compatible Arrow/Kotlin versions and the concrete transaction integration remain to be designed.
- Use one modular Spring Boot backend with Spring Modulith, in one Gradle project using Kotlin DSL. Organize domain modules as packages and verify boundaries in developer checks. Separate Gradle subprojects per domain module are deferred; exact domain boundaries remain to be agreed. The Angular workspace resides separately under `frontend/`, with the backend under `backend/` in the application monorepo.
- Use one Angular application organized by feature, initially campaigns, preparation, and play. Separate API access from presentation components. Use feature-scoped services with Angular Signals for state and derived values, and RxJS for asynchronous flows. Keep the backend authoritative for saved records; frontend state owns working edits, selections, loading, and errors. Requests retain their originating campaign/session identity. Nx, separate frontend libraries, and NgRx are deferred. Exact Angular tooling remains to be discussed.
- Use REST/JSON with OpenAPI generated from Spring controllers through springdoc, and generate the Angular client from that contract. Keep transport DTOs separate from domain models and JPA entities. Feature services wrap the generated client; presentation components do not own transport concerns. Generator configuration, error conventions, and compatibility checks remain to be designed.
- Map typed application failures to HTTP Problem Details in the web adapter. Include stable error codes, safe explanations, and field errors where relevant; use `409 Conflict` for stale version updates, with `draft.version-conflict` as an example code. Keep Arrow types inside Kotlin and expose documented error DTOs to Angular. Unexpected failures return a generic message and correlation ID. Exact error catalogue and OpenAPI response schemas remain to be defined.
- Start with Angular Material and CDK for standard controls and interaction primitives, with custom reading, preparation, and play layouts. Exact theme, typography, and component layout remain design work; this selection does not establish a finished visual design.
- Edit session drafts as Markdown source with a rendered preview. Drafts remain database-backed; this editor does not grant permission to modify campaign files. CodeMirror is the recommended editor component; exact editor and renderer integration remain to be finalized. A visual rich-text editor is not selected initially.
- Run local PostgreSQL through Docker Compose with persistent database storage. Use Testcontainers with PostgreSQL for database integration tests, exercising Flyway migrations and JPA mappings against the selected PostgreSQL version. Domain unit tests do not need containers. Backend/frontend runtime packaging, exact versions, and test lifecycle configuration remain undecided.
- Use one PostgreSQL database with a schema per domain module. Each module owns its tables, JPA mappings, and migrations; other modules use its public interface rather than directly querying its tables. Campaigns share module tables with campaign-scoped records, rather than receiving a database or schema each. Exact schema names follow agreed module boundaries; migration ordering and cross-module integrity rules remain to be designed.
- Use Kotest as the primary backend test framework, including integration tests where supported. Use JUnit Jupiter as a fallback for demonstrated Kotest integration or tooling limitations, such as a Spring/Modulith test facility that cannot be supported reliably in the selected Kotest setup. Record the reason for exceptions; ordinary assertion failures or application defects are not a reason to bypass a failing test by changing frameworks. Exact versions and Spring/Testcontainers lifecycle integration remain to be validated.
- Use Vitest with Angular TestBed for frontend component and service behavior, and Playwright for key end-to-end flows through Angular, Spring, and PostgreSQL. Keep end-to-end state isolated from the DM's real database and campaign records. Exact versions, browser targets, and test orchestration remain to be designed.
- Preserve explicit draft approval, manual canon export, privacy exclusions, and controlled player output from the product specification.
- Keep AI credentials and spending controls in backend responsibilities. A separately deployed gateway is no longer prescribed. Provider and budget decisions remain unresolved.

### Ownership and domain boundaries

A campaign identifies an independent body of campaign content. A playthrough records what happened when that content was played. Prepared sessions refer to source versions and belong to the applicable campaign/playthrough context. Registering multiple campaigns does not imply support for multiple simultaneous playthroughs of each campaign.

Campaign ownership does not require a single large aggregate. Aggregate boundaries and consistency rules remain design work. Campaigns and Sources are accepted as separate modules:

- **Campaigns** owns campaign identity, registered directory, and campaign configuration.
- **Sources** owns document discovery, versions, authority classifications, references, and search. It references a campaign by identity and exposes versioned content through its public API.

- **Preparation** owns session objectives, prepared scenes, ordering, drafts, approvals, pinned source versions, and the session lifecycle.
- **Playthroughs** owns actual events: notes, encountered clues, revelations, theories, and outcomes. It references session identities without depending on Preparation's implementation. Preparation may read prior discoveries through the Playthroughs API; Playthroughs must not introduce a reverse dependency on Preparation. Exact session-reference validation and lifecycle coordination remain use-case design work.

- **Assistance** owns provider integration, generation execution, usage, and spending controls. Preparation selects permitted context and requests generation through the Assistance API; Assistance receives explicit context rather than independently querying campaign files or private notes. It returns a result without accessing Preparation tables. Preparation owns the resulting session draft and its approval, keeping this dependency one-way.

The initial accepted module split is Campaigns, Sources, Preparation, Playthroughs, and Assistance. Keep player-facing output within Preparation initially: it owns explicitly selected, versioned handouts, preview, and export approval. Rendering and file export live in adapters; selection and approval remain application/domain behavior. Player output contains only the selected content. A separate Publishing module is deferred until a player portal or distribution workflows justify it.

Use the following package layout inside each module: `api` for public module interfaces and contracts, `domain` for aggregates, values, rules, and typed errors, `application` for use cases and outbound ports, and `adapter` subpackages for web, persistence, and other integrations where needed. Explicitly expose `api` as a Modulith named interface; other module packages remain internal. Dependencies point inward and domain code has no Spring, JPA, or HTTP dependencies. Avoid creating empty adapter categories for modules that do not need them.

Run Modulith verification and complementary ArchUnit checks in the normal backend test task, using Kotest where practical and the agreed JUnit fallback policy where needed. Modulith verifies exposed module access and dependency cycles. ArchUnit enforces inward dependencies, excludes Spring/JPA/HTTP concerns from domain packages, and prevents application code from depending on concrete adapters. Exact executable rules and necessary composition-root exceptions remain to be specified against the implemented package structure.

Scope source reads, search, persistence operations, and AI context by campaign identity. Asynchronous saves and generations must retain their originating campaign/session context when the user switches campaigns. Never use a mutable UI selection as the destination for a completed operation.

Use synchronous public module interfaces when a caller needs an immediate result, and domain events for follow-up reactions that can happen afterward. Keep entities and repositories private to their owning modules. This choice does not make all events asynchronous or select a broker, durable delivery mechanism, or transaction propagation policy; those details remain to be designed where a use case requires them.

Place database transaction boundaries around application use cases, keeping domain functions independent of Spring. For example, approval loads a draft, applies its domain decision, and persists the approved version within one transaction. Perform AI calls and filesystem scans outside database transactions; persist their results in short transactions. Use version checks to reject stale updates rather than overwrite newer edits. Exact locking, event delivery, and cross-module transaction behavior must be specified for the affected use case; database transactions do not make filesystem or provider operations atomic.

### Consequences and proposals still to discuss

- Database: PostgreSQL and Spring Data JPA are accepted by the owner. Its relational model fits campaign ownership, source versions, sessions, approvals, and discoveries; variable draft content alone does not justify MongoDB while authoritative Markdown remains on disk. Keep JPA entities and Spring Data repositories in persistence adapters, with separate Kotlin domain models and explicit mapping. Cross-module references use identifiers and public module interfaces rather than shared JPA entity relationships. Use Flyway with versioned SQL migrations and Hibernate schema validation, not automatic schema updates. Schema design and exact PostgreSQL version remain undecided; local provisioning uses Docker Compose.
- Backend shape: a modular monolith using Spring Modulith and one Gradle Kotlin DSL backend project is accepted, with five domain modules and the package structure defined above. Modulith and ArchUnit checks enforce module and hexagonal dependencies; concrete rules remain implementation design work.
- Source changes: scan when a campaign opens, watch its folder while active, group rapid changes before processing, and compare content hashes to identify changed versions. Provide a manual rescan. Configure included/excluded paths per campaign, excluding hidden and tooling directories by default. Changes update the source library while prepared sessions retain pinned versions until explicitly updated. Missing or unreadable files produce a visible status and preserve existing snapshots. Symlink handling, exact exclusion defaults, watch recovery, and directory relocation remain design details.
- Offline play now means local backend/database operation without internet. Browser-only cold startup on an independent device is deferred with tablet support.
- Backup must cover database state and campaign sources. The prior browser-workspace restore proposal is not automatically applicable to database restoration. AI expenditure must not reset through an ordinary application restore.
- Start with local-only access; network exposure for a tablet, authentication, and connection security require later design and authorization.
- The accepted version baseline is recorded below and in `versions.toml`; compatibility checks, detailed API conventions, and launcher implementation remain outstanding. Development and session-use startup modes are accepted above. REST/JSON, springdoc-generated OpenAPI, and a generated Angular client are accepted. Flyway, Testcontainers, Kotest with JUnit Jupiter fallback, Vitest with Angular TestBed, and Playwright are selected; migration organization and test orchestration remain to be designed.
- The application repository name/location is agreed above. Application design documents and the version catalog are intended for the new repository; setup increment 0 defines migration scope, link updates, and the pointer retained in Sea Witch.

### Supersession rationale

The earlier plan optimized for tablet-browser access and assumed a Sea Witch-specific application. The owner prioritizes laptop operation, their Angular/Kotlin/Spring stack, direct repository access, and generic campaign support. The new direction avoids snapshot-upload administration and separates reusable application development from campaign authorship. Trade-offs include operating a local backend/database and providing an explicit backup/launch workflow.

## Increment 1 — Accepted searchable-library architecture

Status: The owner accepted the following architecture on 2026-10-17 after approving the increment 1 requirements in the product specification. The implementation plan for this increment still requires approval; this section does not authorize implementation. The historical browser-local increment 1 below remains superseded.

### Ownership and persistence

- Campaigns owns campaign identity, display name, registered directory, source inclusion/exclusion configuration, and remembered campaign selection. Sources obtains campaign configuration through Campaigns' public API; the dependency is Sources → Campaigns. No reverse module dependency or shared JPA entities are introduced.
- Sources owns discovery, captured document content, sections, and search. PostgreSQL stores one current successful capture per campaign in Sources-owned tables. Refresh replaces that capture atomically; historical captures are not retained. Markdown remains authoritative and is never rewritten.
- Persisting captured text duplicates source content as a replaceable read model, but lets consistent reading and search survive backend restart. An in-memory-only capture was considered and rejected because it would require rebuilding before that content became available again.
- Existing module package, schema ownership, inward dependency, generated-client, typed-error, and transaction conventions continue to apply. Only Campaigns and Sources receive domain behavior in this increment.

### Refresh and consistency

- Opening a campaign or explicitly refreshing starts a filesystem scan outside a database transaction. Publish the complete result in a short database transaction. Filesystem reads are not made atomic by that transaction.
- An unreadable included document or a detected change that prevents a reliable read fails the refresh. Preserve the complete previous capture and expose the failure. Before the first successful refresh, show an empty library with the failure rather than claiming success. Publishing a partially readable library was rejected because it could silently omit content.
- A file removed before discovery is absent from the new successful capture. A file disappearing during its read fails that refresh. This policy provides a consistent captured library, not a guarantee that all files describe the same filesystem-wide instant.
- Give each published capture an identifier. Document lists, reads, search results, and local link navigation retain the originating campaign and capture identity. If a referenced capture has been replaced, report that explicitly and have the UI reload; never silently open newer text for an old search result.
- Permit one refresh at a time per campaign and reject overlapping requests. Different campaigns remain independent.
- Save configuration changes independently, mark the existing capture as needing refresh, and retain it until a refresh succeeds. Completion must not mark a capture current for configuration that changed while its scan was running.

### Discovery, search, and interface

- Use campaign-relative glob patterns for included/excluded paths, with exclusions taking precedence. Default to all Markdown while excluding hidden/tooling directories and agent instructions. Show effective rules. Do not follow symlinks. Exact default names and supported glob grammar must be specified before implementation.
- Search uses the trimmed query as a literal, case-insensitive substring across captured paths, headings, and section text. No stemming, fuzzy matching, query language, or separate search engine is selected. Revisit indexing only if measured behavior warrants it.
- Feature services wrap the generated Angular client. Signals own selection and view state; asynchronous requests retain their originating campaign/capture identity, including when selection changes.
- Use a campaign selector, document navigation/search panel, and reading pane, with refresh status and errors visible alongside the library. Safely render the accepted Markdown elements and resolve links against the same campaign capture. Exact parser/renderer dependencies and browser support remain to be settled before affected implementation.

### Consequences and limits

Old references may require reloading after refresh because only one capture is retained. One unreadable included file blocks publication until corrected or excluded. Remembered selection does not replace explicit campaign identity on individual operations. Automatic watching and retained versions remain future work under the broader architecture; they are excluded from increment 1. This architecture delivers no preparation, play, assistance, assets, backup/restore, or session-use launcher.

### Approved implementation plan

The owner approved this bounded plan on 2026-10-17. Implement Campaigns registration/configuration/remembered selection; Sources discovery, atomic current captures, refresh coordination and configuration-version checks, sections, literal search, and capture-bound reading; and an Angular library with registration/configuration, campaign selection, navigation/search, reading, and visible refresh errors. Update generated-client integration, owned-schema migrations, exact dependency pins, isolated fixtures, README, and developer evidence. This is the current increment 1 plan; the historical plan below remains superseded.

Filters match normalized campaign-relative paths: `*` and `?` stay within a segment; `**` spans directories, and `**/*.md` includes root documents. Exclusions win. Reject absolute paths, traversal, and unsupported grammar. Default to case-insensitive `.md` discovery, excluding hidden segments, `node_modules`, `build`, `dist`, `target`, `coverage`, and `AGENTS.md`/`CLAUDE.md`. Show editable defaults.

Use `org.commonmark:commonmark:0.30.0` and `commonmark-ext-gfm-tables:0.30.0` in a Sources adapter, with source positions for sections and controlled HTML rendering. Escape raw HTML, suppress images, validate links, retain Angular's default HTML sanitization without trust bypasses, and require explicit clicks for external links. [Tagged documentation](https://github.com/commonmark/commonmark-java/blob/commonmark-parent-0.30.0/README.md) and [release](https://github.com/commonmark/commonmark-java/releases/tag/commonmark-parent-0.30.0) establish available features; repository compatibility must be checked during implementation. Flexmark's broader syntax support was considered unnecessary. Chromium from the pinned Playwright version is the acceptance target; Safari/WebKit support is deferred.

Expected areas: `backend/src/main/{kotlin,java}/workbench/{campaigns,sources}/`, module-owned SQL migrations, backend tests, `frontend/src/app/campaigns/`, root application integration, frontend tests and e2e fixtures, build/catalog pins, existing check scripts, README, and developer evidence here. No campaign-content, harness, deployment, commit, or remote changes are included.

Completion requires restart persistence, two-campaign isolation and late-response handling, filters and symlink checks, exact passage navigation (including repeated headings), safe rendering and links, failed-refresh preservation, stale-capture handling, overlapping refresh/configuration races, rollback including `Either.Left`, and unchanged source files. Backend tests/build, frontend tests/build/version checks, and isolated Chromium e2e flows must pass. Formal verification is separately authorized. Automatic watching, history, authority assignments, assets, preparation, play, AI, backup/restore, and session-use packaging remain excluded.

### Developer-check evidence — increment 1

Implementation and developer checks completed on 2026-10-17 using the existing runtime baseline. This is not formal verification or owner acceptance of the completed increment.

- `./scripts/check-setup.sh`: passed for the current implementation. Backend `test bootJar` passed with 9 Kotest tests (2 architecture, 5 library behavior, 1 library integration, 1 setup integration). Frontend Vitest/TestBed passed 7 tests, the production build passed, version drift checks passed, and both Chromium Playwright flows passed. PostgreSQL setup state survived Compose restart; smoke services were stopped afterward.
- Real PostgreSQL/Testcontainers checks exercised Campaigns/Sources migrations and JPA mappings, persistence across backend restart, remembered selection, duplicate/unavailable registration, campaign isolation, old-capture rejection, and configuration requiring refresh. Actual campaign writes and capture replacement were rolled back on `Either.Left`; unexpected exceptions also rolled back. Expected failures use sealed types, mapped to documented Problem Details in web adapters.
- Behavior checks exercised recursive inclusion/exclusion, default exclusions, symlinks, invalid UTF-8 with an identified failed document, repeated headings, table rendering, escaped executable markup, omitted images, encoded-space local links, missing targets, case-insensitive search, scan failure preservation, overlapping refresh rejection, and configuration changes during scans.
- Frontend checks exercised late reading/search responses after campaign switching, search response ordering, pending configuration after refresh races, and registration racing with startup selection restoration. Browser coverage exercised registration, source browsing, search focusing the exact block under repeated headings, local/missing links, tables, no remote-image requests or script execution, explicit refresh, source rules, isolation, and selection restored on browser reload. Fixture-source contents were checked; independent campaign repositories were not used or modified.
- Spring-generated OpenAPI, including explicit required fields and the Problem Details error shape, generated the Angular client consumed by the passing compilation/browser checks. Commonmark core and tables 0.30.0 resolved and compiled with the selected Kotlin/JDK baseline. Modulith checked the introduced module boundaries; ArchUnit checked inward dependencies and excluded Spring/JPA/filesystem/network/parser dependencies from domain packages.
- Corrected the pre-existing setup integration test to pass its Testcontainers connection as command-line properties: its former low-priority Spring defaults were overridden by application configuration and attempted the development database port when checks ran independently.

Implementation details: captures persist raw text and rederive sections/rendering/search text through one Commonmark adapter on access; no separately persisted search index was needed. The operational platform package now also supplies cross-cutting failure/transaction/web support, not a sixth domain module. Registration/configuration revisions and pessimistic campaign-row locking coordinate short publication transactions; a per-campaign application lock excludes overlapping scans in the single local backend.

Limits: Chromium automation only; no Safari/WebKit or full manual accessibility/visual review. Captures do not guarantee a filesystem-wide instant, historical versions are not retained, and large-library performance has not been benchmarked. Backup/restore and session-use packaging remain deferred. No formal verification record, commit, deployment, or later increment was produced.

## Development startup — accepted design and implementation scope

The owner accepted the development-startup requirements and design on 2026-10-17. Add a dedicated Gradle `dev` task and a small development-only JVM launcher, outside application modules and the production artifact. It loads local `.env`, starts the existing Compose database, waits for readiness, starts Spring, generates the Angular client from live OpenAPI with the existing generator/configuration, and starts Angular. It owns its child processes and cleans them up on normal stop, cancellation, or startup failure; PostgreSQL remains running. Existing `bootRun`, build, and test behavior remains unchanged. A shared IntelliJ Gradle run configuration points at `dev`.

A separate launcher process keeps lifecycle code outside the Gradle daemon and application domain modules, without adding plugins/dependencies. Reuse the selected JDK, Compose definition, frontend npm script, and OpenAPI generator. No Docker Desktop launch, automatic runtime installation, production packaging, campaign-content changes, or application feature changes are included.

Bounded scope: `backend/build.gradle.kts`, a development source set/launcher, `.run/` Gradle configuration, startup developer checks, README, and evidence here. Check successful startup/proxied connectivity, readiness ordering, occupied-port and configuration failures, process cleanup on cancellation/failure, retained PostgreSQL state, and absence of startup side effects during ordinary Gradle tasks. GUI Stop behavior must not be claimed tested solely from documentation.

### Developer-check evidence — development startup

Implemented on 2026-10-17. `dev` is a JavaExec task using a development-only source set and the selected JDK. The launcher uses the existing Compose definition, packaged backend, OpenAPI generator dependency, and `npm start`. It parses `.env` as data, with process/run-configuration variables taking precedence; no shell evaluation or secret printing is used. The shared `.run/Campaign Workbench.run.xml` targets the backend Gradle project's `dev` task. Ordinary `bootRun` and the existing backend-only script remain unchanged.

- `cd backend && ./gradlew checkDevStartup --console=plain`: passed. The opt-in check uses the installed Gradle Tooling API (the cancellation mechanism used by IntelliJ) and the separate `campaign-workbench-startup-check` Compose project, retained test-only volume, and database port 55433. It exercised occupied-port rejection without terminating the unrelated listener, two successful real stack launches and proxied status requests, cancellation, released server ports, immediate relaunch, unchanged PostgreSQL installation state across stops/relaunches, and a deliberately failed generator after Spring startup that cleaned up Spring. The check stopped its isolated database afterward.
- Readiness probes use HTTP/1.1 and bounded response waits. Port preflight permits normal TIME_WAIT reuse so a stopped stack can restart immediately. Child-process ownership and descendant cleanup cover normal shutdown and failure; PostgreSQL is deliberately left running by the launcher.
- `./gradlew test bootJar --console=plain`: succeeded with all tasks up-to-date from the passing increment 1 checks. Its graph included neither development launcher nor startup-check execution, and started no development services. Production jar inspection confirmed that neither launcher nor lifecycle-check classes were packaged. Shared run-configuration XML parsed; `git diff --check` passed.

Limits: cancellation was exercised through the real Gradle Tooling API, not by manually clicking IntelliJ's GUI. Force-killing the launcher JVM or machine power loss cannot run its shutdown hook. Docker Desktop and installed Java/Node/npm/frontend dependencies remain prerequisites; runtime installation and session-use distribution are outside this change. Formal verification was not performed.

## Increment 2 — Accepted architecture and visual direction

The owner accepted manual session preparation, session export/import, and an atmospheric campaign-desk direction across the shell, source library, and preparation workspace; the detailed requirements are in the product specification. Architecture/design and three disposable UI variants using sample data were explicitly authorized. The owner selected A (writing desk) for preparation and B (session folio) for reading the same prepared session. No production implementation plan has been accepted.

The [disposable study](../frontend/src/app/preparation/prototype/README.md) compares A (writing desk: persistent outline and reading/notes), B (session folio: source and notes on facing pages), and C (scene board: ordered material with an inspector). It is hosted on the existing root behind `?prototype=preparation&variant=A|B|C`, with one floating switcher. Shared sample state is in memory and refresh resets it. No campaign content or application API/database is used by the study. The normal root view remains available. A production file replacement supplies a no-op loader, excluding the study bundle and switcher from production output.

Design-review checks on 2026-10-17: Angular development and production builds passed; the existing 7 frontend tests passed. Chromium review captured all three variants at 1440px and the board at 1280px, with no horizontal overflow, page errors, or API requests. Sample additions, retained edits during simulated save failure, retry, variant switching, and editor arrow-key behavior were exercised. Production JavaScript inspection found no sample session/variant labels or prototype bundle. Angular still reports component-style budget warnings for the disposable variants during compilation; production budgets were not relaxed. Preview rendering supports sample headings/bullets only; autosave and export/import are simulated, not implemented product features.

Accepted visual decision: retain A's persistent outline and editing workspace for preparation, and B's facing source/notes pages for reading. Both modes share saved session identity/data and the atmospheric visual system. Reading during a session remains a view of preparation, without journals, outcomes, discoveries, or lifecycle transitions. C is not selected for production.

The owner subsequently approved the production architecture below and authorized planning. The prototypes remain disposable references; production implementation requires approval of the specific plan. No prototype commit, branch, or formal verification record was created.

### Accepted production architecture

Status: Accepted by the owner on 2026-10-17. Typed Markdown cards and their dedicated library sections are deferred to [increment 3](increment-3-typed-markdown-cards.md); they do not block this increment. The implementation plan below is accepted.

- **Preparation ownership:** introduce the accepted Preparation module and its own PostgreSQL schema. It owns sessions, ordered prepared items, preparation notes, and immutable prepared snapshots. Keep domain models independent of persistence and transport DTOs. Campaigns owns campaign identity/configuration; Sources owns source discovery and current source captures. Preparation uses their public interfaces, with no reverse dependency or cross-module repository access.
- **Source selection:** Sources supplies exact captured Markdown and provenance through a public interface. A selected heading includes descendants until the next equal/higher heading. Preparation stores the selected text with each item. Source path, capture identity, selected section identity, and content fingerprints are provenance, not a live dependency on files or mutable source content. Selecting from a replaced capture fails explicitly; nothing silently switches to newer text.
- **Preservation trade-off:** copying selected text into Preparation duplicates content but makes sessions portable and independent of the replaceable current library. Retaining all historical library captures was considered unnecessary for this slice. This prepared snapshot is distinct from a campaign domain entity or a general source-history feature.
- **Two views:** A's writing desk provides editing and organization; B's folio displays the same captured material and notes with a clear return to preparation. Both share session identity, item order, selection, and working state. Mode changes preserve working edits. Reading does not introduce journal records or lifecycle transitions.
- **Saving:** serialize autosaves per session and reject stale writes with revision checks. Keep expected failures typed and use the established Problem Details mapping. Failed saves preserve working edits; leaving a session requires retry or explicit discard. Application transactions are short and must roll back on expected failure, including `Either.Left`. Requests retain their originating campaign/session identity.
- **Portable sessions:** versioned JSON contains only selected sessions, their objective, order, captured material, notes, and provenance. Validate the whole import before atomically creating new sessions with fresh identities under the explicitly selected registered campaign. Never overwrite existing sessions, register directories, or load extra campaign files as a side effect of import.
- **Captured links:** resolve links within captured selected material. In reading mode, identify targets outside that material as unavailable rather than substituting current library content. Preserve the existing explicit-action HTTP(S) link and safe Markdown/media policies.
- **Existing stack:** continue Angular Material/CDK, feature services with Signals/RxJS, Spring-generated OpenAPI and generated client, Kotlin/Arrow, JPA/Flyway, Kotest/Testcontainers, and the established developer-check approach. No new infrastructure or domain modules beyond Preparation are selected. User content remains escaped/sanitized and external images are not fetched.

### Accepted implementation plan — increment 2

Status: Accepted by the owner on 2026-10-17. These work packages form one implementation increment.

| Work package | Expected components | Completion criteria and focused developer checks |
| --- | --- | --- |
| 1. Exact source selection | Sources public API, application selection use case/port, existing Commonmark adapter and DTOs | Return exact Markdown and provenance for whole documents or heading subtrees. Preserve current section/search locators. Check repeated/nested headings, pre-heading text, end-of-document boundaries, and stale-capture rejection. |
| 2. Durable preparation | New `workbench.preparation` API/domain/application/adapters, named API interface, Preparation-owned SQL migration and JPA mappings | Create/list/open sessions; save title/objective and both levels of notes; add/remove/reorder items with stable item identities. Frozen text is immutable through note saves. Scope every operation by campaign/session. Test real PostgreSQL persistence/restart, isolation, revision conflicts, and rollback after actual partial writes. |
| 3. Safe Markdown reading/preview | Preparation rendering adapter using the existing pinned Commonmark core/tables, rendering DTOs and link resolution | Render captured source and Markdown notes with the existing HTML/URL/media restrictions. Source provenance remains visible. Links inside captured content work; uncaptured targets are explicit. Test source removal/refresh, duplicate anchors, malicious Markdown, and no automatic remote fetches. |
| 4. Session export/import | Preparation application use cases and JSON transport/file adapters | Export the last successfully saved selected sessions. Validate archive schema/content/limits before one import transaction; create fresh session/item identities under the chosen campaign. Test round trips without original sources, repeat imports, malformed/unsupported archives, preserved order/provenance/notes, limits, and no partial imports or overwrites. |
| 5. Shared shell and working state | Angular shell/routing, required campaign-selection integration, `frontend/src/app/preparation/` feature services, generated-client wrappers | Session/campaign routes and requests retain explicit identities. Share one working session between modes; serialize saves and guard navigation. Test slow/late saves, edits during a save, failed saves and retry, stale revisions, switching campaigns/sessions, and failed-save navigation. |
| 6. Production preparation and reading UI | Production components/styles based on A/B, existing library integration, Material/CDK controls | Create/reopen sessions, add whole documents/sections from library/search, reorder/remove items, edit/preview notes, and switch Prepare/Read without losing state. Apply atmospheric tokens to shell/library/preparation. Check keyboard focus, reorder buttons, long documents, empty/error states, readable contrast, and laptop layouts at 1280×800 and 1440×900. |
| 7. Integration and handover | Backend/frontend tests, isolated Playwright fixtures, existing check script if needed, README and developer evidence here | Generate the real client; pass backend tests/build, frontend tests/version checks/build, and isolated Chromium end-to-end preparation/export/import/read flows. Preserve increment 1 library behavior and existing development startup. Record limitations and stop before formal verification. |

#### Bounded implementation details

- Use one session revision to coordinate title/objective, order, notes, and item mutations. Every mutation checks it; the frontend queue coalesces edits while preserving newer working text when an older save completes. A conflict retains local edits and offers explicit reload/discard/retry handling rather than an automatic overwrite. Source capture selection and adding its frozen text use one application transaction through public module interfaces, without filesystem reads.
- Start with a 500 ms debounce for text edits and serialized item mutations; only a completed server save advances the saved revision/status. Export waits for pending edits to save, or blocks with a visible error; unsaved local text must not be presented as a complete saved backup. Mode switches reuse working state. Campaign/session navigation offers Stay/Retry or an explicit Discard; browser close uses the available unsaved-change warning. Forced browser termination is not claimed recoverable without a successful save.
- For this slice, use a native textarea with a real Commonmark-rendered preview. CodeMirror remains a previously recommended enhancement, not an installed dependency; it adds no demonstrated need for the initial Markdown notes workflow. Retain the established source/preview contract so a richer editor can be added later. Do not introduce a custom production Markdown parser.
- Export/import schema version 1 is self-contained UTF-8 JSON. Initial limits: 20 MiB per archive, 100 sessions, 1,000 prepared items total, and 2 MiB per individual captured-text/note field. Validate required field types, identifiers/order consistency, declared provenance/content fingerprints where present, and supported schema before writes. Import maps all session/item identities to fresh values; original campaign references are descriptive provenance, never operation destinations. No binary assets, credentials, unselected campaign documents, or automatic fetching are included.
- Reuse the current session library and generated API tooling. Add only the Sources API needed for exact content selection; do not add typed-card metadata fields, required templates, type registries, filtering, authority assignment, or a generic extension framework. Independent campaign repositories remain outside edit scope.
- Rebuild A/B as production components; the existing prototype state, simulated saves, sample content, and limited preview renderer are not production logic. Keep the disposable study excluded from production. Prototype branch/commit preservation or deletion is a separate owner decision; no Git history changes are included here.

#### Expected file scope

Backend: `src/main/{kotlin,java}/workbench/preparation/`, the affected Sources API/application/Markdown adapter, one new Preparation-owned migration under `src/main/resources/db/migration/`, and focused domain/integration/architecture tests. Frontend: production files under `src/app/preparation/`, `app.*`, shared shell/styles and campaign library files needed for selection/visual integration, and component/service/e2e tests. The client remains generated and ignored. Build/manifest/catalog/lockfile changes are unnecessary unless an approved dependency need emerges. Documentation: README, accepted requirement refinements where necessary, and developer evidence in this plan. Startup scripts change only if needed for these checks; no launcher redesign, deployment, campaign migration, or commit is included.

#### Required evidence and remaining limits

A representative isolated flow creates two campaigns, prepares a session with a whole document and nested section, orders items, edits both note levels, reopens after restart, modifies/removes and refreshes the sources, reads the original prepared material in B, exports/imports as a new session, and confirms isolation and unchanged campaign files. Failure checks cover actual transaction rollback, stale revisions/captures, save queues and navigation, invalid archives, and safe rendering. Existing library and startup checks remain applicable; broaden checks only when changes/failures justify it.

Chromium is the agreed acceptance browser. Reading is a view of preparation, not the full play workflow. Session archives protect selected sessions only. General history, authority classification, metadata/tags/filtering/type sections, AI, journals, player output, lifecycle states, assets, full-system backup, tablet delivery, and session-use packaging remain deferred. [Increment 3](increment-3-typed-markdown-cards.md) records the future typed-card direction without authorizing it.

### Increment 2 developer implementation evidence — 2026-10-17

Implementation of the accepted increment is complete. This is developer-check evidence, not formal verification or owner acceptance.

- Added Preparation with separate API, pure domain, application ports/services, web/Markdown/persistence adapters, and schema. Sources exposes exact whole-document/heading-subtree selection through its public API. Architecture checks verify module interfaces, cycles, and inward dependencies.
- Sessions retain ordered stable item identities, exact captured Markdown, provenance/fingerprints, original-to-captured anchor mappings, and both note levels. Source changes/deletion never rewrite prepared items. Note/order/removal saves cannot change snapshot text. Campaign locking and a session revision reject stale writes; expected failures roll back actual writes.
- Version 1 archives validate structure, scalar types, identities, supported version, sizes/counts, and fingerprints before atomic imports with fresh identities. Whole-document hashes must match their content. A partial selection retains its original document hash as descriptive provenance because the rest of the document is not archived. Export waits for pending saves; imports require an explicit destination campaign and preserve existing sessions.
- Angular routing retains campaign/session identities. Shared state implements 500 ms debouncing, coalesced serialized saves/source mutations, late-response protection, retry/conflict/discard handling, and browser-close warnings. Preparation and folio share working state. The existing library supplies whole-document/section selection, including from search. Shell/library/preparation share dark green surfaces and warm accents.
- Commonmark renders source and note previews with tables, escaped HTML, omitted images, and explicit HTTP(S) actions. Captured links resolve only against frozen campaign/capture/path/anchor metadata in the session. Original duplicate anchors survive section selection and import. Structured heading metadata supports focused navigation without bypassing Angular sanitization.
- `./scripts/check-setup.sh`: passed with **12 backend tests**, **15 frontend tests**, **4 Chromium end-to-end tests**, production builds, real Spring OpenAPI/client generation, version drift checks, and isolated PostgreSQL persistence across restart. Backend cases include nested/repeated headings, CRLF/pre-heading/EOF boundaries, stale captures/revisions, isolation, application restart, actual partial-write/multi-session-import rollback, archive limits/tampering, and preserved order/notes/provenance. Frontend cases include newer edits during slow saves/source mutations, failures/retry, stale revisions, explicit discard, and late loads/create/import responses after campaign changes.
- Chromium flows cover the existing library, preparation with both note levels, response-confirmed keyboard ordering, long documents/code lines, source replacement/removal, reload, folio, focused local/cross-item captured links, safe rendering/no remote image requests, export/import into another campaign, invalid imports without partial writes, and failed-save navigation/retry. Screenshots at **1280×800** (folio) and **1440×900** (preparation) were inspected; horizontal overflow checks passed. Keyboard controls and focused link targets were exercised. An exhaustive accessibility audit and additional browsers were not performed.
- Developer-check corrections: explicit JSON negotiation was needed for the generated client. The order/reload test waits for the actual save response rather than an old rendered status during Angular's update. Captured anchors use V5 because V4 had already been applied during development; applied migrations were preserved. No dependency, launcher, campaign-content, Git history, or harness changes were needed.
- Production output is approximately **424 kB** before transfer compression. Disposable prototype A/B/C styles retain their existing 4 kB budget warnings; sample code/data remain excluded from the production bundle through the loader replacement. Build limits were not relaxed. The existing development launcher was exercised to readiness; its separate cancellation/GUI check was not repeated for this feature.

Remaining limits match the approved scope: no forced-termination recovery before a successful save; session archives are not full-system backups; journals/lifecycle/AI/assets and increment 3 metadata/type/filtering features remain deferred. Formal verification requires separate authorization. No commit or deployment was made. Isolated check servers/containers were stopped; the existing development database remains separate.

## Version baseline proposal — 2026-10-17

Status: The owner accepted the proposed baseline, compatibility exceptions, and Boot-managed dependency policy, and requested TOML version storage. [versions.toml](versions.toml) is the machine-readable version reference, using Gradle version-catalog syntax. The table below records the dated rationale and sources. Flyway remains a candidate override pending validation, not an established compatible selection.

At baseline selection, these were release and documentation checks only; no dependencies had been installed. Setup developer evidence below now records the tested subset. The catalog accompanies these design records in the application repository. Gradle now imports the catalog, frontend versions are explicit in the npm manifest and lockfile, and scripts/check-versions.mjs checks drift; npm does not read Gradle catalogs directly. Runtime details and image digests are recorded in runtime-baseline.md and build configuration. Later additions must use exact versions rather than floating latest tags.

| Component | Proposed baseline | Evidence and qualification |
| --- | --- | --- |
| JDK | 25 LTS, current maintained vendor patch at implementation | [Java roadmap](https://www.oracle.com/java/technologies/java-se-support-roadmap.html); explicit exception to latest non-LTS Java 27, since [Boot 4.1.1 documents support only through Java 26](https://docs.spring.io/spring-boot/system-requirements.html) |
| Spring Boot | 4.1.1 | [Stable system requirements](https://docs.spring.io/spring-boot/system-requirements.html) |
| Spring Modulith | 2.1.1 | [Release notes](https://github.com/spring-projects/spring-modulith/releases/tag/2.1.1) explicitly upgrade to Boot 4.1.1 |
| Kotlin and compiler plugins | 2.4.21 | [Latest stable release](https://kotlinlang.org/docs/releases.html); align compiler, stdlib, reflect, and compiler plugins explicitly rather than accidentally mixing with Boot's managed Kotlin 2.3.21 |
| Gradle wrapper | 9.7.0 | Conservative documented compatibility choice: [Kotlin's table](https://kotlinlang.org/docs/gradle-configure-project.html) lists support through 9.7.0 for 2.4.20; confirm for 2.4.21. [Latest Gradle is 9.8.1](https://gradle.org/releases/), so this exception requires owner acceptance rather than being called latest |
| PostgreSQL | 18.6 | [Current stable version table](https://www.postgresql.org/support/versioning/); PostgreSQL 19 is still a release candidate. Match Compose and Testcontainers versions |
| Arrow Core | 2.2.3 | [Latest stable release](https://github.com/arrow-kt/arrow/releases/tag/2.2.3) |
| Kotest | 6.2.5 | [Latest stable release](https://github.com/kotest/kotest/releases/tag/v6.2.5); Spring extension, JUnit Platform, and container lifecycle compatibility still require validation |
| ArchUnit | 1.5.1 | [Latest stable release](https://github.com/TNG/ArchUnit/releases/tag/v1.5.1) |
| springdoc | 3.1.1 | [Latest release](https://github.com/springdoc/springdoc-openapi/releases/tag/v3.1.1); dependency alignment needs investigation because of the [reported Jackson version conflict](https://github.com/springdoc/springdoc-openapi/issues/3373) |
| OpenAPI Generator | 7.26.0 | [Latest stable release](https://github.com/OpenAPITools/openapi-generator/releases/tag/v7.26.0); validate generated Angular code against the selected Angular/TypeScript versions |
| Angular framework and CLI | 22.2.3 | [Framework release](https://github.com/angular/angular/releases/tag/v22.2.3), [CLI release](https://github.com/angular/angular-cli/releases/tag/v22.2.3) |
| Angular Material and CDK | 22.2.2 | [Latest components release](https://github.com/angular/components/releases/tag/v22.2.2); these packages need not match the framework patch number; verify published peer dependencies |
| TypeScript | 6.0.3 | [Angular 22.2.3 compiler manifest](https://raw.githubusercontent.com/angular/angular/v22.2.3/packages/compiler-cli/package.json) requires >=6.0 <6.1 and uses 6.0.3. [TypeScript 7.0.2 is latest](https://github.com/microsoft/TypeScript/releases/tag/v7.0.2) but outside that range |
| Node.js | 26.12.0 | [Latest Current stable release](https://nodejs.org/en/about/previous-releases), also previously observed locally; latest LTS is 24.22.0. Node 26 satisfies Angular's declared range |
| Vitest | 5.0.5 | [Latest stable release](https://github.com/vitest-dev/vitest/releases/tag/v5.0.5); [Angular build 22.2.3](https://raw.githubusercontent.com/angular/angular-cli/v22.2.3/packages/angular/build/package.json) permits Vitest 5. Match optional coverage package versions if used |
| Playwright | 1.64.1 | [Latest stable release](https://github.com/microsoft/playwright/releases/tag/v1.64.1); use its matching browser binaries |
| Testcontainers | 2.0.5 | [Latest stable release](https://github.com/testcontainers/testcontainers-java/releases/tag/2.0.5), also Boot-managed |
| Flyway | 13.10.3 candidate | [Latest stable release](https://github.com/flyway/flyway/releases/tag/flyway-13.10.3); Boot manages 12.4.0. Latest requires an explicit aligned override of core and PostgreSQL support and validation of Boot startup/migrations; do not assert compatibility before that check |

Prefer Boot-managed versions for Spring Data JPA, Hibernate, JDBC driver, Jackson, and the JUnit fallback rather than independently upgrading each. The [Boot dependency table](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html) currently lists Hibernate 7.4.5.Final, JUnit Jupiter 6.0.3, Testcontainers 2.0.5, Flyway 12.4.0, and Kotlin 2.3.21. The proposed latest Kotlin/Flyway versions are deliberate overrides requiring validation, not Boot defaults. This managed-dependency policy is a proposed qualification of the latest-stable request.

The vendor-specific JDK patch/build, npm version, Compose runtime version, RxJS pin, editor/parser artifacts, and remaining transitive packages are not fully enumerated here. Resolve and record them before their affected implementation work; do not claim this proposal is a complete lockfile.

Before relying on this baseline, validate Gradle/Kotlin/JDK compilation, Modulith verification, Kotest plus JUnit Platform, PostgreSQL migrations and JPA, OpenAPI generation, generated-client compilation, frontend tests, and build packaging. Resolve the springdoc/Jackson alignment issue without arbitrary transitive upgrades. Report conflicts to the owner instead of silently downgrading or enabling previews.


## Setup increment 0 — accepted plan

Establish the separate Campaign Workbench repository with `frontend/`, `backend/`, `docs/`, root Compose configuration, README, and ignore rules. Initialize local Git without commits, remotes, or publishing. Copy `.agents/skills/` and both workflow Markdown files unchanged, and adapt AGENTS.md for application ownership.

Transfer the product specification, this implementation plan (including superseded history), and versions.toml from Sea Witch after checking copies. Keep the historical assessment and all campaign content there. Update relative links and retain a Sea Witch pointer plus a narrowly scoped AGENTS.md correction. Preserve existing Sea Witch index entries.

Scaffold one Angular/Material application and one Kotlin/Spring Boot Gradle project using the accepted catalog. Pin npm dependencies and lockfile, Gradle wrapper, remaining runtime builds and PostgreSQL image. Use one operational connectivity API to validate springdoc OpenAPI generation and an Angular generated client. Establish Kotest, Modulith, ArchUnit, Testcontainers, Vitest/TestBed and a Playwright smoke flow. Use only an operational setup schema; implement no campaign or session behavior. Gradle imports docs/versions.toml; a script checks frontend and infrastructure version drift.

Completion requires builds and focused tests, PostgreSQL migration/JPA integration with isolated Testcontainers state, generated-client compilation, browser connectivity, Compose persistence across restart, document/link checks and unchanged Sea Witch campaign hashes/index. Report blocked checks explicitly. Compatibility conflicts require owner resolution rather than silent baseline changes. Formal verification is separate.

Excluded: campaign registration/scanning/search, preparation/play/AI, backup/restore, tablet delivery, session-use launcher/runtime packaging, hosted deployment, real campaign database records, commits and remotes. No subsequent increment is authorized by this plan.

The operational `platform` package is temporary setup infrastructure, not a sixth domain module. The five accepted domain modules will be introduced with real use cases; their unimplemented boundaries cannot yet be verified. No empty domain/adapters or speculative aggregates are created.

### Developer-check evidence

Setup developer checks completed on 2026-10-17 on macOS 26.6 arm64 with the runtime recorded in [runtime-baseline.md](runtime-baseline.md). This is implementation evidence, not formal verification.

- `./scripts/check-setup.sh`: passed. Backend `test bootJar` passed (three Kotest tests, including Modulith/ArchUnit and real PostgreSQL 18.6 Testcontainers integration); frontend Vitest/TestBed passed (two tests); Angular production build passed; Chromium Playwright connectivity passed (one test). PostgreSQL installation data survived Compose restart. Smoke backend/containers were stopped afterward; isolated test volume remains separate from development storage.
- Spring-generated OpenAPI was captured from the running backend, then OpenAPI Generator 7.26.0 generated the client used by Angular compilation and the real browser flow. The endpoint explicitly declares JSON; wildcard media types produced a Blob in the generated client during development and were corrected. Angular proxy configuration matches nested `/api/**` routes.
- `npm run check:versions`: passed. Catalog/frontend/lockfile, Node runtime, wrapper and Compose PostgreSQL versions agree. Gradle 9.7.0 compiles Kotlin 2.4.21 on JBR 25.0.3. Resolved stdlib and reflect are 2.4.21; Gradle's embedded Kotlin 2.4.0 is separate from the application compiler.
- `dependencyInsight` confirmed aligned Flyway core and PostgreSQL support 13.10.3. The initial migration and Hibernate validation of a test-only mapped entity passed. This exercises setup integration, not future domain migrations or rollback behavior.
- springdoc 3.1.1 and the basic JSON/OpenAPI flow worked without a manual Jackson override. Boot dependency management resolved Jackson 3.1.5 and Swagger's separate Jackson 2.21.5 dependencies. Wider DTO/error schemas still require checks when introduced. OpenAPI Generator warns that OpenAPI 3.1 support is beta; the exercised contract generated and compiled successfully.
- Copied `.agents/skills/` files and both workflow documents match Sea Witch byte-for-byte. Design documents preserve accepted decisions and superseded history, with location/status updates and this setup record. Local Markdown links were checked.
- Sea Witch campaign content hashes and existing Git index entries were checked before and after transfer. Only the approved application-document transfer, application pointer and AGENTS.md location guidance changed there. No commit or remote was created.

Limitations: only Chromium browser automation was exercised; Safari/WebKit, real-device compatibility, session-use packaging/offline play, backup/restore, business transactions including Either.Left rollback, five domain-module boundaries and campaign isolation are not implemented or verified by setup. Domain/application architecture rules allow empty selections until those packages exist; Modulith currently checks only the operational platform module. Kotest uses an explicit SpringApplicationBuilder lifecycle; its optional Spring extension was not selected. No JUnit fallback was needed. No claim of product requirement completion or full-stack general compatibility follows from these checks.

## Historical architecture and plan — superseded

Everything below this heading is retained solely as decision history. Proposed dependencies, file paths, completion criteria, and execution assumptions below do not define current scope or authorization. Useful invariant ideas such as pinned versions and explicit approval survive only as specified in the current requirements and direction above.

The recommendation supports two activities: preparing sessions with assisted creation and playing sessions with offline reference and manual recording. It preserves Markdown authority and separates campaign sources from playthrough records.

## Recommended shape

Use a browser application that stores campaign snapshots, prepared sessions, and playthrough records on the DM's chosen device. Cache the application itself for offline use. Use a small authenticated online gateway for explicit AI requests, provider credentials, and generation-budget accounting.

Propose TypeScript for browser and gateway code, keeping domain logic independent of UI and storage libraries. Framework, bundler, persistence wrapper, hosting service, and AI provider remain to be selected; selecting them should not change the ownership boundaries below. No library installation is authorized here.

### Alternatives and trade-offs

| Design | Advantages | Consequences | Recommendation |
| --- | --- | --- | --- |
| Browser with local records and an AI gateway | Laptop/tablet access; offline play; no campaign synchronization service | Browser storage needs backup; AI gateway needs authentication and persistent budget records | Recommended |
| Server owns campaign and session data | Central backup and easier later synchronization | Offline editing requires synchronization and conflict resolution; exceeds agreed initial scope | Defer |
| Desktop application with local filesystem access | Strong filesystem integration and local storage options | Does not meet tablet browser access without another client | Do not select initially |
| Browser calls AI provider directly | Fewer deployed components | Exposes credential handling to the client and makes independent spending enforcement difficult | Do not select for this design |

## Responsibilities and boundaries

| Component | Owns | Does not own |
| --- | --- | --- |
| Source library | Snapshot import, immutable document versions, sections, authority assignments, source conflicts, local search | Canon decisions or session outcomes |
| Session workspace | Prepared scene versions, ordering, drafts, approvals, lifecycle, selected references | Rewriting repository files |
| Playthrough journal | Notes, encountered clues, confirmed revelations, theories, outcomes, unresolved threads | Inferring knowledge from missing records |
| Assistance coordinator | Context selection, private-note filtering, source identifiers, draft validation and generation provenance | Applying outcomes, approving drafts, publishing, or changing canon |
| Player output | Explicit selection, preview, sanitized display and export | Loading the full DM workspace into player output |
| Device persistence | Transactions, schema versions, save failures, backup/restore | Cross-device synchronization |
| AI gateway | Authentication, provider credentials, model allowlist, bounded requests, budget reservation and reconciliation | Long-term storage of campaign or journal content |

Domain operations should not depend on UI components. Storage and provider integrations sit behind the boundaries that need them; avoid a generic plugin system or support for many providers before there is a concrete need.

## Source import and retrieval

Import an explicitly selected snapshot package through a browser file upload. Proposed format: an archive containing Markdown, selected local assets, and a manifest with relative paths, content hashes, and an optional Git revision. The archive format and limits need selection before importer implementation.

Exclude harness files, Git metadata, secrets, and editor artifacts from campaign imports. Validate paths, sizes, formats, and local references before committing an import. Do not require a live GitHub connection or browser directory access.

Store each snapshot immutably. Identify a source by snapshot, relative document path, section locator, and content hash. Preserve source text alongside derived sections. Authority assignments refer to explicit versions; newly imported versions do not inherit accepted authority silently.

Refresh reports added, changed, and removed documents. Prepared sessions retain their source versions. Updating a prepared item is an explicit operation; removed sources remain available where a session pins their version. Renames may be suggested but must not silently merge identities.

Start with local lexical search over headings and section text, with links back to exact source versions. At the observed repository size, a vector service is not justified without evidence of inadequate retrieval. Search implementation and performance targets remain subject to planning and validation.

Entity identities may connect multiple documents without merging their text. Known conflicts can be recorded by the DM and flagged by assistance; comprehensive automatic conflict discovery is outside initial scope.

## State and version boundaries

Keep these concepts distinct:

- **Campaign snapshot:** immutable imported sources and their identities.
- **Authority assignment:** DM-designated current canon, supporting material, proposal, or superseded status for a source version.
- **Prepared item:** versioned session material, including pinned sources, selected references, and local edits.
- **Assisted draft:** generated content plus source references, declared inventions, review flags, request metadata, and approval status.
- **Session:** objective, item order, lifecycle, and current navigation position.
- **Journal record:** editable note, clue encounter, revelation, theory, outcome, or unresolved thread, associated with a session where applicable.
- **Player artifact:** a frozen selection approved for display/export, separate from its DM source.

Approval applies to a specific draft version. Editing an approved draft makes the changed version require review again. Session approval never adopts canon. Canon incorporation remains manual Markdown export followed by an owner-controlled repository edit and later source refresh.

Unknown discovery state stays unknown. Clue encounters do not imply comprehension. Historical records can be entered without pretending they occurred in the current session.

## Offline persistence and recovery

Propose IndexedDB for structured device records and a service worker for the application shell. Cache required UI assets locally; do not depend on remote fonts or scripts for play. Preserve the complete imported text library locally and explicitly package prepared local assets and references for offline sessions.

Show save state based on completed storage transactions. Storage failure must produce a visible unsaved state and preserve the editor contents for recovery/export; never claim a failed save succeeded. Prevent concurrent tabs from silently overwriting records using revision checks or a single-writer policy selected during planning.

Mark a session offline-ready only after its required material has been verified locally. Initial load and provisioning require connectivity. A prepared session must reopen after the browser is closed while offline. App updates should not replace the running session's code unexpectedly; stage activation until the DM leaves active play.

Browser storage can be evicted or cleared. Request persistent storage where supported, expose storage errors, and provide backup reminders and portable exports. Persistence permission is not a substitute for backups. See [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Propose a versioned backup containing source snapshots, authority assignments, sessions, drafts, journal records, and player artifacts. Exclude credentials. Validate the full backup before restoration. Initial restore should replace a workspace only after explicit confirmation and a recovery export; avoid merging two divergent playthroughs in version one. This restore behavior needs owner approval.

The gateway budget ledger is not restored from a device backup. Restoring older device data must not reset AI expenditure.

## Assisted creation and context handling

An explicit action captures the objective, task type, permitted scene/session context, selected references, applicable designated canon and revelation rules, recorded discoveries, and known conflicts. Filter excluded notes before constructing summaries, retrieval inputs, or outgoing requests. Derived content must retain provenance; content derived from excluded notes cannot bypass their exclusion through an automatically selected summary.

Use source identifiers supplied by the app. Ask for separate content, citations, invented additions, and review flags. Validate citation identifiers against the actual supplied context; invalid or missing references are review problems, not evidence. Valid references still do not prove that generated claims are correct.

Imported prose is evidence, not instructions authorizing tools or actions. The model receives no write, publication, or canon-change tools. Generated text is rendered as untrusted content, with raw HTML and executable links disabled or sanitized. Do not automatically fetch external images or URLs embedded in imported/generated prose.

Present unresolved conflicts and the context limits of each request. Do not silently omit applicable authority or revelation rules to fit a model context window; reduce scope or ask the DM to narrow the request. Larger context is not a reason to transmit all private notes.

Results are private drafts. Journal-update suggestions are proposals with individually confirmable effects. Interrupted generations must not apply partial outcomes. Do not automatically retry provider requests whose execution status is uncertain.

## AI gateway and spending

Deploy the gateway separately from offline storage. Authenticate the DM before generation; having no player accounts does not justify an unauthenticated endpoint spending provider credit. Keep provider credentials server-side. Provider requests receive only the permitted request context; application logs should omit campaign text, private notes, credentials, and raw model outputs.

Propose a persistent, atomic gateway ledger for the configured budget period. Before a call, reserve an upper bound using the permitted model's pricing, input accounting, maximum output, and any billable options. Block when the reservation would exceed the remaining limit. Enforce allowed models and output limits at the gateway, rather than trusting browser settings.

Reconcile reservations with returned usage. Concurrent requests use the same ledger. Unknown outcomes retain a conservative reservation until resolved; retries must not quietly duplicate a charge. Browser backups or reinstallations cannot reduce the ledger's spent amount.

A strict monetary ceiling is conditional on provider accounting and bounded billing behavior. If a chosen provider cannot support conservative reservation for the selected features, return to the owner to revise provider choice or budget semantics before implementing generation. An estimated client-side counter does not satisfy a hard ceiling.

The owner must select provider, model, data handling terms, currency, budget period, actual limit, and who can change that limit. This proposal does not claim to cap unrelated provider usage outside this gateway.

## Player output

Build display/export from an allowlisted artifact containing only selected player content. Preview and export use the same frozen artifact version and rendering rules. Never generate player output by hiding DM fields with CSS. Existing approvals become stale when the artifact content changes.

Separate-screen presentation or downloadable handouts do not create a player account or portal. The exact initial handout formats remain to be selected. Both imported and generated content require review because neither sanitization nor visibility filtering can detect every narrative spoiler inside the selected prose.

## Compatibility evidence and proposed targets

Do not depend on `showDirectoryPicker`: it has limited availability according to [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker). Explicit file import is the baseline; directory integration could be an optional future enhancement.

Propose a stable HTTPS application origin, desktop Safari/Chrome and iPad Safari as initial targets, with actual versions and devices agreed before formal compatibility verification. Service-worker offline behavior, save/reopen, upload/download, and restore must be checked on those targets. These are proposed targets, not a tested support claim.

## Requirement coverage and evidence needed

| Requirements | Architectural owner | Evidence needed in later authorized work |
| --- | --- | --- |
| R1, R5 | Source library and immutable versions | Search opens exact sections; refresh preserves prepared sessions and explicit authority |
| R2, R4, R10 | Session workspace | Save/reopen, version-specific approval, export, lifecycle and reopening |
| R3, R9, R13 | Assistance coordinator and gateway | Context exclusion including derived records; valid references; drafts; failures leave play usable |
| R6, R7, R11 | Workspace and journal | Flexible navigation; durable editable records; no inferred knowledge |
| R8 | Player output | Preview/export equivalence; no DM fields in output |
| R12 | Device persistence and offline shell | Offline cold reopen; manual recording; backup round trip; save failure and schema upgrade recovery |
| R14 | Gateway ledger | Atomic reservations, concurrent calls, unknown outcomes, blocked overspend and no background requests |

No prototype, tests, provider calls, or browser checks have been run for this proposal. Documentation checks establish consistency of the written proposal only.

## Decisions required before planning affected work

1. Approve or revise the browser/device-storage plus authenticated AI gateway design.
2. Approve explicit snapshot uploads, pinned versions, and manual repository export.
3. Approve replacement-style backup restore and the proposed browser targets.
4. Choose gateway access/hosting and AI provider/accounting details, or explicitly defer AI implementation increments until those choices are resolved.
5. Confirm the representative evaluation scenario and relevant initial source authorities.

Framework and dependency choices remain open and need a short, evidence-based comparison before implementation planning that relies on them. No infrastructure accounts, deployments, or paid services are authorized by this proposal.

## Planning: first increment

Status: Proposed. Planning is authorized; implementation awaits explicit approval of this increment and its detailed choices.

### Increment 1 — Import and use the campaign source library

Deliver a usable browser source library: package this repository's campaign Markdown, import the package explicitly, retain immutable source versions locally, search and read their sections, and designate authority. This establishes part of R1 and R5 and the local storage foundation. It does not complete the session preparation or play features.

### Detailed technology proposals

| Choice | Recommendation and rationale | Alternative considered |
| --- | --- | --- |
| UI/build | React with TypeScript and Vite, isolated under `app/`; component state suits the later editor, draft review, and play workspace | Vanilla TypeScript has fewer dependencies, but requires manual coordination of those interactive states; server rendering adds no demonstrated value for a private offline workspace |
| Device records | Dexie over IndexedDB, confined to persistence code; atomic imports and versioned schemas are concrete needs | Raw IndexedDB avoids a dependency but adds transaction and migration plumbing; localStorage does not fit structured transactional imports |
| Markdown | markdown-it with HTML explicitly disabled, controlled renderer rules, and section locators derived from parsed tokens | Rendering plain text loses tables and headings; arbitrary HTML introduces an unnecessary trust surface |
| Package format | A versioned UTF-8 JSON snapshot file containing a manifest and Markdown text; no compression or binary assets initially | ZIP requires archive parsing and expanded-size controls before assets are needed |
| Developer checks | TypeScript check, production build, focused Vitest tests and a Playwright browser flow | Mock-only storage tests cannot establish durable browser import/reopen behavior |

These choices require owner approval with the increment. [Vite documents both vanilla and React TypeScript templates](https://vite.dev/guide/). [Dexie documents transaction behavior](https://dexie.org/docs/Dexie/Dexie.transaction%28%29) and [TypeScript support](https://dexie.org/docs/Typescript). [markdown-it exposes parsing and rendering options](https://markdown-it.github.io/markdown-it/interfaces/MarkdownItOptions.html); disabling HTML alone is not the complete output policy.

Environment inspection found Node v26.12.0 and npm 11.20.0, with no existing application package or lockfile. Pin compatible dependency versions in the new lockfile during authorized implementation. Do not upgrade the system runtime or introduce a monorepo tool.

### Scope and behavior

1. Add a packaging command that reads explicit campaign root files and campaign directories, writes a snapshot to a caller-selected output path, and never edits inputs. Include `00_Campaign_Overview.md`, `09_Future_Chapter_Summaries.md`, `knowledge_architecture_v0.1.md`, `prompt.md`, and Markdown under `campaign_bible/`, `foundation/`, `blacktide_haven/`, `items/`, `the_ship/`, `factions/`, `chapter_2_the_broken_atoll/`, `chapter_3/`, `chapter_3_design/`, and `npcs/`, plus `sahuagin_stronghold_fisherman_rescue.md`. Future campaign roots require explicit addition. Exclude symlinks, hidden files, agent instructions, harness directories, application code, and generated documentation.
2. Define snapshot schema version 1 with normalized relative paths, text, UTF-8 byte sizes, SHA-256 hashes, optional Git revision, and a deterministic snapshot identity derived from canonical sorted content. Hashes check integrity, not authorship. Identical content imports are idempotent.
3. Validate the entire package before an atomic import: supported schema, unique paths, hashes, declared sizes, and content-derived identity. Reject absolute paths, traversal, backslashes, control characters, forbidden roots, malformed UTF-8 input, and invalid fields. Initial limits: 20 MiB package, 1,000 documents, 2 MiB per document. Report a useful error and leave the prior library unchanged on failure.
4. Store immutable snapshots and documents. Show added, changed, and removed paths when importing a new snapshot. Retain older snapshots for inspection; no automatic deletion or rename merging. No existing session records exist in this increment.
5. Offer title/path browsing and case-insensitive section-text search. Search excludes superseded documents by default with an explicit option to include them. Results identify document path, snapshot, section, excerpt, and authority status, and open the exact matching section. Duplicate heading text must still produce distinct stable locators within a source version.
6. Render headings, lists, tables, and text. Disable executable/raw HTML, embedded remote media, and automatic external fetching. Resolve supported local Markdown links inside the selected snapshot, including encoded spaces and section anchors; show unresolved references explicitly. External links are inert or require an explicit user action. Assets are placeholders in this increment.
7. Let the DM designate a source version as current canon, supporting material, proposal, superseded, or unclassified. Default to unclassified; do not choose the active Bible automatically. New changed versions require explicit classification. Preserve existing classifications across identical-content reimports. Surface multiple documents classified as canon without implying the app has checked semantic consistency.
8. Show import/save progress and errors based on completed transactions. Reopening the browser at the same origin restores the library and classifications. Imported campaign content stays on-device; this increment has no AI calls or campaign upload endpoint.

### Expected files and ownership

| Area | Expected additions or edits |
| --- | --- |
| Application tooling | `app/package.json`, lockfile, TypeScript/Vite configuration, HTML entry, scripts and generated-output ignore rules |
| Source behavior | `app/src/library/` for snapshot validation, section extraction, search, refresh comparison, and authority operations |
| Persistence | `app/src/storage/` for Dexie schema, atomic imports, and authority writes |
| UI | `app/src/main.tsx`, source-library components, controlled Markdown rendering, responsive styles |
| Packaging | `app/scripts/package-campaign.mjs` and a documented command accepting repository root and output path |
| Tests | `app/tests/` for validator/search/version behavior; a browser test for import, classification, search and reopen |
| Usage documentation | `README.md` for setup, packaging, import, commands, and current limitations; implementation notes in this document |

Names within these directories may vary as implementation clarifies cohesion. Campaign Markdown and harness files are outside the edit scope. Generated packages, browser artifacts, and dependencies must not be committed as source. Do not initialize another Git repository, deploy, or commit changes as part of this increment.

### Completion criteria and developer checks

- The packaging command creates a snapshot of the allowlisted campaign sources, excluding harness/editor artifacts, without changing the inputs.
- A valid package imports, is searchable and readable, and retains data and authority classifications after browser reopen.
- Search opens exact sections including duplicate headings; queries match section text as well as headings.
- A second snapshot reports additions, edits, and removals while the original remains readable. Reimporting identical content does not create duplicates.
- Invalid hashes, duplicate/traversal paths, forbidden roots, oversized inputs, and unsupported schemas leave the existing library intact.
- Malicious Markdown cannot execute HTML or initiate remote media fetches. Local links with spaces and supported anchors resolve to the correct version; missing targets are visibly unresolved.
- Simulated storage failures produce an error rather than a success state or partial import.
- Type checking, focused tests, production build, and the browser import/search/reopen flow pass. Inspect laptop and tablet-sized layouts for usable navigation, keyboard access, and overflow.

Use the existing Agelus material as a representative search/link example without treating it as the owner-approved full-session evaluation scenario. Avoid tests that merely restate implementation; prioritize import atomicity, version retention, safe rendering, search navigation, and persistence failure behavior.

Browser developer checks should cover available Chromium and WebKit automation. Report unavailable tools, browser-download blockers, and lack of real iPad testing explicitly. These checks are implementation validation, not separately authorized formal verification or a complete browser-support claim.

### Explicit limits and deferrals

- No session builder, session journal, generated drafts, player output, AI gateway, provider credentials, or billing logic yet.
- No service worker or offline cold-start claim yet. Local records persist, but the application still needs to load. Offline shell behavior belongs to a later increment.
- No backup/restore yet. Only reproducible imported sources and classifications are stored; classification loss remains a risk until backup is added. Do not enter irreplaceable playthrough data in this slice.
- No binary assets, ZIP import, PDF export, semantic contradiction detection, entity extraction, vector retrieval, or filesystem integration.
- No production hosting or user authentication setup. Local development/preview serves the first increment; production origin and access remain unresolved.

### Later work — sequencing only

After accepting this increment, plan a session preparation slice with pinned references and durable manual drafts; then offline startup and workspace backup before relying on it for live play. Add live journal and handout workflows in reviewable slices. Assisted creation follows only after provider, access, privacy terms, and spending controls are resolved. This outline authorizes no later increment and is not a replacement for their individual plans.
