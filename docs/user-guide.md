# Using Campaign Workbench

This describes the delivered workspaces after P8. Approved behavior remains in the [product specification](product-specification.md); formal evidence and limits are in [verification](verification.md). Earlier detailed instructions are preserved in the [historical usage record](history/usage-2026-10-24.md), where controls or formats may differ from the current application.

## Library

Use **Manage campaign** to register a campaign folder and configure source rules. The shared header selects the campaign. Independent Markdown files remain authoritative; the app never rewrites them. Explicit source refresh captures later file changes; a failed refresh retains the previous readable capture.

The catalogue combines captured Sources and saved Drafts, with the effective Draft taking precedence. Search includes incomplete entries; the compact type control narrows results. Classification, readiness and identity conflicts remain visible. Catalogue and reader scroll separately on laptop and stack on narrow screens.

Select a document to use its full Markdown reader or optional Card view. Details exposes provenance, validation, conflicts and Source availability. **Edit in Write** reuses or creates the associated Draft. **Refresh sources** refreshes the capture; **Reload catalogue** checks saved state; **Reload selected document** explicitly recovers stale reading. Associated Source/Draft links open the effective Draft and its headings; unsafe, conflicting or stale targets require explicit recovery rather than silently choosing different content.

Choose the current session explicitly. The route carries it between workspaces; changing campaign clears it. With no destination, **Add to session…** asks you to select or create one. Add saves pending workspace changes first and freezes the selected representation atomically. Switching session cannot redirect an in-flight request. Already-prepared material offers **View in Prepare**; newer revisions are updated explicitly there. Inspection alone never adds material or changes the Play arrangement.

## Write

Create and edit durable Drafts with independent **Document / Card** editing tabs. The supporting panel has **Preview / Library** modes and one hide/show control; Preview independently chooses Card or Document. Reference results use available panel height and scroll independently from the editor.

**Card back text** is separately authored plain text with line breaks, independent of the summary and Markdown body. Open **Check physical card fit** in Preview to inspect static front/back text layouts. Fit warnings identify text that needs shortening or characters unavailable in the card font. You can still save and export oversized Drafts within the existing export safety limits; adding a new session card or applying a newer revision requires both sides to fit. Fit feedback is cleared while the current text is being checked.

Back text travels with the saved revision, Markdown export and frozen prepared copy. Editing it later leaves existing sessions unchanged until **Use latest version**. Use **Flip to back / Flip to front** on any full card, including Library references, Writing recovery and every Play location. Flipping is temporary and does not select, move or activate the card. Content, selection, reopened views and location changes restore the front; unrelated saves leave the side being read alone. Flips use a brief animation, with immediate changes for reduced motion.

Both card sides remain scroll-free. If a side does not fit or its layout/fonts are unavailable, **Read all front text / Read all back text** opens the complete side in an external reading dialog. Front reading includes title, type, summary and every tag. **Open full document** remains on the front. Historical cards remain intact; edit a working Draft and explicitly replace its prepared revision to change frozen text.

Markdown stores this optional text in `workbench.backText` front matter; export preserves its line breaks. Session exports use format v11 and can read the preceding v10 format. Writing JSON recovery uses v5 and illustrated ZIP manifests use v6; readers also accept the preceding v3/v4 formats. Missing historical back text means an empty back. Older retained Markdown and hashes stay unchanged. If an old Draft already retained an unknown metadata key named `backText`, export reports the collision rather than overwriting that evidence; a fresh Draft can author the new field separately.

Opening a full reference saves successfully before navigating to Library. **Return to Write** or browser Back restores the originating Draft, tabs, panel and reference search. Cursor and scroll restoration are best effort. Save failures retain local work and guard departure.

Local artwork is shown in the shared card preview and frozen with prepared content. Replacing or removing live Draft artwork does not rewrite existing prepared artwork. **Export to campaign** downloads reviewed Markdown for manual placement; explicitly refresh Sources afterward. Export inspection warns when linked Draft content is not reproduced by captured campaign files. AI assistance remains future work.

Writing recovery archives preserve Drafts and retained history through the existing recovery workspace. Markdown downloads are portable content, not a substitute for a complete Writing backup. See [historical detailed recovery instructions](history/usage-2026-10-24.md#writing-recovery) and the [accepted recovery plan](history/implementation-plan-2026-10-24.md#mw-4--portable-draft-recovery-and-release-walkthrough--accepted-plan--2026-10-20) for the full contract.

## Prepare

Prepare owns ordered frozen session material and preparation notes. Open **Add material** or **Add cards from Library** to use the unified picker; select or create a destination first when needed. New membership uses whole-card Library Add. Historical prepared sections and duplicate copies remain readable and portable.

Prepared material opens in **Read**. Valid prepared Scenes also offer **Scene planning** for explicit links to already-prepared cards. Inspect a linked card and use **Back to scene**; session notes stay selected while item notes follow the selected prepared item.

**Use latest version** explicitly accepts a newer valid saved revision of the same type whose front and back text fit. Replacement preserves item identity, order, notes, Scene associations and runtime arrangement. Invalid metadata, changed type or non-fitting card text blocks replacement. Existing oversized/historical prepared content remains readable and portable. Removal confirms affected Scene associations and prunes only the removed runtime membership; removing the active Scene clears its slot.

## Play

Every prepared item has exactly one runtime location: Session Cards, Pile 1, Pile 2, Used, or the reserved active Scene slot. The two piles retain names, order and displayed covers. New material enters the front of Session Cards. Used means manually set aside; it does not mean discovered by players.

Drag a movable card surface to move it; on touch screens, hold briefly before dragging. Clicking reads the card. Flip, document and card-action controls stay separate. Card menus provide keyboard move/reorder alternatives, including within Show all. The active Scene cannot be dragged. Clear search/type filters before dragging Session Cards or Used. **Show all** opens pile contents; changing the cover does not select another document or move cards. Search/type filtering applies to Session Cards and Used, while pile contents remain available.

Pile headers contain the name, rename action, card count and **Show all**. Side arrows change the displayed cover without changing pile order or the selected document. Multiple-card piles have decorative stacked edges. **Show all** opens a bounded card grid: drag to reorder, or drop on **Other pile**, **Session Cards** or **Used cards** in its header. Each card's **⋯** actions provide keyboard movement and ordering. Reordering keeps the displayed cover; moving that card away advances the cover to the next surviving card. Reading a card closes the tray; Close or Escape returns focus to Show all.

Activate or change a Scene explicitly. The Scene overview offers Keep current piles, customization and cancellation. Related cards come from Preparation's session-specific associations. Confirmation applies the Scene and selected movements together. Reading, Library inspection and cover changes never activate a Scene. Reopening and visiting Prepare preserve committed arrangement; temporary overlays, panel mode and selected document need not persist.

The right panel switches between **Notes / Document**. Document keeps the existing frozen Markdown reader and heading navigation. Inside Notes, **Live notes** starts with the new/edit composer and five recent notes; **Preparation** shows read-only Session/Selected Item references; **History** contains complete session chronology, pins, cross-session resource/Scene history and reload/recovery tools. Switching these views or Notes/Document retains unsubmitted text, edit context, captured Scene, primary resource and reader selection. Choosing Edit explicitly returns to Live notes after any unsaved-edit confirmation. Unsaved-note departure guards remain active.

Create a PlayNote with Markdown and at most one primary resource. The server captures active Scene context; changed Scene context requires explicit review with text retained. Save the note, then edit it to pin it. Pins remain in full chronology. Failed or uncertain saves retain retry identity instead of creating duplicates.

Expand **Card history across sessions** to select a prepared copy and view primary-resource or captured-Scene history. Pins and full chronology paginate independently. History retains captured titles and session provenance after original removal, uses exact origin-qualified identity, and never merges by title or path. Session links retain unsaved-draft guards.

## Share

Select the campaign and prepared session in **Share**. Manage players and pair tablets through the LAN controls; enabling sharing is explicit. On a prepared source, choose **Share**, inspect both sides and artwork, select Group Unsorted, an existing/new Group pile or one player's Unsorted, choose Handout or Inventory and confirm. Artwork must load before confirmation. Changed content requires review again. An uncertain response offers **Retry delivery**, which recovers the same copy even after closing/reopening that dialog in the same workspace. A subsequent new distribution deliberately creates another copy.

Select the Group or named player destination to inspect actual shared cards. Tablets show **Group Cards** and **My Cards** separately; personal cards are private to that player. Click/tap or keyboard-activate a card to expand, flip with its on-card control, and use complete side reading when necessary. Players never receive the full source document. Quiet arrival indicators do not navigate or interrupt reading. Transport loss retains stale reading in memory; access denial hides content. Reload requires connection. Shared copies retain their frozen text and artwork after prepared-source removal.

Drag Group Inventory onto **My Cards** (or **My Cards · Claim** inside Show all) to claim it immediately into My Cards Unsorted without leaving Group. If another player claims first, the view refreshes with an unavailable message. In My Cards, drag Inventory to **Remove · confirm**; removal requires confirmation and applies only to your Inventory. Handouts cannot be claimed or removed by players.

The DM drags active Inventory to Group, a Group pile or a player to transfer it. Dragging to **Remove · confirm** discards Inventory; **Withdraw · confirm** removes a Handout, both with confirmation. **Removed cards** is the single DM-only recovery view: **Restore** returns the same instance to its previous recipient's Unsorted, even if that player is inactive. Restoration does not reactivate their access. Unknown connection loss disables commands while retaining local reading; reconnect refreshes state before commands resume.

The distribution dialog keeps Cancel and confirmation visible while preview and destination details scroll internally when needed.

Use **New pile** to create an empty pile. The DM manages Group piles. Players can move and reorder Inventory and Handouts between existing Group piles and Group Unsorted, and manage their own My Cards piles across paired devices. Group movement keeps cards shared with Group; Claim is separate. The DM can inspect personal piles but cannot reorganize them. The pencil beside the pile name renames it; the **⋯** menu offers earlier/later order and deletion. Deleting a nonempty pile asks for confirmation and appends its cards to the same collection's Unsorted in pile order; empty deletion is immediate. Drag between piles and Unsorted to move cards; drop onto another card to insert before it. These moves preserve recipient and mode.

Tap a pile cover to browse its cards, then tap an individual card to expand it. The DM also has a **Show all** button; player pile headers omit it. Unsorted cards expand directly. Tap outside an expanded card or press Escape to close it; card controls and contextual actions keep it open.

Pile arrows beside the cover change the organizer's saved default cover; Group viewers browse locally. Covers survive reordering and advance when their card leaves. Counts, empty piles and **Show all** remain available; Show all opens a bounded grid with card reading and drag destinations. Moving an accessible card preserves an open reader. Shared collections are independent of Prepare and Play. Session/Writing archives do not back up Sharing state or artwork.

Drag a prepared source onto a collection destination or Group pile to open distribution review with that destination selected; mode and confirmation remain explicit. Drag active Inventory to another collection for immediate same-instance transfer; personal destinations always use Unsorted. While inspecting a player collection, Group pile destinations appear during eligible dragging. Dragging never changes Prepare or Play.

Organizers can drag an individual card from a pile cover, Unsorted or Show all to another owned location. Drop onto another card to insert before it; drop on a location target to append. On tablets, drag eligible Group Inventory onto sticky **My Cards** to claim without leaving Group. Inside Show all, use its conditional **My Cards · Claim** target. Eligible **Remove** or **Withdraw** drop targets require confirmation.

On touch screens, swipe to scroll or briefly hold a card: the card highlights and permitted destinations appear before movement. Move to drag; releasing a hold without movement cancels without opening the card or executing an action. Flip and reading controls work independently. Escape, touch cancellation or release outside a permitted target cancels. A source that disappears or changes location, navigation or connection/access loss also cancels. Sharing Card actions menus have been removed on all surfaces, including expanded readers. Close the expanded reader before dragging a card; non-drag alternatives for these card commands are no longer provided. Pile-management controls and the prepared-card Share button remain. Physical-tablet/Safari behavior and owner acceptance remain separate from automated Chromium evidence.

The sticky player header combines the collection title, Playing as identity, connection indicator and collection navigation. Identity and connection stay in place when switching collections. Long player names truncate; longer errors and command feedback remain below the header. Both DM Share and player cards show Handout/Inventory above the card at the left edge. Multi-card piles show layered card backs; their cover keeps the same size as a single-card pile.

## Transfer and recovery

Session archives use strict current format **v10**, including frozen text/artwork/provenance, preparation notes, Scene associations, runtime locations/covers/names and PlayNotes. Imports create new session/item/note identities while preserving historical origin evidence. Unsupported or invalid archives are rejected without partial session imports. Unopened runtime workspaces remain representable. Older formats are not supported.

Keep session archives and Writing recovery archives for their distinct purposes. They do not constitute a complete PostgreSQL operational backup. Session-use packaging and operational backup/restore remain [future work](future-work.md).
