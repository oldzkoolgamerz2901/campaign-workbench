# SBCE-P1 — Writing Save Draft pilot evaluation

Status: experimental implementation evidence; **not** formal verification or owner acceptance.

## Frozen baseline

- Source: `main` at `dd88518d22daac4601e6da8618b5be6c478de00b`.
- Baseline was inspected before the contract or harness files were changed.
- Three scenario questions were assessed from existing code/tests: revision conflicts; the affected boundary and test files for a behaviour change; hypothetical automatic retry of a stale save.
- Findings: stale saves return `writing.stale-revision`; Writing/Angular/browser tests jointly own the interaction; blind retry against a newer revision would contradict approved MW3.
- **Limitation:** this is a read-only evidence baseline, not three independent isolated agent executions. No token, timing, error-rate or productivity improvement is claimed.
- Comparative A/B agent scenarios remain unexecuted until isolated, equivalent sessions are available. The baseline source commit is preserved so they can be run later without retroactively changing the control.

## Proposed comparison scenarios

1. Explain a revision conflict and the fate of local unsaved edits.
2. Identify the architectural owners and tests implicated by a change to Save Draft.
3. Assess a hypothetical automatic stale-save retry and whether implementation is authorized.

Use the same prompts, model settings, read permissions and approval instructions; variants must have separate isolated worktrees/session context. A uses frozen baseline, B uses the SBCE-P1 branch. Assess behavioural accuracy, architectural scope, approval compliance, evidence quality and human review effort. Correctness and authorization are mandatory; improved speed cannot compensate for violations.

## Requirement trace matrix

Requirement IDs are rooted in `backend/src/main/java/workbench/writing/package-info.java`.
Existing test locations below describe **observed assertions**, not a claim of full end-to-end coverage.

| ID | Existing evidence | Status / caveat |
| --- | --- | --- |
| WSD-R1.1 | `WritingIntegrationTest.kt`: saved revision equals 1; persisted fields checked | Covered at service level |
| WSD-R1.2 | `WritingIntegrationTest.kt`: `writing.stale-revision`; `writing.spec.ts`: conflicting edit retained | Covered at service and browser levels |
| WSD-R2.1 | `WritingIntegrationTest.kt`: cross-campaign open/save rejected | Covered at service level |
| WSD-R2.2 | `WritingIntegrationTest.kt`: restart and open of saved draft | Covered at service level |
| WSD-R3.1 | `WritingIntegrationTest.kt`: incomplete title saved and preview flags issue | Covered at service level |
| WSD-R3.2 | `WritingIntegrationTest.kt`: oversized body rejected and stored draft unchanged | Covered at service level |
| WSD-R4.1 | `writing-state.spec.ts`: revisioned image removal/replacement | Partial: application-level contract not independently reverified |
| WSD-R4.2 | `writing-state.spec.ts`: failed image upload retains pending image; server image preservation needs separate assertion review | Partial |
| WSD-R5.1 | `writing.spec.ts`: HTTP 503 leaves edits, Retry save succeeds | Covered at browser level |
| WSD-R5.2 | `writing.spec.ts`: conflict prevents retry, local edit retained until explicit reload | Covered at browser level |
| WSD-R5.3 | `writing.spec.ts`: cancelled navigation retains unsaved edit | Covered at browser level |
| WSD-R6.1 | `writing-state.spec.ts`: slow saves serialized, newer edits remain saving | Covered at frontend unit level |

A requirement ID in a test's display name is a navigation aid only. For each row formal verification must inspect the assertions, reproduce checks where authorized, and report unproven or missing coverage.

## Implementation exclusions

No production Kotlin, API/DTO, database, framework, dependency, Angular production source, module layout or campaign content changes. No automatic contracts reconciliation, new tests solely to satisfy an ID, or mandatory new Gradle plugin.

## Phase 5 developer handover — 2026-11-13

**Implementation:** Completed the scoped contract, agent skill, workflow pointer, approved decision record, and trace labels on the experimental branch `experiment/sbce-p1-save-draft`. Original `main` baseline remains at `dd88518d22daac4601e6da8618b5be6c478de00b`.

**Static checks performed against branch sources:**
- 12 contract requirements; all 12 IDs unique.
- All 12 IDs occur in existing backend/frontend test display names and in the evaluation matrix.
- Package documentation contains only Java 25 `///` lines and the `package workbench.writing;` declaration.
- GitHub diff contains only contract/harness/docs/test-label files. No production application behaviour, schema, API/DTO, build configuration or dependency change.
- Existing tests were not rewritten: only their display names changed.

**Checks not executed:** Java/Kotlin compilation, Gradle/Kotest, Modulith/ArchUnit, Vitest, Playwright, complete browser journeys, and independent A/B agent evaluation. The current execution environment cannot clone GitHub over the network or run the project's Docker-backed toolchain. This is a **verification gap**, not a passing result.

**Local developer checks to execute in an environment with the repository and required toolchain:**
1. `cd backend && ./gradlew compileJava compileKotlin test` (requires Docker/Testcontainers for integration tests).
2. `cd frontend && npm ci && npm test -- --run` only if compatible with the existing package script; otherwise use the repository's documented `npm test`.
3. Run the existing documented setup/check workflow (`./scripts/check-setup.sh`) for generated contracts, frontend build and Chromium tests, with Docker and the specified JDK/Node versions.
4. Review actual test assertions for WSD-R4.1 and WSD-R4.2; do not infer persistence guarantees solely from frontend mocked responses.
5. Run an isolated A/B agent comparison at equal model settings using the frozen baseline and this branch before claiming measurable benefit.

**Formal verification status:** Not started and not authorized by this implementation approval. Owner acceptance and broader adoption remain separate decisions.

## Results

Only the static checks above are established. No claim of improvement in speed, LLM accuracy, or correctness is supported without comparable independent runs.

