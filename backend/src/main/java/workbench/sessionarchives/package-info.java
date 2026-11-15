/// # Session quote portability
///
/// Scope: only the quote operations listed below, not the complete module.
/// Approved product intent and architecture take precedence; phase gates remain mandatory.
///
/// ## Requirements
/// - **SAP-R1.1** — When a current session archive is exported and imported, Session Archives shall preserve each frozen quote. Supported predecessor archives lacking quote content shall remain readable with empty quotes.
/// - **SAP-R1.2** — If quote fields are missing, malformed or unexpected for the declared wire version, Session Archives shall reject the archive before importing sessions.
///
/// ## Invariants and exclusions
/// - Quote and summary remain separate; no campaign file is automatically rewritten.
/// - This contract grants no implementation authorization and covers no card visibility UI.
///
/// ## Provenance and evidence
/// Accepted card-front requirements (2026-11-15), CF1 architecture and owner-approved scope.
/// Assertion-level traceability and explicit coverage gaps: `docs/card-front-contract-evaluation.md`.
///
package workbench.sessionarchives;
