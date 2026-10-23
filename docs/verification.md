## Card background presentation — 2026-10-23

**Assessment: PASS within the approved small increment.** The owner approved the full-card artwork/lower-panel scope, the separate phase skips, implementation, verification and necessary fixes. This separate formal review followed the completed developer checks; it was performed by the implementing agent, not an independent reviewer. No corrective application change was needed during formal review.

Assessed the [accepted increment and developer evidence](implementation-plan.md#card-background-presentation--accepted-increment--2026-10-23) against the accepted product requirement and supplied Brother Colm reference. The shared renderer fills the existing 243:420 card with centered cover artwork and an opaque parchment lower panel at 40% height. Cropping replaces P2A's letterboxing without stretching or changing the 320px default size. Existing title/type/summary/tags/document action remain; no new stat fields were introduced.

Evidence and assessment:

- **Geometry/readability: pass.** Existing browser tests now assert portrait/landscape/square cover fitting, full-card image height, lower-panel proportions/bounds and opaque background at 1280/390/320px. Reviewed rendered portrait and landscape card screenshots and the dense 320px Play screenshot. Existing dense-title/summary keyboard-scroll and full-document tests pass at 1440/1280/390/320px.
- **Behavior/recovery: pass.** Reviewed unchanged selection/keyboard handlers, the action-menu stacking order and the artwork message offset above the panel. The artwork integration journey passes failed-save recovery, frozen prepared artwork, Active/Used/return, failed artwork GET and clickable Retry, responsive presentation and session/Writing-recovery archive round trips. Shared Library, Write, Prepare, Play and recovery rendering retain the full regression coverage. Thumbnail defaults and image persistence remain unchanged.
- **Integrated evidence: pass.** `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh`: **111 frontend tests in 16 files**, production build, **36 Chromium journeys**, live OpenAPI/client generation/version checks and isolated PostgreSQL restart preservation. Backend test/module/package tasks were up-to-date, not freshly executed. Final log `/tmp/card-background-check.log`; screenshots are derived under `frontend/test-results/`. `git diff --check` passes. No application changes followed this run.

Limits: center cropping can hide image edges and artwork beneath the opaque panel, as approved; no per-card focal-point control was added. Owner visual acceptance remains separate. Chromium checks do not establish Safari/WebKit or exhaustive assistive-technology coverage. Existing nonblocking budget/generator warnings remain (initial bundle **782.74 kB**); no budgets were raised. Temporary logs/screenshots are not guaranteed durable artifacts. No backend/schema/archive change, campaign-content edit, development database reset or commit occurred. UW5 was not started.

## UW4 — dedicated Library and shared session navigation — 2026-10-23

**Assessment: PASS within the approved UW4 scope.** Implementation, developer checks and the separately authorized formal pass are complete. Recommend owner acceptance; UW5/UW6 remain separately gated.

The owner explicitly authorized UW4 implementation, verification and necessary fixes. Assessed the delivered frontend against the [accepted UW4 scope and developer evidence](implementation-plan.md#uw4--accepted-library-and-shared-navigationsession-context), [accepted unified requirements](product-specification.md#unified-library-writing-and-preparation--accepted-requirements--2026-10-22), [accepted UX](unified-workspace-ux-design.md) and architecture reconciliation. This was a separate verification phase by the implementing agent, not an independent reviewer. No application correction was needed during this formal pass; the application stayed unchanged after the final integrated developer run.

| Criterion | Assessment |
| --- | --- |
| Unified discovery and reading | Pass. Dedicated lazy Library route composes UW1/UW2, preserves Draft precedence and uses shared search/type/tag/purpose/status/diagnostic controls. Compact illustrated rows, Document-first selection, optional shared Card presentation and secondary provenance/validation Details. Explicit Source conflict-path inspection and stale reload are available. No Create document action in Library. |
| Explicit destination and navigation | Pass. Library/Write/Prepare/Play expose the same route-owned campaign/session context. No session is inferred from a previous visit; selection, switching and clearing retain the Library reader/query. Campaign switch clears the destination. Existing owner save/navigation guards retain failed Writing/Preparation edits until explicit recovery. Session creation precedes Add. |
| Atomic Add and representation safety | Pass. Successful saves precede UW2 mutation. Captured destination, catalogue capture and exact Draft ID/revision remain explicit. Failed and stale operations retain reading and support deliberate retry/reload. Existing membership yields persistent exact View in Prepare choices; update availability directs to Prepare. Current filters can hide an automatically associated Draft without preventing selected-document recovery. |
| Asynchrony and content ownership | Pass. Request/epoch checks reject mismatched catalogue/read/mutation feedback; switching destination cannot redirect an in-flight Add. Confirmed or uncertain dispatched additions invalidate Preparation's cache through its owner. A stale cached session revision does not override the current catalogue revision. Navigation context owns no content or save queue. No backend module, API, database, archive, dependency or card-geometry change. |
| Layout and keyboard behavior | Pass within tested dimensions. Browser assertions establish independent overflow regions at 1280×800 and 1440×900, stacked scrolling at 390×844, no page-width overflow and retained 243:420 Card ratio. Native row-button keyboard selection and exact linked-section focus pass. Laptop and narrow screenshots were inspected. |
| Compatibility and increment boundary | Pass. Existing Prepare/Write contextual selectors and Play focus/scene/Used/save/archive behavior retain their regression coverage. UW5 Write research/return, Prepare Scene planning, explicit replacement/removal confirmation and later PlayNotes/history were not implemented or claimed. |

Evidence:

- Final integrated developer check **passed**: `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh`; log `/tmp/uw4-final.log`. Live OpenAPI/client generation and version checks, **111 frontend tests in 16 files**, production build, **36 Chromium journeys**, and isolated PostgreSQL restart/preservation. Backend test/module/package tasks were up-to-date; inspected existing XML reports contain **83 passing tests in 24 suites**, zero failures/errors. This is reused unchanged backend evidence, not a claim of fresh backend execution.
- Separate formal browser/HTTP probe against the packaged backend and isolated smoke database **passed**. Independently exercised no destination → create session → verify empty membership → concurrent session-note save → stale Add rejection without membership mutation → explicit selected-document reload → successful Add retaining the concurrent note. Verified original campaign Markdown bytes were unchanged and original Source evidence remained visible after associated-Draft reload. The formal lifecycle also passed isolated database restart preservation. Script/config and log: `/tmp/uw4-formal/acceptance.spec.cjs`, `/tmp/uw4-formal.config.cjs`, `/tmp/uw4-formal.sh`, `/tmp/uw4-formal.log`. These are temporary local evidence, not guaranteed durable artifacts.
- Inspected the final implementation, route/save guards, generated-client parameter/Accept usage, owner cache invalidation, independent CSS overflow regions, test reports and UW4 screenshots under `frontend/test-results/`. `git diff --check` passes. No independent campaign repository, development database reset or commit was involved.

Limits: initial bundle **781.73 kB**, existing style/initial budget warnings and generator warnings remain nonblocking; no budgets were raised. Chromium evidence does not establish Safari/WebKit behavior, exhaustive assistive-technology coverage, maximum catalogue performance or every concurrency schedule. Session archives remain v8 and Writing recovery JSON v3 / ZIP v4. No next-increment authorization or owner acceptance is inferred.

## UW3 — session Scene associations and archive integration — 2026-10-23

**Assessment: PASS within the approved UW3 scope.** No acceptance-blocking defect was found and no corrective application change was needed during formal verification. Recommend owner acceptance; UW4–UW6 remain separately gated.

The owner explicitly authorized UW3 implementation, verification and necessary fixes. Assessed the completed implementation against the [accepted UW3 scope and developer evidence](implementation-plan.md#uw3--accepted-session-scene-associations-and-archive-integration), accepted unified requirements/UX and architecture reconciliation. This is a separate verification phase by the implementing agent, not an independent reviewer. Formal assessment followed the completed integrated developer run; the application did not change afterward.

| Criterion | Assessment |
| --- | --- |
| Session ownership and validation | Pass. Preparation owns bounded directed edges and uses the Session revision/campaign lock. Same-session endpoints and valid frozen Scene origins are required. Shared targets/multiple Scenes and historically duplicated prepared cards retain exact endpoint identity; no automatic membership or Markdown-derived edges. Module/dependency checks pass. |
| Persistence, replacement and cleanup | Pass. V18 initializes existing sessions with empty links. Session-row serialization survives item delete/reinsert, repeated saves/reorders and application restart. Same-type UW2 replacement preserves links, notes/order and Play identities; illustrated archive round trip preserves artwork and remaps links. Incoming/outgoing removal is atomic with membership; removal-impact supplies revision and Scene IDs/titles. Play reconciliation remains Play-owned. |
| Play composition and existing controls | Pass. Related cards use only exact explicit endpoints in preparation order. Reads do not save/activate/reorder/focus/return Used cards. Browser checks retain Used indicators, explicit focusing, fourth-card inspection and requested slot replacement. Frozen Markdown section navigation still resolves through the existing reader; it does not populate contextual associations. |
| Strict complete archives | Pass. JSON/ZIP v8 requires exact association fields, validates same-session endpoints/valid origins/unique edges and enforces count/manifest limits before import. Versions 1–7, missing/null/unknown fields, invalid UUIDs, duplicates, dangling/non-Scene/cross-session edges and excessive edge count reject without partial sessions. Imported IDs are fresh; links and initialized workspace references remap, origin provenance/artwork remain frozen, and unopened workspaces stay null. |
| Revisions and concurrency | Pass. Stale session edits reject without writes. Separate concurrent HTTP commands with the same revision yield one success and one 409. Controlled backend membership/workspace/export concurrency preserves snapshot consistency and exports no dangling edge after removal. No reverse Preparation→Playthroughs dependency. |

Evidence:

- Final integrated developer run `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed: **83 freshly executed backend tests in 24 suites**, zero failures/errors/skips; module checks and backend packaging; live OpenAPI generation/version consistency; **98 frontend tests in 15 files**; production build; **31 Chromium journeys**; isolated PostgreSQL restart/preservation. Logs: `/tmp/uw3-setup.log`; XML reports inspected. The earlier `/tmp/uw3-backend.log` also passed, before the additional replacement/concurrency assertions; final evidence uses the integrated run.
- Separate formal probes against the built application and isolated smoke database passed **29 HTTP assertions** plus the controlled two-command revision race. Checked no implicit hyperlink associations, explicit link creation, shared targets, no runtime mutation, stale/non-Scene/missing endpoints, missing/null required command values, removal names, strict malformed/legacy archives, exact remapping and membership cleanup. Log `/tmp/uw3-formal.log`; script `/tmp/uw3-probe.py`. Temporary evidence is local and not a guaranteed durable artifact. Both service lifecycles cleaned up.
- Inspected generated required schemas for `SessionData.sceneLinks`, both endpoint UUIDs, both command fields and removal-impact fields. Inspected the final 390px related-card screenshot under `frontend/test-results/focused-tabletop-related-c-ecd5d-cus-or-full-slot-inspection/related-390.png`; existing responsive geometry checks also pass at 1280/390/320px. `git diff --check` passes.

Limits: existing Angular bundle/style budgets (initial **776.58 kB**, workspace CSS **7.94 kB**), Kotlin and OpenAPI-generator warnings remain nonblocking; no budgets were raised. This does not establish maximum-size edge performance, all concurrency schedules, Safari/WebKit or exhaustive accessibility. Scene-planning/removal-confirmation UI, dedicated Library and shared navigation remain UW4/UW5; no claim of those features or PlayNotes/history is made. Session archives are v8 and Writing recovery remains JSON v3 / ZIP v4. Association endpoint/uniqueness integrity is application-enforced under the campaign lock, rather than cross-row database constraints, to preserve existing item-row replacement semantics.

No development database reset/migration, independent campaign-repository edit or commit occurred. Stop at UW3 verification handover; owner acceptance and later implementation approval remain separate.

# Verification evidence

## UW2 — atomic Library Add and explicit prepared replacement — 2026-10-23

**Assessment: PASS within the approved UW2 backend scope.** No acceptance-blocking defect was identified and no application correction was needed during this verification pass. Recommend owner acceptance within the limits below; UW3–UW6 remain separately gated.

### Authorization, scope and method

After reviewing the documented increment, the owner explicitly authorized UW2 implementation, verification and necessary fixes. Assessed the delivered backend against the [accepted UW2 plan and developer evidence](implementation-plan.md#uw2--accepted-backend-atomic-add-and-prepared-replacement), [unified requirements](product-specification.md#unified-library-writing-and-preparation--accepted-requirements--2026-10-22), accepted workspace UX and architecture reconciliation. This was a separate verification pass by the implementing agent, not an independent reviewer. Application changes stopped before the formal pass; documentation records its outcome. No frontend feature, Scene association persistence or PlayNotes/history was assessed as delivered.

Reviewed Preparation orchestration and its shared approval/freezing path, public module boundaries, campaign lock/transaction behavior, identity and section checks, stale expectations, status composition, frozen link resolution and current archives. Used independent HTTP requests against a packaged server with fresh synthetic campaigns/sessions/Drafts, alongside the database-backed regression evidence. Existing UI browser regressions check compatibility; they do not exercise future unified Library controls.

### Assessment and evidence

| UW2 criterion | Assessment |
| --- | --- |
| Preparation-owned composition, public contracts and campaign transaction | Pass. Preparation calls Campaigns/Writing public contracts and existing Preparation approval/freezing operations. No Writing→Preparation or Preparation→Playthrough dependency is introduced. Modulith/ArchUnit pass. |
| Atomic whole-card Add and associated reuse | Pass. Four concurrent identical calls create one automatic Draft/item and advance membership once; retries return the existing item. Another session reuses the Draft. Late-failure database tests roll back automatic Draft, association, approval and item writes together. |
| Exact expectations and conflicts | Pass. New membership and replacement check capture, session revision, Draft ID and numeric revision; a recreated Draft with the same numeric revision cannot satisfy an old identity. Incomplete/conflicting additions reject without partial creation. Existing-item Add is a documented no-write retry exception for old session/Draft expectations, while stale captures/conflicts still reject. |
| Membership and session status | Pass. Shared query/type/tag filters compose with ready/already-prepared/update-available/blocked state and explicit ordered matches. Section captures do not satisfy whole-card membership; historical multiple copies are returned without arbitrary selection. Foreign-origin imports cannot satisfy local membership or be rebound by replacement. |
| Explicit same-type replacement | Pass. The exact saved version replaces content/artwork/approval/outgoing bindings while retaining item ID, order, preparation/session notes and objective. Entire Active/Used/active Scene/focus workspace remains identical. Stale/type-changing updates reject; exact-current replacement is a no-op. |
| Frozen targets and independent retention | Pass. Updating a target makes an older incoming exact-revision link unavailable when that target is absent; replacement's own outgoing bindings refer to its approved snapshot. Artwork/text survive independently of working Draft edits. Illustrated late-failure replacement rolls back approval, Preparation artwork and content. |
| Archives, origin identity and restart | Pass. Illustrated v7 ZIP round trip preserves replaced frozen provenance/artwork/notes and remaps runtime item references. Null-workspace manifests stay uninitialized. JSON manifest restoration and restart checks pass. Existing fields fully express UW2; no persisted-state or format change is required. |
| Existing frontend and scope | Pass. Generated API includes all three new operations and required nullable representation fields. Existing screens compile and their browser regressions pass. No source-file mutation, database reset, frontend redesign or later UW implementation is included. |

### Execution evidence

- Developer run `./gradlew --no-daemon cleanTest test bootJar` freshly executed **83 backend tests in 24 suites**, with zero failures/errors/skips. This includes seven new UW2 database/HTTP journeys and all existing module, migration, concurrency, image, Writing recovery, session archive and Playthrough regressions. XML totals were inspected. The formal integration runner's subsequent backend build reused these passing outputs; it did not claim a second fresh 83-test execution.
- Ran `/tmp/uw2-verification.sh`, derived from the existing isolated setup check, with `WORKBENCH_CHECK_FRONTEND_PORT=4201`. It built/started the packaged server against the smoke Compose database, generated the Angular client from live OpenAPI, then ran `/tmp/uw2-verification-probe.py`. **All 40 independent HTTP checks passed**, including concurrent Add, cross-session reuse, stale capture/session/Draft expectations, recreated-Draft identity collision, update status, explicit replacement, complete runtime-state preservation, type rejection, incomplete no-write failure, campaign isolation, bounded/malformed commands and source immutability. Temporary campaign directories were removed.
- Live OpenAPI/client generation and version checks passed. Inspected all three new operation IDs, the five required mutation fields and their nullable capture/Draft representations in the generated schema/client. **98 frontend tests in 15 files**, the production build and **all 31 Chromium browser regressions** passed. PostgreSQL installation state survived the isolated database restart; the runner stopped its server and smoke services. No JAR rebuild overlapped a running verification server.
- Evidence: `/tmp/uw2-verification.log`, `/tmp/uw2-verification.sh`, `/tmp/uw2-verification-probe.py`, `/tmp/uw2-verification-results.json`, and backend XML reports under `backend/build/test-results/test`. Temporary/build artifacts are not guaranteed durable; this document retains the assessment and counts. `git diff --check` and whitespace/newline checks for all newly added files passed.

### Limits and exit

Existing Angular bundle/style budget, OpenAPI-generator 3.1 and Kotlin warnings remain nonblocking. This pass does not establish maximum-size catalogue performance, exhaustive concurrency schedules or Safari/WebKit behavior. Laptop layouts for future unified workspaces, unsaved-editor handling in their new Add flow, Scene planning/association persistence and PlayNotes/history belong to later increments. Existing Source/Draft frontend pathways remain unchanged until their authorized UX replacement; no new UI controls are claimed by UW2. Session archives remain v7 and Writing recovery remains JSON v3 / ZIP v4.

No production database reset/migration, independent campaign-repository edit or commit occurred. Stop at UW2 verification handover; owner acceptance and later increment approval remain separate.

## UW1 corrective re-verification — V-UW1-01 and V-UW1-02 — 2026-10-23

**Assessment: PASS within the assessed UW1 scope. V-UW1-01 and V-UW1-02 are resolved.** Independent HTTP reproductions now pass, including positive current-representation reads and negative stale-identity reads. No remaining acceptance-blocking UW1 defect was identified in this pass. Recommend owner acceptance within the recorded limits; later increments remain separately gated. The original failed assessment is preserved below.

### Authorization, scope and method

The owner authorized verification of V-UW1-01, correction of V-UW1-02 and subsequent verification without intermediate confirmation. The initial seven-test Library integration run passed, including the V-UW1-01 regression. A new HTTP regression then reproduced V-UW1-02 before its fix. The bounded correction and developer evidence are recorded in [implementation-plan.md](implementation-plan.md#uw1--v-uw1-02-corrective-implementation--2026-10-23).

Assessed the current uncommitted working tree based on `65aafc8` against the original UW1 scope, approved identity architecture and the two failed findings below. This is a separate verification pass by the implementing agent, not an independent reviewer. Application changes stopped before final verification; only this formal assessment was added during that pass. Derived client/build artifacts and temporary diagnostic probes are evidence, not new application features.

### Resolution

| Finding | Resolution and evidence |
| --- | --- |
| V-UW1-01 — secondary conflicting Sources absent from search | Source-only search considers every candidate's rendered sections, path and decoded title/tags/summary without assigning authoritative classification. The regression covers both candidate positions, filename reordering, explicit reader choice, blocked readiness, no implicit Draft creation and effective-Draft precedence. Separate HTTP probes now find both body needles and secondary/renamed paths before and after candidate reordering; reader choice still requires an explicit path. |
| V-UW1-02 — same revision number accepts a replacement Draft | Detail reads compare both the expected Draft ID and revision from the catalogue. `GET .../cards/document` now accepts `draft` alongside `revision`; both are required for an effective Draft and both omitted for Source-only reads. The original old-Draft request at revision 1 now returns 409 after replacement by another Draft at revision 1. A current pair returns 200 with the exact expected Draft ID and text. Missing identity/revision, wrong identity, stale numeric revision and a stale Source-only selection all conflict. Existing capture and explicit candidate checks remain intact. |

The change is confined to the owning Library API/service/controller and their tests, plus README/API guidance. No persistence migration or archive change accompanies V-UW1-02. Existing frontend screens do not call the new Library detail endpoint; the generated client was updated to expose its additional UUID query parameter.

### Fresh execution evidence

- Final verification ran `/tmp/uw1-reverification.sh`, derived from the existing isolated integration check, with `cleanTest test bootJar` and an independent HTTP probe before frontend checks. **76 freshly executed backend tests across 23 suites passed**, zero failures/errors/skips. This includes both correction regressions, Modulith/ArchUnit and the existing migration, rollback, recovery, artwork, Preparation and Playthrough checks. XML totals were inspected.
- **All 45 independent HTTP checks passed.** The probe retains the original conflict and replacement-Draft reproductions, using fresh synthetic campaign/source/draft records. It sends the old expected Draft ID with its colliding revision, confirms 409, then independently checks the replacement pair's identity/text and incomplete/incorrect pairs. Other checks cover explicit Source inspection, concurrency, captured-only behavior, missing Sources, safe typed moves/old-path reuse, JSON v3/ZIP v4 association preservation and detached-copy behavior. Temporary campaign directories were removed.
- Live-Spring OpenAPI/client generation and version checks passed. The served OpenAPI describes the Draft identity/revision pair and exposes the `draft` UUID query parameter; the generated Angular `readLibraryCard` method includes it. **98 frontend tests across 15 files**, the production frontend build and **all 31 Chromium browser regressions** passed. PostgreSQL installation-state preservation across restart passed; the isolated server/database lifecycle completed and cleaned up. No JAR rebuild overlapped the running verification server.
- Evidence: `/tmp/uw1-reverification.log`, `/tmp/uw1-reverification-probe.py`, `/tmp/uw1-reverification-probe-results.json`, `/tmp/uw1-reverification.sh`. Original failure artifacts remain separate. Generated client files are ignored; no tracked frontend application code changed.

### Limits and exit

Existing Angular bundle/style budget and OpenAPI-generator 3.1 warnings remain nonblocking. Verification does not establish maximum-size catalogue performance, exhaustive concurrency schedules, Safari/WebKit or the future unified-workspace layouts. Browser checks establish compatibility of existing screens; the new backend contracts are exercised by database-backed/HTTP tests and separate probes. UW2 Add/update, Scene planning and PlayNotes/history remain outside UW1.

`git diff --check` passed. No production database migration/reset, independent campaign-repository edit or commit occurred. Stop at UW1 verification handover; owner acceptance and later increment authorization remain separate.

## UW1 — Identity, Source associations and Library backend — 2026-10-23

**Assessment: FAIL — corrections V-UW1-01 and V-UW1-02 required before acceptance.** Existing tests pass, but independent HTTP probes reproduce incomplete conflict search and a stale-read identity substitution after Draft deletion/recreation. These concern UW1's delivered discovery/detail contracts, not deferred Library UI or UW2 session mutations.

### Authorization, scope and method

The owner explicitly requested verification after the UW1 implementation handover. Reviewed the uncommitted working tree based on `65aafc8` against the [UW1 plan and developer evidence](implementation-plan.md#uw1--accepted-implementation-plan--2026-10-23), [accepted architecture reconciliation](implementation-plan.md#unified-library--write--prepare--play--accepted-architecture-reconciliation--2026-10-23), unified requirements and accepted workspace UX. This is a separate verification pass by the implementing agent, not an independent reviewer. No application, test or configuration source was changed. Only this assessment was added to repository documentation; temporary probes and generated/build outputs are derived evidence.

### Blocking findings

#### V-UW1-01 — Conflicting Source candidates disappear from search (medium)

**Evidence:** `CardLibraryService.list`, lines 105–114, searches only `item.sources.firstOrNull()` when there is no effective Draft. Snapshot composition groups duplicate declared identities into one conflicted entry containing all Source candidates. As a result, only the first candidate's body/path contributes to discovery.

**Independent HTTP reproduction:** Capture `a.md` and `b.md` with the same declared card UUID, with distinct `PrimaryNeedle` and `SecondaryNeedle` body text. Unfiltered `/cards` exposes one conflicted entry with both paths and `ready=false`; an explicit `/cards/document?...&sourcePath=b.md` successfully reads the second candidate. However, `/cards?query=SecondaryNeedle` and `/cards?query=b.md` both return zero entries, while `PrimaryNeedle` returns the conflicted entry.

**Impact:** An affected Source is readable if its path is already known but cannot be found through its own content or filename. This fails the UW1 completion criterion that incomplete/conflicting material remains discoverable and lets path order decide which conflicting evidence participates in search.

**Required correction:** Search all eligible Source candidates in a conflicted Source-only entry, retaining explicit reader choice and the established effective-Draft precedence for associated cards. Cover secondary body/path matches and deterministic behavior when candidate order changes. No identity merge or automatic authority selection is needed.

#### V-UW1-02 — Revision checks accept a different Draft with the same revision number (medium)

**Evidence:** `CardLibraries.document` identifies a selection by logical card key, Source capture and numeric revision. `CardLibraryService.document`, line 122, compares only `item.draft?.revision` with the request. The request carries no expected Draft identity, although revisions are scoped to a Draft and deletion/recreation deliberately preserves logical card identity with a new Draft ID.

**Independent HTTP reproduction:** Edit a Source into Draft A and save revision 1 with body `OldDraftNeedle`; retain its catalogue key/capture/revision. Delete A, recreate its associated Draft B from the same unchanged Source capture, and save B to revision 1 with body `ReplacementNeedle`. A and B have the same logical card UUID and numeric revision but different Draft IDs. Reading with A's old catalogue key/capture/revision returns HTTP 200, B's ID and B's replacement body. The expected result for the stale saved-revision selection is a conflict requiring catalogue reload.

**Impact:** A stale reader can silently substitute another Draft's saved revision. This fails UW1's capture/revision-checked detail contract and the accepted distinction between logical card identity and Draft identity/revision. No lost write or historical-note mutation was observed; the failure is incorrect stale-read validation.

**Required correction:** Validate the expected Draft ID together with its revision, through an explicit identity parameter or equivalent representation token. Preserve capture checks, Source-only reads and normal current-Draft reads. Cover deletion/recreation with equal revision numbers as well as ordinary stale revisions, and regenerate the API client for any contract change.

### Fresh execution evidence

- `./gradlew cleanTest test bootJar` passed with **74 freshly executed backend tests across 23 suites**, zero failures/errors/skips. Modulith/ArchUnit, persistence/migration, Source, Writing, recovery, artwork, Preparation, Play workspace and P4R regressions passed. XML totals were inspected; the existing tests do not cover the two reproductions above.
- Ran `/tmp/uw1-verification.sh`, a temporary copy of the existing isolated integration check with an independent Python HTTP probe inserted before frontend checks. The probe used fresh synthetic campaigns, captured Source files and Drafts, then removed its temporary campaign directories. **31 of 34 recorded checks passed**; three failed assertions reproduce the two findings (secondary body/path search, and replacement-Draft rejection). The positive diagnostic check confirming that the returned identity is B is included in those totals.
- Positive independent HTTP checks cover explicit conflict inspection, blocked conflicting associated creation, four concurrent associated edits reusing one Draft, ordinary effective-Draft search, typed moves with old-path reuse, missing-Source readiness/status, obsolete capture rejection, JSON v3/ZIP v4 association preservation, strict duplicate-association rejection, and detached recovery copying with fresh logical identity and no live Source binding.
- Live-Spring OpenAPI/client generation, version checks, **98 frontend tests across 15 files**, the production frontend build and **all 31 Chromium browser regressions** passed in the verification integration run. PostgreSQL installation-state preservation across restart passed; the isolated backend/database lifecycle completed and cleaned up. Existing browser journeys establish compatibility of existing screens, not coverage of the two new backend cases above.
- Temporary evidence: `/tmp/uw1-verification.log`, `/tmp/uw1-verification-probe.py`, `/tmp/uw1-verification-probe-results.json`, `/tmp/uw1-verification.sh`. Probe failures are retained as assessment evidence; they deliberately do not stop the existing compatibility checks from running.

### Acceptance assessment

| UW1 criterion | Assessment |
| --- | --- |
| Writing association ownership, public Sources boundary, no persistence-owning Library | Pass in code review and fresh module checks. Association evidence remains Writing-owned and independent of Draft deletion. |
| Draft precedence, associated reuse, independent derivatives | Pass for covered cases in fresh tests and independent concurrency/search probes. |
| Explicit capture refresh, changes/absence/restoration, safe UUID moves and conservative untyped handling | Pass for covered cases in fresh tests; independent probes confirm typed moves, old-path reuse and unavailable originals without Draft invalidation. |
| Incomplete/conflicting discovery and explicit inspection | Partial. Classification/readiness and reader choice pass; secondary conflict search fails V-UW1-01. |
| Capture and exact saved-Draft read validation | Partial. Ordinary stale revision/capture checks pass; Draft replacement with equal revision fails V-UW1-02. |
| Campaign isolation, rollback, retained history and restart | Pass for covered automated integration cases, including campaign-qualified identity and deletion/recreation with retained approvals. |
| Association recovery and detached-copy behavior | Pass in fresh tests and separate JSON/ZIP probes; older archive rejection is the accepted disposable-artifact policy. |
| Scope | No frontend feature, Preparation mutation, Scene-link persistence, session archive evolution, PlayNotes/history or production data reset introduced by UW1. |

### Limits and exit

Existing Angular bundle/style budget warnings and OpenAPI-generator 3.1 warnings remain nonblocking build observations. This assessment does not establish maximum-size catalogue performance, exhaustive concurrency schedules, Safari/WebKit, or the future Library/Write/Prepare laptop layouts. New session Add/update, Scene planning and PlayNotes/history remain outside UW1. Catalogue reads retain observed association/locator evidence under the campaign lock as documented in the implementation record; they do not refresh files or overwrite Draft text.

`git diff --check` passed. Recommend a bounded correction for both findings followed by re-verification before UW1 acceptance. Verification authorizes neither application fixes nor UW2. No development database reset, independent campaign-repository edit or commit occurred.

## P4R — Contextual relationship suggestions — 2026-10-23

**Assessment: PASS within the assessed P4R scope; no blocking defect identified.** Exact frozen targets, prepared-copy choice, section constraints, Used preservation and explicit focus/inspection/replacement satisfy the bounded increment. Unprepared-target inspection/capture remains the explicitly accepted P7 dependency; this assessment does not claim full suggestion acceptance across P4R/P7. Recommend owner acceptance of P4R within these limits.

### Authorization, scope and method

The owner explicitly requested verification following the P4R implementation handover. Assessed the current uncommitted working tree based on `1cdacba` against the [accepted P4R plan](playthrough-implementation-plan.md#p4r--contextual-relationship-suggestions), [relationship and public-contract decisions](playthrough-domain-architecture.md#invariants-and-decisions) and [developer evidence](implementation-plan.md#p4r--contextual-relationship-suggestions--developer-evidence--2026-10-23). This is a separate verification pass by the implementing agent, not an independent reviewer. Reviewed Preparation's shared frozen-target matcher/public resolver, Playthrough read composition and HTTP contract, frontend request cancellation/retry and explicit command wiring, plus associated tests. No application, test or configuration source was changed during verification. Only this assessment was added to repository documentation; generated build/client artifacts and temporary probes are derived evidence.

### Fresh execution evidence

- Ran `/tmp/p4r-verification.sh`, a temporary copy of the existing integration check using the same isolated smoke database and service lifecycle, with backend `cleanTest test bootJar` to force fresh test execution and a separate HTTP probe before cleanup. **68 backend tests**, zero failures/errors/skips; module/architecture checks and backend packaging passed. XML report totals were inspected.
- Live OpenAPI generation, runtime/version checks, **98 frontend tests across 15 files**, production build and **all 31 Chromium journeys** passed. The P4R browser journey checks actual ambiguous prepared-copy choice, Used focus without return/reorder/scene activation, full-slot inspection with unchanged complete persisted workspace, explicit slot replacement, unchanged Preparation revision and narrow-screen overflow. Existing delayed-reader, focus/mode continuity, failure recovery, illustrated archive, source, reader and Writing journeys also passed. PostgreSQL installation-state preservation across restart passed; smoke services and database were cleaned up. Log: `/tmp/p4r-verification.log`.
- Separate Python HTTP probe: **17 assertions passed**, using new synthetic campaign/session/source/draft records rather than the repository test fixtures. It checks exact-copy ambiguity/order, alias collapse, section targets, missing/unsafe/unprepared outcomes, unchanged complete workspace and Preparation after suggestion reads, and HTTP 400 for an untyped scene target. A real Sources section-only capture is excluded from the full-document target and included in the compatible section target. After removing all old prepared copies, a newer source capture satisfies neither frozen whole nor section target. Authored approvals similarly preserve exact old draft revision, duplicate-copy order and section anchors; a newer approved revision cannot join or replace those candidates, including after the old copies are removed. Results: `/tmp/p4r-verification-probe-results.json`; temporary probe: `/tmp/p4r-verification-probe.py`. Temporary campaign directories were removed.
- Inspected fresh `related-390.png` in `frontend/test-results/focused-tabletop-related-c-8e56f-cus-or-full-slot-inspection/` and `focus-1280.png` in `frontend/test-results/focused-tabletop-focus-fou-f99e7-sion-and-Prepare-continuity/`. Related controls/copy context remain readable, notes remain separately accessible, and narrow focused cards retain horizontal access. Existing browser assertions cover 1280/390/320px layouts. Owner visual acceptance remains separate.

### Acceptance assessment

| P4R criterion | Assessment |
| --- | --- |
| Active-scene frozen relationships; no live-source substitution | Pass. UI requests its current active Scene; endpoint validates prepared Scene eligibility and composes through Preparation's public contract without mutation. Independent probes reject newer source/draft content as a replacement. |
| Exact source capture, authored revision and section constraints | Pass in code review, fresh resolver/integration tests and separate real-HTTP whole/partial-source and authored-revision probes. |
| Preparation-order candidates, repeated-target collapse and explicit copy choice | Pass. Candidate order follows Preparation, including reorder; full-document aliases collapse while section targets remain distinct. Ambiguous copies expose separate explicit controls. |
| Used cards, one-click focus with room and full-slot inspection/replacement | Pass in fresh component/browser evidence. Complete persisted state comparisons confirm inspection does not mutate the workspace; focus/replacement preserve table order, Used state and active scene. |
| Missing/unsafe/incompatible and unprepared outcomes | Pass for assessed missing/unsafe/external/guidance and unprepared cases. Unprepared inspection/capture is clearly unavailable pending P7. |
| Asynchronous context, retry and existing boundaries | Pass in assessed component tests and review: superseded requests are cancelled; scene clearing removes results; retry is independent. Preparation has no reverse Playthrough dependency; matching is shared with its existing reader. |
| Persistence and archive completeness | No new persisted state or archive version. Existing illustrated archive and scene/focus regression journeys pass; v7 remains unchanged. |

### Limits and exit

Existing warnings remain: initial bundle **764.68 kB** against a 500 kB warning target, workspace CSS **7.94 kB** against 4 kB and prototype stylesheet budgets. The build succeeds; no budget was changed. This assessment does not establish Safari/WebKit, real touch, exhaustive accessibility/zoom, all asynchronous/concurrency schedules or large relationship-count performance. Narrow suggestion lists scroll in their bounded area. P7's unprepared-target actions and later PlayNotes/history increments remain unassessed.

`git diff --check` passed. No development database reset, independent campaign-repository edit or commit occurred. Stop at verification handover: owner acceptance, corrective work if requested, and later increments remain separate gates.

## P4 corrective re-verification — V-P4-01 — 2026-10-22

**Assessment: PASS within the assessed scope. V-P4-01 is resolved.** A newer frozen-reader selection survives the delayed same-session workspace response and is reconciled as temporary inspection or expanded focus. Normal expansion restoration still works when there is no intervening selection. Combined with the other P4 findings below, no acceptance-blocking P4 defect remains identified. Recommend owner acceptance within the recorded limits; owner visual acceptance and later increments remain separate. The original failed assessment is preserved.

### Authorization and scope

The owner explicitly requested verification following the bounded V-P4-01 corrective handover. Reviewed the current uncommitted working tree based on `a447900`, the [correction evidence](implementation-plan.md#p4-correction--v-p4-01--developer-evidence--2026-10-22), original reproduction and [accepted P4 scope](playthrough-implementation-plan.md#p4--focused-tabletop-presentation). This is a separate verification pass by the implementing agent, not an independent reviewer. Only this formal assessment was added to repository source/documents; no application, test or configuration source was changed. Temporary probes used synthetic campaign directories and the isolated smoke database. No development reset, external campaign-content edit or commit occurred.

### Fresh evidence

- `npm test` passed: **96 frontend tests across 14 files**.
- `npm run test:e2e -- focused-tabletop.spec.ts` passed: **all seven focused-tabletop Chromium journeys**. These freshly cover the main focus/inspection/notes/layout/Prepare/removal flow, failed workspace edits and explicit discard, late response after session departure, and four controlled same-session delayed-response cases.
- The four correction regressions confirm: normal Scene expansion restoration even after a different Prepare selection; newer Fourth selection opening temporary inspection; newer focused NPC selection becoming expanded focus; and Fourth → Scene navigation retaining the final explicit choice. Complete persisted workspace state remains unchanged in each case. Explicitly closing Fourth inspection returns to the previous expanded Scene.
- Reran the original separate browser reproduction against the corrected application. Before releasing the delayed GET, Fourth was selected. After delivery the reader remained **Temporary document inspection / Fourth / Complete frozen Fourth document.**, with the Fourth inspection visible. The original probe now reports `ORIGINAL_REPRODUCTION_RESOLVED true`. Complete workspace and Preparation responses equal their pre-probe values. Following the same link after loading still works, and Escape explicitly returns to expanded Scene.
- Evidence: `/tmp/p4-reverification.log`, `/tmp/p4-reverification-late-selection.png`; temporary harness: `/tmp/p4-reverification.sh` and `/tmp/p4-reverification-probe.mjs`. The isolated backend, frontend and database lifecycle completed successfully and cleaned up. `git diff --check` passed.

### Resolution and boundaries

The correction stays with the frontend workspace that owns reader selection and mode restoration. Explicit reader intent is tracked separately from route identity, so same-route navigation can supersede automatic restoration, including navigation away and back to the original ID. After initialization, the latest choice is reconciled against loaded focus/membership; existing route/session guards still reject departed-context callbacks. No persistence, API or archive version change was introduced.

The full **30-journey**, production-build and PostgreSQL restart check in the corrective developer handover was **not repeated** in this bounded re-verification. Fresh evidence is the 96 frontend tests, seven P4 journeys and separate original reproduction above. Backend tests were not rerun; this correction changes no backend behavior. Existing bundle/style warnings and the original assessment's limits for other browsers, real touch, exhaustive accessibility/zoom and concurrency schedules remain. This does not assess contextual suggestions, PlayNotes or later increments.

Stop at verification handover. This result does not itself accept P4 or authorize P4R.

## P4 — Focused tabletop presentation — 2026-10-22

**Assessment: FAIL — required correction V-P4-01.** The covered focus, inspection, layout, persistence and mode-continuity journeys pass, but a delayed same-session workspace response overwrites a newer document selection. This fails P4's asynchronous navigation/retained-selection criterion. Recommend a bounded correction and re-verification before acceptance.

### Authorization, scope and method

The owner requested verification after the P4 implementation handover. Assessed the current uncommitted working tree based on `a447900` against the [P4 scope](playthrough-implementation-plan.md#p4--focused-tabletop-presentation), accepted product requirements Q10f/g/i/r/s/w/x and [domain invariants](playthrough-domain-architecture.md#invariants-and-decisions). This is a separate verification pass by the implementing agent, not an independent reviewer. Formal assessment is the only repository documentation change in this pass; no application, configuration or test source was edited. Temporary browser probes used synthetic campaigns in temporary directories and the isolated smoke database. No development reset, external campaign edit or commit occurred.

### Fresh evidence

- `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed: live OpenAPI client generation, version checks, **96 frontend tests across 14 files**, production build and **26 Chromium journeys**. PostgreSQL installation-state preservation across restart passed and services were cleaned up. Log: `/tmp/p4-verification-setup.log`.
- Backend `test bootJar` succeeded with tasks up-to-date. The retained 65-test backend reports are prior evidence, not fresh backend test execution in this verification; P4 changes no backend behavior.
- The three focused-tabletop journeys freshly cover ordered three-card focus, Used retention, explicit scene activation and slot replacement, fourth-card inspection without workspace mutation, notes access/scope, keyboard expansion/return, 1280/390/320px geometry, Prepare addition and return, reopened inspection closure, membership removal, failed replacement/discard and late responses after session departure.
- Reviewed fresh `focus-320.png` and `inspection-1280.png` under `frontend/test-results/focused-tabletop-focus-fou-f99e7-sion-and-Prepare-continuity/`: narrow notes use the available width; laptop inspection retains three focused cards and separate notes access. Automated layout assertions establish no page-wide horizontal overflow at the tested widths. Owner visual acceptance remains separate.
- A separate temporary Chromium probe reproduced V-P4-01 in **two isolated service lifecycles**. The confirmation additionally proved the complete persisted workspace unchanged and the same link behaving correctly after loading. Logs: `/tmp/p4-verification-browser.log` and `/tmp/p4-verification-browser-confirmation.log`; harness: `/tmp/p4-verification-browser.sh`, `/tmp/p4-verification-probe.mjs`; screenshot: `/tmp/p4-verification-late-selection.png`. Both lifecycles cleaned up successfully.

### Required correction: V-P4-01 — delayed reopen overwrites newer reader selection

**Severity: medium; blocks P4 acceptance.** The reader's frozen links remain actionable while the Play workspace reloads. Following a link updates the selected document, but inspection is rejected while workspace state is loading. Once the older request completes, `openPlayContext()` restores the previous expanded item without checking whether the owner selected another document during the wait.

Reproduction with a synthetic frozen Scene containing `[Visit Fourth](Fourth.md)` and a prepared Fourth document:

1. Persist Scene/NPC/Relic as the three focused cards and Scene as active. Expand Scene using the actual UI.
2. Switch to Prepare, then back to Play, holding the resulting workspace GET response before delivery. The same Scene reader remains available.
3. Click **Visit Fourth** in that reader. The reader displays **Complete frozen Fourth document.**
4. Release the delayed successful workspace response.
5. **Expected:** the newer explicit Fourth selection remains readable; completing the older open must not silently restore Scene over it. Preserve valid expanded context and reconcile temporary inspection with the loaded workspace.
6. **Observed in both runs:** the reader changes back to **Expanded focused card / Scene / Complete frozen Scene document.** The probe reports `FOURTH_RETAINED false`.

The confirmation then follows the identical link after loading: Fourth remains selected and the temporary inspection opens. Escape explicitly restores expanded Scene as expected. The complete saved workspace equals its pre-probe value, so this is transient navigation loss, not persisted data corruption.

Owning paths: [openPlayContext](../frontend/src/app/preparation/workspace.ts#L259) checks route/session identity but unconditionally selects the expanded item after awaiting initialization; [followCaptured](../frontend/src/app/preparation/workspace.ts#L411) changes reader selection without changing that route epoch; [inspect](../frontend/src/app/playthroughs/workspace-state.ts#L159) drops inspection intent while loading. The existing late-response journey tests departure to a different session and does not exercise this same-session interaction.

**Recommended bounded correction:** preserve the latest explicit reader intent across same-session initialization, reconcile it against the returned workspace, and prevent automatic expansion restoration from overwriting a subsequent selection. Add a controlled delayed-response regression using a frozen reader link, including the normal no-intervening-selection expansion-restoration case. Keep route/session guards, persisted state and archive v7 unchanged. No correction was made during verification.

### Other acceptance findings and limits

| P4 criterion | Assessment |
| --- | --- |
| Two/three focused cards, Used retention, explicit replacement and fourth-card inspection | Pass in covered state/component/browser checks. Inspection does not mutate scene, focus or table. |
| Shared card and full-document presentation; one-action expansion/return | Pass. Composition reuses PlayingCard, PreparedArtwork and the existing frozen Markdown reader; no parallel renderer or persistence model. |
| Keyboard access, laptop/narrow layouts and independently accessible notes | Pass within tested Chromium controls and viewports; screenshot review and geometry assertions support the bounded layout assessment. |
| Same-session Prepare continuity, new membership and removals | Pass in covered journeys: expansion restores after adding material; new cards do not steal focus/scene; removal prunes only affected focus/scene and retains notes/Used. |
| Reopen and transient/persisted boundaries | Pass. Persisted identities restore; temporary inspection closes; expansion/inspection stay outside workspace saves and archive state. |
| Asynchronous navigation and retained selection | **Fail: V-P4-01.** Cross-session late-response guards pass, but same-session newer reader intent is overwritten. |

Build warnings remain: initial bundle **757.79 kB** against 500 kB, workspace stylesheet **7.94 kB** against 4 kB, and existing prototype stylesheet warnings. No budget was raised. This assessment does not establish other browsers, real touch behavior, exhaustive accessibility/zoom, every conflict/concurrency schedule or later increments such as contextual suggestions and PlayNotes. `git diff --check` passed.

Stop at verification handover. Owner authorization is required for the bounded correction; this assessment does not authorize implementation or P4R.

## P3 corrective re-verification — V-P3-01 — 2026-10-22

**Assessment: PASS within the assessed scope. V-P3-01 is resolved.** Missing required scene input now rejects without mutation, while explicit null and valid Scene selection retain their intended behavior. Combined with the other P3 findings in the original assessment below, no acceptance-blocking P3 defect remains identified. Owner acceptance and P4 remain separate decisions; the original failed assessment is preserved.

### Authorization and scope

The owner explicitly requested verification after the bounded V-P3-01 corrective implementation handover. Reviewed the current uncommitted working tree based on `a447900`, the [recorded correction evidence](implementation-plan.md#p3-correction--v-p3-01--developer-evidence--2026-10-22), original finding and [accepted P3 scope](playthrough-implementation-plan.md#p3--scene-and-ordered-focus-state-including-archives). This is a separate verification pass by the implementing agent, not an independent reviewer. No application, configuration or repository test source was changed; only this assessment was added. Temporary probes used synthetic records in the isolated smoke database and temporary campaign directories. No development reset, independent campaign-content edits or commit occurred.

### Fresh evidence

- `cd backend && ./gradlew test --tests workbench.WorkspaceHttpIntegrationTest --rerun-tasks` passed: **one freshly executed real-HTTP/database regression**, zero failures/errors/skips. The test covers missing-field rejection, unchanged complete workspace/Preparation state, explicit null clearing without focus/table changes, valid alternate Scene selection and live OpenAPI required/nullable semantics. Relevant compilation and test tasks were rerun. `./gradlew bootJar` then succeeded with tasks up-to-date.
- A separate backend/database lifecycle reran the original independent API probe and added correction-specific requests: **all 30 checks passed, zero failures**. In the original missing-scene reproduction, HTTP now returns **400**, workspace revision remains **1 → 1**, and the saved scene remains `59640c78-893a-465b-95ee-57948230e5f2`. An additional request containing exactly `revision`, `active`, `used` and `focusedItemIds` returns 400 `request.invalid` with the complete saved state unchanged.
- Explicit `activeSceneItemId: null` returns 200, clears only the scene and advances the workspace revision once; focus, Active/Used order and Preparation remain unchanged. A valid alternate Scene ID then returns 200, changes only scene/revision and retains focus/table/Preparation. The probe also repeats invalid focus/type/stale-write checks, eleven malformed archive rejections without imports, v7 JSON/ZIP scene/focus remapping, same-revision concurrent writes and membership-removal reconciliation.
- Live OpenAPI still lists `activeSceneItemId` as required with `string | null` types. The current generated Angular `SaveWorkspace` retains a required `activeSceneItemId: string | null` property. Test services were cleaned up successfully. Evidence: `/tmp/p3-reverification.log`, `/tmp/p3-reverification-probe-results.json`, `/tmp/p3-reverification-openapi.json`; temporary harness: `/tmp/p3-reverification.sh` and `/tmp/p3-reverification-probe.py`.

The full 65-backend / 89-frontend / 23-Chromium developer run recorded in the implementation handover was **not repeated** in this bounded re-verification. Those counts are prior implementation evidence, not newly executed verification results. The fresh checks above directly assess the request-binding correction and repeat the independent P3 API probes; previous browser/persistence/concurrency assessment limits remain applicable.

### Resolution and scope assessment

| Required behavior | Assessment |
| --- | --- |
| Omitted required scene field rejects before mutation | Pass. HTTP 400 `request.invalid`; saved scene, focus, table, workspace revision and Preparation are unchanged. Both the original returned-workspace-style payload and a minimal save payload were tested. |
| Explicit null remains a deliberate clear | Pass. HTTP 200 with exactly one workspace revision increment; only the scene clears. Focus, table and Preparation remain intact. |
| Valid Scene activation and required/nullable contract survive | Pass. Alternate frozen Scene selection succeeds without clearing focus; live OpenAPI and the generated client agree on required nullable input. |
| Correction stays at the owning boundary | Pass. The constructor-property presence annotation is confined to `SaveWorkspace` request binding. No global mapper setting, domain rule, persistence or archive version change is introduced. The HTTP regression exercises the actual Spring boundary rather than only constructing DTOs. |

### Limits and exit

No new acceptance-blocking defect was found. Existing compiler warnings and previously recorded frontend bundle/style budget warnings remain; frontend builds and visual/browser checks were not rerun in this bounded pass. This assessment does not extend to exhaustive malformed-input combinations, all concurrency schedules, other browsers/touch/accessibility, P4 presentation or later functionality. Earlier increments' outstanding acceptance gates are unchanged. `git diff --check` passed.

Recommend owner acceptance of P3 within the combined recorded assessment limits. Stop at verification handover; this result does not authorize P4 or further implementation.

## P3 — Scene and ordered focus state, including archives — 2026-10-22

**Assessment: FAIL — required correction V-P3-01.** The assessed domain, persistence, frontend state and archive paths satisfy the covered P3 criteria, but the workspace HTTP boundary accepts an omitted required scene field and clears the saved scene. Passing automated suites do not resolve this independently reproduced contract defect. Recommend corrective implementation and bounded re-verification before P3 acceptance.

### Authorization, scope and method

The owner explicitly requested verification after the P3 implementation handover. Reviewed the current uncommitted working tree based on `a447900` against the [P3 plan](playthrough-implementation-plan.md#p3--scene-and-ordered-focus-state-including-archives), [accepted interaction requirements](product-specification.md) and [domain invariants](playthrough-domain-architecture.md#invariants-and-decisions). This is a separate verification pass by the implementing agent, not an independent reviewer. No application, configuration or repository test source was changed during verification; only this assessment was added. Temporary Python HTTP probes and synthetic campaign directories used the isolated smoke database and system temporary directory. No development reset or independent campaign-content edits occurred.

### Fresh execution evidence

- `cd backend && ./gradlew test bootJar --rerun-tasks` passed: **64 freshly executed backend tests**, zero failures/errors/skips, including Modulith/ArchUnit, database concurrency/rollback, persistence/restart and scene/focus domain tests. All relevant build tasks were rerun, rather than relying on retained execution results.
- `WORKBENCH_CHECK_FRONTEND_PORT=4201 ./scripts/check-setup.sh` passed live OpenAPI client generation, version checks, **89 frontend tests across 13 files**, production build, **all 23 Chromium browser journeys**, and isolated PostgreSQL restart/preservation. Its backend tasks were up-to-date against the fresh run above. Test services were cleaned up. Run log: `/tmp/p3-verification-setup.log`.
- Independently exercised the live HTTP boundary with four frozen prepared cards (two Scenes, one NPC, one item). The final probe recorded **26 passing checks and one failing check**. Checks covered initial null/empty state, Used scene/focus, unchanged Preparation, rejected duplicate/foreign/four-card focus and non-Scene activation, stale writes, JSON/ZIP completeness, eleven malformed archive variants rejected without new sessions, fresh imported IDs, same-revision concurrent saves (one 200 and one 409), and membership removal with stale-write rejection and ordered focus pruning.
- Reproduced the missing-scene-field defect in two separate synthetic sessions. Final probe evidence: `/tmp/p3-verification-probe-results.json`; temporary probe: `/tmp/p3-verification-probe.py`. The initial probe expected 409/422 for domain-invalid input, while this application's `Failure.Invalid` maps to 400. Correcting that probe expectation made those four checks pass; these were probe errors, not additional product findings.

### Required correction: V-P3-01 — omitted scene field silently clears saved context

**Severity: medium; blocks P3 acceptance.** The public `SaveWorkspace` contract declares `activeSceneItemId` required and nullable in live OpenAPI and the generated client. Its Kotlin nullable property has documentation metadata but no runtime presence enforcement: [request field](../backend/src/main/kotlin/workbench/playthroughs/api/Playthroughs.kt#L20). An omitted property binds to null, and [the save command](../backend/src/main/kotlin/workbench/playthroughs/application/PlaythroughService.kt#L37) persists that as an explicit clear.

Reproduction against the actual Spring HTTP endpoint:

1. Prepare a valid frozen Scene and open its workspace. Explicitly save that Scene as active, with three ordered focused cards; the Scene may be in Used. The saved workspace revision is 1.
2. PUT `/api/campaigns/{campaign}/sessions/{session}/workspace` with that current revision, unchanged `active`, `used` and `focusedItemIds`, **omitting `activeSceneItemId`**. For example, construct the body from those four keys of the saved workspace.
3. **Expected:** 400 for an omitted required field, with scene, focus, table and revision unchanged. An explicit `"activeSceneItemId": null` remains the supported clear command.
4. **Observed:** 200; revision advances **1 → 2** and `activeSceneItemId` becomes null. GET confirms the cleared scene. In the final reproduction the previous scene was `201d1265-3867-4c1c-aeb0-cddbfe1ff783`, session `8be479dc-52e5-4137-8841-60e7bb6b2485`, containing campaign `15d8edfc-50c7-47f8-b0b0-95447832e401` in the isolated smoke database. Omitting `focusedItemIds` or `revision` instead returned 400 without advancing the saved revision.

This violates the required wire contract and permits loss of explicitly selected scene context through an incomplete save. The current generated frontend includes the field, so this was not observed in the covered browser workflows. Existing service tests pass constructed DTOs directly and therefore do not exercise this missing-property binding case.

**Recommended bounded correction:** enforce presence of the nullable scene field at the HTTP request boundary while preserving explicit null as a valid clear. Add a real HTTP regression proving omitted field → 400 with no mutation, explicit null → deliberate clear without changing focus, and valid scene ID → normal save. Recheck generated contract consistency. No domain redesign, new persistence or archive version change is indicated by this finding. No correction was made during verification.

### Other P3 acceptance findings

| Contract | Assessment |
| --- | --- |
| Explicit scene, separate inspection and focus | Partial: ordinary selection/inspection does not activate a scene; frontend activation/focus commands are separate, and server validation requires frozen valid Scene classification. Required-field omission fails as V-P3-01. |
| Up to three unique ordered prepared focus IDs; Used allowed | Pass in covered state/domain/API tests and independent HTTP probes. Four distinct valid members, duplicate IDs and foreign IDs reject without mutation; Used scene/focus remains valid. |
| Reconciliation and mode/reopen continuity | Pass within P3 state scope. Removals prune only absent focus IDs and clear removed/invalid scenes; remaining order is retained, new members prepend without stealing focus, unchanged reconciliation is idempotent. Database-backed tests reopen persisted scene/focus after application restart. P4 presentation and expanded/temporary inspection state remain outside this increment. |
| Revision, ownership and concurrency | Pass in covered schedules. Preparation is read through its public snapshot and its revision/notes remain independent. Campaign locking precedes snapshots/writes; stale saves and concurrent membership changes reject safely. Independent concurrent same-revision focus saves produced one success and one conflict. No reverse module dependency or duplicate table authority was introduced. |
| Current archives complete and strict | Pass in covered transfers. v7 JSON and ZIP preserve/remap scene and ordered focus with fresh item/session IDs, including Used focus; illustrated browser round trip preserves frozen artwork and notes. Unopened workspaces stay null. Wrong/foreign scene or focus, four/duplicate focus IDs, missing/null fields, unsupported state and old/fractional versions reject atomically. Existing import rollback and image safeguards pass. |
| Frontend save lifecycle and existing functionality | Pass within covered journeys. Full workspace saves carry both new fields; use/return/reorder retains them. Slow-save/newer-edit and conflict tests retain scene/focus, with existing identity guards and recovery. Browser table saves/reopen/discard preserve seeded scene/focus. Writing, preparation notes, artwork, geometry, filters and reading regressions pass. |

### Limits and exit

Existing warnings remain: initial bundle 739.68 kB against 500 kB, workspace stylesheet 7.91 kB against 4 kB, prototype stylesheet budgets and existing Kotlin compile warnings. Chromium and bounded concurrency checks do not establish Safari/WebKit, real touch, exhaustive accessibility, resource maxima or every interleaving. No new visual UI was introduced or visually accepted by P3; P4 controls and temporary inspection, later suggestions/PlayNotes/history and previous increments' outstanding acceptance gates are not certified here. `git diff --check` passed before recording the assessment.

Stop at verification handover. V-P3-01 corrective implementation and subsequent re-verification require separate owner authorization; this result does not authorize application changes or P4.

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
