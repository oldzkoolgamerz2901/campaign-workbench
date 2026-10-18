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

## Increment 3 — Accepted typed-card architecture

Status: Architecture accepted by the owner on 2026-10-17 after approval of the increment 3 requirements. The 3A plan, contract/parser detail, and 3B plan were subsequently accepted on 2026-10-18; other implementation increments below remain proposed. Persisted approval is not execution authorization. Campaign-file edits have a separate boundary. See [approved requirements](product-specification.md#increment-3--typed-cards-campaign-organization-and-reading) and [increment 3 overview](increment-3-typed-markdown-cards.md).

### Metadata, identity, and authority

- Store versioned YAML front matter under a `workbench` mapping in authoritative campaign Markdown. Version 1 carries `schema`, `id`, `title`, `type`, `purpose`, and `status`; `tags` and `summary` are optional. Purpose values are `session`, `guidance`, and `tooling`; revision status values are `draft`, `current`, and `superseded`. Initial types are `npc`, `location`, `faction`, `item`, `scene`, `adventure`, `handout`, and `reference`.
- A stable ID identifies one document/card within a campaign, not the in-world entity described by several documents. Rename preserves the ID; independently reusable cards created by a split receive distinct IDs. Duplicate IDs produce classification issues and never merge records silently. Existing campaign/capture/path/section provenance remains intact.
- Retain relative Markdown links as the portable relationship convention; do not introduce a custom link language. Resolve relationships against the applicable capture and preserve their source context when preparing material. A relationship is not permission to capture or publish its target.
- Purpose and current status do not establish approved AI authority. Future AI approval must identify the exact approved content version. Increment 3 displays classifications and does not implement AI execution or that approval workflow. Do not reinterpret existing self-described canon labels or filenames as owner approval.
- Recommend ordinary Markdown with one H1 title, substantive H2 topics, H3 subsections, and recognizable sections such as Quick reference, Read aloud, Background, and Design notes. Unknown sections remain visible. Legacy files need not follow these structures to remain readable.

Example convention, not a classification of an existing campaign file:

```yaml
---
workbench:
  schema: 1
  id: "87b085da-326b-4cc4-933e-c908648ee712"
  title: Arrival Hall
  type: scene
  purpose: session
  status: current
  tags: [whispering-reef, chapter-2]
  summary: First entry into the Sea Guardian sanctuary.
---
```

Use a maintained YAML parser with a restricted schema, rather than a custom parser. JSON front matter was considered: it reduces the need for a YAML dependency but is less comfortable for campaign authors. On 2026-10-18 the owner accepted SnakeYAML Engine 3.1.1 and the [version 1 validation contract](increment-3-typed-markdown-cards.md#accepted-version-1-metadata-contract--2026-10-18). Restrict metadata to data values; validate supported schema/types, duplicate keys/IDs, and resource limits. Unknown unrelated front-matter keys must not be treated as Workbench instructions.

### Module responsibilities and capture behavior

| Component | Accepted responsibility |
| --- | --- |
| Campaigns | Registered campaign identity, directory, and include/exclude rules |
| Sources | Metadata extraction/validation, classification issues, captured relationships, browsing/filtering/search, and exact source selection |
| Preparation | Immutable captured text and metadata, order, notes, and self-contained archives |
| Angular features | Navigation, compact results, filters, selected reader, and local expansion/focus state |

No new domain module, graph database, generic extension framework, or campaign writer is selected. Preserve raw source text in the current capture and derive classification from it; additional persisted source indexes need a demonstrated requirement.

Metadata extraction must preserve mapping to original character offsets, since current section IDs, subtree selection, and anchor mapping rely on them. Metadata is separate from rendered body text and ordinary body search. Titles/tags are explicit searchable metadata. Malformed metadata creates a document-level issue while readable campaign content remains available; actual scan/read failures retain the existing previous-capture and atomic-publication behavior.

For new prepared items, retain exact selected source Markdown and separate captured metadata. Rendering suppresses a recognized metadata envelope without rewriting the frozen text. Hashes continue to identify exact raw document/selection content. For section selections, retain document classification/provenance but do not import unrelated Quick reference text from outside the selected subtree. Raw legacy prepared text remains unchanged and uses legacy rendering behavior.

Session preparation excludes explicitly classified guidance/tooling documents, including direct add requests, not merely hidden navigation entries. Legacy or invalid classification remains accessible through an issues/unclassified path without guessing a purpose. Detailed validation behavior belongs in the reviewed contract before implementation.

### Reading and archive compatibility

- Use category/filter navigation, compact results, and a selected reader. Provide a heading outline, accessible collapsible background/design sections, Expand all, read-aloud/mechanics distinctions, and automatic reveal/focus for search matches. Unknown content is visible by default.
- Retain the writing desk and folio while allowing surrounding panels/notes to collapse for focused source reading. Review representative long content at 1280×800 and 1440×900 before production reader implementation. A disposable prototype is a separately authorized experiment, not production code.
- Extend prepared records with optional captured classification/relationship metadata through a new Preparation-owned migration. Existing records remain legacy material without looking up current sources or modifying old text, hashes, or provenance.
- Export archive version 2 with captured metadata. Continue to import version 1 as legacy material. Validate versions through explicit version-specific field/type/size checks before atomic import; retain existing fresh destination identities and campaign scoping. Existing applications reject version 2 rather than silently losing metadata. No version 1 downgrade export is selected.
- Captured relationships may identify unavailable material, but prepared links resolve only to material actually captured in the session. Never follow a captured relationship into newer live library content automatically.
- A replace-with-latest command is excluded from increment 3. Explicit removal/addition remains available; source refresh never updates prepared material.

### Separate Sea Witch pilot architecture

The accepted approach is a separately reviewed pilot of Thomas's two profiles, Arrival Hall, Agelus Trail, and a guidance document. Campaign Bible v0.6 is the recommended guidance example, conditional on owner resolution of its title/authority issue; acceptance of this approach does not resolve that content question.

Preserve recoverable originals and protected prose. Produce a source-to-result information mapping, link/anchor checks, and an owner review queue. Mechanical evidence establishes protected-text preservation and link integrity; it cannot establish semantic equivalence by itself. Any uncertain consolidation, edit, classification, or authority decision blocks that edit and enters [the review queue](sea-witch-manual-review.md). Broad migration, deletion of historical versions, automatic canon reconciliation, and application tooling changes are excluded.

## Increment 3 — Proposed bounded implementation increments

Status: Planning deliverable proposed on 2026-10-17; the owner accepted the 3A plan, its contract/parser review, and the 3B plan on 2026-10-18. Other increments remain proposed. Each row below is a separate approval scope, not one blanket implementation authorization. Formal verification remains separately authorized after implementation. No commits, deployment, production data changes, or Sea Witch edits are implicit.

### Prerequisites and sequencing

Before dependency/code changes in 3A, finish the contract and parser assessment described below and present any consequential unresolved choice. This prerequisite was satisfied by the separately accepted 2026-10-18 review; the plan alone did not select a library. Sources, prepared snapshots, and production reading form the sequence 3A → 3B → 3C. The disposable layout study may run before or alongside those only with separate authorization; its owner review must finish before 3C. Sea Witch pilot work has its own approval scope and is not a dependency for shipping generic application support.

| Increment | Expected scope | Completion criteria and focused developer evidence |
| --- | --- | --- |
| 3A — Typed source foundation | `backend/src/main/kotlin/workbench/sources/{api,domain,application,adapter}/`, focused Sources/architecture tests; parser dependency in `backend/build.gradle.kts` and `docs/versions.toml` only after selection; convention reference in the increment 3 document | Parse/validate metadata while preserving raw text and source offsets. Return metadata, issues, heading levels, and captured Markdown relationships through Sources APIs. Support type/tag/purpose/status filtering and full-content search with originating capture identity. Read legacy/unknown/invalid documents; identify duplicate IDs without merging. Enforce session-purpose selection restrictions. Verify metadata/body separation, whole-file/subtree hashes, repeated/nested headings, CRLF and Unicode offsets, anchors, stale captures, atomic refresh, duplicate IDs scoped by campaign, safe parsing limits, and differently structured campaigns. Existing frontend still compiles against generated contracts. |
| 3B — Frozen typed preparation and archives | `backend/src/main/kotlin/workbench/preparation/{api,domain,application,adapter}/`, Sources public selection contract, new Preparation-owned migration, focused persistence/import tests; generated-client consumers where needed | Snapshot classification, summary, relationship context, and interpretation version when adding source material. Keep existing sessions/text/hashes unchanged. Export v2 and import v1/v2 atomically with exact field/version validation. Demonstrate persistence/restart, source rename/split/deletion and label changes without snapshot changes, section-only captures without extra background, unavailable relationship handling, fresh identity remapping, cross-campaign isolation, rejected malformed imports without partial writes, and archives readable with no campaign files. Preserve save-conflict and note behavior. |
| 3C — Production browsing and reader | `frontend/src/app/campaigns/`, `frontend/src/app/preparation/`, necessary `app.*`/shared styles, generated-client wrappers, focused component/state/Chromium fixtures | Deliver the owner-selected B direction through proposed increments 3C.1–3C.3 below: real workspace/session navigation, typed browsing and explicit adventure choices, then reader presentation and integrated handover. Preserve working notes, provenance, save states and captured-link semantics. No production use of prototype state/data. |

Each increment updates relevant README/convention documentation and records developer evidence here. Regenerate the real Spring OpenAPI client whenever the contract changes. Use backend domain/integration/Modulith checks for changed backend behavior and frontend checks for affected consumers. Use the isolated full-stack check at the integrated handover; repeat broader startup checks only for relevant changes or failures. No tests against the owner's live campaign/database are required.

### Increment 3A — Implementation and developer-check evidence — 2026-10-18

The approved Sources implementation and the bounded archive-import readiness correction are complete; the integrated developer check is now green. The initial failure and subsequent correction are recorded below. This is developer evidence, not formal verification or owner acceptance.

Changes:

- Added the accepted restricted SnakeYAML Engine 3.1.1 dependency and offset-preserving envelope extraction in the Sources Markdown adapter. Classification, diagnostics, duplicate IDs within a campaign capture, normalized tags, and metadata/body separation are derived from captured raw text; no database index or migration was added.
- Added classification to source summaries/documents/search hits, heading levels, and direct captured Markdown relationships with source section, destination, target classification, and explicit scene-candidate flags. Whole-file/subtree selections retain raw text/hashes and expose metadata/relationship context for 3B.
- Added combined type/tag/purpose/status and issues/unclassified filters to library/search APIs. New parameters and response additions are optional in generated OpenAPI consumers; the existing frontend compiles without hand-maintained contract changes.
- Enforced the guidance/tooling restriction in the public Sources selection operation, including otherwise invalid classifications with an independently valid purpose. Preparation integration confirms a rejected add leaves the session unchanged.
- Recorded the approved metadata contract, parser assessment, and type-specific recommended Markdown structures in the increment 3 convention document; updated README and accepted-plan status while preserving earlier uncommitted documentation.

Developer checks:

- `cd backend && ./gradlew test --tests workbench.TypedSourcesTest --tests workbench.LibraryBehaviorTest --tests workbench.ArchitectureTest`: 15 checks passed.
- `cd backend && ./gradlew test --tests workbench.LibraryIntegrationTest bootJar`: passed after starting Docker Desktop. The initial attempt could not start Testcontainers because Docker was stopped; this was an environment prerequisite, not an application assertion failure.
- The first `./scripts/check-setup.sh` run passed all 20 backend checks, real Spring OpenAPI client generation, version checks, all 15 frontend tests, and the production build. The second invocation retained the unchanged backend checks as up-to-date and repeated generation/frontend checks successfully.
- Both full-stack runs passed 3 of 4 Chromium flows (connectivity, source-library operations, and failed-save recovery). Both failed `frontend/e2e/preparation.spec.ts:145`, awaiting the archive-import success notice. The error snapshot shows the new session in the destination campaign, with no success notice. The existing `Workspace.initialize` sets library selection before awaiting source refresh and binding SessionState; `SessionState.import` ignores completion after an epoch/campaign change. This is evidence for an initialization/import-readiness race; no baseline checkout reproduction or frontend correction was performed in 3A. No frontend application or E2E source was changed.
- The script's final PostgreSQL restart comparison was not reached because Chromium failed. The backend integration checks separately passed capture/classification persistence across application restart, transaction rollback, and frozen legacy session/archive behavior.
- `git diff --check`: clean. Production build retains the existing prototype CSS size warnings; those files were not changed.

The focused checks cover malformed/unknown/legacy metadata, duplicate keys/IDs, parser bounds/aliases/tags, metadata-only and body search, combined filters, BOM/CRLF/non-BMP offsets, exact UTF-8 hashes, repeated/nested headings, anchor remapping, subtree-only relationships, stale capture rejection, atomic refresh behavior, different campaign structures, HTTP filter binding, and cross-campaign isolation. Module checks confine YAML dependencies to the Sources adapter and preserve API boundaries.

Remaining work/limits: the archive-import readiness failure was corrected and the complete integrated check passed as recorded below. Formal verification is not performed. At the 3A handover, typed metadata persistence, metadata-aware prepared rendering, and archive v2 were deferred to 3B; the subsequent 3B evidence is recorded below. Production typed browsing/reader controls remain 3C. No campaign files, owner development database, commits, or deployments were changed. The isolated check servers/containers were stopped by the check script; Docker Desktop remains running.

### Archive-import readiness correction — 2026-10-18

The correction preserves the existing Angular Workspace/SessionState responsibilities, API contracts, persistence model, and dependency set. Scope: `frontend/src/app/preparation/workspace.ts`, its template, `session-state.ts`, focused SessionState tests, and the existing preparation Chromium flow.

The campaign selector and upload control became visible while route initialization was still awaiting source refresh, before SessionState was bound to the destination. A fast upload could successfully import on the backend while its completion was discarded by the existing epoch/campaign guard. Workspace now keeps import disabled until route initialization, campaign binding, and session listing complete; its handler checks the same readiness. A route epoch check prevents an obsolete callback from marking a newer route ready. SessionState rejects imports for an inactive campaign and rechecks identity after file reading and list reload so navigation cannot send a stale upload or display an old completion notice.

Added three state regressions for unbound destinations, navigation during file reading, and navigation during post-import listing. The Chromium flow deliberately delays the destination source refresh, asserts that import is disabled, releases initialization, and verifies the import notice, reopened content/notes, and malformed-archive rejection. This tests the actual timing condition without arbitrary sleeps or removing the original success assertion.

Developer evidence: `cd frontend && npm test` passed all 18 tests. The subsequent complete `./scripts/check-setup.sh` passed: unchanged backend suite/build retained as up-to-date (20 backend checks previously passed), real Spring OpenAPI generation, version alignment, all 18 frontend tests, production build, all 4 Chromium flows, and PostgreSQL installation-state preservation across database restart. The script stopped its isolated servers/containers. Existing prototype CSS budget warnings remain. `git diff --check` is clean. No architecture change, dependency addition, campaign-file edit, commit, deployment, or formal verification is part of this correction.

### Increment 3B — Implementation and developer-check evidence — 2026-10-18

The accepted 3B implementation is complete. This is developer-check evidence, not formal verification or owner acceptance. Requirements and module boundaries are unchanged.

Implementation:

- Added Preparation-owned immutable captured classification, authored summary, diagnostic issues, direct relationship context, interpretation version, and saved body offset. The application maps the Sources public selection contract into these frozen values when adding material; save/reorder/notes operations retain them.
- Added `V6__captured_source_metadata.sql`, a nullable JSON-encoded text column on `preparation.item`. Serialization stays in the persistence adapter. There is no source-index migration, backfill, new module, dependency, or campaign writer. Existing rows remain legacy/null with original text, notes, hashes, provenance, and anchors.
- Prepared rendering suppresses only the envelope identified by the saved body offset for new captures. It never reparses live metadata. Legacy items and v1 imports retain prior rendering. Section captures keep only selected raw prose, with document classification held separately.
- Exports now use archive v2; imports accept v1/v2 through version-specific field/type/size checks before binding and transactional writes. V1 items reject typed fields and import as legacy; v2 requires nullable captured metadata. Nested metadata, supported interpretations, offsets, hashes, enums, canonical identifiers, duplicate JSON keys, trailing data, and scalar coercion are validated. Destination session/item identities are fresh; descriptive provenance and stable card IDs remain unchanged.
- Frozen links still resolve only within the prepared session and original campaign/capture. A newer card at the same old path cannot satisfy an older relationship. Uncaptured targets remain unavailable after import, with their captured descriptive context retained.
- Updated the typed browser fixture and v2 export assertion. Regenerated the Angular client from the real Spring OpenAPI contract. Production typed browsing/reader controls remain 3C.

Developer evidence:

- `cd backend && ./gradlew test --tests workbench.PreparationIntegrationTest --tests workbench.ArchitectureTest` passed the existing preparation and module checks.
- The focused `TypedPreparationIntegrationTest` passed a real Flyway V5-to-V6 upgrade seeded with legacy rows, legacy rendering/v1 HTTP import, new snapshots and authored summary, CRLF/BOM selections, section-only captures, repeated-anchor links, label/type changes, rename/split/deletion, saves/notes, persistence across application restart, self-contained v2 HTTP import, fresh identities, cross-campaign isolation, and unavailable links across captures.
- Malformed archive HTTP cases reject unknown/missing fields, unsupported versions/interpretations, scalar coercion, noncanonical IDs, incorrect enums/offsets/fingerprints, oversized fields/archives, duplicate keys, trailing JSON, duplicate sessions, and a valid first session followed by an invalid second session. Destination session counts remain unchanged. Invalid classification diagnostics and normalized Unicode tags also round-trip. Unicode lowercasing can expand a valid 64-unit authored tag; frozen validation accepts its normalized representation without changing authoring limits.
- `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` completed successfully: all 24 backend tests (subsequently reused as up-to-date), real Spring client generation, version checks, all 18 frontend tests, production build, all 4 Chromium flows, and PostgreSQL installation-state preservation across restart. The typed browser flow checks hidden envelope display, frozen content/notes, captured metadata and summary in the v2 download, import, and malformed-archive rejection.
- `git diff --check` passed. Existing prototype CSS budget warnings remain; no prototype files were changed.

Check-driven corrections and operational deviations:

- The first integrated attempt found port 4200 occupied and stopped before browser tests. Added a validated optional `WORKBENCH_CHECK_FRONTEND_PORT` in the existing Playwright configuration (default still 4200), then used 4201. The existing frontend was neither reused nor terminated. A Docker-access sandbox denial was retried with the required environment approval.
- The next browser run passed typed preparation but exposed a campaign-selector startup race: saved captured documents could be visible before initial route setup completed, and a user switch during that interval could be overwritten when the URL was applied. The existing Workspace readiness signal now gates the CampaignLibrary selector as well as imports; no-selection startup can become ready normally. A deterministic browser regression delays initial refresh, checks that switching is disabled, then releases startup and confirms switching succeeds. This correction remains within existing UI/router responsibilities and adds no architecture or dependency.

The isolated check servers/containers were stopped. Tests used temporary campaign fixtures and isolated databases; no Sea Witch files or owner development data were edited. The owner's running development backend has not been restarted or migrated by these checks. Restarting the development stack is needed to load the new backend/migration locally. Formal verification, 3C, the disposable reader study, commits, and deployment remain separate.

### Pre-implementation contract review for 3A

Status: Completed and accepted on 2026-10-18; the resulting [contract and parser decision](increment-3-typed-markdown-cards.md#accepted-version-1-metadata-contract--2026-10-18) supersede the open selection prerequisite below.

Produce the field constraints and validation table, YAML parser assessment, and type-specific Markdown conventions as reviewable documentation before code/dependency changes. Resolve these implementation details against accepted behavior:

- Required fields, ID format, tag normalization, supported schema versions, and defaults for legacy versus explicitly invalid metadata. Missing labels are never inferred from folder names.
- Safe parser limits and behavior for malformed envelopes, unknown fields/types, duplicate keys, and duplicate IDs; readable body and diagnostic retention. Assess dependencies against the existing Kotlin/JDK/Boot baseline using primary documentation before selecting one.
- Offset-preserving envelope/body extraction and frozen interpretation version so adding metadata never shifts a selected range incorrectly or changes historical prepared rendering.
- Relationships use ordinary links. The explicit Adventure scene chooser must distinguish scene targets from other links and never recursively capture a graph or silently include non-session material.
- Guidance authority remains outside this contract's execution scope; invalid/unreviewed labels do not become approval evidence.

If those details expose a consequential departure from accepted architecture, return to architecture approval before implementing it.

### Proposed disposable reader study

Question: can the category/results/reader layout and source-focused folio make long content usable without concealing essential scene information?

Scope: extend the existing isolated preparation study under `frontend/src/app/preparation/prototype/` and its development-only loader as needed, with in-memory fixtures representing a short NPC, a long scene, a multi-scene adventure, a guidance document, and legacy/invalid metadata. Use sample or read-only copied excerpts; no campaign edits, application API/database writes, new framework, or production integration. Follow the prototype skill if/when this experiment is explicitly authorized.

Deliverable: a reviewable preview at 1280×800 and 1440×900 demonstrating outline/disclosure navigation, search reveal, panel collapse, and quick/full-text access. Keep fixtures and study behavior excluded from production output. Owner review of the layout is a prerequisite for 3C; prototype approval does not authorize 3C implementation.

#### Disposable A/B session-workflow extension — 2026-10-18

The owner authorized extending the standalone study to campaign/session selection, creation/reopening, repeated source additions, ordering/removal, notes, and Prepare → Read → Prepare. The question is whether A's library desk and B's focused folio can support one session compilation without losing library context or crowding long content. This is an isolated design experiment, not acceptance of a revised production design or authorization for 3C.

Scope is the existing `frontend/src/app/preparation/prototype/reader-study.*`, a static `reader-migrated-fixtures.ts`, and study documentation/evidence. The shared shell selects a fixture campaign and opens its session chooser/creation form. Session contents remain separate from the document's collapsible heading outline. Additions retain the source reader, while prepared entries contain cloned fixture text and independent item notes. Read opens B with the library hidden; Prepare returns to A with the same compilation and selected prepared entry. Campaigns and sessions retain separate in-memory contents/notes. A/B arrows compare presentation without changing mode.

Ten read-only migrated Sea Witch drafts cover the short Thomas reference, Arrival Hall, Agelus overview, and all seven extracted scenes. The chooser adds only the overview and explicitly checked scenes. Related navigation in prepared copies uses only whole-document copies already in that fixture session. The invented second campaign retains guidance, legacy/invalid metadata and long-content stress cases. No production state/services, campaign files, source-rule activation, API/database calls, registration/management flows, archive implementation or durable persistence are included. The existing production loader replacement remains unchanged.

Developer/design checks: the development build and final production build pass. Chromium walkthroughs at 1280×800 and 1440×900 exercised new/empty sessions, the seven-scene chooser with two selected scenes, opening related sources without adding, document/section additions, removal/reordering, separate item/session notes, Read/Prepare transitions, reopening sessions, campaign isolation, unavailable prepared links, panel collapse, hidden-background search reveal, table/long-token display, A/B switching, editor arrow-key behavior and refresh reset. No page overflow, runtime errors or API requests were observed. The source reader remains about 579px wide with all four A panels visible at 1280px, versus 643px in B with notes; hiding B's contents and notes expands it to about 1207px. Visual review corrected an inherited panel-background conflict. All ten copied raw files/hashes match the migrated campaign tree, and their body sections remain present in source order. Final production JavaScript inspection found no study markers/fixture text. Existing disposable component style-budget warnings remain; budgets were not relaxed. `git diff --check` passes.

Recommendation for owner review: use A for repeated library browsing and session assembly, with notes collapsed initially and the document outline available inside the reader; use B with the library hidden for session reading. Its horizontal library shelf consumes approximately 190px of height when shown, so it remains a comparison option rather than the default preparation arrangement. The experiment uses a limited offline Markdown renderer and in-memory copies, not evidence for real autosave, archive or captured-link implementation. No new formal verification, production design acceptance, 3C implementation, commits or campaign writes occurred. The review journey and preview URLs are in the prototype README.

Owner-feedback iteration: the owner found the search/filter arrangement out of place in both A/B and identified 30–50 prepared entries as a realistic session size. Within the disposable experiment, a shared library toolbar now groups search, category tabs, result count and optional tag filters above the library results/reader area; B places it above its horizontal shelf. Active tags have removable chips, and library controls remain absent during reading. Source-result styling is quieter, with clearer selected state. A's toolbar occupies approximately 105px above the source/results area; B's toolbar and 134px shelf remain a visible preparation-space tradeoff. The preceding measurements describe the earlier study stage.

A new **Long session · 40 items** fixture deliberately captures ten documents and thirty sections to expose density problems without inventing campaign facts. Session contents uses a fixed header/find field and an independently scrolling compact numbered list. Section names lead their rows, with source-document context beneath and full accessible labels/tooltips. Only the selected entry exposes preparation reorder/remove controls. Finding a prepared title preserves full-session numbering, selection, notes, and library filters; clearing it reveals the selected entry. No grouping, pagination, virtualization, new dependency or durable session feature is introduced. Navigation/control presentation is in a separate prototype stylesheet, with the existing reader/layout styles and production budgets retained.

Follow-up developer/design checks: Chromium at 1280×800 and 1440×900 repeated the earlier preparation/reading walkthrough and exercised tag-filter disclosure/removal, 40-entry navigation, finding/selecting entry 40, preserved original numbering, an empty session-filter result without changing the reader, restoring the selected entry, and ten additional captures to reach 50 before Read. No page overflow, runtime errors or API requests were observed. Development and final production builds pass with existing disposable style-budget warnings; no budgets were relaxed. Final production JavaScript inspection confirms that study controls, density fixtures and campaign text are excluded; `git diff --check` passes. All mutations remain in memory; production design acceptance, formal verification and 3C are separate.

### Increment 3C — B production implementation plan — 2026-10-18

Status: B's visual direction is accepted following the library-toolbar and 30–50-item study. The owner authorized planning and subsequently accepted 3C.1. Its implementation and developer-check evidence are recorded below; owner implementation review and formal verification remain separate. 3C.2 is also accepted and implemented, with developer evidence below. 3C.3 is also accepted and implemented, including integrated developer evidence below; owner implementation review and formal verification remain separate. This latest selection supersedes the earlier recommendation to use reader-study A for assembly. The historical increment 2 A/B selection and study evidence above remain unchanged.

#### Accepted direction and existing implementation

Use B for the campaign workspace: shared campaign/session header, grouped library toolbar, horizontal source-results shelf, compact session contents, and source/notes folio. Prepare exposes composition/editing actions; Read hides the library and composition controls. Collapsing session contents/notes recovers reading space. Preserve the atmospheric palette, Angular Material/CDK foundation and existing root route; rebuild production components rather than importing the disposable study.

Read-only planning inspection established:

- `campaigns/library-state.ts` already protects against late campaign/search/document responses, but does not yet pass the typed filters supported by the generated Sources client. Its current campaign-opening refresh and capture-replacement recovery are existing behavior, not permission to refresh the owner's data during implementation.
- `preparation/workspace.ts` owns campaign/session routing and currently navigates away from the library after every successful addition. Moving the campaign selector into the shared shell must retain its route guard, readiness checks and campaign/session identity checks.
- Sources already supplies classification, heading levels, exact section/block IDs, relationships and explicit scene-candidate flags. Preparation supplies immutable captured metadata and rendered source/notes HTML. Neither a new backend endpoint nor a database migration is required by this plan.
- Prepared HTML has an ordered anchor list rather than the prototype's structured sections. Existing `MarkdownView` and `Workspace.followCaptured` rely on heading order and returned link targets, including targets inside section-only captures; the study's whole-document-only navigation shortcut must not replace them.
- `SessionState` already serializes saves and additions. Its preview loop currently renders every item's notes after any edit: a 50-item session can request 51 previews for one edit. The large-session scope justifies a focused correction to reuse unchanged previews and request only changed note fields; it does not justify a new editor, renderer or cache infrastructure.

#### Boundaries and contracts for all three increments

- Campaigns continues to own registration and source rules; Sources owns classification, filtering, search, exact selection and capture identity; Preparation owns saved sessions, revisions, frozen values, order, notes and archives. The workspace coordinates navigation and presentation. Any shared reader helper is a small Angular presentation facility for the two existing readers, with no domain policy or custom Markdown parser.
- Preserve the real save states, working edits, revision conflicts, Retry/Reload/discard behavior, browser-close warning, export flush and guarded campaign/session transitions. Reading retains the current rendered-notes behavior; the prototype's editable reading textareas do not introduce a new editing mode. No durable UI preference/selection schema or simulated save success is introduced.
- Keep source-library selection separate from selected prepared-item identity. Browsing/filtering/related navigation does not capture content. Adds stay in the library; selecting a prepared entry shows its frozen copy. Prepare/Read share identity, order, selection and working notes. Find-in-session is local presentation, retains original numbering, and never changes the saved order or library filters.
- Use frozen title/type/source context for prepared entries, falling back to saved provenance for legacy material. Never fetch current sources to fill historical labels or summaries. Source refresh/rename/split/deletion, source-rule changes and archive import must not reinterpret old captures.
- Keep registration, refresh, source-rule editing, import, single/multiple export and connection status reachable through the real shell, including empty campaign/session states. Do not copy the prototype's omissions or expose dead controls. Retain meaningful labels and selected/save/error states for keyboard and assistive-technology use.
- No backend/domain/schema/API changes, new dependencies, source-rule activation, live campaign/database operations, campaign edits, prototype deletion, Git history changes or deployment are included. If implementation proves a backend contract change necessary, stop and present that scope change rather than silently expanding 3C.

#### Implementation increments

**3C.1 — B workspace and large-session navigation. Plan accepted.**

Expected files: production `preparation/workspace.{ts,html,css}`, `session-state.ts` and its focused tests; `campaigns/library.{ts,html,css}` for layout/control ownership; necessary `app.{ts,html,css}` and `styles.css`; local campaign/session presentation components if extraction keeps those files readable; relevant `app.spec.ts`, existing preparation/library browser fixtures, README and evidence here. Existing generated types are consumed unchanged.

Deliver B's shared campaign selector and session chooser/new-session form, explicit destination/title/objective, real save/recovery controls, collapsible library/contents/notes and facing source/notes pages. Keep existing source browsing/search working in the shelf while typed filter controls await 3C.2; no mock category/filter controls ship in this increment. Successful single document/section additions preserve the open source and reader position, expose their persisted destination and select the new prepared item without navigating away. The compact contents list handles 30–50 entries, find/clear/no-match states, original numbering, section-title/source context and selected-item reorder/remove actions. Clearing a find or changing view reveals the selected entry without scrolling unrelated panels. Keep title/objective and both note levels editable in Prepare, rendered in Read, and keep full archive/management access.

Completion evidence: create/open/save/reopen real sessions; add document and nested section repeatedly while remaining in the library; find entry 50, clear the filter, reorder/remove and reopen with the persisted order; edit/preview both note levels; switch Prepare/Read without losing working state; exercise save failure/conflict, delayed response and campaign-switch protection, plus existing import/export/library management regressions. For 50 items, editing one note field requests only that field's changed preview; title/order changes do not re-render unchanged notes. Check both laptop sizes and production study exclusion. Record any still-deferred 3C.2/3C.3 features explicitly and stop for review.

**3C.2 — Typed library and explicit adventure assembly. Plan accepted; implementation evidence below.**

Expected files: `campaigns/library-state.ts` and tests, library/control/result presentation, generated Sources-client consumers, the workspace add handler, the minimum `SessionState` addition-result/queue handling and tests, isolated typed library/adventure browser fixtures, README and evidence here. No manual edits to generated client code.

Wire all eight supported card types, tags, purpose/status and issues/unclassified access to existing Sources queries. The grouped toolbar retains full-content search, categories, optional filters, visible removable criteria and a clear Search all action. Debounce interactive search and extend current request/campaign/capture guards to filter changes; changing filters must not refresh the filesystem capture. Results show explicit title/type/tags/optional authored summary, with path/issue fallbacks. Preserve exact passage targets when grouping search hits by document; do not discard repeated-heading matches. Show guidance/tooling and legacy/invalid material through explicit access without guessing labels; add controls are absent for known non-session material and backend rejection remains authoritative for invalid declarations.

Default Play library shows explicitly current session material. Drafts/superseded material remain available through status controls; a helpful empty state offers including drafts. Sea Witch's migrated drafts are not automatically promoted or hidden without explanation. Search all retains the query and clears type/tag/purpose/status/issues restrictions. Issues/unclassified can union and deduplicate the existing unclassified/issue query results rather than adding a backend OR-filter endpoint; apply explicit additional criteria consistently. No frontend classifier is introduced.

Related-card navigation uses returned relationships without adding targets. Adventure addition offers the overview and directly linked eligible scenes, with explicit checkboxes and no recursive traversal; respect returned section targets. Use the existing single-add API sequentially with the latest revision and pinned campaign/capture. Since there is no atomic multi-add endpoint, show completed/failed/pending selections if an addition fails, stop the queue and retry only remaining work. Do not roll back saved items or duplicate completed additions on retry. Guard navigation/mutations during the queue and retain local note edits.

Completion evidence: combined filters and full-content search, Search all reset, draft visibility, all supported types, guidance/tooling rejection, legacy/invalid/duplicate metadata, stale-filter/capture responses and exact repeated-heading passage selection. Demonstrate opening related material without capture, overview-only and selected-scene additions, no unselected handout/graph capture, preserved nested ranges, and partial queue failure/retry without duplicate completed items. Existing session/save/archive checks remain green. Stop for review.

**3C.3 — Production reader controls and integrated handover. Plan accepted; implementation evidence below.**

Expected files: source reader presentation in `campaigns/`, prepared reader/`markdown-view.ts` and selection/navigation in `preparation/`, a small shared reader presentation component/helper under `frontend/src/app/shared/reader/` if needed by both consumers, focused presentation tests, long-content browser fixtures, README and evidence here. No production import of study fixtures, section-role flags or its offline renderer.

Provide the document outline separately from session contents; contextual source section-add actions; section focus; Expand all/quick access; provenance/classification issues and available/unavailable relationships. Use Sources section IDs/levels/block IDs for live material, and the already rendered prepared HTML plus returned anchors for frozen material. Preserve heading order and link keys; reveal collapsed ancestors before following either search results or captured anchors. Derive presentation from backend output, retain Angular sanitization and existing escaped HTML/image/external-link behavior, and do not bypass security or parse campaign Markdown independently in the browser.

Bounded presentation convention: use exact conventional headings (case/whitespace normalized) for Quick reference, Read aloud, Mechanics, Background and Design notes in valid typed cards. Only explicitly named Background/Design notes subtrees may start collapsed. Unknown headings, legacy/invalid cards and ambiguous grouping remain visible; no path-specific or semantic guessing. Study-only aliases such as Original Purpose, DM Notes and Future Callbacks do not silently become collapse rules. Provide direct access to an authored Quick reference without duplicating prose, changing backend heading order, or importing material outside a selected subtree. A missing summary/quick reference remains absent. Any broader section taxonomy needs a separately presented decision.

Completion evidence: real backend-rendered long content with repeated/nested headings, canonical and unfamiliar sections, hidden search matches, full expansion, outline/focus/keyboard controls, wide tables/long tokens, missing/external/section-only captured links and legacy/v1/v2 reading. Recheck at 1280×800 and 1440×900 with 30–50 items and every relevant panel combination. At integrated handover exercise source refresh/rename/deletion without changing frozen material, self-contained export/import and app/backend restart with saved state preserved; capture screenshots and remaining limits. These are developer checks; formal verification is separately authorized.

#### Check strategy and approval boundary

For each increment, run focused frontend state/component tests, affected existing browser regressions against temporary campaigns and an isolated backend/database, version checks and development/production builds. Keep tests about user behavior, race handling, content preservation and failure recovery rather than prototype markup. Adapt existing selectors/expectations to the accepted navigation while retaining their original safety assertions. Regenerate the client from real Spring OpenAPI on a fresh checkout or if its contract actually changes; no new mock contract replaces it. Use the existing isolated full-stack setup check at integrated handover, with `WORKBENCH_CHECK_FRONTEND_PORT=4201` when the owner's server occupies 4200. Do not restart the owner's stack or alter its campaigns/source rules to run checks. Inspect production output for prototype controls/private fixtures and run `git diff --check`. Backend tests/build remain part of the integrated check; no unrelated launcher checks or infrastructure changes are planned.

At the planning handover, checks were read-only: current documentation, production frontend/state/guards/generated signatures, Sources and Preparation DTOs/rendering, and existing unit/browser fixtures. The owner subsequently authorized 3C.1; its evidence follows. That approval does not authorize 3C.2, 3C.3 or formal verification.

#### 3C.1 — Implementation and developer-check evidence

The production B workspace is implemented with the real Angular/generated-client state. The shared header selects campaigns and opens a session chooser/new-session form; a Campaigns-owned controls component retains registration, refresh and source-rule editing. The chooser retains import and multiple-export controls, while single export and real save/recovery states remain accessible from the workspace. The source library uses a search toolbar and horizontal document/passage shelf. Selecting a source opens its live captured reader; selecting prepared material opens its frozen reader, independently. Successful document/section additions preserve library route, source selection and reader scroll position, and identify the saved destination session. Read hides the library; Prepare resumes the same working data. Panels collapse independently, and note editors remain Prepare-only with real rendered previews in both modes.

The Preparation-owned contents component provides a fixed heading/find control and independently scrolling list for 30–50 items. It preserves original numbering while finding saved titles/frozen source context, uses explicit selection plus selected-item reorder/remove controls, and reveals the selected entry by scrolling only its own list. Legacy items use saved provenance rather than fetching current labels. Title/objective editing lives in Session details; session/item note tabs retain both levels of notes. The root application header is compact enough to preserve laptop reading height, and light reader surfaces use readable local Material button colors.

`SessionState` keeps successful previews by note field/text for the current session and requests only edited or newly selected uncached fields. Opening a 50-item session requests the session and selected item's previews rather than all 51 note fields; editing one item requests one changed preview, while title/order edits reuse existing previews. Existing save serialization, revisions, dirty-state handling, API capture and archive contracts are retained. Preview responses from prior sessions/campaigns are discarded. There are no backend, database, API, dependency, startup-script or campaign-file changes.

Developer checks completed with `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` against the existing isolated smoke database/backend and temporary campaign directories. The final run passes backend `test bootJar` (unchanged tasks were up-to-date), real Spring OpenAPI client generation, version checks, all **20 frontend tests** across three suites, production build, all **five Chromium browser flows**, and the isolated PostgreSQL installation-state restart check. A development build also passes. New state tests cover bounded preview requests with 50 items and stale cross-session preview rejection. The new real-backend browser flow seeds 48 section captures, adds a document and nested section through the UI while retaining reader position, finds entry 50 with its original number, preserves its notes/selection through Read/Prepare, reorders/removes it and reopens the persisted result. It checks panel collapse, keyboard reorder, no horizontal overflow and captured screenshots at **1280×800** and **1440×900**. Existing flows retain source rules/refresh/registration, exact repeated-heading focus, escaped HTML/omitted images, frozen text after source deletion, v2 export/import readiness and failed-save navigation assertions.

Browser review corrected two implementation defects: the session chooser could open before campaign loading finished and then be closed by initialization, and a same-campaign configuration response could close the source-rule editor. The chooser now waits for readiness; campaign controls reset only when campaign identity changes. A blocked session switch closes the chooser so Retry remains reachable. Existing browser fixtures were adapted to the new controls and scoped source reader while retaining their safety assertions; import-readiness still tests the disabled input during a held refresh before opening the ready chooser. The final suite passes after these corrections.

Build limits: Angular reports the existing disposable-study component-style warnings and a production workspace style warning (approximately **5.33 kB**, above the 4 kB warning threshold and below the 8 kB error limit). Budgets were not relaxed. Final production JavaScript inspection confirms study controls/private fixture markers are absent, and `git diff --check` passes. No prototype state, sample data or limited offline renderer is imported by production components; the existing development-only loader remains unchanged. Formal verification has not been performed. Typed filters/scene selection remain 3C.2; reader outline/disclosure/focus/search reveal remain 3C.3. No source exclusions were activated, live campaign refreshed, owner database changed, owner stack restarted, or Git commit/staging/merge performed. The isolated check's processes/containers were cleaned up; its separate test volume remains available for the existing check workflow.

#### 3C.2 — Implementation and developer-check evidence — 2026-10-18

The production library now sends the eight card types, required tags, purposes, statuses and diagnostic criteria to the existing generated Sources client. Play library defaults to explicit session/current classification; Search all retains the query and clears every criterion. Drafts/superseded material remains accessible through statuses, with an Include drafts empty-state action. Selecting diagnostic access clears the default purpose/status criteria so legacy/invalid material is reachable; additional explicit criteria still apply. The issues/unclassified union uses two existing queries and deduplicates documents and exact passage identities. No frontend classifier, API change or filesystem refresh is introduced by filtering.

Interactive full-content search is debounced by 250 ms. Query edits invalidate pending results immediately, and pending debounce callbacks are pinned to campaign identity. Filter/search publication checks request, campaign and capture identity; capture replacement reloads and reapplies the active criteria. Compact entries show declared title/type/tags/optional summary, paths and classification issues. Grouped document search retains all distinct block/section targets, including repeated headings. Optional filters retain typed tag text while normalizing query values, and Search all closes their disclosure so it does not obstruct results. Controls stay visible but disabled during mutations to retain the toolbar layout.

Related-card navigation follows returned targets without capturing them. Adventures offer explicit overview/direct-scene checkboxes, deduplicated by path/section; only returned scene candidates are offered and nested section targets are preserved. Preparation owns a sequential addition queue pinned to campaign/session/capture. Each request uses the latest session revision, flushes intervening edits and merges additions without replacing locally edited notes. Failure stops the queue with completed/failed/pending progress; retry skips completed selections. Queue execution guards campaign/session/view navigation (including route guards), source operations, reload and reorder/removal while retaining note editing. Known guidance/tooling has no source-add controls; backend rejection remains authoritative for invalid metadata. No recursive relationship traversal or implicit handout capture occurs.

Developer checks: the final `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passes backend `test bootJar` (unchanged tasks up-to-date), real Spring OpenAPI client generation, version checks, all **25 frontend tests** in three suites, production build, all **six Chromium flows**, and isolated PostgreSQL installation-state restart persistence. A separate development build passes. Added state tests cover default/combined filters, Search all query retention without refresh, diagnostic union/exact-hit deduplication, late-filter/typing responses, partial queue failure/retry at the latest revision, guarded additions/navigation and notes typed during sequential captures. The new real-backend typed-library browser fixture covers all eight types, combined typed tags/status/search, draft access, exact repeated-heading targeting, Search all reset, guidance/tooling controls and backend rejection, legacy/invalid/duplicate metadata, related navigation without capture, overview-only addition, deduplicated scene choices, partial failure/retry without duplicate completed selections, nested-range preservation and no handout/recursive capture. It asserts no filter-triggered refreshes or runtime errors, checks overflow and captures screenshots at **1280×800** and **1440×900**. Existing library, save/conflict, archive and 50-item navigation flows remain green; legacy fixtures explicitly select Search all and wait for campaign readiness after registration.

The first browser passes exposed a filter disclosure covering shelf results and an older registration fixture racing campaign readiness; both were corrected before the final passing run. A transient template-edit error was also corrected. Final production JavaScript inspection finds no reader-study controls/private campaign fixture markers; `git diff --check` passes. Existing workspace/disposable-study style-budget warnings remain; no budgets or dependencies changed.

Limits: this queue uses separate revision-checked API operations, not an atomic batch or durable job. If a response is lost after a server commit, revision conflicts can require an explicit reload; no automatic rebase or exactly-once transport guarantee is introduced. Queue progress is local UI state; acknowledged prepared items are persisted. Safari/WebKit and formal verification are not covered. Reader outline/disclosure/focus/search reveal remain 3C.3. No backend/schema changes, owner-stack restart, owner database operations, campaign edits/source-rule activation, Git staging/commit/merge or deployment occurred. Check servers/containers were cleaned up; the existing isolated smoke volume remains. Stop for owner implementation review before further increments or formal verification.

#### 3C.3 — Implementation and integrated developer-check evidence — 2026-10-18

The source and prepared readers now share a small presentation directive and Angular controls under `frontend/src/app/shared/reader/`. The directive indexes already rendered DOM after Angular rendering; it never parses Markdown, moves/reorders the rendered nodes, replaces backend link keys, creates a second HTML renderer or bypasses Angular sanitization. Sources supplies exact section IDs/levels/block IDs; prepared sources use returned anchor order alongside the sanitized rendered headings, including repeated headings. Document outline is distinct from session contents. Its native buttons support heading navigation and section focus; Show full document clears focus, Expand all clears focus/disclosure, and Quick reference jumps to the actual authored heading rather than copying prose.

Only valid typed cards use the accepted conventional-heading treatment (case/whitespace normalization). Explicit Background/Design notes subtrees start collapsed; their heading remains visible with immediately available disclosure controls and outline `aria-expanded`/`aria-controls` controls. Read aloud and Mechanics receive distinct presentation without text changes. Unknown headings/aliases, legacy/v1 material and invalid classification remain visible. Repeated canonical names or nested markup with ambiguous boundaries are conservative: automatic disclosure is withheld; unsafe section focus is disabled while outline jumps remain usable. Missing summaries/quick references stay absent, and section-only captures never import content from outside their saved subtree.

Live search, inline links, related-card navigation, local frozen anchors and cross-item captured targets reveal presentation ancestors before the existing exact target receives focus. Frozen navigation still consults the backend-rendered captured links only. Captured relationships retain their frozen labels and align with the rendered link traversal order (the two contracts use distinct key namespaces); mismatched relationship/link counts remain unavailable rather than guessing a target. Source capture provenance and frozen classification/issues/relationship availability are inspectable. External navigation remains click-only, unavailable targets remain explicit, raw HTML remains escaped and images omitted.

Focus source collapses the library shelf, contents and notes and restores their previous visibility on request. Separating shelf visibility from the live reader corrects the former whole-library hide behavior: the open live text remains mounted and readable when its shelf is hidden. The helper preserves local disclosure/focus state for unchanged content and resets it for a different source/captured identity. Existing notes, revision/save/recovery behavior, section-add actions, queue guards and archive contracts remain in their owning components. No backend, schema, API, dependency or prototype changes were needed for this increment.

Final integrated check: `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passes backend `test bootJar` (unchanged tasks up-to-date), real Spring OpenAPI client generation, version checks, **30 frontend tests across four suites**, production build, **all seven Chromium flows**, and isolated PostgreSQL installation-state restart persistence. Five new presentation tests cover exact collapse conventions, nested subtree reveal, outline/focus/expansion, legacy/invalid and ambiguous markup, repeated-anchor order and missing/external link behavior. Existing typed-library/adventure, source-management, save/conflict, archive and 50-item workspace flows remain green. Development and final production builds both pass; existing workspace/disposable-study style warnings remain unchanged and budgets were not relaxed.

The new real-backend reader fixture prepares **40 items**, exercises live hidden search matches and exact repeated-heading focus, local frozen links and cross-item links into a **section-only capture**, authored quick reference, unfamiliar headings, wide tables/long code tokens, escaped HTML/omitted images, missing links, read-only working notes and source focus. It checks both **1280×800** and **1440×900** with all eight Prepare library/contents/notes combinations and all four Read contents/notes combinations; no horizontal page overflow or runtime errors occur. Screenshots are recorded as `reader-{1280,1440}.png` and `prepare-reader-{1280,1440}.png` in the ignored reader test-results directory and were visually inspected. Source rename, replacement refresh and deletion leave exact frozen text, labels, summaries, selected ranges and notes intact after browser reload. Self-contained v2 export/import works after deleting the source documents; a derived v1 import remains legacy, fully visible and readable.

Additional isolated handover: after the full-stack check stopped its backend/database, an operational script under `/private/tmp` restarted the same smoke database and launched the built backend on port 18080 **twice**, with cleanup of each owned process. On each launch, the imported 40-item session, rendered frozen-link output and v2 archive export exactly matched JSON evidence saved by the browser fixture before shutdown. This verifies session order, notes, metadata, self-contained reading and export across backend restarts as well as the browser reload. The development stack and owner database were not restarted or used. Both check runs cleaned up their isolated containers/processes; the existing smoke volume remains.

During developer checks, a fixture paragraph boundary and a panel-toggle fixture race were corrected; panel combinations now await each rendered expanded state before continuing. Source focus was also corrected to preserve the live reader while hiding its shelf. The final production JavaScript inspection excludes study controls/private campaign fixture markers, and `git diff --check` passes. No owner campaign files, source-rule activation, owner data, Git staging/commit/merge or deployment were changed.

Limits: Chromium is the checked browser; Safari/WebKit, manual IntelliJ startup and formal verification are not covered. UI focus/disclosure state is local and is not restored across a page reload; saved source/notes/order remain durable. Ambiguous nested heading grouping deliberately keeps content visible and disables section focus. Automatic reader-body search is the existing Sources search; no separate frozen-content search was added. The implementation is ready for owner review. Formal verification requires its own authorization.

### Expanded Sea Witch migration — accepted architecture and proposed plan — 2026-10-18

The owner approved the repository-wide requirements in the product specification and the architecture below, then authorized planning. This supersedes the small SW-P1 scope below as the proposed execution route; historical pilot text is retained for context. Implementation authorization is still required for a specific increment. The reader study remains disposable, and 3C is separate.

#### Accepted architecture

- Keep existing paths where practical, normalize useful heading hierarchy, and edit ordinary prose without introducing new campaign facts. Keep protected dialogue/read-aloud/handout text verbatim and preserve functional instructions, fallback clues, exceptions, and knowledge limits.
- Retain an adventure overview at its existing path when extracting independently reusable scenes to a nearby `scenes/` directory. Use ordinary relative Markdown links. Consolidate profiles only where distinct information and intended ownership are clear; queue conflicting details and unresolved consolidations.
- Keep existing consistency/design folders and historical versions. Put newly separated design-only material in `guidance/`. Such documents remain available as refactor guidance; file labels, version numbers, and self-described status do not settle authority conflicts.
- Deliver explicit exclusion patterns for the existing Source rules control. There is no campaign-repository exclusion-file loader: writing a pattern file does not activate it. Guidance metadata prevents session capture but does not prevent source scanning/reading. Applying source rules and refreshing the owner's campaign are separate operational actions, outside the migration's database-change scope.
- Put campaign-owned inventory, mappings, manual-action queue, evidence, and exclusion patterns in `docs/refactor/`; exclude that directory from the source library. Keep application architecture/requirements in this repository. No new campaign agent harness or application code is included.
- Preserve originals through the recorded Git baseline, without duplicate archives in the readable library. Renames retain card identity; independently reusable split cards receive fresh UUIDs. Do not silently assign authoritative status to uncertain material.

#### Baseline and editing policy

Planning baseline: Sea Witch `main`, commit `7c94830a22218c2625e5e3472b188516e48d615d`, 85 non-hidden Markdown files. No tracked changes were present. Five untracked `.DS_Store` files were present and remain outside scope. Recheck the baseline before writing and record any intervening changes. Create `refactor/typed-campaign-content` before campaign edits; do not modify main, commit, merge, push, or delete historical versions. Filesystem permission for the independent repository remains separate from phase approval.

Owner-approved metadata policy for SW-R1: new/migrated cards use `status: draft` while awaiting owner review, with that migration status explicitly distinguished from canon authority in the inventory. Do not declare existing versions superseded. Guidance/history with unresolved status remains unchanged and is covered by explicit exclusions. Give cards UUIDs only when their boundaries/classification are clear; otherwise leave the affected content unchanged and queue it. Summaries and Quick reference sections are optional, and must not merely duplicate a short file.

Review every existing file, but do not require a rewrite for its own sake. Each inventory row records source path/hash, proposed type/purpose, action, destination(s), and unresolved concerns. Each manual-action row records filename, concern, suggested manual action, decision needed, and status. Cross-reference existing SW-01–SW-11 without silently closing them. Do not rewrite guidance to reconcile it with session prose.

#### Proposed increments — each requires separate implementation authorization

| Increment | Files/components | Completion criteria |
| --- | --- | --- |
| SW-R1 — Baseline, exclusion inventory, representative editorial conversions | All 85 files read-only for inventory; new `docs/refactor/` records and exclusion-pattern text; editable representatives: the two Thomas profiles, Arrival Hall, Agelus Trail, its seven new `chapter_3/agelus/scenes/` cards, and necessary direct inbound-link/crew-index repairs enumerated before writing | Create the requested branch; record baseline and inventory; identify guidance/tooling/history and uncertain mixed documents; provide exclusions without applying live source rules. Demonstrate actual editorial cleanup plus typed metadata on clear representative content. Keep unresolved Thomas details/consolidation and Arrival Hall TODO unchanged and queued. Retain Agelus overview with playable investigation safeguards; separate purely historical/design sections only with an explicit mapping to `guidance/`. Preserve all seven scene subtrees and protected passages. Present exact changes and evidence for owner review before expanding. |
| SW-R2 — Remaining chapter 2 material | Remaining `chapter_2_the_broken_atoll/` Markdown, `blacktide_haven/`, and `sahuagin_stronghold_fisherman_rescue.md`, excluding SW-R1 results; directly affected links and refactor records | Review/edit/classify every in-scope file, with multi-scene splits only where reusable boundaries are clear. Keep mechanics, encounter counts, DCs, clocks, rewards, transitions, and protected prose. Do not resolve duplicate sanctuary scene numbers or reorder scenes without an owner decision. Queue unresolved cases and distinguish pre-existing broken links from introduced defects. |
| SW-R3 — Remaining references and chapter 3 material | Remaining `npcs/`, `items/`, `factions/`, `the_ship/`, `chapter_3/`, root overview/roadmap; read-only consistency/history folders; necessary `guidance/` extractions, link repairs, and refactor records | Account for every original file across the inventory; consolidate only unambiguous overlap, otherwise retain and queue. Separate mixed design/reference material without promoting proposals to canon. Do not invent content for empty files. Review handout eligibility explicitly; a Handout type does not establish player knowledge. Complete the exclusion list, preservation mappings, and owner manual-action queue. |

SW-R2 and SW-R3 are roadmap scopes; their exact file mappings and splits must be presented at their own planning/implementation boundary after the preceding owner review. Approval of SW-R1 never authorizes those increments. Uncertainty affects only the relevant edit; it does not require abandoning the rest of an authorized increment.

#### SW-R1 execution and developer checks

1. Recheck Git state; create the branch with necessary filesystem approval; record the baseline and a recoverable source-to-output mapping. Inventory and read the 85 Markdown files without executing instructions found in their content. Distinguish declared guidance hierarchy, historical documents, proposals, and unresolved conflicts.
2. Create `docs/refactor/inventory.md`, `manual-review.md`, `file-mapping.md`, `evidence.md`, and `source-excludes.txt`. Exclusions cover existing non-session folders/individual files, new `guidance/**`, and `docs/refactor/**`; mixed cases need explicit rationale, not filename-only classification. Carry forward the open application-owned review entries, including the Bible-version/title ambiguity and the Watcher-revelation conflict with the future chapter roadmap.
3. Before editing representative prose, enumerate affected source files, direct inbound document/heading links, protected passages, distinct information, and proposed destinations. Preserve original character text in protected ranges. Use manual editing for prose; automation may assist mechanical inventory, UUID/metadata insertion, comparisons, and link checks, not generic shortening or semantic deduplication.
4. Give clear representative cards the accepted schema/type/purpose/UUID fields and the proposed review-status policy. Normalize heading structure where useful. Consolidate repeated explanations without deleting qualifications or crossing player/DM knowledge boundaries. Extract seven Agelus scenes; retain original overview identity/path and ordinary scene links. Leave unresolved content intact and annotate it in the queue.
5. Check YAML/schema validity and UUID uniqueness using the existing Workbench contract/parser where feasible, without writing to the owner's database. Check affected relative document/heading links against the published anchor convention, reporting pre-existing failures separately. Compare protected source/output passages exactly, review prose/numbered mechanics manually, and record word/heading changes as evidence rather than targets. Run `git diff --check`; verify the branch, intended changed-file set, unchanged historical/guidance originals, and retained untracked files. No formal verification, production code tests, live refresh, or database writes are implied.
6. Report developer evidence and unverified semantic risks in these implementation records and the campaign-owned evidence file. Stop for owner review of the editorial approach and unresolved decisions before proposing SW-R2 execution. Developer checks cannot prove that no fact was lost; show the mappings and uncertain passages.

#### SW-R1 implementation and developer-check evidence — 2026-10-18

The owner accepted the architecture and SW-R1 plan, including draft migration status, and explicitly authorized SW-R1 implementation in the conversation. Work is on Sea Witch branch `refactor/typed-campaign-content`, based on `7c94830a22218c2625e5e3472b188516e48d615d`; its main ref is unchanged. No commits, staging, merges, or pushes were made.

- Inventoried all 85 original Markdown files, with baseline hashes, proposed type/purpose, action, destination and uncertainty. Identified 23 guidance/design/history candidates and two tooling files for exclusion; preserved their originals. The [campaign-owned inventory](../../sea_witch/docs/refactor/inventory.md), [manual review list](../../sea_witch/docs/refactor/manual-review.md), [source-to-result mapping](../../sea_witch/docs/refactor/file-mapping.md), and [developer evidence](../../sea_witch/docs/refactor/evidence.md) record details. Whole-corpus inventory is not a completed copyedit of the remaining files.
- Edited four original representative files: both Thomas profiles, Arrival Hall, and Agelus Trail. Tightened ordinary prose, normalized useful heading hierarchy, added accepted metadata with distinct UUIDs and draft review status, and preserved unresolved Thomas details and Arrival Hall atmosphere TODO. Thomas consolidation remains deferred; both profiles have reciprocal links.
- Extracted seven Agelus Scene cards with explicit overview/previous/next links. Retained the playable investigation safety net and NPC limits in the overview. Moved its retrospective 18-step timeline and design outcome to one new, origin-labelled `guidance/agelus_trail_design_context.md`; these passages remain exact apart from heading levels. No missing worktable/map handout was invented. The manual list contains SW-01–SW-28, carrying forward authority/content questions and adding concrete manual actions.
- Supplied `docs/refactor/source-excludes.txt`, retaining standard safety exclusions and identifying non-session paths, new guidance, and refactor records. The application's actual scanner glob implementation matched all 25 original excluded candidates, the new guidance and review records, while retaining the 11 typed session outputs. The list has **not** been applied to the owner's live campaign; no source refresh or database/configuration operation occurred. Applying rules requires a separately identified operational action.
- Used the existing compiled Workbench Commonmark/front-matter parser, actual SourceService link resolver, and scanner glob in a temporary Java inspector without starting Spring or a database. Rechecked the actual written tree: 12 typed content outputs with valid unique metadata and no parser issues; all 33 links from migrated content resolve both with and without proposed exclusions. Eight existing links to the sibling application repository remain unavailable inside a campaign capture and unchanged; no new content-link failures were introduced. This did not test production UI, session capture, or archives.
- Exact comparisons cover Arrival Hall read-aloud, Thomas scene/dialogue, atmosphere, notices, player answers and callbacks; Thomas quotations and knowledge/personality list items; all Agelus source blockquotes, scene topic headings and specimen IDs; island read-aloud; and overview safety-net/NPC-rule/design-context prose. Manual review/mapping covers ordinary prose; these checks do not prove semantic equivalence. Word/heading counts are recorded as evidence, not targets.
- Post-write SHA-256 checks confirm all 81 other original Markdown files and all five pre-existing untracked `.DS_Store` files are unchanged. Exactly the four intended tracked sources changed; 13 new files were added without index staging (seven scenes, one guidance file, four Markdown records and the exclusion text file). `git diff --check` passed. No application source/configuration/tests, historical versions, assets, live database, or prepared sessions were edited.

SW-R1 is ready for owner editorial review. Formal verification, activation of source exclusions, SW-R2/SW-R3 execution, 3C, and campaign authority/revelation decisions remain separate. The representative study fixtures were not silently updated from these source edits.

#### SW-R2 — Bounded continuation — 2026-10-18

The owner accepted SW-R1 and requested proceeding with the other files. The next implementation scope is the previously presented SW-R2 row: exactly 25 existing files, comprising the 20 remaining Markdown files under `chapter_2_the_broken_atoll/` (all except Arrival Hall), the four files under `blacktide_haven/`, and `sahuagin_stronghold_fisherman_rescue.md`. Current document boundaries and paths are retained; no new scene splits, canon reconciliation, sanctuary renumbering/reordering, or SW-R1 source edits are included. All existing direct Markdown links outside these files are unchanged. Necessary source links and campaign-local inventory/mapping/manual-review/evidence updates remain within scope.

Use the accepted metadata contract with distinct UUIDs and draft migration-review status. Preserve the entire Captain's House handout, bounty-board text and Tordeck meeting script; preserve shop table rows/properties/prices and all quoted/read-aloud text. Tighten only selected, individually reviewed ordinary-prose passages. Keep encounter numbers, DCs, quantities, spell effects, traps, rewards and knowledge gates unchanged. Normalize heading hierarchy where it does not alter protected material. Keep unresolved textual discrepancies intact and record file-specific manual actions. Existing scene-order disagreements remain visible and uncorrected.

Before campaign writes, snapshot the actual SW-R1 tree and existing untracked files, prepare the exact outputs in scratch space, record each source/topic mapping, and run protected-text/mechanics comparisons plus the real Workbench metadata/parser/link/glob checks. After applying, repeat checks against the written tree and confirm all out-of-scope sources and main are unchanged. Source exclusions remain supplied but inactive; no live database/application changes, commits, or formal verification are included. Stop after SW-R2 for owner review before SW-R3 execution.

#### SW-R2 implementation and developer-check evidence — 2026-10-18

Completed the bounded 25-file continuation on Sea Witch branch `refactor/typed-campaign-content`. Paths and document boundaries are retained: no splits, merges, deletions, sanctuary order/number changes or edits to SW-R1 content. Added schema-1 metadata with fresh UUIDs and draft migration-review status to all 25 files. Applied 40 individually authored prose edits across 19 files, useful heading normalization and unnumbered source-navigation links. Four original bodies (Captain's House handout, bounty board, Tordeck meeting script and uncertain early activity notes) remain exact beneath metadata. Shop properties/prices/table rows remain exact; empty placeholder headings are removed.

The [campaign-local mapping](../../sea_witch/docs/refactor/file-mapping.md), [inventory](../../sea_witch/docs/refactor/inventory.md), [manual-action list](../../sea_witch/docs/refactor/manual-review.md) and [evidence](../../sea_witch/docs/refactor/evidence.md) now include SW-R2. Open issues extend through SW-36, including conflicting Rowan pronouns, rough lesson title, early Thomas chronology, the Church-infiltration objective, Ritual Pool revelation/protected-grammar questions, missing battle-map details, ambiguous rescue reward/loot totals and unspecified corruption-encounter creatures. These are preserved and queued, not silently reconciled. Functional scene/puzzle/encounter rules remain session material; general guidance exclusions are unchanged and inactive.

Developer checks against both scratch review copies and the actual written tree passed: all 23 Read Aloud bodies, 123 blockquote blocks, 41 table lines, and the numeric sequence of every source are preserved; all four fully protected bodies and the original numbered outline prefix match exactly. The real Workbench parser reports 37 valid typed records with distinct UUIDs and zero classification issues. All 41 links from SW-R2 sources resolve through the actual resolver with and without the supplied exclusions; pre-existing outside-campaign links remain unchanged. No general semantic-equivalence guarantee or formal verification is claimed.

Post-write SHA-256 checks confirm every existing file outside the explicit 29-file write set (25 sources and four review records) is unchanged, including all SW-R1 content, guidance/history, exclusion-pattern text and the six untracked `.DS_Store` files present at SW-R2 entry. The extra `the_ship/.DS_Store` appeared after SW-R1 and was preserved. Written files match the checked copies; `git diff --check` passes. Sea Witch main remains at the original baseline. No application source/configuration/tests, live database, source refresh, source-rule activation, index staging, commits, merges or pushes were performed.

SW-R2 is ready for owner editorial review. SW-R3's remaining reference/chapter 3 work, 3C, formal verification and unresolved content/authority decisions remain separate. Source-rule delivery still does not activate those rules in the app.

#### SW-R3 — Bounded continuation — 2026-10-18

The owner accepted SW-R2 and authorized the remaining SW-R3 scope. The exact residual inventory is 31 original session/uncertain files: `00_Campaign_Overview.md`; the notebook, seed-chest table and empty worktable file under `chapter_3/agelus/`; three non-design faction references; two item files; seven non-design NPC/player-knowledge files (Corin, Aldren, Eldrik, Kraken, Watcher, Tordeck and Lucius's Robbert reference) plus the Agelus handout; and 14 remaining ship/crew files. The two Thomas profiles and all SW-R1/SW-R2 content are outside this write set. The 25 original excluded guidance/tooling documents remain unchanged and available as refactor guidance.

Retain current document boundaries and paths in this pass. Add metadata/draft migration-review status to the 30 nonempty files where file-level reference/NPC/item/faction/handout identity is clear. Keep the worktable source empty and unclassified; do not invent or delete a missing handout. Preserve the full notebook, Agelus and Lucius player-belief sources, command articles, seed-chest table and mixed campaign introduction; normalize only safe headings and selected ordinary prose elsewhere. Do not resolve mixed-content split decisions, faction-redesign disagreements, actor/knowledge limits, harbormaster naming, role appointments or equipment/pricing inconsistencies.

Repair the crew index's malformed separator and add links with original display-cell content retained. Normalize inventory/stat headings without changing quantities, table cells, mechanics or planning assumptions. Link only to available session sources; do not expose excluded design documents as a substitute for missing playable references. Use the same real parser/resolver/glob and protected-text checks on scratch copies before applying and on the actual written tree afterward. Update the four campaign-owned review records, complete coverage of all 85 original files, and report manual actions/remaining limitations. No new application or campaign harness, source-rule activation, database operation, commits, or formal verification is included.

#### SW-R3 implementation and developer-check evidence — 2026-10-18

Completed the authorized remaining pass on Sea Witch branch `refactor/typed-campaign-content`: reviewed the 31 residual session/uncertain originals, migrated the 30 nonempty files, and left `chapter_3/agelus/papers_from_agelus_worktable.md` exactly empty/unclassified. No paths or document boundaries changed. Added schema-1 session metadata, distinct UUIDs and draft migration-review status; made 44 individually authored ordinary-prose/spelling edits across 13 files, normalized safe topic/crew-role hierarchy, added source navigation, repaired the malformed crew-table separator and linked its nine existing displayed names. Short crew references do not gain duplicated Quick reference prose. Mixed-content/authority decisions remain deferred rather than silently resolved.

Six complete source bodies are exact beneath metadata: campaign introduction, Agelus notebook, seed-chest table, Agelus handout, Lucius's player-belief reference and Articles of Command. The other sources preserve all 33 blockquote blocks and original inline quoted lines, numeric sequences and 137 table lines; the crew-index exception changes only the separator and link wrappers with displayed cells retained. All first-impression scenes are preserved apart from the explicit Cassandra spelling correction; Last Mercy's complete First Touch memory remains exact. Existing research/role/knowledge limits and ship quantities/prices/effects are not rebalanced or reconciled.

Developer checks against scratch copies and the actual written corpus used the real Workbench parser/resolver/glob inspector without starting Spring or a database. All 67 typed records have valid distinct UUIDs and zero classification issues; all 126 links from typed content resolve with and without supplied exclusions, including 52 links from SW-R3 sources. Existing outside-campaign link failures remain unchanged. With exclusions simulated, the only included legacy source is the empty worktable placeholder. Existing source IDs are unchanged; no prepared snapshot or archive was rewritten. These are data/developer checks, not formal verification or proof of semantic equivalence.

The [inventory](../../sea_witch/docs/refactor/inventory.md), [file mapping](../../sea_witch/docs/refactor/file-mapping.md), [manual action list](../../sea_witch/docs/refactor/manual-review.md), and [evidence](../../sea_witch/docs/refactor/evidence.md) now cover all 85 original files: **59 migrated nonempty session/reference originals, 25 original guidance/tooling files preserved byte-for-byte, and one empty unclassified handout**. SW-R1 added seven Scene cards and one guidance extraction; the final corpus has 66 typed session cards, one typed guidance card, and four excluded refactor Markdown records, for 97 Markdown files overall. All 85 baseline sources have exactly one inventory row. Manual IDs SW-01–SW-41 are unique; the crew-index mechanical repair is applied while unresolved narrative/authority/audience issues stay open.

Post-write comparisons confirm that all 25 original excluded guidance/tooling documents still match their original pre-migration hashes, and every file outside the explicit 34-file SW-R3 write set (30 sources and four review records) is unchanged, including prior migrated content, exclusion text and all six existing untracked `.DS_Store` files. `git diff --check` passes. Main remains at `7c94830a22218c2625e5e3472b188516e48d615d`. No original source was deleted; no index staging, commits, merges, pushes, application source/configuration/test changes, live refresh, source-rule activation or database operations were performed.

The migration/editorial pass is complete with the documented manual exceptions. Owner editorial review, missing-handout work, canon/revelation/identity decisions, formal verification, source-rule activation and production 3C remain separate. Exclusion patterns are delivered but inactive; previously captured app content is unaffected until an explicitly authorized rule application/refresh. The disposable study fixtures were not silently regenerated from the edited campaign files.

### Historical proposed separate Sea Witch pilot — SW-P1

Files/content in scope:

- `npcs/thomas_haggerty.md` and `the_ship/crew/thomas_haggerty.md`; related crew index/inbound links only where necessary to preserve navigation.
- `chapter_2_the_broken_atoll/Whispering_Reef_Sanctuary_v1/03 - arrival_hall.md`.
- `chapter_3/agelus/agelus_trail_playable_scenes.md` and new sibling scene files created from it.
- `campaign_bible/The_Sea_Witch_Campaign_Bible_v0.6.md` only after the owner confirms this guidance example and its status/title.
- Necessary direct Markdown link/anchor repairs caused by those changes; enumerate affected paths in a pre-edit inventory before writing. Broader prose edits remain excluded.
- Application-owned convention/preservation evidence in `docs/increment-3-typed-markdown-cards.md` and the manual review queue. No new campaign workflow/instruction files are included.

Entry conditions: owner authorizes SW-P1 implementation independently; the metadata/convention contract is approved; initial Git status and recoverable baseline are recorded without altering existing work. Resolve or defer SW-01, SW-04, SW-08, and SW-10 as relevant before their affected edits. Resolve the guidance selection/status explicitly. Edits outside workspace writable roots also require the environment's filesystem approval, independently of development-phase approval.

Tasks: inventory distinct source information and protected passages; propose target file/link mapping; add metadata only where owner decisions support it; consolidate Thomas without dropping detail; normalize Arrival Hall without rewriting protected prose; extract Agelus scenes with an overview retaining investigation safety nets/timeline/design context; label the selected guidance document without recasting authority. Queue uncertainties and continue unaffected work only.

Completion: show exact changed/new files and word/heading counts, source-to-result information mapping, verbatim checks for read-aloud/dialogue/handouts, and relative-link/anchor checks. Explicitly report uncertain/unmapped passages; do not claim automated proof of semantic preservation. Owner reviews editorial preservation and usability before any broader migration. Historical versions, unrelated campaign files, assets, tooling, Git history, and application code remain outside SW-P1.

### Planning exit

The original recommendation was the 3A contract/parser assessment and a separately authorized disposable layout study. The 3A review and 3B plan were subsequently accepted, and their implementation evidence is recorded above; the layout study, 3C, and SW-P1 remain separately selectable. Do not infer permission for every row from approval of one increment. Open owner content questions remain in the review queue and do not block generic application work.

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
