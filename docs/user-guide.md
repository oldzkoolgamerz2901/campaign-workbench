# Using Campaign Workbench

This describes the delivered workspaces after P8. Approved behavior remains in the [product specification](product-specification.md); formal evidence and limits are in [verification](verification.md). Earlier detailed instructions are preserved in the [historical usage record](history/usage-2026-10-24.md), where controls or formats may differ from the current application.

## Library

Use **Manage campaign** to register a campaign folder and configure source rules. The shared header selects the campaign. Independent Markdown files remain authoritative; the app never rewrites them. Explicit source refresh captures later file changes; a failed refresh retains the previous readable capture.

The catalogue combines captured Sources and saved Drafts, with the effective Draft taking precedence. Search includes incomplete entries; the compact type control narrows results. Classification, readiness and identity conflicts remain visible. Catalogue and reader scroll separately on laptop and stack on narrow screens.

Select a document to use its full Markdown reader or optional Card view. Details exposes provenance, validation, conflicts and Source availability. **Edit in Write** reuses or creates the associated Draft. **Refresh sources** refreshes the capture; **Reload catalogue** checks saved state; **Reload selected document** explicitly recovers stale reading. Associated Source/Draft links open the effective Draft and its headings; unsafe, conflicting or stale targets require explicit recovery rather than silently choosing different content.

Choose the current session explicitly. The route carries it between workspaces; changing campaign clears it. With no destination, **Add to session…** asks you to select or create one. Add saves pending workspace changes first and freezes the selected representation atomically. Switching session cannot redirect an in-flight request. Already-prepared material offers **View in Prepare**; newer revisions are updated explicitly there. Inspection alone never adds material or changes the Play arrangement.

## Write

Create and edit durable Drafts with independent **Document / Card** editing tabs. The supporting panel has **Preview / Library** modes and one hide/show control; Preview independently chooses Card or Document. Reference results use available panel height and scroll independently from the editor.

Opening a full reference saves successfully before navigating to Library. **Return to Write** or browser Back restores the originating Draft, tabs, panel and reference search. Cursor and scroll restoration are best effort. Save failures retain local work and guard departure.

Local artwork is shown in the shared card preview and frozen with prepared content. Replacing or removing live Draft artwork does not rewrite existing prepared artwork. **Export to campaign** downloads reviewed Markdown for manual placement; explicitly refresh Sources afterward. Export inspection warns when linked Draft content is not reproduced by captured campaign files. AI assistance remains future work.

Writing recovery archives preserve Drafts and retained history through the existing recovery workspace. Markdown downloads are portable content, not a substitute for a complete Writing backup. See [historical detailed recovery instructions](history/usage-2026-10-24.md#writing-recovery) and the [accepted recovery plan](history/implementation-plan-2026-10-24.md#mw-4--portable-draft-recovery-and-release-walkthrough--accepted-plan--2026-10-20) for the full contract.

## Prepare

Prepare owns ordered frozen session material and preparation notes. Open **Add material** or **Add cards from Library** to use the unified picker; select or create a destination first when needed. New membership uses whole-card Library Add. Historical prepared sections and duplicate copies remain readable and portable.

Prepared material opens in **Read**. Valid prepared Scenes also offer **Scene planning** for explicit links to already-prepared cards. Inspect a linked card and use **Back to scene**; session notes stay selected while item notes follow the selected prepared item.

**Use latest version** explicitly accepts a newer valid saved revision of the same type. Replacement preserves item identity, order, notes, Scene associations and runtime arrangement. Invalid metadata or changed type blocks replacement. Removal confirms affected Scene associations and prunes only the removed runtime membership; removing the active Scene clears its slot.

## Play

Every prepared item has exactly one runtime location: Session Cards, Pile 1, Pile 2, Used, or the reserved active Scene slot. The two piles retain names, order and displayed covers. New material enters the front of Session Cards. Used means manually set aside; it does not mean discovered by players.

Use card actions or drag handles to move cards. Keyboard/menu actions provide equivalents. **Show all** opens pile contents; changing the cover does not select another document or move cards. Search/type filtering applies to Session Cards and Used, while pile contents remain available.

Activate or change a Scene explicitly. The Scene overview offers Keep current piles, customization and cancellation. Related cards come from Preparation's session-specific associations. Confirmation applies the Scene and selected movements together. Reading, Library inspection and cover changes never activate a Scene. Reopening and visiting Prepare preserve committed arrangement; temporary overlays, panel mode and selected document need not persist.

The right panel switches between **Notes / Document**. Document uses the existing frozen Markdown reader and heading navigation. Notes contains independent PlayNotes plus read-only Preparation references. Tabletop and reader interactions retain an unsubmitted note's text and primary association. Unsaved-note navigation uses explicit departure guards.

Create a PlayNote with Markdown and at most one primary resource. The server captures active Scene context; changed Scene context requires explicit review with text retained. Save the note, then edit it to pin it. Pins remain in full chronology. Failed or uncertain saves retain retry identity instead of creating duplicates.

Expand **Card history across sessions** to select a prepared copy and view primary-resource or captured-Scene history. Pins and full chronology paginate independently. History retains captured titles and session provenance after original removal, uses exact origin-qualified identity, and never merges by title or path. Session links retain unsaved-draft guards.

## Transfer and recovery

Session archives use strict current format **v10**, including frozen text/artwork/provenance, preparation notes, Scene associations, runtime locations/covers/names and PlayNotes. Imports create new session/item/note identities while preserving historical origin evidence. Unsupported or invalid archives are rejected without partial session imports. Unopened runtime workspaces remain representable. Older formats are not supported.

Keep session archives and Writing recovery archives for their distinct purposes. They do not constitute a complete PostgreSQL operational backup. Session-use packaging and operational backup/restore remain [future work](future-work.md).
