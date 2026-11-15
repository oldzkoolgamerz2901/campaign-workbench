/// # Frozen quote distribution
///
/// Scope: only the quote operations listed below, not the complete module.
/// Approved product intent and architecture take precedence; phase gates remain mandatory.
///
/// ## Requirements
/// - **SCP-R1.1** — If visible quote content changes after distribution review, Sharing shall reject the outdated preview without partial distribution.
/// - **SCP-R1.2** — When distribution succeeds, Sharing shall retain and deliver the frozen quote independently of subsequent source changes or removal; retrying the same completed operation shall recover the same instance and quote.
/// - **SCP-R1.3** — When a historical empty-quote distribution is retried, Sharing shall preserve its existing review fingerprint and operation identity.
///
/// ## Invariants and exclusions
/// - Quote and summary remain separate; no campaign file is automatically rewritten.
/// - This contract grants no implementation authorization and covers no card visibility UI.
///
/// ## Provenance and evidence
/// Accepted card-front requirements (2026-11-15), CF1 architecture and owner-approved scope.
/// Assertion-level traceability and explicit coverage gaps: `docs/card-front-contract-evaluation.md`.
///
package workbench.sharing;
