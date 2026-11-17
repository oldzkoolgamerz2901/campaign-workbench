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
/// ## Canonical front presentation
/// - **CFP-R1.1** — When a full card is composed, Sources shall retain canonical 243 × 420 dimensions, compose only title and optional quote on the front, and omit empty quote areas. If their complete text exceeds the panel or cannot use the canonical fonts, Sources shall report non-fit without partial geometry. Front fit shall be independent of back length, type, summary, tags and viewer visibility.
///
/// - **CFP-R1.2** — When a back is composed, Sources shall retain title/type and control space, emit only complete fitting information lines and mark deliberate continuation explicitly. Deliberate overflow shall retain valid compact geometry; measurement/font/input failures shall remain distinct and expose no partial geometry.
///
/// - **CFP-R1.3** — Optional stat presentation shall preserve fixed typography, emit complete core/supporting/section groups, prioritize core then ordinary back text then remaining groups, and mark omitted permitted content for Details. Stats shall not affect front fit or extend campaign Markdown interpretation.
///
/// ## Invariants and exclusions
/// - Quote and summary remain separate; no campaign file is automatically rewritten.
/// - This contract grants no implementation authorization and covers no card visibility UI.
///
/// ## Provenance and evidence
/// Accepted card-front requirements (2026-11-15), refined by approved card communication requirements and CD2 architecture/scope (2026-11-17).
/// Assertion-level traceability and explicit coverage gaps: `docs/card-front-contract-evaluation.md`.
///
package workbench.sources;
