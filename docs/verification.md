# Verification evidence

## P2G — Shared card geometry — 2026-10-22

**Assessment: PASS within the assessed scope.** The shared renderer satisfies the approved 243:420 geometry and preserves the covered card interactions, artwork and reading paths. No acceptance-blocking defect was found. Owner visual acceptance and P3/later implementation remain separate decisions. Historical P2 assessments below are preserved; the owner accepted P2 before authorizing P2G.

### Authorization and scope

The owner explicitly authorized verification after P2G implementation handover. Reviewed the current uncommitted working tree based on `0d505b4` against the [approved geometry contract and P2G scope](playthrough-implementation-plan.md#card-geometry-contract), accepted presentation boundaries and implementation evidence. This is a separate verification pass by the implementing agent, not an independent reviewer. No application or repository test source was modified during this pass; only this assessment was added. Temporary probes used synthetic records in the isolated smoke database and files under the system temporary directory.

### Fresh checks and evidence

`WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed during verification:

- **87 frontend tests across 13 files**, version checks, live OpenAPI client generation and production build passed.
- **All 22 Chromium journeys** passed, including dense-content geometry, illustrated Write/Prepare/Play/recovery, frozen artwork and current-format archive round trips, drag reorder/Used return, reader selection, retry and navigation protection.
- Isolated PostgreSQL restart/preservation passed and test services were cleaned up. Backend `test bootJar` succeeded with tasks up-to-date; no fresh backend-test execution is claimed.
- A separate real Chromium probe at 390×844 opened three Used cards, measured all three at **320×553.078125px**, confirmed no overlap using positions captured at the same scroll offset, and clicked each full-document action to read its frozen document. Its independent smoke/backend/frontend lifecycle completed and cleaned up successfully. Screenshot: `/tmp/p2g-used-tray.png`.
- Inspected fresh illustrated Write at 1440px, Play at 390px and the three-card Used-tray probe screenshot. Laptop card controls fit the preview; narrow Play retains vertical access to the card, Used target, reader and notes. Existing dense-browser screenshots document horizontal shelf scrolling after keyboard focus.

The additional probe initially encountered sandbox browser-launch restrictions, then missed the main check's already-stopped backend. It was rerun with an isolated service lifecycle. Its first position comparison mixed scroll offsets; the corrected same-offset comparison above passed. Those unsuccessful probe attempts supply no product pass/fail evidence.

### Acceptance assessment

| Contract | Assessment |
| --- | --- |
| 243:420 outer shape, 320px default | Pass. Shared CSS specifies the ratio; real browser measurements cover scene, NPC and item fixtures at 1440/1280/390/320px viewport widths. Laptop default remains 320px; the additional Used-tray measurement gives approximately 553px height. |
| Container-driven sizing and proportional presentation | Pass within tested containers. Renderer host uses its available width and an inline-size container; spacing and typography scale with readable minimums, and artwork keeps proportional height. Active and Used entries constrain card width; the narrow Used target stacks below the active shelf. |
| Dense content and keyboard/full-document access | Pass. Dense summaries and 30 tags remain present in a focusable scrolling area. A long title scrolls using the keyboard. Browser checks keep the document action inside the card and open frozen text from Play and Prepare. Focus styles and existing selection/action boundaries remain in the renderer. |
| Shared consumers, artwork and fallback | Pass within covered journeys. Write, draft chooser, prepared preview, Active/Used and Writing recovery use the same renderer. Illustrated card geometry/document actions, placeholders, failed-artwork retry and frozen images survive the covered workflows and archive transfers. |
| Scope and module ownership | Pass. Geometry remains presentation-only in shared PlayingCard and the existing CardTable sizing consumer. No new backend/API/domain persistence, image service, dependencies, card fields, extraction or back/flipping behavior was introduced. |

### Limits and exit

Existing warnings remain: initial bundle 739.17 kB against 500 kB, workspace stylesheet 7.91 kB against 4 kB and prototype stylesheet budgets. Tested Chromium viewport layouts do not establish Safari/WebKit, real touch dragging, exhaustive accessibility/screen-reader behavior, extreme zoom or arbitrarily tiny embedding containers. Future multi-focus layouts belong to later increments and were not assessed. Writing recovery's existing long record list is unchanged. No development database reset or independent campaign-content edits occurred. `git diff --check` passed before recording this assessment.

Recommend owner visual review and acceptance of P2G within these limits. Stop at the verification boundary; no corrective implementation, P3 or later increment is authorized by this result.

## P2 corrective re-verification — V-P2-03 — 2026-10-22

**Assessment: PASS for V-P2-03 within the assessed scope.** Navigation during a pending same-session Preparation reload now honors the originating workspace save/discard guard. This supersedes the V-P2-03 finding status in the assessment below; historical evidence is preserved. Together with the preceding V-P2-01/V-P2-02 re-verification, no recorded P2 acceptance-blocking finding remains open. Owner acceptance and later increments remain separate decisions.

### Authorization and scope

The owner authorized formal re-verification after the V-P2-03 corrective implementation handover. Reviewed the current uncommitted working tree based on `0d505b4`, including `app.routes.ts`, Preparation and Play workspace lifecycle/guard composition, and the real browser regressions in `frontend/e2e/preparation-recovery.spec.ts`. Assessed against P2's accepted scope, independent revisions/navigation protection and the six required correction behaviors from the implementation request. This is a separate verification pass by the implementing agent, not an independent reviewer. No application or test source was changed during this pass; only this assessment was added.

### Fresh evidence

`WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed in this verification pass:

- All **87 frontend tests across 13 files**, production build, version checks and live OpenAPI generation passed.
- All **21 Chromium browser journeys** passed, including the three delayed-reload regressions and the earlier Preparation recovery and independent workspace conflict/retry journeys.
- Backend `test bootJar` succeeded with tasks up-to-date; this is not fresh backend-test execution. Isolated PostgreSQL restart/preservation passed and smoke services were cleaned up. No development database reset or campaign-content edit occurred.
- `git diff --check` passed before recording this assessment.

### Required behavior assessment

| Required behavior | Finding and evidence |
| --- | --- |
| Pending Preparation reload cannot bypass workspace protection | Pass. The route guard grants the view-change shortcut only for a known matching campaign/session; null `current` reaches `SessionState.allowLeave()`, which invokes `play.allowLeave()` before departure. Fresh Chromium session and campaign switches required the workspace-specific dialog while the reload GET response was held. |
| Navigation waits/blocks or invokes the originating guard | Pass. The existing workspace guard flushes retained edits or waits for its in-flight save before permitting departure; failed saves require explicit discard. Browser cases exercise the failed-save path with the originating workspace retained. |
| Cancelling departure retains table changes | Pass. Cancelling keeps the origin route and table retry control. A separate journey then releases the reload and observes Used cards (1) and the retry control, while the saved backend workspace remains unchanged. |
| Explicit workspace discard permits departure | Pass. Both session and campaign journeys first cancel, then explicitly accept the workspace discard dialog with the same Preparation response still pending and reach the destination. Accepting the earlier Preparation reload dialog alone does not authorize workspace discard. |
| Late reload cannot replace or alter destination state | Pass within the tested schedules. After destination session opening, the held originating response is delivered; destination heading/route remain selected and the old table failure does not reappear. Code review confirms session open/campaign clear increments the epoch and stale success, failure and loading completion are rejected; UI recovery also checks its route epoch before initializing Play. |
| Preparation reload preserves independent workspace edits | Pass. The cancellation journey retains the local Used change after reload completion. State regressions also preserve the failed workspace data/revision while discarding Preparation notes; separate-save tests keep workspace fields out of Preparation saves. |

### Limits and exit

No new acceptance-blocking defect was found in this bounded review. The browser reproductions use retained failed workspace edits with delayed successful Preparation reload responses. Pending successful workspace-save/reload interleavings are supported by existing serialized-save tests and code review, not a new exhaustive browser schedule. Safari/WebKit, touch, exhaustive accessibility/concurrency, worst-case resources and later increments remain unassessed. Existing initial bundle (738.55 kB against 500 kB), workspace stylesheet (7.91 kB against 4 kB) and prototype stylesheet warnings remain.

Recommend owner acceptance of P2 within the combined recorded assessment limits. Stop at this verification boundary; no implementation, P2G or later increment is authorized by this result.

## P2 corrective re-verification — V-P2-01 / V-P2-02 — 2026-10-22

**Assessment: the original two findings are resolved within their assessed reproductions; P2 still requires correction for V-P2-03 below.** A related navigation defect can discard retained unsaved workspace changes during a pending Preparation reload. This assessment supersedes the initial P2 finding status for V-P2-01 and V-P2-02, while preserving that historical record below. It is not owner acceptance or authorization for another increment.

### Scope, authority and fresh evidence

The owner explicitly requested re-verification after corrective implementation handover. Reviewed the current uncommitted working tree based on `0d505b4`, including the new workspace recovery component/state/browser tests, against the prior findings, [P2's accepted scope](playthrough-implementation-plan.md#p2--frontend-workspace-integration), and accepted independent revisions/navigation protection. This is a separate review by the implementing agent, not an independent reviewer. No application or repository test source was changed; only this formal evidence record was written.

- Fresh `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed: live OpenAPI generation, version checks, **87 frontend tests across 13 files**, production build, **all 18 Chromium browser journeys**, and isolated PostgreSQL restart/preservation. Backend `test bootJar` tasks were up-to-date; no fresh backend-test execution is claimed.
- Re-ran the original temporary Chromium probe against the real Angular UI and packaged backend. On the same two-item failure sequences, successful Preparation retry and reload/discard each restored **two Active card entries**, with header **Saved** and no workspace error/recovery state. The queued-edit/503 sequence issued **one PUT**, instead of the previous two, without an explicit retry. Temporary scripts and synthetic campaign directories were outside application source; browser instances and owned smoke services were cleaned up.
- Inspected and freshly ran regressions for both 409 and 503 workspace failures, explicit retry with original revision/retained local order, pending/failed workspace preservation through same-session Preparation reload, unsuccessful/cancelled recovery, and late recovery after campaign/session/mode/component changes. Existing illustrated archives, reader/artwork/table behavior, filters and explicit navigation/retry/discard journeys also pass.
- A further controlled Chromium probe held the Preparation reload GET pending while navigating to a different session. It reproduced V-P2-03 below using only synthetic records in the smoke database.
- `git diff --check` passed. Existing size warnings remain: initial bundle **738.56 kB** against 500 kB, unchanged workspace CSS **7.91 kB** against 4 kB, plus existing prototype CSS warnings. No budget was relaxed, development database reset, independent campaign repository edited, or commit created.

### Resolution of original findings

| Finding | Assessment and evidence |
| --- | --- |
| V-P2-01: Preparation recovery leaves Play empty | Resolved for both original paths. Recovery controls now use the workspace UI to resume initialization/reconciliation after successful Preparation retry/reload. Current route/mode/identity checks suppress late initialization, and recovery in Prepare does not initialize Play. Same-session Preparation reload preserves failed table edits instead of clearing them. Fresh browser reproductions restore both saved cards. The new preservation behavior exposes the separate pending-reload navigation defect below. |
| V-P2-02: queued autosave survives failure | Resolved for the assessed timing. The workspace failure path cancels its pending timer. Fresh original Chromium reproduction observes only one PUT. Unit regressions cover 409 and 503, retaining local Active/Used order and expected revision until explicit retry; late old-identity failure cannot cancel a newer identity's timer because failure handling is epoch-guarded. |

### Required correction: V-P2-03 — navigation during Preparation reload discards retained workspace edits

**Severity: medium; acceptance-blocking for P2 navigation/save protection.** Unsaved table order/Used changes can be lost without the workspace save/discard guard. The saved backend table and frozen content remain intact; the lost change is the local runtime arrangement.

Locations: `frontend/src/app/app.routes.ts:7`–`17`; `frontend/src/app/preparation/session-state.ts:101`–`111` and `:437`–`443`.

Reproduced in Chromium:

1. Open a prepared session in Play, mark its card Used, and force its workspace PUT to return 409. Keep the failed local Used change.
2. Switch to Prepare, edit session notes, and force the Preparation PUT to return 503. Switch back to Play.
3. Click **Reload / discard local edits** and accept the Preparation reload confirmation. Hold its GET session response pending. Same-session reload intentionally preserves the failed table edits, but `SessionState.open()` sets `current` to null while waiting.
4. Open **Sessions / New session** and choose a different session before the held response completes.
5. Release the old reload response and reopen the originating session.

Observed: navigation to the other session succeeded. The only dialog was **Discard local edits and reload the saved session?** from step 3; no workspace retry/discard decision occurred during navigation. On returning, the card was Active, **Used cards (0)** was present, and **Retry table save** was absent: the retained local Used change had been cleared.

Root cause: `protectWorkingSession` returns true whenever `state.current()` is null, without checking retained Play workspace edits or reload/loading state. The new same-session reload correctly preserves workspace state but temporarily nulls Preparation's current session. Navigating in that interval therefore bypasses `SessionState.allowLeave()`; opening/binding another session clears the retained workspace. Recovery completion's route/identity checks prevent an old response from reopening the wrong view, but cannot protect local changes already discarded by that navigation.

Expected: navigation while reloading must either wait/block or honor the originating workspace save/discard guard, even while the Preparation reader has no current session value. The Preparation-discard choice must not silently become a later workspace-discard choice, since same-session reload intentionally retains that separate state.

Recommend a bounded correction to guard composition/originating-session lifecycle, with real router/browser regressions for a delayed same-session reload plus failed or pending workspace edits and a session/campaign switch. Assert that cancel retains the originating local table, explicit workspace discard permits departure, and a late reload response cannot replace the selected destination. The current UI recovery tests change a mock current-session value after recovery starts; they do not exercise the real router's `!current` shortcut.

### Limits and exit

The existing P2 functionality and original recovery fixes pass the covered checks, but V-P2-03 prevents an overall P2 pass. Safari/WebKit, touch, exhaustive accessibility/concurrency, worst-case resources and later tabletop increments remain outside this assessment. No unrelated historical finding is implicitly closed.

Stop at this verification boundary. Corrective implementation for V-P2-03 requires separate owner authorization; no fix was made during re-verification.

## P2 — Frontend workspace integration — 2026-10-22

**Assessment: correction required before P2 verification can pass.** The existing suites pass, but additional Chromium probes reproduce two recovery defects. No data loss or cross-campaign overwrite was observed. This is a separate verification pass by the implementing agent, not an independent reviewer assessment.

### Scope, authorization and method

The owner explicitly authorized P2 verification after implementation handover. Assessed the current uncommitted P2 working tree based on `0d505b4`, including untracked `frontend/src/app/playthroughs/` and `frontend/e2e/play-workspace.spec.ts`, against P2 in [the accepted plan](playthrough-implementation-plan.md#p2--frontend-workspace-integration), accepted ownership/concurrency rules in [the architecture](playthrough-domain-architecture.md), and existing preparation/save protections in [the product specification](product-specification.md). Card geometry, scene/focus, PlayNotes/history and later increments remain excluded.

Reviewed the generated-client integration, workspace save lifecycle, Preparation save/membership lifecycle, route guards, recovery controls, shared CardTable/artwork/reader integration and current-format portable transfer controls. No application code or repository test source was changed. Only this formal evidence record was written. Temporary diagnostic scripts under `/private/tmp` created synthetic campaigns and records in the isolated smoke database; their browser/backend/frontend processes and Compose services were cleaned up and synthetic source directories removed. No development database reset, independent campaign-repository edit or commit was performed.

### Fresh execution evidence

- `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed: live OpenAPI client generation, version checks, **77 frontend tests across 12 files**, production build, **all 16 Chromium browser journeys**, and isolated PostgreSQL restart/preservation. Backend `test bootJar` succeeded with tasks up-to-date; this pass does not claim fresh execution of the 62 retained backend tests.
- Existing browser journeys exercise illustrated Write → Prepare → Play, frozen notes/readers/artwork, actual drag/reorder/Used return, filtering/reopening, explicit workspace retry and stale-revision discard, current v6 portable ZIP round trips with remapped Used IDs, and obsolete archive rejection.
- Additional Chromium probes used the real Angular UI and packaged backend, with controlled browser interception of selected PUT failures. They reproduced V-P2-01 and V-P2-02 below. The initial temporary probe needed a selector correction to choose session-level notes before filling them; the corrected probe completed all three scenarios and cleaned up successfully. No product change was made to obtain these results.
- `git diff --check` passed. Existing production warnings remain: initial bundle **738.13 kB** against 500 kB; workspace CSS **7.91 kB** against 4 kB, plus existing prototype stylesheet warnings. No budget was relaxed.

### Required correction: V-P2-01 — Preparation recovery leaves Play without an initialized workspace

**Severity: medium; acceptance-blocking for P2 recovery/usability.** Prepared content remains saved, but the current Play view loses its usable table after ordinary recovery actions and offers no workspace recovery control.

Locations: `frontend/src/app/preparation/session-state.ts:211` and `:433`; `frontend/src/app/preparation/workspace.ts:161`; `frontend/src/app/preparation/workspace.html:243` and `:319`.

Two independently reproduced sequences with a saved two-item session:

1. Open the session in Prepare in a fresh page. Force a Preparation PUT to return 503, edit session notes and wait for failure. Switch to Play; `initializeTable()` returns early because the Preparation flush fails. Restore the PUT endpoint and click **Retry save** while still in Play. Preparation saves, but workspace initialization is never resumed.
2. Open Play successfully, switch to Prepare, fail a Preparation note save, then switch back to Play. Click **Reload / discard local edits** and accept discard. `SessionState.open()` clears the Play state while reloading Preparation; completing that reload does not reopen Play's workspace.

For both sequences, the observed result was **zero Active card entries instead of two**, **zero workspace recovery buttons**, and header **Saved**. The CardTable is disabled because `play.current()` is null. Switching Prepare → Play restores the two saved cards, demonstrating a frontend lifecycle failure rather than missing backend membership.

Expected: successful retry or discard/reload completes the current Play initialization/reconciliation, or exposes a clear recoverable workspace-opening state. A saved session in Play must not be left with an empty disabled table and no recovery action. Root cause: workspace initialization is triggered by route application, while these recovery controls only flush/reopen Preparation; they do not reapply the current Play lifecycle.

Recommend a bounded lifecycle correction that preserves originating campaign/session identity, independent revisions and retained local workspace edits. Add regressions for both recovery paths, including late responses/navigation while recovery completes. Do not initialize unopened workspaces merely because a user recovered notes in Prepare.

### Required correction: V-P2-02 — a queued autosave survives workspace save failure

**Severity: medium; acceptance-blocking for the explicit failure/retry contract.** Working changes and optimistic revision remain intact; no silent rebase or overwrite was observed. The failure does not remain explicit until a recovery action as promised in P2's implementation handover.

Location: `frontend/src/app/playthroughs/workspace-state.ts:92`–`100`, `:141`–`145` and `:179`.

Reproduction: in a two-item Play table, mark the first card Used and hold its autosave PUT pending. While that request is in flight, mark the second card Used; this schedules another debounce timer. Release the first PUT with 503 before the new timer expires. Make no retry/navigation action and wait 800 ms.

Observed: **two workspace PUT requests** occurred, although the owner only initiated the original save sequence. The pending timer calls `flush()` after the first failure, which clears the error and starts another save. The probe returned 503 for both requests and ended at **Save failed**; a successful second response could instead remove the failure state without an explicit retry. The existing test edits only after failure, when `edit()` correctly refuses to schedule a timer, so it misses this in-flight-edit timing.

Expected: on failure, cancel or suppress queued automatic follow-up saves while retaining all local order changes and the original revision. Explicit **Retry table save**, reload/discard or an approved navigation recovery action may then proceed. Add a focused regression for a newer edit queued during a slow save that fails before its debounce expires; cover 409 and temporary errors without silently rebasing.

### Other P2 acceptance findings and limits

| Approved behavior | Assessment and evidence |
| --- | --- |
| Dedicated workspace state and independent revisions | Pass within reviewed/tested paths. Workspace requests use their own generated service/revision; Preparation payloads no longer contain table fields. Unit and browser checks confirm runtime table changes leave Preparation notes/revision unchanged. Frontend session state composes lifecycle/guards; backend Preparation ownership/dependencies remain unchanged. |
| Existing table/card/reader/artwork behavior | Pass within existing Chromium journeys: preparation ordering remains separate, selection/full-document reading and frozen artwork survive Active/Used changes, filters do not mutate order, and reopening restores persisted workspace IDs. Shared geometry is unchanged, as required for P2. |
| Slow saves, identities and navigation | Selected checks pass: serialized successful saves retain newer edits, old opens/saves cannot replace another campaign/session or clear its save queue, and failed table saves guard session departure. V-P2-01 and V-P2-02 prevent an overall recovery pass. This is not exhaustive interleaving evidence. |
| Current-format portable controls | Pass within reviewed/tested paths: export waits for both frontend save lifecycles; ZIP import remains destination-scoped; illustrated round trip retains frozen content/notes/artwork and Used references with fresh identities. Old-format rejection matches the accepted disposable-data policy. |
| Scope | No new backend persistence, compatibility adapter, image store, dependency, card geometry, scene/focus or PlayNotes feature was introduced. |

Safari/WebKit, touch dragging, exhaustive accessibility, every failure/interleaving and worst-case archive/resource combinations remain unverified. No previous historical finding or later increment is implicitly accepted by passing regressions here.

### Exit

Recommend a bounded P2 corrective implementation for V-P2-01 and V-P2-02, followed by re-verification. Stop at this verification boundary. The repository workflow requires separate owner authorization for corrective application/test changes; this verification did not make those changes or authorize P2G.

## P1 — Playthrough workspace and current-format archives — 2026-10-22

**Assessment: pass within the approved backend P1 scope; no blocking defect found.** This does not establish a releasable frontend application or acceptance of later tabletop capabilities. The owner explicitly approved P1's temporarily incompatible frontend interval. Formal verification was separately authorized after implementation handover. This assessment is by the implementing agent in a subsequent review pass, not an independent reviewer.

### Scope, authority and method

Assessed the current uncommitted working tree based on `904665b`, including untracked Playthroughs/session-archives modules, against P1 in `docs/playthrough-implementation-plan.md`, accepted ownership/invariants in `docs/playthrough-domain-architecture.md`, the approved single-sided-card/notes scope and the owner's disposable-data decision. Reviewed domain/service/persistence/controller/codec code, V15, public module contracts, Spring transaction/campaign-lock behavior and the relevant integration tests. Historical saved objects/archives have no conversion or compatibility obligation. Scene/focus, PlayNotes/history, card geometry and frontend integration are outside P1.

No application or repository test source was changed during verification. A temporary diagnostic script outside the repository exercised the packaged backend over HTTP against its own disposable PostgreSQL container and synthetic campaign directories. Its backend process/container were cleaned up; no development database reset, campaign-repository mutation or commit was performed. Only this formal evidence record was changed.

### Fresh execution evidence

- `cd backend && ./gradlew test bootJar --rerun-tasks`: passed with all nine tasks executed, rather than relying on up-to-date developer results. XML reports total **62 tests, zero failures, errors or skips**. The packaged backend was rebuilt. Non-fatal Kotlin warnings remain.
- Modulith/ArchUnit checks pass. New cross-module access is through named public API packages; Preparation does not depend on Playthroughs. Domain/application dependency rules remain intact.
- The startup integration test fetched fresh live OpenAPI into ignored `backend/build/openapi-p1.json`, checking workspace operation IDs, the absence of `table` from Preparation session/save schemas and the workspace-containing archive schema.
- An isolated packaged-backend HTTP probe passed real GET/PUT workspace operations, unchanged-open stability, Preparation/workspace revision independence, stale-write **409**, invalid-membership **400**, foreign-campaign **404**, and required-revision omission **400**.
- The same probe exported unopened workspaces as explicit null, then round-tripped initialized Active/Used state through current-format ZIP and image-less JSON. It confirmed new item/session identities, correctly remapped pile membership, retained frozen text/provenance and successful reading after original synthetic source files were removed and their library refreshed.
- HTTP invalid-import probes rejected version 5, omitted workspace records, duplicate/missing table membership, unknown future runtime fields and bare JSON sent to the ZIP endpoint with **400**. The destination session count remained unchanged after these failures.
- `git diff --check` passed.

### P1 acceptance assessment

| Approved behavior | Assessment and evidence |
| --- | --- |
| One authoritative CardTable owner | Pass. Playthroughs owns workspace persistence/API. Preparation Session, SessionData, SaveSession and persistence mapping no longer contain table state. V15 creates the new workspace table and drops the old column without conversion or dual writes; integration checks confirm the column is gone. |
| Lazy initialization and stable order | Pass. First open follows prepared order; subsequent unchanged opens preserve revision/order. Reconciliation prepends new items and removes missing IDs while retaining surviving Active/Used order. Explicit full-table requests represent reorder, Used and return-to-front. No automatic rearrangement based on current source content. |
| Membership and independent optimistic revisions | Pass. Active/Used must be unique, disjoint and jointly cover current prepared membership. Play mutations leave Preparation revision/notes untouched. Reconciliation precedes stale-revision validation; invalid/stale writes do not partially persist. Missing session/campaign access is rejected. |
| Consistency under concurrent Prepare/Play/export | Pass within tested schedules. Each operation joins the containing-campaign transaction and acquires the existing pessimistic row lock before snapshots/writes. Integration latches hold a Prepare transaction while workspace writes and exports wait; after commit, export observes the committed notes/membership and the stale workspace command fails. Locks remain database-owned across JPA context clearing. This is not evidence of exhaustive race freedom. |
| Frozen public Preparation read contract | Pass. Campaign-scoped snapshot exposes ordered IDs, frozen content/classification, provenance, anchors and relationships through Preparation's API. Exact-target candidate states and anchors are declared for later P4R; no resolver or live-source substitution is falsely claimed implemented in P1. |
| Complete current-format archives | Pass within assessed cases. Version 6 requires one workspace record per session and preserves null versus initialized state. The coordinator snapshots both modules and stages required originals under one campaign lock, then packs/streams outside it. Import validates before persistent changes, assigns fresh session/item identities, remaps workspace references and resets concurrency revisions to zero. Origins remain historical, not rebound to the destination campaign. |
| Strict validation and atomic restore | Pass. Exact wire fields, canonical UUIDs, bounded numeric/string/count fields, duplicate-key/trailing-token rejection and workspace coverage checks are present. Current-version malformed-data tests and HTTP probes pass. A failure after the workspace restore rolls back Preparation and Playthrough rows together; image-owner failure tests also prove image/record rollback. |
| Artwork preservation and resource safeguards | Pass within existing processor/staging limits and covered cases. Illustrated ZIP tests preserve frozen artwork and an initialized Used pile through ID remapping/restart. Existing tests exercise missing/extra/tampered image data, canonical ZIP membership, actual byte counters, malformed/truncated containers and staging cleanup. Original/derivative ownership remains in Preparation; no new image store was added. |
| Scope and disposable-data handling | Pass. No old-format converter/adapter, source-file writing, scene/focus/note implementation, card geometry or frontend integration was added. Reset instructions identify the development Compose volume and require separate execution authorization; verification did not execute them. Writing recovery behavior remains covered by regression tests. |

### Limits and exit

The frontend remains incompatible with the new Preparation contract until P2. Its previously recorded generated-client build failure is an approved P1 limitation, not a backend acceptance failure; no frontend/browser/visual pass is claimed here. Client generation passed during implementation; this verification refreshed and inspected the live schema but did not rerun generation or the frontend build. The shared card shape and all later tabletop UX remain unassessed.

The assessment reuses and freshly executes implementation tests plus an external HTTP probe; it does not provide independent-reviewer context. Extreme manifest/count combinations, sustained load, every interleaving, OS crash/disk exhaustion and every possible image/archive input were not exhaustively tested. Archive authenticity is not established, and archives are not full database backups. No existing historical verification finding is implicitly closed by this P1 assessment.

Recommend owner acceptance of P1 within this bounded scope. Stop at this verification boundary; corrective implementation, P2 or another increment requires separate authorization.

## Increment 5 UI follow-up — shared Write / Prepare / Play — 2026-10-20

**Assessment: pass within the assessed scope; no blocking defect found.** Assessed the accepted “Shared mode UI and Prepare placeholders” requirements and “Shared Write / Prepare / Play UI” bounded plan, including the retained card-table interactions. This is a separate verification pass by the implementing agent, not an independent reviewer assessment. It does not reassess or close historical findings from other increments below.

### Evidence and method

Reviewed the current uncommitted working tree based on `8de2529`, rather than claiming that HEAD contains this implementation. Inspected App availability handling, the shared header and global theme, Writing search/disclosures/navigation, Prepare material filters/readers/placeholders, Play table filtering/events and their state/browser tests. No application or test source was changed during verification. Client regeneration reproduced the existing generated contract. Only this formal evidence record was written.

Fresh `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` execution passed: **63 frontend tests across nine files**, production build, **all 14 Chromium browser flows**, generated-client/version checks and isolated PostgreSQL restart preservation. Backend test/bootJar tasks were UP-TO-DATE, not freshly executed backend tests; existing XML reports total **44 tests, zero failures/errors/skips**. This frontend follow-up introduces no additional backend changes. `git diff --check` passed. Owned smoke services and containers were cleaned up; browser fixtures use temporary campaign directories and the disposable database.

### Requirements assessment

| Approved behavior | Assessment and evidence |
| --- | --- |
| Consistent campaign/mode/save header and contextual rows | Pass on shared-component inspection, browser navigation/save-guard flows and rendered screenshots. Write/Prepare/Play reuse the same presentation component; feature owners retain navigation, persistence and guards. Active mode is identified with `aria-current`. |
| Dark menus and availability without a permanent healthy indicator | Pass. Browser checks assert actual menu background/text colors and startup-failure/retry recovery. Unit checks cover startup and foreground return; subscription cleanup and suppression of concurrent checks are present on inspection. Save status is separate from availability. |
| Write body visible early; optional metadata, creation and export controls | Pass. The Writing flow asserts the body is in the viewport before expanding metadata, edits and saves a draft, checks backend persistence and reload, combines title/type filters, and exercises preview and failure recovery. Template inspection confirms disclosures and on-demand export/history access. Existing export/deletion/recovery flows pass. |
| Prepare compact filters and full-document-first material viewing | Pass on inspection and typed-library/authored-preparation/reader flows. Multi-type filtering, Search all, diagnostics and explicit assembly/approval remain accessible. Draft selection renders the document before switching to Card; prepared selection resets to Document. Reader metadata disclosures preserve the mounted safe reader and authored text. |
| Bundled placeholders across Prepare | Pass. Source and draft-list browser assertions verify placeholder coverage; source search-result, prepared-list and card templates use the same local SVG. Inspected Prepare screenshot shows source and session-list thumbnails. No per-card selection/storage or source-owned image fetching was added. |
| Play primary-type group plus text find | Pass. The table unit test covers combined filters across active/used, All including untyped entries, unchanged input order and suppression of filtered drop/reorder. Browser flow filters a used NPC, combines a nonmatching find, retains selected full text, clears filters and checks the saved arrangement. All eight existing types are provided without a new taxonomy. |
| Card interactions and persistence remain usable | Pass within Chromium coverage: actual whole-card reorder and Used-pile/tray drag, on-card keyboard alternatives, selection border, summary scrolling, independent preparation order, newly added cards at front, reopen and archive export. Both find/group filters disable drag and positional move actions. Explicit Mark used/Return actions remain available through card menus. |
| Play naming and compatibility | Pass. New navigation emits Play; new `mode=play` browser flow and existing `mode=read` reader/import flows pass. The route accepts both aliases. No play lifecycle record or journal is introduced. |
| Ownership, immutable material and save protection | Pass on inspection and regression evidence. Shared header only receives values/emits intents; Writing and Preparation own state. Frozen reading, captured links, archive portability, failed-save retention, conflicts and guarded navigation continue through existing owners and passing browser flows. Per-card images remain deferred. |

### Visual evidence and limits

Reviewed freshly generated screenshots for Write (`writing-card.png`), Prepare (`typed-library-1280.png`) and Play (`card-table-1440.png`) under their corresponding `frontend/test-results/` flow directories. Automated Prepare/Play viewport checks cover 1280×800 and 1440×900; the table retains 320px cards and has no external per-card control rows. Write's screenshot deliberately has metadata expanded; the body-visible default is established by the browser assertion before expansion. These generated screenshots are local artifacts, not tracked source.

The initial bundle remains **710.42 kB** versus the **500 kB** warning budget. Workspace CSS remains **7.91 kB** versus **4 kB**, with existing prototype stylesheet warnings. Builds pass; budgets were not relaxed. These are recorded nonblocking size risks, not performance benchmark results.

Safari/WebKit, real touch/iPad dragging, exhaustive accessibility, narrow-screen visual review, resource stress and exhaustive multi-browser interleavings were not verified. Menu color assertions establish the tested colors, not a complete contrast/accessibility audit. This scoped pass does not constitute a new assessment of every older backend feature or resolve historical findings below. No corrective application work is required by this assessment; commits and later increments remain separate actions.

## MW-5 — delete a Writing draft — 2026-10-20

**Assessment: correction required before verification can pass.** One reproducible HTTP validation defect violates the accepted missing/malformed-request behavior. Normal exact-revision deletion, retained history and the assessed race/failure behavior pass. The owner reviewed/approved implementation and explicitly authorized this verification. No application or test source was changed; this is a separate pass by the same agent, not an independent reviewer assessment.

### Scope and evidence

Reviewed MW12 and the accepted MW-5 architecture/plan against Writing deletion/service/persistence, V11, controller/error mapping, recovery enumeration, frontend confirmation/autosave/deletion state, navigation guards and existing developer tests. Ran `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh`: live Spring OpenAPI client generation, version checks, **59 frontend tests across eight files**, production build, **all thirteen Chromium flows**, and PostgreSQL restart persistence passed. Its backend tasks were UP-TO-DATE; separately ran `./gradlew cleanTest test` for fresh execution: **42 tests across thirteen suites, zero failures/errors**, including module/architecture checks and the V10→V11 upgrade fixture. XML totals were inspected. `git diff --check` passed.

Additional live HTTP probes used only newly registered temporary fixtures and the disposable smoke database, with a controlled backend/container lifecycle. The first probe stopped when the missing-revision defect was found; a second reproduced it and completed the remaining probes. Fixtures, owned backend and smoke containers were cleaned up. Existing real campaign/application data and unrelated uncommitted work were preserved.

### Required correction: V-MW5-01 — missing revision is reported as an unexpected server failure

**Severity: low; blocks a full verification pass against the accepted validation contract.** No deletion or data loss was observed for the malformed request. Normal UI requests supply the revision, so the ordinary deletion flow remains usable.

Reproduction against an existing campaign/draft:

```http
DELETE /api/campaigns/{campaign}/drafts/{draft}
Accept: application/json
```

Expected: HTTP 400 Problem Details identifying an invalid request, with the draft unchanged. Actual: HTTP 500 with `code: request.failed`, a correlation ID and `detail: The operation failed. Please retry.` Retrying the unchanged invalid request cannot resolve the missing parameter. Both independent probe lifecycles reproduced this result, and the draft remained available for subsequent saves/deletion.

Evidence: `WritingController.kt:59` declares required `@RequestParam revision: Long`. Spring raises `MissingServletRequestParameterException` before entering the service. `UnexpectedFailures.kt:16` maps unreadable messages and type mismatches to HTTP 400, but omits missing required parameters. Its catch-all at lines 20–24 therefore converts the binding failure to HTTP 500. This violates MW-5 plan item 1's invalid-request behavior and item 2's documented failure contract.

Recommend a bounded corrective implementation mapping the missing-required-parameter exception into the existing malformed-request/HTTP 400 handling, plus a live HTTP regression for missing revision that checks unchanged draft state and preserves 204/409 behavior. Error translation belongs to the existing platform web adapter; explicitly include that adapter in the corrective scope. Do not default to a valid revision, infer a current revision or weaken optimistic deletion checks.

### Other assessed behavior

| Area | Assessment and evidence |
| --- | --- |
| Scope and ownership | Pass on inspection and fresh architecture checks: Writing owns working-draft deletion; no source-file writer, Preparation mutation, trash/undo subsystem, new dependency or archive version is introduced. |
| Revision/ownership checks | Fresh integration tests and live probes pass: negative, fractional and overflowing revisions return 400; foreign/missing/repeated deletion returns 404; stale revision returns 409; exact revision returns 204 with an empty body. Missing parameter is the exception above. |
| Migration and retained history | V10→V11 fixture preserves stored export payload/summary and campaign ownership, removes only the mutable-draft FK, and permits deletion while retaining the artifact. Valid-artifact tests and HTTP probes demonstrate orphan approved/export snapshots survive backup/restore with exact Unicode/CRLF Markdown bytes and SHA-256. Existing recovery workspace bytes remain unchanged. |
| Atomicity and resurrection | Fresh tests pass for rollback and controlled save→delete/delete→save ordering under the campaign lock. Live probes confirm a late save and new approval of the deleted identity return 404. Copying the old working snapshot from a pre-deletion recovery workspace creates fresh draft/card identities at revision zero; the deleted identity remains absent. |
| Frozen sessions and campaign files | Integration/browser tests retain prepared text, metadata, order, notes and rendered reading across deletion/restart; fixture source bytes remain unchanged. HTTP probes compare the entire session and rendered response before/after deletion. |
| Confirmation and failure state | Browser/state tests pass for named confirmation/cancellation, permanent unsaved-edit warning, dirty/invalid drafts, in-flight save settlement without another save, stale deletion preserving local text, explicit reload/retry, uncertain/missing results, paused autosave and successful editor/list clearing. Owner visual review was already approved; this assessment does not add comprehensive accessibility/visual evidence. |
| Navigation and callbacks | State/route inspection and tested interleavings support pending-deletion navigation/edit/export guards and generation-based suppression of late preview/history/delete responses. Backend locking/live-draft lookup remains the authoritative protection against resurrection by other clients. |
| Regression and durability | All thirteen Chromium flows pass, including planner absence after reload, unchanged prepared notes and exact orphan export retrieval. Fresh backend tests preserve deletion through restart and cover recovery/session v1/v2/v3 regressions. Setup persistence and version/build checks pass. |

### Limits and exit

The initial production bundle is **541.31 kB**, exceeding the 500 kB warning budget by **41.31 kB**; existing preparation/prototype style-budget warnings remain. Builds succeed and budgets were not relaxed. Safari/WebKit, exhaustive request/tab interleavings, resource stress and forced-termination combinations were not assessed. Those limits are separate from the reproduced validation failure.

Present V-MW5-01 and stop. Corrective implementation requires owner authorization for its bounded scope, and re-verification remains separately authorized. Earlier MW-3/MW-4 assessments and the historical MW-2 finding are unchanged.

## MW-4 — portable detached Writing recovery — 2026-10-20

**Assessment: pass within the assessed scope.** No blocking MW-4 defect was found. The owner reviewed/approved the implementation and separately authorized this formal verification in the conversation. This is a separate verification pass by the same agent, not an independent reviewer assessment. It does not close the historical MW-2 finding or authorize further implementation.

### Scope and method

Assessed MW11, the accepted detached-recovery architecture, the MW-4 increment plan, and relevant manual-writing acceptance walkthrough/regressions. Inspected the recovery wire model/strict codec, validation, snapshot/export/import/copy services, persistence queries, V10 migration, draft recovery provenance, generated HTTP contract, frontend route guards and recovery state/UI, and corresponding backend/frontend/browser tests. Existing uncommitted work was preserved; no application or test source was changed during verification.

`WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed: live Spring OpenAPI client generation, runtime/dependency version checks, **52 frontend tests across eight files**, production build, **all twelve Chromium flows**, and PostgreSQL restart persistence. Its backend tasks were UP-TO-DATE. Separately executed `./gradlew cleanTest test` for fresh backend evidence: **39 tests across twelve suites**, including architecture checks and the three recovery integration scenarios. These establish fresh execution rather than merely reusing developer results. The setup script stopped its owned services/containers.

Additional HTTP probes used a temporary fixture and new records only in the disposable smoke database. A separately controlled smoke-backend lifecycle was needed after the first probe attempt missed the setup server's availability window; that first attempt produced no behavioral evidence. The successful probe lifecycle cleaned up its fixture, backend and smoke containers. Probes were kept outside repository application/test sources.

### Assessed behavior

| Area | Assessment and evidence |
| --- | --- |
| Ownership and isolation | Pass on inspection and fresh Modulith/ArchUnit checks. Writing owns recovery; V10 stores detached workspaces without campaign foreign keys and adds nullable live-draft recovery provenance. No folder registration/attachment, Preparation schema change or new dependency is introduced. Source/campaign identities remain historical values inside each isolated workspace. |
| Snapshot completeness and consistency | Pass within tested cases: campaign locking serializes backup against a controlled competing save; all current drafts and retained approved/export records are enumerated, including orphan approved snapshots. SQL strips stored previews from approved enumeration. Bounded preflight/serialization reject excessive data without truncating history. No source refresh/filesystem read is part of recovery backup. |
| Strict validation and atomicity | Pass: wire shape, required/null fields, versions, duplicate keys/identities, UUIDs, revisions, UTF-8, hashes, source evidence, snapshot consistency and link variants are checked before workspace insertion. Incomplete current drafts remain valid recovery content. Malformed mutations leave workspace counts unchanged. Injected failure after insertion rolls back the workspace; copy/restore transaction rollback is also covered. |
| Bounds | Pass for inspection and selected boundary cases: 64 MiB archive, 1,000 current drafts, 10,000 retained records combined, existing field/evidence/Markdown limits and 1,000 exports per historical draft. Fresh tests exercise exact 64 MiB acceptance using padding around a small archive, over-limit rejection, 1,000 small drafts, excessive counts and oversized fields. This is not exhaustive combined-boundary or resource-load evidence. |
| Detached restore and persistence | Pass: a full archive whose originating campaign UUID is absent restores without registration/source lookup; restore and copied-draft provenance persist after restart. Repeat imports produce independent workspace IDs. Existing work is not merged or overwritten. Re-export preserves archive content/evidence and all historical identities. |
| Historical fidelity and unavailable targets | Pass in integration tests and additional HTTP probes. Retained exports download their exact bytes/hash. A probe includes local, draft, source, missing, external and unsafe links, then moves/edits the target draft and deletes/refreshes the source. Backup/restore still succeeds with absent historical target material. Unicode/CRLF Markdown downloads match the original UTF-8 bytes and SHA-256; re-export JSON is semantically equal to the original archive. Mutating a retained draft-link path to contradict its destination returns HTTP 400 and creates no workspace. |
| Safe inspection | Pass on inspection and existing rendering tests: archive wire records omit derived HTML; recovered previews use Sources' public Authoring API and existing safe readers. Read-only history does not load mutable source/draft targets. Original evidence and historical export reports are inspectable; historical approved snapshots are distinguished from session-specific approval events. |
| Explicit resume | Pass: only a selected current recovered draft can be copied to an explicitly chosen registered campaign. The campaign lock and draft cap apply; new draft/card IDs and revision zero preserve working fields, source evidence and recovery provenance. Retained history stays in recovery. Fresh approval and ordinary export inspection remain required. Repeated deliberate copies are independent; no original source file is overwritten. |
| Save/navigation/request behavior | Pass within tested interleavings: route guards resolve pending Writing/session work; backup waits for successful save; failed saves block backup; uncertain imports reload workspace summaries; duplicate pending copy/import commands are blocked. Epoch/selection checks suppress stale responses. Transfer protection continues through post-import refresh. Existing writing/session navigation and failure flows pass. |
| Integrated walkthrough and regressions | All twelve Chromium flows pass, including source fork into a long Scene, reviewed export/manual fixture incorporation/refresh, frozen mixed-session content and notes after later edits, recovery after folder removal, exact historical download, re-export/re-import, and explicit copy/open/fresh approval in another campaign. Existing NPC/card, save-failure, 50-item navigation and session v1/v2/v3 backend/browser coverage passes. The complete walkthrough is distributed across these flows rather than one monolithic UI test. |

### Warnings and limits

- Production initial bundle is **537.74 kB**, exceeding the 500 kB warning budget by **37.74 kB**. Existing preparation/prototype stylesheet-budget warnings remain. Build succeeds; budgets were not relaxed.
- Safari/WebKit, exhaustive asynchronous/concurrency interleavings, destination-cap races, 10,000-record combinations and worst-case combined resource/load behavior were not dynamically assessed. The exact byte-boundary check uses padding, not 64 MiB of fully populated history. No exhaustive stress/recovery guarantee is claimed.
- Recovery contains saved current drafts and revisions actually retained for export/approval, not unsaved edits or arbitrary intermediate history. Forced-termination recovery remains unassessed. Sessions, complete source libraries/folders, credentials and AI records are excluded. Oversized histories require a future partitioned-backup design.
- The owner already reviewed and approved MW-4. Automated/browser evidence supports the assessed behavior; it does not claim comprehensive visual/accessibility acceptance or independent review. The historical MW-2 verification entry retains its original assessment pending separately authorized re-verification.

### Exit

MW-4 formal verification is complete with the limits above. No corrective application change is recommended from this assessment. Present the result and stop; any subsequent development requires its own authorized scope.

## MW-3 — exact-revision session approval — 2026-10-20

**Assessment: pass within the assessed scope.** No blocking MW-3 defect was found. The owner authorized formal verification in the current conversation. This assessment does not authorize MW-4 or claim completion of portable Writing recovery.

### Scope and method

Reviewed the current working tree against MW7/MW8, the prepared-card/full-reader aspects of MW5/MW6, the relevant acceptance walkthrough, and the accepted MW-3 plan in `docs/implementation-plan.md`. Inspected Writing retention and persistence, Preparation transactions/domain validation/persistence, V9 migration, frozen-link rendering, strict archive parsing/import/export, Angular draft selection/readiness/approval/navigation handling, and the corresponding integration/state/browser tests. This is a separate verification pass by the same agent, not an independent reviewer assessment. Existing uncommitted work was preserved.

Ran `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` successfully against the isolated smoke environment: live Spring OpenAPI client generation, dependency/runtime version checks, **47 frontend tests across seven files**, production build, **all 11 Chromium browser flows**, and PostgreSQL restart persistence. The script stopped its owned backend, frontend and smoke containers. Its backend test/build tasks were initially UP-TO-DATE; separately ran `./gradlew cleanTest test` to obtain fresh backend execution: **36 tests across eleven suites, zero failures/errors**, including Modulith/ArchUnit checks. Inspected the XML totals. `git diff --check` passed before recording this report.

### Assessed behavior

| Area | Assessment and evidence |
| --- | --- |
| Ownership and migration | Pass on inspection and fresh architecture tests: Writing owns immutable retained revisions behind `SessionDrafts`; Preparation owns approval identity/time and frozen copies. V9 preserves source provenance and constrains source/authored variants. No new dependency or campaign-file writer was introduced. |
| Exact revision and atomicity | Pass in fresh integration tests: stale session/draft revisions, cross-campaign requests, incomplete and oversized drafts are rejected. A surrounding transaction failure rolls back both retained revision and session append. Campaign locking and shared transaction boundaries support the intended serialization. Metadata status remains draft after session approval. |
| Frozen content and durability | Pass: text, metadata, summary, provenance, order and notes remain independent of later draft edits and source refresh/deletion. Copied material retains exact original evidence, including a colon-containing source filename. Mutable Writing rows are deleted in the isolated test; prepared reading and retained approved revisions survive application restart. |
| Frozen links and safe reading | Pass within exercised cases: local/repeated-heading anchors, exact draft revision targets and source-capture bindings resolve against frozen session material. A newer target revision cannot satisfy an older binding. Missing/unsafe targets remain unavailable; raw HTML is escaped and images omitted. Rendering uses no mutable draft lookup. |
| Mixed preparation and presentation | Pass in state/component tests and Chromium: labelled Sources/Drafts entry points, type grouping, saved-revision readiness and explicit approval; NPC insertion between source scenes, manual ordering, item notes, shared card and full reader in Prepare/Read. Existing source filters and the 50-item navigation flow pass. Inspected the generated authored-session screenshot at 1280 × 720; this is limited visual evidence, not a substitute for owner visual acceptance. |
| Save and navigation protection | Pass within tested interleavings: notes flush before approval, edits during capture are retained, stale approval preserves the session, late approval/render responses are isolated after campaign changes, older chooser checks cannot replace newer selections, and failed readiness checks disable approval. Existing writing/session navigation regression flows pass. |
| Archives | Pass: authored v3 round trip preserves evidence and remaps item navigation into an independent destination campaign without restoring Writing drafts. Explicit v1/v2 wire imports and legacy rendering pass. Strict parsing/domain validation reject malformed variants, identities, revisions, hashes/evidence, unknown fields, duplicate JSON keys, unsupported interpretation and oversize input before import writes. Existing count/text/byte bounds remain in place; inspection confirms v3 rejects duplicate item IDs across sessions. |
| Regression and scope | All automated checks above pass, including source copying, reviewed immutable Markdown download, isolated manual incorporation/refresh, source preparation and reading. No application/test changes, real campaign edits, real development-data operations or Git commits were made during verification. |

### Warnings and limits

- The production initial bundle remains **525.52 kB**, exceeding the 500 kB warning budget by **25.52 kB**. Preparation and prototype stylesheet budget warnings remain. Builds succeed; no budget was relaxed.
- Safari/WebKit, exhaustive concurrency/request interleavings, worst-case resource/load combinations and forced-termination recovery were not assessed. Existing bounds and selected oversized rejection cases do not establish exhaustive boundary coverage.
- The Chromium walkthrough uses a long NPC body; a separate long Scene approval walkthrough and every type-tab combination were not dynamically exercised. Type-independent approval logic and existing type catalog checks support those paths, but do not constitute separate visual evidence.
- Session archives preserve prepared copies, not Writing drafts or revision-history recovery. MW-4 remains unimplemented and outside this assessment. The historical MW-2 finding below retains its original status; passing regression checks here is not a separately authorized MW-2 re-verification decision.

### Exit

MW-3 formal verification is complete with the limits above. Present this assessment to the owner and stop. MW-4 planning or corrective implementation requires its own conversational authorization.

## MW-2 — source copies, reviewed Markdown export and links — 2026-10-19

**Assessment: correction required before verification can pass.** One reproducible export-validation defect violates the approved distinction between an ordinary opening thematic rule and a conflicting owned envelope. The existing automated suites pass but do not exercise this combination. No application or test code was changed during this verification.

### Scope and method

Reviewed the current working-tree implementation against the accepted manual-writing requirements in `docs/product-specification.md` and the MW-2 plan in `docs/implementation-plan.md`. This review covers MW4, MW9 and MW10 and relevant draft/reader regression behavior; it does not claim completion of direct draft-to-session capture or portable draft recovery. MW-3 and MW-4 remain outside scope.

Inspected Sources decoding/encoding and URI resolution, Writing copy/inspection/export/persistence/HTTP behavior, frontend working-state guards and source/reader/export controls, migrations, and developer tests. Used the same agent with a separate verification pass; this is not an independent reviewer assessment.

Ran `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` against the existing isolated smoke environment. It completed successfully: live OpenAPI client generation, version checks, **42 frontend tests**, production build, **10 Chromium flows**, and PostgreSQL restart persistence. Gradle reported its backend tasks **UP-TO-DATE**; inspected the retained backend XML evidence showing **32 tests across ten suites, zero failures**, rather than representing these as newly executed backend tests. The source/test files were unchanged from the corresponding developer run. `git diff --check` passed.

Additional live HTTP probes used only a new temporary fixture and records in the disposable smoke database. They created a draft, saved each body with its exact revision, and called `POST /api/campaigns/{campaign}/drafts/{draft}/export-inspection` with the expected revision and null capture. No real campaign or development database was used. The temporary directory was removed; the setup script stopped its backend and containers after completing checks.

### Required correction: V-MW2-01 — body-envelope detection rejects literal Markdown and depends on line endings

**Severity: medium; acceptance-blocking for MW-2.** An otherwise valid document can be saved but cannot be exported. Source/body bytes remain intact; no data loss or source mutation was observed.

Location: `backend/src/main/kotlin/workbench/sources/adapter/markdown/MarkdownAuthoring.kt:64`–`68`. When a body begins with `---\n`, the fallback scans its first 65,536 characters for any line matching `^workbench\s*:`. This scan is not restricted to an actual front-matter envelope and includes fenced code. Its opening-delimiter check recognizes LF only. The shared parser handles closed CRLF envelopes, but the fallback's behavior differs for an unclosed candidate.

Reproduced body, with LF endings:

````markdown
---
An ordinary opening thematic rule.

```yaml
workbench: example
```
````

Actual result: inspection contains `The body must not contain a second front-matter envelope.` The exact body remains present in the generated Markdown, but export creation rejects this error. Expected: the thematic rule, ordinary prose and literal fenced YAML remain exportable; the fenced example is not a second owned envelope. This fails MW-2 plan item 6's explicit ordinary-thematic-rule requirement and affects MW9.

Probe results:

| Saved body | Inspection errors | Exact body retained |
| --- | --- | --- |
| Opening rule + prose + fenced YAML example above | Second-envelope error | Yes |
| Opening rule + ordinary prose only | None | Yes |
| `---\nworkbench: {}\nUnclosed\n` | Second-envelope error | Yes |
| Same unclosed candidate using CRLF throughout | None | Yes |

The LF/CRLF difference is a second symptom of the same detection defect. This is not evidence of executable content: the renderer still escapes raw HTML and omits images. Corrective work should constrain detection to the opening envelope candidate, respect Markdown literal/prose boundaries and use consistent BOM/LF/CRLF handling. Add focused regression cases for the demonstrated false positive, the equivalent CRLF body, legitimate closed conflicting envelopes, and consistent handling of unclosed candidates. Do not rewrite authored body text or relax the canonical metadata/YAML safety rules.

### Other assessed behavior

| Area | Assessment and evidence |
| --- | --- |
| Module ownership and dependencies | Pass on inspection and existing Modulith/ArchUnit evidence: Writing owns draft/provenance/export persistence; Sources owns YAML and URI interpretation; no Writing dependency on Preparation or direct Sources table access. |
| Source copies and identity | Pass within tested cases: independent draft/card IDs, draft status, explicit legacy type, exact body, retained original evidence/extras, no application source writes, stale-capture rejection and persistence after deletion/refresh/restart. |
| Unsafe metadata | Pass within tested cases: unsupported schema, aliases, duplicate/non-string keys, explicit tags and incompatible fields are rejected without partial copy. Source reading remains available. |
| Reviewed export and stale context | Pass within tested cases: pending saves are flushed; fingerprint includes revision/content/path/capture/target revisions; creation rechecks under the campaign transaction lock; errors and unacknowledged warnings block creation; stale revisions/captures/dependencies are rejected. Body-envelope exception above prevents an overall pass. |
| Immutable artifacts | Pass within tested cases: stored snapshot/body/hash/report, scoped retrieval, exact HTTP bytes and hash, repeat download after edits/source changes/restart, and compact history-summary queries. |
| Links and placement | Pass within tested cases: local/duplicate anchors, original source/self/draft references, ambiguity, moved placement, encoded spaces, missing targets/anchors, unsafe schemes, root escape and query rejection. Source navigation checks capture identity; draft navigation uses save/discard protection. |
| Browser compatibility round trip | Pass in Chromium: source copy → edit → acknowledge/download → identical repeat download → manual fixture incorporation → explicit refresh → matching UUID/type/status/tags/summary. Legacy explicit type and unsupported-schema copy failure are exercised. |
| Existing preparation and archives | Regression suite passes; no preparation migration/archive revision was introduced. MW-3 integration remains unimplemented by design. |
| Scope | No new dependencies, campaign-file writing, AI integration, image upload, batch export, source replacement or general recovery implementation found. |

### Warnings and limits of this assessment

- The production initial bundle is **509.66 kB**, exceeding the **500 kB warning budget by 9.66 kB**. Build succeeds. Existing preparation/prototype style-budget warnings also remain. This is a performance follow-up, not the demonstrated correctness failure.
- Resource bounds are present in code, but worst-case sizes/counts, the 1,000-artifact boundary, high concurrency and load were not dynamically stress-tested in this pass. Existing tests do not provide exhaustive boundary evidence for every approved cap.
- Some frontend asynchronous transitions are covered by state tests, but exhaustive campaign-switch/request interleavings and failure combinations were not demonstrated. No claim of exhaustive race freedom is made.
- Safari/WebKit, forced-termination recovery and owner visual acceptance were not assessed. Markdown export remains portable content rather than a complete draft/revision backup.

### Exit

Recommend a bounded corrective implementation for V-MW2-01 in the Sources authoring adapter and focused regression tests, followed by re-verification. The repository workflow requires owner authorization before that corrective code work. This verification does not authorize fixes, MW-3, or changes to accepted product scope.
