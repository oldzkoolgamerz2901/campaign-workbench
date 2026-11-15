# Card front contract approach — implementation case study

Status: CF1 implementation and developer checks complete, not formal verification. Scope: the approved quote lifecycle and later CF2 presentation. No causal productivity or accuracy claim is made; no comparison implementation exists.

## Entry baseline

Before CF1 edits, inspection identified an existing Save Draft contract and tests for revisions, working limits, restart durability and guarded edits. `AuthoringCodecTest`, `CardBackIntegrationTest`, `WritingRecoveryIntegrationTest`, `AuthoredPreparationIntegrationTest` and `SharingDistributionIntegrationTest` cover adjacent back-text paths. None of those assertions established quote preservation because no authored quote field existed. This is an observed code/test baseline, not an independently executed control experiment.

## Contracts and assertion trace

| Requirement | Developer assertion evidence | Coverage limit |
| --- | --- | --- |
| WSD-R7.1 | WritingIntegrationTest: quote save, oversized quote rejection, stale save, unchanged persisted fields, restart; writing-state.spec.ts: newer quote edits during multipart save | Passed Chromium quote reload, temporary failure/retry and conflict retention; physical devices unverified |
| SQA-R1.1–R1.3 | AuthoringCodecTest quote round trip, missing/invalid quote and historical retained-key conflict; CardBackIntegrationTest source edit capture | Current Source export and capture use real authoring |
| PCP-R1.1 | CardBackIntegrationTest exact freeze, independent second session, explicit replacement | Fit geometry including quote is CF2 |
| PCP-R1.2 | SharingDistributionIntegrationTest real Preparation projection | No private-content disclosure introduced |
| SCP-R1.1–R1.2 | SharingDistributionIntegrationTest quote preview invalidation, frozen retry after source removal | Passed whole-card restart equality and explicit quote player-payload assertion |
| SCP-R1.3 | Historical empty-quote fingerprint assertion against predecessor bytes | Passed developer check |
| SAP-R1.1–R1.2 | CardBackIntegrationTest current round trip/import and historical v10; quote-specific v11 and invalid shape checks | Passed developer check |
| WCP-R1.1–R1.2 | CardBackIntegrationTest recovery/copy; WritingRecoveryIntegrationTest detached histories; predecessor quote compatibility checks | Illustrated archive paths assessed through broad regression suite |

IDs are navigation aids; passing evidence requires meaningful assertions. Frontend presentation contracts are deferred to CF2.

## Observations during implementation

- Contract review exposed the historical unknown `quote` key: interpretation 3 preserves earlier metadata as evidence and refuses silent takeover during export.
- The portability obligations exposed strict recovery/session wire shapes: new formats need explicit versions plus predecessor normalization, rather than merely adding a DTO default.
- Review/retry obligations exposed fingerprint compatibility: unchanged empty-quote content retains predecessor fingerprint bytes; nonempty quotes are included under a new fingerprint profile.
- These are plausible omissions avoided, not proven counterfactual bugs. Ordinary careful engineering could also discover them.
- Overhead so far: authored bounded contracts in existing owners and this trace map, reviewed compatibility branches, and strengthened lifecycle assertions. No stopwatch comparison or token-cost estimate is available. Final evidence will distinguish extra test value from label-only edits and document rework and low-value duplication.

## CF1 developer assessment — 2026-11-15

**Result:** Useful for identifying preservation obligations at module boundaries. The implementation includes thirteen quote-specific requirements across six narrowly scoped contract sources, with concrete assertions rather than new tests solely for identifier presence. This is a single implementation case study; benefit and overhead are qualitative observations.

**Additional test value:** Three new test cases cover current/historical quote interpretation, predecessor recovery/session wire compatibility, and a fixed predecessor sharing fingerprint vector. Existing lifecycle tests now carry actual quote values through revision guards, restart durability, exact freezing/replacement, Source editing, detached recovery/copy, multipart image saves, illustrated archives, player payloads and distribution retries. Existing frontend/browser journeys now assert quote retention during delayed saves, reload, temporary failures and conflicts.

**Rework observed:** The new historical tests exposed an implementation error in recovery normalization: a collection expression did not traverse retained approval/export snapshots as intended. Explicit traversal corrected it. Full regression checks also exposed hard-coded current archive-version assertions and a duplicate-key rejection test whose replacement string no longer matched the new version. Those tests were corrected without removing predecessor coverage. One new session test initially selected an unrelated campaign with no sessions; its fixture lookup was corrected. These findings distinguish actual implementation/test defects from contract text alone.

**Overhead and limits:** The contracts and trace table required extra writing and assertion review across multiple owners; that maintenance cost is real but was not timed separately. Several neighboring lifecycle obligations could be discovered through ordinary careful code review. No productivity percentage, token saving, independent review advantage or A/B result is established. Avoid repeating the full product specification in contracts; preserve this narrow changed-behavior scope. A fixed historical fingerprint value replaced an initially duplicated algorithm in the compatibility test, improving its independence and reducing maintenance.

**Evidence:** Full backend developer suite passed **160 tests in 35 suites**, including Modulith/ArchUnit and portable archive tests (`/tmp/cf1-backend-all.log`). Final additional boundary checks passed real multipart quote saves, illustrated archive regression and player collection quote exposure (`/tmp/cf1-boundary-tests.log`); the fixed fingerprint vector is checked in the final Sharing rerun (`/tmp/cf1-sharing-final.log`). Frontend **136 tests in 16 files**, version agreement, DM/player production builds, and **3 Chromium Writing journeys** passed. Browser journeys assert quote save/reload, failed-save retry/guarded navigation and stale-save retention followed by explicit reload. Logs under `/tmp` are transient developer artifacts, not durable formal verification evidence.

**Remaining scope:** CF2 presentation, quote-aware fit geometry, hiding the panel and removing front tags are not implemented or verified by CF1. Physical-device/Safari and owner visual acceptance are unverified. Formal verification and the pilot's independent A/B comparison were not performed. The practical recommendation is to retain bounded contracts for cross-boundary invariants while avoiding whole-module contract expansion merely because a file was touched.
