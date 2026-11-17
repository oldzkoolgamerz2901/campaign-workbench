# Full-card presentation

Scope: shared full-card presentation and temporary viewer state. Approved card communication requirements and accepted architecture/CD2 scope (2026-11-17) refine the earlier card-front requirements; this contract grants no phase authorization.

- **CFP-R2.1** — Each displayed full card shall start with visible front text. Hide text shall hide the entire front panel, retaining artwork, Show text, flip and supported document controls; it shall leave the back unchanged.
- **CFP-R2.2** — A visibility choice shall belong to that displayed card alone, survive flips and unrelated updates, and reset for a different card or reopened view. It shall never be persisted or synchronized.
- **CFP-R2.3** — Keyboard, pointer and touch visibility controls shall not select, expand, move or flip cards. Complete fallback front reading shall retain literal quote, summary and stored tags. Hidden text shall not alter fit eligibility.

Sources owns canonical geometry and fit (CFP-R1.1 in its package contract). Rendering rejects incompatible profiles and unavailable fonts rather than substituting capacity. Thumbnails and catalogue rows are excluded.

Evidence: `playing-card.spec.ts` CF2 viewer-local tests assert independent instances, lifecycle, event isolation, literal reading and preserved document/back access. `card-layout-renderer.spec.ts` covers profile/font failures; backend `CardLayoutTest` covers fit and geometry. Browser journeys and remaining coverage limits are recorded in `docs/implementation-plan.md` and `docs/card-front-contract-evaluation.md`.

- **CFP-R3.1** — Physical fronts shall show only title/optional quote. Physical backs shall retain title/type, Flip and conditional Details, with no internal scrolling or content-driven font shrinking.
- **CFP-R3.2** — Deliberate back overflow shall show complete fitting lines and visible continuation. One Details window shall provide complete available information on overflow or layout failure, preserving literal text. A complete fitting card shall not offer a no-op Details action.
- **CFP-R3.3** — Details activation and interaction shall remain independent of selection, document access, flip and drag. Closing by button or Escape shall return focus to its opener when retained. Changed card content/context shall close stale Details.

Sources CFP-R1.1–R1.2 and CD2 layout/backend/browser checks provide the refined traceability; developer and formal evidence is recorded in the implementation plan and verification record. CD5 adds optional structured stats under CFP-R3.4 below. CD4 adds one optional Details image: it is uncropped in the same Details window and available regardless of back reveal, with explicit loading/failure/retry; equivalent image-loader identities preserve reading. CD3 adds disclosure: unrevealed cards remain flippable with title/type and “Back not revealed”; Details and layout requests must contain only permitted content. Server-side projection is the disclosure authority.

- **CFP-R3.4** — Optional stats shall appear on the back alongside independent back text using complete coherent groups and fixed typography. One Details window shall retain all permitted stat values and authored order. Withheld stats shall be absent from presentation and layout inputs. Stat-free cards shall retain their existing presentation.

CD5 traceability: `StructuredStatsLayoutTest`, `StructuredStatsIntegrationTest`, the stats-enhanced Sharing projection lifecycle test, `playing-card.spec.ts`, `writing-state.spec.ts`, `structured-stats.spec.ts` and canonical renderer fixtures. Formal evidence is recorded separately in `docs/verification.md`.
