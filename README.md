# Campaign Workbench

A local laptop workspace for campaign preparation and play. The source library provides campaign registration, switching, Markdown browsing, and passage search. Increment 2 adds durable session preparation, frozen source material, Markdown notes, a reading folio, and portable session archives. Play records, authority assignments, general source history, and AI remain future work.

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

The setup check builds/tests the backend, starts an isolated PostgreSQL Compose project on port 55432 and backend on port 18080, obtains OpenAPI from Spring, generates the Angular client, checks version drift, runs frontend tests/build and a Chromium browser flow, and checks PostgreSQL persistence across restart. It stops its backend and containers afterward. Its test-only volume is retained separately from development data. Testcontainers also creates temporary PostgreSQL containers. Ports 4200, 55432 and 18080 must be free. If the development frontend already uses 4200, run `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` to use a separate browser-check frontend; the existing server is not reused or stopped.

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

Use **Manage campaign** to register a campaign using a display name and an available folder path, refresh its library, or edit source rules. The shared header switches campaigns in preparation and reading. Registrations, source rules, and the last selected campaign persist in PostgreSQL. Opening a campaign scans its Markdown; **Refresh library** explicitly captures later edits. Reading and search use the same captured text until refresh succeeds. If scanning fails, the previous capture remains readable and the error identifies the affected read. Before a first successful capture, the library remains empty.

**Source rules** shows editable include/exclude patterns, one per line. Paths are relative to the registered folder, with `/` separators. `*` and `?` match within a segment; `**` spans directories. `**/*.md` includes root and nested Markdown, case-insensitively. Exclusions win. Defaults exclude hidden files/directories, `node_modules`, `build`, `dist`, `target`, `coverage`, and `AGENTS.md`/`CLAUDE.md`. Symlinks are not followed. Changing rules marks the current capture as needing refresh; it stays readable until successful refresh. Duplicate resolved directories are rejected.

Search matches the trimmed query literally and case-insensitively against document paths, headings, and section text. Results open their matching block, including under repeated headings. Markdown supports headings, lists, tables, and code; raw HTML is escaped and images are omitted. Relative Markdown links (including encoded spaces) and heading anchors resolve within the capture. Heading anchors use lowercase heading text, remove punctuation except `_`/`-`, replace spaces with `-`, and add numeric suffixes for collisions. Missing, excluded, or unsupported targets are identified. External HTTP(S) links open only after a click.

A refresh replaces the current capture rather than retaining history. Old references prompt a library reload. There is one refresh at a time per campaign; scans are outside database transactions and publication is atomic. Concurrent filesystem edits cannot be guaranteed to represent one instant; detected unreliable reads fail the scan. No background watching, source authority classification, assets, campaign-file editing, backup/restore, or live-session functionality is included. Chromium is the current developer acceptance browser; Safari/WebKit support is deferred. The development startup above remains required.

## Session preparation and reading

Choose a campaign and open **Sessions / New session** in the shared header. Give the new session a title and optional objective, or reopen an existing session there. The B workspace shows source documents/search passages in a horizontal shelf above the reader, alongside the current session's contents and notes. **Add source material** opens the library; add an entire document or a section from the reader. Additions keep the source open at its reading position and identify the destination session. A section includes its nested headings up to the next heading of equal or higher level. Search results open the same section reader; **Clear search** returns to the document shelf.

**Session contents** supports 30–50 prepared entries in a compact numbered list. **Find in session** searches saved titles/source context while retaining the original session numbers and order. Select an entry to inspect its frozen copy and show its up/down/remove controls. Clearing the find brings the selected entry back into view. Hide/show the library, contents, or notes to recover reading space. This local find is independent of full-content source search.

The source library defaults to **Play library**: explicitly classified current session material. Category buttons combine any of the eight card types; optional Filters combines required tags, purposes and statuses. Draft and superseded cards stay available through those controls, and an empty current view offers **Include drafts**. Search covers full content within the selected criteria. **Search all** retains the query and removes every criterion, including purpose/status and diagnostics, so guidance, tooling and legacy material remain accessible. Unclassified / invalid and Classification issues offer explicit diagnostic access; selecting either clears the default purpose/status restrictions. Active criteria can be removed individually. Filtering reads the existing capture without rescanning campaign files.

Entries show declared title/type/tags and optional authored summaries, with path/issue fallbacks. Search groups passages by document while retaining each exact target. Related cards open material without adding it. For Adventures, **Choose adventure material** offers the overview and directly linked eligible scenes as explicit checkboxes, including section targets. Additions save one at a time; completed/failed/pending progress remains visible after a failure, and **Retry remaining material** skips completed selections. Navigation and other source/order mutations are guarded during the queue; notes remain editable. Known guidance/tooling has no add controls, and backend validation remains authoritative for invalid declarations.

Both source and prepared readers offer **Document outline**, section focus, **Expand all**, and direct access to an authored **Quick reference**. Valid typed cards distinguish exact Read aloud and Mechanics headings visually. Only exact Background and Design notes subtrees start collapsed; names are matched after case/whitespace normalization. **Show Background** / **Show Design notes** and the outline disclose them, while search and source/captured links reveal their exact targets before focusing. Unknown headings and legacy/invalid material remain visible; ambiguous grouping disables automatic disclosure and unsafe section focus. No summary or quick-reference text is invented or imported from outside a selected subtree. Source provenance and frozen classification/relationship availability remain inspectable.

**Focus source** hides the browsing shelf, session contents and notes, retaining the open source or frozen reader. **Restore panels** restores their prior visibility. Individual library/contents/notes switches remain available; hiding the library shelf keeps an already open live source readable. These controls are local presentation state and do not change session contents or saved Markdown.

Prepared material is a frozen copy of captured Markdown, with source provenance. Changing, removing, excluding, or refreshing the original never rewrites an existing prepared item. Links resolve only to material captured into the session from the same original capture; unavailable targets are identified. Images are omitted, raw HTML remains escaped, and external HTTP(S) links require a click.

In Prepare, the notes page edits session or selected-item Markdown with a rendered preview; **Session details** edits the title and objective. Changing one note requests its preview without re-rendering every item's notes. Text edits autosave after a short pause; **Saved** means the backend completed the save. Failed saves retain local edits and show **Retry save** and **Reload / discard local edits**. Conflicting revisions require an explicit reload rather than overwriting another browser's changes. Leaving a session waits for pending edits or asks whether to discard failed local edits. Browser close/reload warns when edits remain; forced termination can still lose unsaved changes.

**Read session** hides the library and opens the folio with the same item order, selection, and rendered working notes. **Return to Prepare** resumes editing. Reading introduces no journal or session lifecycle records.

**Export session** exports the open session after pending edits save. In **Sessions / New session**, tick export checkboxes and choose **Export selected sessions**, or use the labelled import input for the destination campaign. Exports use JSON archive version 2; import accepts version 1 or 2. Import creates new sessions and items; it never overwrites existing sessions or requires the original files. Archives contain only selected sessions, notes, captured text, provenance, captured anchors, and optional frozen classification/relationship metadata. Version 1 imports retain legacy rendering; version 2 exports preserve that distinction. Older application versions reject v2; there is no v1 downgrade export. Limits are 20 MiB per archive, 100 sessions, 1,000 prepared items total, and 2 MiB per text/note field. These archives are not full database backups.

Increment 3A adds backend classification of typed Markdown cards, filtered source APIs, and captured link relationships using the [version 1 front-matter convention](docs/increment-3-typed-markdown-cards.md#accepted-version-1-metadata-contract--2026-10-18). Invalid metadata remains readable with classification issues. Explicit guidance/tooling cannot be added to sessions. Increments 3C.1–3C.2 provide the B workspace, large-session navigation, typed categories/filters and explicit adventure assembly above. Increment 3C.3 provides the production outline/disclosure/focus/search-reveal controls and integrated developer handover above; owner review and formal verification remain separate. Increment 3B freezes classification, authored summary, relationships, and interpretation when adding source material. New captures omit recognized front matter from display while retaining exact raw text/hashes. Existing prepared items and v1 imports keep their legacy text and rendering; current sources never backfill their labels. Source refresh, renames, splits, and deletion do not rewrite prepared metadata or make uncaptured links available.

## Design and evidence

- [Approved requirements](docs/product-specification.md)
- [Accepted architecture, setup scope, superseded history and developer-check evidence](docs/implementation-plan.md)
- [Historical Sea Witch assessment](../sea_witch/repository-app-assessment.md), in a separate campaign repository; its suggestions are not approved requirements.

Read [AGENTS.md](AGENTS.md) before agent development. Workflow documents and skills are under `.agents/`. Developer checks do not constitute formal verification; no formal verification record exists yet. Implementation evidence is recorded per increment; formal acceptance remains separate.
