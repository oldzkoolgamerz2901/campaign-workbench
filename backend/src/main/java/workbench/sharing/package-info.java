/// # Frozen quote distribution
///
/// Scope: frozen quote distribution and CD3 back disclosure, not the complete module.
/// Approved product intent and architecture take precedence; phase gates remain mandatory.
///
/// ## Requirements
/// - **SCP-R1.1** — If visible quote content changes after distribution review, Sharing shall reject the outdated preview without partial distribution.
/// - **SCP-R1.2** — When distribution succeeds, Sharing shall retain and deliver the frozen quote independently of subsequent source changes or removal; retrying the same completed operation shall recover the same instance and quote.
/// - **SCP-R1.3** — When a historical empty-quote distribution is retried, Sharing shall preserve its existing review fingerprint and operation identity.
///
/// ## Back disclosure — CD3
/// - **SCP-R2.1** — New distributions shall default to unrevealed backs and retain the explicitly chosen initial permission in retry intent; changed intent shall conflict with a completed operation.
/// - **SCP-R2.2** — All player reads, layouts and mutation responses shall withhold unrevealed back information and non-front metadata, while retaining title/type/quote and front artwork. Unrevealed shall remain distinct from an empty revealed back.
/// - **SCP-R2.3** — An explicit DM Reveal back on an active instance shall permanently reveal that same frozen content, idempotently, without changing identity, recipient or placement. Players shall have no reveal operation.
/// - **SCP-R2.4** — Claim, transfer, removal, restoration, retry and restart shall preserve disclosure state; failed reveal shall not partially change permission or history.
///
/// - **SCP-R3.1** — Distribution shall freeze the optional Details image independently of front artwork and include it in reviewed content identity. Changed images shall reject stale review; retries and source removal shall preserve the same frozen image.
/// - **SCP-R3.2** — Authorized players shall be able to read that image before or after back reveal, without receiving hidden back information. Revoked/foreign access shall reject image reads.
///
/// - **SCP-R4.1** — Distribution review identity shall include complete authored stats. Distribution and retries shall retain the frozen values independently of live Draft/Preparation changes. Unrevealed player reads, layouts and mutation responses shall omit stats; Reveal back shall expose the same instance's frozen stats.
///
/// ## Invariants and exclusions
/// - Quote and summary remain separate; no campaign file is automatically rewritten.
/// - This contract grants no phase authorization; temporary orientation/front-panel visibility remain presentation concerns.
///
/// ## Provenance and evidence
/// Accepted card-front requirements (2026-11-15), refined by approved card communication requirements, architecture and CD3 scope (2026-11-17).
/// Assertion-level traceability and explicit coverage gaps: `docs/card-front-contract-evaluation.md`.
///
package workbench.sharing;
