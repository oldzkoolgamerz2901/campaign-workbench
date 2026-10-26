# Future work and unresolved choices

This is an index of retained future work, not execution authorization or a newly accepted product scope. Accepted requirements, accepted architectural direction, deferred ideas and new proposals are distinguished below. Detailed original context remains linked and preserved. Do not implement a broad requirement merely because it appears here.

## Delivered baseline

Library/Write/Prepare/Play integration, manual authoring and recovery, frozen artwork, atomic whole-card Add/replacement, session Scene associations, T1/T2 tabletop, P5 PlayNotes, P6 history, revised P7 and P8 have delivery evidence. See the [current plan](implementation-plan.md) and [formal assessments](verification.md). Owner acceptance remains separate; historical documents describing these as future work are dated records.

## Accepted future direction requiring further decisions

| Area | Status, open work and retained context |
| --- | --- |
| Creative co-author | Accepted requirements and architectural direction; integration feasibility and concrete plans remain open. Preserve campaign conversations, versioned decisions/source overrides, approved guidance, explicit request-context snapshots and distinct provenance. See [requirements](product-specification.md#creative-co-author--accepted-requirements--2026-10-19) and [full architecture/open choices](history/implementation-plan-2026-10-24.md#creative-co-author--accepted-architectural-direction-and-open-choices--2026-10-19). Historical baseline descriptions there are not current delivery claims. |
| Provider access and spending | Accepted subscription-first direction through the local Kotlin backend, OS credential storage, explicit provider actions and separately enabled/budgeted API spending. Eligibility, models, allowance/credit controls and integration feasibility require investigation at execution time. See the co-author record above and [AI requirements](product-specification.md#ai-access-and-spending). No current provider availability is asserted here. |
| Authority and guidance | Explicit owner-selected source authority, visible unresolved conflicts, approved guidance and exact captured-passage overrides remain future capabilities. Metadata status and filename recency do not settle canon. See [R1](product-specification.md#r1--source-access-and-authority), the co-author decision record and [manual campaign review](sea-witch-manual-review.md). |
| Player material | Deliberately selected/redacted output remains in [R8](product-specification.md#r8--player-material); do not infer a player portal, accounts or tablet delivery. |
| Session-use operations | Packaging, serving frontend assets through Spring, session-use startup/distribution and operational database backup/restore remain future work. The development launcher and portable session/Writing archives do not by themselves deliver these. See [development guidance](../README.md#development), [local-operation requirements](product-specification.md#r12--local-laptop-operation-and-offline-play) and the retained [historical architecture](history/implementation-plan-2026-10-24.md#offline-persistence-and-recovery). |
| Evaluation and campaign decisions | Representative evaluation session, source-authority choices, real playthrough state and campaign conflicts require owner evidence. Preserve [outstanding questions](product-specification.md#outstanding-decisions-and-limits), [evaluation scenario](product-specification.md#evaluation-scenario) and the [Sea Witch review register](sea-witch-manual-review.md). Campaign files belong to independent repositories and are outside application edits. |

## Deferred ideas and exclusions

Note-to-resource promotion in Write, multiple primary note associations and a recent-scenes shortcut remain deferred. General source history is separate from delivered resource-bound PlayNote history. AI summaries, autonomous world-state/discovery tracking, combat automation, extra piles, card backs, freeform/resizable tabletop windows and mandatory review workflows are not delivered by P8.

Ship accounting, interactive maps and broader consistency audits remain assessment opportunities, not committed initial requirements. Preserve the [initial concept](../concept.md), [original exclusions](product-specification.md#initial-exclusions), [tabletop scope](product-specification.md#play-tabletop--accepted-requirements-reconciliation--2026-10-24) and historical proposals for future discussion. Earlier Read/focus-slot and unprepared-P4R completion requirements have explicit supersessions; they are not a backlog to revive automatically.

## Architecture-health roadmap — proposed, not approved for implementation

The owner requested an architecture review against hexagonal architecture, cohesion, coupling and domain modeling, then a plan. The subsequent authorization covers preserving that proposal during documentation cleanup; it does not approve these architectural choices or increments. The review found no new functional defect and recommended retaining the modular monolith.

| Increment | Proposed scope | Completion criteria |
| --- | --- | --- |
| AH1 — Domain language and identity | Agree canonical logical-card, Source document/capture, Draft, prepared-item, Scene-association, Play-workspace and PlayNote definitions. Use existing domain documents and a concise glossary only when approved. | Vocabulary agrees with behavior; imported copies, revisions, sections and removed originals are unambiguous. Record mismatches without behavior changes. |
| AH2 — Explicit consistency contracts | Trace campaign locking, Library association reconciliation and other read-triggered writes; make effects explicit while initially preserving transaction boundaries. | Callers can identify locking and persistence. Atomic Add, retries, archive rollback and identity guarantees remain protected. Reduce lock scope only with evidence. |
| AH3 — Frontend session coordination | Define a focused owner for departure, coordinated saves and workspace transitions; remove Library access through Preparation's Play state. | Explicit coordination contract; domain-specific states retain ownership; save ordering, cancelled departure, uncertain delivery and originating-session safety remain intact. |
| AH4 — Cohesive domain transitions | Consolidate pure PlayWorkspace movement/Scene invariants and rejection rules in domain operations. Keep loading, transactions and persistence in application services. | Pure tests cover accepted/rejected transitions; orchestration does not duplicate domain rules; runtime/archive behavior stays stable. |
| AH5 — Boundary enforcement and integration | Tighten architecture checks to the approved dependencies; separate domain and HTTP-schema concepts where the earlier increments demonstrate value. | Rules enforce intended boundaries; integration checks pass; remaining exceptions have documented rationale. |

Recommended order: AH1 → AH2 → AH3 → AH4 → AH5. Each needs a bounded design/plan and phase authorization; approvals can cover multiple phases together. Developer test starts do not need individual approval. Protect frozen identity, atomic Add, campaign isolation, archive recovery, placement preservation and unsaved-work guards.

Review evidence to revisit: `SessionState` and the shared Prepare/Play workspace coordinate multiple lifecycles; Library calls `preparation.play.flush()` and inspects preparation revision state. `PlayWorkspace.move()` relies on application-level membership/Scene/bounds checks. `Campaigns.configuration()` acquires a pessimistic write lock; Library snapshot composition can persist Source associations. Public API objects also carry Jackson/OpenAPI concerns. These are maintainability risks and consistency tradeoffs, not proof of functional failure or a reason for blanket abstractions.

Exclude microservices, event infrastructure, generic repository layers, wholesale DTO duplication, blanket UUID wrappers and a frontend state-management rewrite. Preserve existing ports, ownership and tested consistency. Domain definitions and naming changes remain proposals until resolved with the owner.

## Validation limits to consider separately

Safari/WebKit, exhaustive assistive-technology/accessibility, maximum-sized history/session performance, every concurrency schedule and forced-termination recovery remain unverified. Existing bundle/style/generator warnings remain recorded, with budgets unchanged. These limits are not automatically promised product increments. See [P8 assessment](verification.md#p8--integrated-developer-handover--2026-10-24) and the preserved per-increment records before selecting new validation scope.
