# Writing quote portability

Scope: quote preservation in recovery and export only. Save Draft remains governed by its package contract. Approved card-front requirements (2026-11-15) and architecture take precedence; phase gates remain mandatory.

- **WCP-R1.1:** When Writing exports Markdown or backs up, restores or copies supported recovery content, it shall preserve the quote independently of summary and body, including historical snapshot distinctions.
- **WCP-R1.2:** When a supported predecessor recovery archive omits quote, Writing shall supply an empty quote without changing historical Markdown, hashes or interpretation. If a wire shape or quote is incompatible with its declared version, Writing shall reject restore without a partial workspace.

No new source authority, automatic campaign write, or general recovery behavior is specified here. Traceability and gaps: `docs/card-front-contract-evaluation.md`.

## Structured stats portability — CD5

- **WCP-R2.1:** Supported Writing recovery shall preserve optional stats in current, approved and exported snapshots. Markdown export shall disclose omission of stats without changing the campaign schema or historical Markdown/hash semantics.
- **WCP-R2.2:** Supported predecessor formats shall remain stat-free; inconsistent version/shape or invalid stats shall reject recovery without partial installation.

Traceability: `StructuredStatsIntegrationTest` asserts retained revisions, removal, restart, JSON/ZIP copy/restore, version/unknown-field rejection and export warning. Save traceability: WSD-R9.1/R9.2 in that suite; delayed saves/conflict/local retention in `writing-state.spec.ts`.
