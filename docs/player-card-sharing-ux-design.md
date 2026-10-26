# Player card sharing — accepted UX design

**Status:** Owner-accepted UX decisions 1–20, refined and reviewed 2026-10-26. Design documentation only; **not** browser-verified, an architecture approval, a G3 plan, or authorization to implement/merge. Scope is limited to `docs/future-player-card-sharing`. Maintain the accepted Sharing architecture Decisions 1–21 in [future-campaign-card-sharing.md](future-campaign-card-sharing.md), except where this document explicitly identifies **architecture reconciliation required**. Existing Play tabletop and Preparation remain independent.

## Goal and interaction philosophy

Players use tablets on the DM's LAN to read **front and back of explicitly shared cards**, claim eligible group inventory, remove their own inventory, and organize cards into optional piles. The DM distributes cards from the current session's prepared sources, organizes shared group piles, manages players, and restores/withdraws/transfers distributed instances. Favor a **simple, direct-manipulation UI**: tap to inspect, use on-card flip, hold and drag to move an individual card, drop on meaningful destinations, and use contextual actions as accessible equivalents. Avoid permanent controls that have no meaning outside an interaction.

Explicitly **no player full-document reader, document URL, or hidden source document in the player API payload**. Allow future selective front/back section disclosure; do **not** implement redaction in the initial UI. No freeform tabletop, freely positioned cards, separate flip buttons, additional reader panel, real-time transport, offline synchronization, or player-to-player inventory transfers.

## Locked UX decisions

| UX | Accepted decision |
| --- | --- |
| 1 | A collection tray (Unsorted) with optional named piles; initial layout is not obligatorily piled |
| 2 | Both front and back visible; full documents not player-accessible; future section-based spoiler restrictions kept possible |
| 3 | Claim via drag/drop or contextual Claim; transfer the same group-owned inventory instance |
| 4 | DM controls group organization; each player controls their personal organization |
| 5 | During distribution DM chooses Group Unsorted, existing/new group pile, or a specific player's Unsorted; Unsorted default |
| 6 | Eligible individual cards may be removed via drag to contextual Remove destination or contextual Remove command, **with confirmation** |
| 7 | Claim target appears/emphasizes only while dragging an eligible group inventory card; contextual Claim always accessible |
| 8 | Tap/click a card to expand; expanded surface reuses `PlayingCard`, its artwork, aspect ratio, flip and card-side behavior |
| 9 | Tap/click expanded card to close except on-card flip/other controls; no external flipping or previous/next reading controls |
| 10 | Claim immediately; no confirmation; concise feedback, gracefully handle concurrent loser |
| 11 | Quiet arrival with subtle new-card indicator; no forced navigation, cover change, or reading interruption |
| 12 | One unified DM Share workspace with prepared sources and collection destinations |
| 13 | Dragging a prepared source to a destination or contextual Share opens compact per-distribution mode popover, Handout or Inventory; explicit confirm/cancel; no sticky distribution mode |
| 14 | DM can create empty named group piles directly and create one during distribution |
| 15 | Delete pile only removes organization: cards return to the **same collection's** Unsorted; confirm for nonempty pile; empty pile deletes directly |
| 16 | DM transfers active inventory via drag/drop or contextual Transfer, immediately, to another collection, group pile, or player Unsorted; never player private piles |
| 17 | One DM-only Removed cards view for discarded inventory/withdrawn handouts; restore same instance to previous owner/recipient Unsorted |
| 18 | On transient disconnect preserve the in-memory displayed view as stale and disable mutations; on explicit access loss hide collections; online-only |
| 19 | Reconcile complete authoritative collection refresh while preserving reading and scroll context when possible; remove inaccessible cards promptly |
| 20 | Two **separate tablet screens**, Group Cards and My Cards; on Group screen the **My Cards destination is in the sticky top header**: tap navigates, eligible drag/drop claims; remain on Group after claim. On My Cards screen, Group Cards control navigates only (no player return transfer). Duplicate the claim destination **inside a modal pile overlay** only when dragging; do not depend on the obscured header. |

## Layout contract and screen hierarchy

### Tablet: Group Cards screen (default group overview)

```text
┌────────────────────────────────────────────────────┐
│ Group Cards                 [ My Cards › ]         │ ← sticky header
│                             tap=switch             │
│                             drag claimable card=claim
├────────────────────────────────────────────────────┤
│ [Enemies pile] [Found Items pile] [Locations pile] │
│ [More named piles ... responsive grid]             │
│                                                    │
│ Unsorted                                           │
│ [card] [card] [card] ...                           │
└────────────────────────────────────────────────────┘
```

- Group layout and pile names/order are campaign-shared and **DM-controlled**. Players browse but cannot reorder, rename or delete group piles or move unclaimed group cards between them.
- A pile shows its selected cover card and subtle stacked-edge treatment if at least two cards are present. Header shows name, count, Show all, and compact previous/next cover arrows framing the displayed card; cycling does **not** reorder. 0/1-card cases are explicit.
- **Unsorted** is a card tray like Play's Session Cards, not a third always-expanded focus pile. Group Unsorted remains visible below group piles. The DM can distribute to either.
- The My Cards control remains at the **top right of a sticky header during page scrolling**. It is the persistent screen switcher. During eligible group inventory dragging, it highlights as a drop target; mere tapping navigates. Claim does **not** automatically navigate.
- Inside a modal Show all overlay, show an equivalent Claim drop target when eligible dragging begins, **within the overlay**, since an underlying sticky target cannot reliably receive modal drops. No duplicate always-visible Claim button.
- Group handouts stay available to authorized recipients until DM withdrawal; a player cannot claim or remove group handouts. Claimability is attached to an instance's mode/state, not its pile or authored card type.

### Tablet: My Cards screen

```text
┌────────────────────────────────────────────────────┐
│ My Cards                    [ Group Cards › ]      │ ← sticky header
├────────────────────────────────────────────────────┤
│ [Equipment pile] [Clues pile] [+ New pile]         │
│ ... player-created named piles ...                 │
│                                                    │
│ Unsorted                                           │
│ [claimed item] [DM-delivered item] ...             │
└────────────────────────────────────────────────────┘
```

- Player owns naming, ordering, creation and deletion of **their** piles; the DM can inspect collections and manage cards but does not assign cards into player-private piles.
- A DM direct distribution or transfer to a player, successful claim, or restoration returns/places that card in **that player's Unsorted**.
- Player-to-group inventory transfer is forbidden: Group Cards control is navigation only, not a drop target.
- Player may remove their own inventory (explicit action and confirmation), not a Handout; DM can remove cards on its own management surface.
- Multiple paired devices for the same campaign player should reflect the same personal organization (not device-local ownership). Card appearance and pile state remain campaign-scoped rather than Playthrough-session scoped.

### DM Share workspace (laptop)

```text
┌──────────────────────────────────────────────────────────────┐
│ Share     [LAN/pairing status & player management affordance]│
│                                                              │
│ Prepared session cards (search/filter, draggable sources)    │
│ [card] [card] [card] [card] ...                                │
│                                                              │
│ Destinations / collections: [Group] [Player A] [Player B]...  │
│ Group:  [pile] [pile] [+ New pile]                             │
│ Group Unsorted: [card] [card] ...                              │
│ Player selected: Unsorted + read-only personal organization  │
│ [Removed cards] (single DM-only recovery view)                │
└──────────────────────────────────────────────────────────────┘
```

- This is **one logical workspace**, not a demand that every collection be displayed fully at once. Use selection/scrolling and responsive regions instead of tiny cards or a dense administrative dashboard. A selected collection can show its actual piles and cards.
- Prepared source drag → **new instance**, not move. Distributed inventory drag between collection destinations → **transfer same instance**, not copy. Distinguish these through feedback and source/destination labels.
- Sharing popover: source preview, recipient, destination, mode (Handout / Inventory), Confirm/Cancel. On drag to a destination, destination preselected. Contextual Share offers same flow. Default Unsorted; new group pile creation is possible here or ahead of time. Mode explicitly chosen for each distribution; authored card type never forces mode.
- Group pile controls use tabletop pattern: compact rename, count, Show all, cover navigation, decorative stack. Personal piles visible to DM for inspection but player-controlled for organization. An individual player's Unsorted is the only DM-to-player placement destination.
- LAN enabling, roster, QR pairing, revoke/deactivate and recovery remain in Share per architecture, but avoid crowding normal card interaction surfaces. Their detailed layout is not yet approved; address in the later bounded UI design/planning for those capabilities.

## Card, expanded reading and overlay contracts

- Use the existing shared `PlayingCard` presentation, 243:420 proportions, artwork, front/back layout, on-card flip animation and card-side content interaction; no full-document button, document reader or exposure of source document to tablet clients. Card metadata and artwork displayed must come from the frozen **player-visible** snapshot.
- In tray or Show all, **tap** selects/expands; **tap on expanded card background/content** closes. On-card Flip and other actionable controls (and dialogs they open) must handle events without dismissing. No external flip controls or expanded-card previous/next navigation. Closing returns to same tray/overlay at the same scroll position.
- Dragging does not cause click-to-expand or click-to-close. Expanded state is transient; changing authoritative card identity/visibility must close inaccessible content. Keep displayed card face while feasible; don't reset orientation due solely to polling or UI layout changes.
- Show all: modal, bounded responsive grid/tray, retains card proportions and readable card size, scrolls if needed; cards can flip and expand; close returns to same pile. For **group viewer**, no pile reordering or cover selection in the overlay; eligible card Claim via contextual action or conditional modal drop target. For **personal pile**, allow moving/reordering individual cards between piles or Unsorted and explicit Remove. For **DM group organizer**, allow moving/reordering among group piles and Unsorted plus DM management commands. Do not show irrelevant actions or permanently visible management bars.
- Pile-cover previous/next arrows sit inside pile region as on Play. They change only cover, not persistent order or history. Show all grid has no separate 'set cover' feature. If cover removed, next card with wrap; if reordering retains cover, keep that cover identity.
- Each card's contextual menu provides only valid actions for role/mode/state, including keyboard-accessible Move/Claim/Remove/Transfer equivalents when dragging is unavailable. Never show unauthorized actions merely disabled as a substitute for server authorization.

## Location and lifecycle rules

1. A distributed card instance lives in one **authoritative collection**: active group inventory, active player inventory, or handout targeted to group/player; discarded/withdrawn cards are absent from active collections. Separate distributed copies from the same prepared source remain distinct instances.
2. Within an active collection a card occupies exactly one **presentation location**: Unsorted or one named pile. This does not change owner/recipient. Group organizational state is DM-managed; personal organization is player-managed.
3. Share from PreparedItem always creates an independent frozen copy. It never moves Preparation membership or Play piles.
4. Group inventory Claim atomically changes owner group → claiming player, removes old group placement and adds to player Unsorted. No confirmation; no duplicate, no auto-navigation. Concurrent claim loser sees concise unavailable/conflict feedback and refreshes.
5. DM Transfer uses the same active inventory instance; to a player goes to Unsorted, to group may target its Unsorted or a group pile. No player-to-player transfers by players; no ordinary handout transfers.
6. Player Remove soft-discards their own active inventory only, requiring confirmation. DM Remove soft-discards inventory or withdraws handouts as appropriate, requiring confirmation. A drag outside a valid target cancels; no implicit removal.
7. Delete pile is **not Remove card**: empty deletes immediately, nonempty prompts and puts its cards in same collection Unsorted in deterministic relative order. Mixed handout/inventory piles are allowed and remain intact.
8. DM-only Removed cards list shows identity, previous owner/recipient, mode/status; Restore returns same instance to that owner/recipient Unsorted, including an inactive player (whose access remains blocked). Never silently change ownership; DM may subsequently transfer inventory. No player recovery list.
9. New or restored cards appear quietly with an indicator at the destination (not automatically focused). Viewing destination clears its indicator; expanded card, cover, tray and scroll remain stable.
10. Authoritative disappearance (claimed by another, transferred, discarded, withdrawn, access revoked) removes card from stale visible collection, closes its expanded/side reading if no longer accessible, and cancels any active drag. A card that remains accessible may preserve expanded identity despite DM reordering.
11. On temporary transport loss, show stale in-memory view plus status, disable mutations (including organization). Retry connection and re-fetch complete collections; do not guarantee viewing after reload. On definitive access denial/gateway off/campaign switch, hide collection immediately. No offline persistence or mutation queue.

## Gesture and accessibility contract

| Intent | Mouse / keyboard | Tablet |
| --- | --- | --- |
| Expand / collapse | Click card; keyboard equivalent | Tap card; tap expanded card |
| Flip | Existing on-card flip button | Tap same on-card flip button |
| Drag individual card | Hold/click-and-move after movement threshold | Brief touch hold, then move; finger lift drops |
| Browse scroll | Mouse/trackpad scroll | Swipe scroll; distinguish from drag |
| Claim | Drop on My Cards or contextual Claim | Drop on sticky/overlay My Cards or contextual Claim |
| Remove | Drop on visible Remove target / contextual action, then confirm | Equivalent gesture / contextual action, then confirm |
| Switch workspace | Click top navigation destination | Tap same control |

- The inspected tabletop currently uses Angular CDK with `dragStartThreshold: 8`, `dragStartDelay: {mouse: 0, touch: 180}`; reuse as **starting defaults**, not tablet-tested acceptance. Keep direct card drag (no external Move/Reorder button).
- On-card flip, actions, menus, scrolling and card-side dialog must not begin drag or trigger expand/close. Card controls should be accessible without hover.
- Valid drop targets are visually obvious **when relevant**, with concise success/error feedback. Keyboard-accessible contextual action alternatives are required. Preserve focus after overlays/dialogs.
- Avoid nested native modal/drop targets hidden behind the top layer. Expanded card and Show all layering, body scroll locking, focus return, visual drag preview and touch scroll cancellation must be verified in browser.
- Responsive acceptance targets: typical 1280×800 and 1440×900 DM laptop view; tablet portrait and landscape including narrow width, virtual keyboard, long card titles, 0/1/many piles/cards. No unbounded modal dimensions or illegible reduced card sizes.

## End-to-end acceptance scenarios (must eventually be verified, not currently tested)

1. **DM groups enemies:** create empty 'Enemies' pile, distribute three different prepared cards as Handouts through popover, then view their front/back on tablet; source/Play remain unchanged; no Claim action.
2. **Mixed discoveries:** distribute a key and potion as Inventory plus a map as Handout into 'Found Items'; group player opens Show all, taps key to expand, flips using card control, taps card to close; claim key by contextual action, potion via drag onto conditional modal My Cards target.
3. **Group→personal:** claim updates only the successful card instance, appearing in personal Unsorted; Group screen stays open; loser of concurrent claim sees conflict and removal on refresh.
4. **DM direct delivery:** deliver Inventory directly to player; it arrives in personal Unsorted, not any private pile. Player makes/renames pile and drags card there; other players cannot see it.
5. **DM transfer:** transfer a claimed item back to group Unsorted or specific group pile through drag or menu; original identity retained, placement follows destination.
6. **Removal/recovery:** remove player's potion with confirmation, verify it vanishes; DM opens centralized Removed cards and restores same instance into personal Unsorted; deleted pile returns remaining cards to same Unsorted without discarding.
7. **Reading and sync:** while expanded, group receives new card; indicator appears, reading unaffected. DM reorders pile; expanded identity remains. DM withdraws currently expanded handout; reading closes and card vanishes.
8. **Connectivity:** temporary disconnect retains stale cards, disables gestures/actions; reconnect fully refreshes without unnecessary reset. Access revocation, campaign switch or gateway disable hides collection.
9. **Touch & access:** portrait/landscape scrolling vs hold-drag; flip does not collapse expanded card, card tap does not drag, menus accessible and usable; Show all modal drop works; keyboard alternatives and focus return work.
10. **Security payload:** player API exposes only authorized frozen front/back and artwork, no full document or hidden section source data; inactive player and revoked device cannot read; DM routes unreachable on LAN gateway.

## Architecture reconciliation required BEFORE G3 planning or implementation

1. **Snapshot / spoiler boundary:** Existing architecture's `SharedCard.immutableSnapshot` includes original document. UX forbids returning full document to player API. Define explicit DM-retained source vs frozen player-disclosable payload (if source retention is needed), and future field/section-level visibility extension. Decide necessary DTO/read contracts; sanitize Markdown and protect artwork/side-reading endpoints too. Do not infer UI hiding equals authorization.
2. **Persistent organization:** Decisions 1, 4, 14–16 and 20 require campaign-level group piles and player-specific piles, order, cover, and one presentation location per active card. Define owning aggregate/application contract, persistence, concurrent edits, placement on claim/transfer/restore/discard, and separate these from Sharing ownership and Play placement. No new cross-module direct repository writes.
3. **Mode/target semantics:** Handouts vs inventory and recipient scope remain as architecture Decisions 4/5/12/14. Confirm DM can manage organization of targeted handouts; player cannot remove handouts. An individual player has one private organization shared across their paired devices.
4. **UI component integration:** Reuse existing card visuals/interaction primitives, not the Play `tabletop` application state or scene lifecycle. Decide how expanded card reuses flip/side reader without exposing document; verify async card layout, front/back preservation across updates, CDK drag and nested dialogs.
5. **Gateway and operational prerequisites remain open:** LAN route isolation, image copying and retention, campaign lock, credentials/localStorage/XSS, player Angular asset packaging, polling, revocation and archives—see architecture document. UX approval **does not** resolve these checks or authorize G3.

## Deferred / explicitly not approved

Batch source selection/distribution, granular spoiler/redaction editor, player-to-player transfers, freeform positions, screen-specific device layouts, quantity stacks, player documents, always-visible Claim/Remove targets, auto-navigation on claim, and offline operations. A future batch flow should be compatible with current per-instance distribution and pile destinations, but is not a G3 requirement.

## Handoff and acceptance status

**Accepted:** UX Decisions 1–20 as owner-selected in conversation. This document makes screen hierarchy, sticky header behavior, overlays, on-card controls, mode/role permissions, and lifecycle outcomes explicit to reduce speculative UI refactoring.

**Not yet verified:** Running screenshots, tablet touch and scroll behavior, portrait/landscape sizing, card expansion/flip event integration, focus/keyboard navigation, persistence/concurrency, authorization, gateway isolation. These require approved architecture reconciliation, bounded G3 planning, implementation authorization and later formal verification under `.agents/development-workflow.md`.

**Non-interference:** Documentation-only on this feature branch. No changes to `main`, app code/tests, implementation scope, or harness; no merge authorization.
