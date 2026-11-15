# Full-card front presentation

Scope: shared full-card presentation and temporary viewer state. Approved card-front requirements and accepted architecture (2026-11-15) govern intent; this contract grants no phase authorization.

- **CFP-R2.1** — Each displayed full card shall start with visible front text. Hide text shall hide the entire front panel, retaining artwork, Show text, flip and supported document controls; it shall leave the back unchanged.
- **CFP-R2.2** — A visibility choice shall belong to that displayed card alone, survive flips and unrelated updates, and reset for a different card or reopened view. It shall never be persisted or synchronized.
- **CFP-R2.3** — Keyboard, pointer and touch visibility controls shall not select, expand, move or flip cards. Complete fallback front reading shall retain literal quote, summary and stored tags. Hidden text shall not alter fit eligibility.

Sources owns canonical geometry and fit (CFP-R1.1 in its package contract). Rendering rejects incompatible profiles and unavailable fonts rather than substituting capacity. Thumbnails and catalogue rows are excluded.

Evidence: `playing-card.spec.ts` CF2 viewer-local tests assert independent instances, lifecycle, event isolation, literal reading and preserved document/back access. `card-layout-renderer.spec.ts` covers profile/font failures; backend `CardLayoutTest` covers fit and geometry. Browser journeys and remaining coverage limits are recorded in `docs/implementation-plan.md` and `docs/card-front-contract-evaluation.md`.
