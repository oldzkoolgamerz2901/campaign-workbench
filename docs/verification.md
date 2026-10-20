# Verification evidence

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
