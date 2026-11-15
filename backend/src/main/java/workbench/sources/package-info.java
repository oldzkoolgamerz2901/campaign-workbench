/// # Source quote interpretation and authoring
///
/// Scope: only the quote operations listed below, not the complete module.
/// Approved product intent and architecture take precedence; phase gates remain mandatory.
///
/// ## Requirements
/// - **SQA-R1.1** — When current-format card Markdown is encoded, decoded or captured, Sources shall preserve its separately authored plain-text quote, including line breaks, independently of summary and body; a missing quote shall be empty.
/// - **SQA-R1.2** — When historical interpretation 1 or 2 is requested, Sources shall retain an unknown quote key as historical metadata and shall not reinterpret it as authored content. If current authoring would overwrite that retained key, Sources shall report the conflict.
/// - **SQA-R1.3** — If a current quote has an incompatible scalar type or exceeds supported front-matter limits, Sources shall report invalid authoring without silently discarding the value.
///
/// ## Invariants and exclusions
/// - Quote and summary remain separate; no campaign file is automatically rewritten.
/// - This contract grants no implementation authorization and covers no card visibility UI.
///
/// ## Provenance and evidence
/// Accepted card-front requirements (2026-11-15), CF1 architecture and owner-approved scope.
/// Assertion-level traceability and explicit coverage gaps: `docs/card-front-contract-evaluation.md`.
///
package workbench.sources;
