/// # Writing — Save Draft
///
/// > Persist editable, campaign-scoped drafts without losing newer revisions or unsaved local work.
///
/// This is the authoritative contract **only for the Save Draft capability** in Writing.
/// Other Writing operations retain their existing approved requirements. An inconsistency
/// with accepted product decisions requires investigation and owner approval, not an
/// automatic change to this contract or implementation.
///
/// ## Boundary
/// - `save-draft` — save an existing working draft and its optional artwork change.
///
/// ## Requirements
///
/// ### WSD-R1: Revision handling
/// - **WSD-R1.1** — When an existing draft is saved with its current revision,
///   Writing shall persist the submitted working fields and advance the revision.
/// - **WSD-R1.2** — If an existing draft is saved with a stale revision, then Writing
///   shall reject the save without overwriting the newer saved revision.
///
/// ### WSD-R2: Campaign ownership and durability
/// - **WSD-R2.1** — If a draft is addressed through a different campaign, then Writing
///   shall reject the operation without modifying the draft.
/// - **WSD-R2.2** — When a draft is saved successfully, Writing shall retain the
///   resulting saved fields and revision across an application restart.
///
/// ### WSD-R3: Working content
/// - **WSD-R3.1** — When a working draft has incomplete metadata within supported
///   working-content limits, Writing shall allow the content to be saved independently
///   of its readiness for preview or session preparation.
/// - **WSD-R3.2** — If working-content limits are exceeded, then Writing shall reject
///   the save without replacing the stored draft.
///
/// ### WSD-R4: Artwork
/// - **WSD-R4.1** — When artwork is replaced or removed successfully, Writing shall
///   save that change as a revisioned draft edit.
/// - **WSD-R4.2** — If an artwork upload fails, then Writing shall preserve the
///   previously saved artwork and retain the unsaved selection for deliberate retry.
///
/// ### WSD-R5: Failure and conflict recovery in Write
/// - **WSD-R5.1** — If a temporary save fails, then Write shall preserve local
///   edits, report failure, and allow a deliberate retry.
/// - **WSD-R5.2** — If a save conflicts with a newer revision, then Write shall
///   preserve local edits and require an explicit reload decision rather than
///   automatically retrying against the newer revision.
/// - **WSD-R5.3** — While local edits have not been safely saved, Write shall guard
///   navigation against silently discarding them.
///
/// ### WSD-R6: Delayed save responses
/// - **WSD-R6.1** — While a save is pending, when newer edits are made, Write shall
///   not acknowledge the newer edits as saved on receipt of the earlier response.
///
/// ## Invariants
/// - Saved drafts are campaign-scoped.
/// - A successful save advances the draft's working revision.
/// - A failed or conflicting save must not silently discard working edits or replace
///   a newer stored revision.
///
/// ## Out of scope
/// - Creating, deleting, exporting, approving, or preparing drafts.
/// - Changing API transport, database representation, application modules or UI design.
/// - Describing general Writing behaviour outside Save Draft.
///
/// ## Provenance
/// - `MW2`, `MW3` — manual editing and durable, conflict-safe drafts.
/// - Approved per-card artwork requirements (2026-10-21) — revisioned artwork edits,
///   failure retention, and preserved prepared artwork.
/// - Accepted existing Writing browser/interaction behaviour and revision tests.
///
/// ## Verification
/// Each `WSD-Rn.m` ID must be mapped to an existing test assertion or recorded as
/// a coverage gap. Identifier presence alone is not evidence of semantic coverage.
/// See `docs/sbce-p1-evaluation.md` for the initial mapping.
///
/// ## Decisions
/// - This contract's current behaviour is subordinate to approved product intent.
/// - No code, test, or agent may revise this contract to rationalize a divergent implementation.
/// - New or changed behavioural obligations require approval through the existing six phases.
package workbench.writing;
