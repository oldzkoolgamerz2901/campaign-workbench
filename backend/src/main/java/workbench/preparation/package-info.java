/// # Prepared quote preservation
///
/// Scope: only the quote operations listed below, not the complete module.
/// Approved product intent and architecture take precedence; phase gates remain mandatory.
///
/// ## Requirements
/// - **PCP-R1.1** — When a card is added or explicitly replaced, Preparation shall freeze the quote of that exact accepted card revision. Later Draft or Source changes shall leave existing frozen quotes unchanged.
/// - **PCP-R1.2** — When supplying a prepared card for distribution, Preparation shall expose its frozen quote alongside its other visible card content, without requiring the live Draft or Source.
///
/// ## Invariants and exclusions
/// - Quote and summary remain separate; no campaign file is automatically rewritten.
/// - This contract grants no implementation authorization and covers no card visibility UI.
///
/// ## Provenance and evidence
/// Accepted card-front requirements (2026-11-15), CF1 architecture and owner-approved scope.
/// Assertion-level traceability and explicit coverage gaps: `docs/card-front-contract-evaluation.md`.
///
package workbench.preparation;
