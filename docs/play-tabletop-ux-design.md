# Play tabletop — reviewed UX design

**Later reconciliation (2026-10-24):** The owner approved the [reconciled product requirements](product-specification.md#play-tabletop--accepted-requirements-reconciliation--2026-10-24) and [placement/command architecture](implementation-plan.md#play-tabletop--accepted-architecture-reconciliation--2026-10-24). Architecture reconciliation is complete; the [bounded T1/T2 implementation plans](implementation-plan.md#play-tabletop--proposed-implementation-sequence--2026-10-24) record accepted T1/T2 scope. [T1 backend implementation and verification](verification.md#t1--backend-tabletop-placements-commands-and-archives--2026-10-24) subsequently passed within backend scope; [T2 subsequently delivered the integrated UI](implementation-plan.md#t2--implementation-and-developer-handover--2026-10-24), with developer checks and the [separate T2 formal assessment](verification.md#t2--integrated-tabletop-ui-and-runtime-save-lifecycle--2026-10-24) passing; owner visual acceptance remains separate. The original status/next-phase text below records the UX review handoff.

**Status:** Owner-confirmed UX decisions, 2026-10-23; reviewed for conceptual consistency. **Not** browser-verified or implemented. Architecture reconciliation, implementation planning, code changes and formal verification require their own workflow authorization.

**Context:** Extends [unified workspace UX design](unified-workspace-ux-design.md), [Playthrough domain architecture](playthrough-domain-architecture.md) and approved PlayNotes requirements. Where this document conflicts with the older three-focused-card presentation, it defines the intended future UX; existing code and persistence remain unchanged until approved implementation.

## Intent and boundaries

Play is a live DM reference tabletop, not a virtual tabletop or encounter simulator. Preparation owns session membership, frozen material, and explicit session-specific Scene→PreparedItem relationships. Play owns runtime card placements, active Scene, pile ordering/cover, and PlayNotes. Library and Write remain responsible for discovery/authoring. No relationship editing or frozen-content editing occurs in Play.

## Main layout

Reuse the current Play spatial arrangement rather than adding an extra always-visible document region:

- **Left work area:** three card-facing tabletop slots: reserved active Scene on the left, runtime Pile 1 in the middle, runtime Pile 2 on the right.
- **Right supporting panel:** *Notes / Document* switch using the existing Notes-panel space. Both share the same footprint; it must not require another permanent column.
- **Session Cards:** the collection of currently unassigned prepared cards beneath/alongside the tabletop, with search/filter and drag targets; not a duplicate searchable inventory of cards located elsewhere.
- **Used holder:** separate drop target and accessible collection for set-aside cards.
- The existing 243:420 shared PlayingCard renderer, frozen artwork and heading-aware Markdown reader remain authoritative. Test 1280×800 and 1440×900 and smaller widths; layout/overflow are not yet verified.

## Unique location and Scene lifecycle

Each prepared card occupies **one runtime location**: Session Cards, Pile 1, Pile 2, Used, or the active Scene slot. These are placements of one PreparedItem identity, not copies or distinct inventories. A Scene card may be in any ordinary location while inactive.

- A valid prepared Scene becomes active **only via Activate/Change Scene**. Activation removes it from its previous location and places it in the fixed left Scene slot.
- The active Scene cannot be dragged, used, removed, or displaced by ordinary card movements. Only **Change Scene** or **Deactivate Scene** vacates the slot.
- On replacement or deactivation, the previously active Scene returns to Session Cards (unassigned), unless a separately approved transition rule changes this.
- When no Scene is active, the left slot is empty and offers Activate Scene. The left slot never becomes a third runtime pile.
- Session Cards, both piles, Used and Scene slot must remain disjoint; no duplicated card references in a pile or between locations.
- Removing a prepared item from the authoritative session reconciles its runtime placement without disturbing other card positions.

**Compatibility note:** The old Active/Used and three ordered focus IDs cannot independently coexist as another placement authority. Architecture must reconcile or replace them, preserving historical PlayNotes and all unaffected frozen material.

## Scene activation and change overview

Activate/Change Scene opens an overview with the Scene's **explicit Preparation-owned related prepared cards** in preparation order, the current pile contents and placement choices. No authored-Markdown-link suggestions and no implicit relationship edits.

For each incoming related card, the DM may place it in Pile 1, Pile 2 or leave it in its current location. Existing pile cards can be retained, moved between piles, returned to Session Cards, or moved to Used.

The overview prominently provides a **Keep current piles** one-press action: activate/change the Scene while leaving both piles unchanged *except that the newly active Scene must vacate its previous pile, if present*. A normal Customize/Confirm action atomically applies the Scene change and chosen card movements. Cancel changes nothing. No automatic clearing or populating piles on change. Reopen the current Scene's related-card overview during Play to assign more cards.

**Edge case needing architecture detail:** If the newly selected Scene currently occupies a pile/Used, the location uniqueness rule takes precedence over literally unchanged contents. Show this explicitly in the overview; never promise to retain that specific card in two places.

## Runtime piles

There are exactly two persistent runtime piles. Each has an ordered set of distinct PreparedItem references, an optional name (defaults Pile 1/Pile 2), and the identity/index of the displayed cover card. Names convey no card-type restrictions.

The pile's main surface shows its selected full card, name, count, stack affordance, Previous/Next cover controls, **Show all** and move actions. Previous/Next changes only the displayed card, **not pile order or Seen/Used state**. Disabled for zero/one item as appropriate.

**Show all** opens a dedicated temporary **pile overlay** containing every card in that pile. It is for inspecting, reading, selecting a cover, reordering and moving individual cards. Closing it returns to the tabletop and preserves committed changes. Do not use the Notes/Document panel as the pile overview.

When the displayed card leaves the pile, display the next ordered card; wrap from the end to the first. Empty pile shows an explicit drop zone. A closed-pile drop appends; within the opened pile precise drop positioning/reordering is supported.

## Card movement

| From | To | Outcome |
|---|---|---|
| Session Cards | Pile 1 / Pile 2 | Move unique card into target pile |
| Pile 1 / Pile 2 | Other pile | Transfer individual card |
| Pile | Session Cards | Unassign card, do not mark Used |
| Pile or Session Cards | Used | Mark Used and remove from former location |
| Used | Session Cards | Restore as unassigned |
| Used | Pile 1 / Pile 2 | Restore and assign in one action |
| Within open pile | Position / cover | Reorder or choose displayed cover |
| Any card | Active Scene slot | Not a valid drop; use Activate/Change Scene |

Dragging the displayed card transfers **that individual card**, not its entire pile. Provide clear drag handles or equivalent affordances separate from Read, Show all and cover navigation. Cancelled/invalid drops do not mutate state. Every drag operation also needs a keyboard-accessible menu/button equivalent and useful success/error feedback. An active Scene is never a valid Used drop target.

## Right-hand Notes / Document panel

Keep the space currently reserved for Notes in Play, making it a **two-mode panel**:

- **Notes (default on Play entry):** live PlayNotes capture/history per accepted PlayNotes architecture; Preparation Session/Item notes available read-only as contextual references, not silently mixed with PlayNotes. Switching views must preserve unsubmitted note text and existing note association context.
- **Document:** the existing complete frozen Markdown reader for the explicitly selected prepared card (including the active Scene or a card in a pile, Session Cards or Used), retaining heading navigation, provenance and readable scrolling. Clicking **Read** switches to Document and loads that specific item. Changing the pile cover does **not** implicitly change the current document. Returning to Notes preserves the document selection; switching back restores it. Reader inspection never moves or marks a card Used.

The pile overlay is separate from this panel. The DM can continue interacting with tabletop cards while Notes/Document remains available. Any expanded document treatment must preserve the session/tabletop context and avoid reimplementing the Markdown reader.

## Persistence, recovery and limits

Persist the selected Scene, disjoint card placements, ordered pile memberships, optional names, displayed covers, and existing Play workspace version/concurrency semantics. Open overlays, drag state and panel mode may be transient; document selection can be transient. Keep save failure retry/discard/navigation guards, prevent in-flight session/campaign switches redirecting commands, and preserve current-format archive round trips for any newly introduced persisted state.

Do not introduce combat initiative, HP automation, monster-instance counts, dice, freeform draggable canvas, additional pile slots, card backs, or new authored Scene relationships.

## Review scenarios

1. **Combat:** activate Crypt; assign Necromancer/Skeleton to Pile 1, Relic to Pile 2; Show all and cycle without reordering.
2. **During Scene:** drag Skeleton Pile 1→Used; next card becomes visible; drag a discovered Key Session Cards→Pile 2; Scene and note draft remain unchanged.
3. **Scene change:** choose Library; Keep current piles in one press; if Library Scene was in a pile, its removal from that pile is disclosed. Alternatively customize to retain/move/remove existing cards and add Librarian from related prepared cards.
4. **Scene deactivation:** active Scene returns to Session Cards; pile contents preserved.
5. **Read and note:** Read Necromancer opens Document in existing right column; cycle pile cover without replacing reader; switch Notes and back without losing document selection or note draft.
6. **Recover:** reopen session to restore active Scene, pile placement/order/covers; invalid/drop/save-conflict operations do not silently lose state.

## Verification status and next phase

The decisions above were reviewed interactively with the owner, including the corrected **unique-card location** rule and reuse of the existing right Notes area for Document. **No running browser layout inspection, drag interaction usability testing, accessibility check or formal verification has been performed for this proposed redesign.**

Before implementation: reconcile the new placement model with existing Active/Used/focus revisions, Scene membership and archives; resolve transition concurrency and exact return rules; plan and verify viewport layouts, actual pointer/keyboard interactions, Reader/Notes state retention, and Scene-related card resolution. Follow `AGENTS.md` and `.agents/development-workflow.md` phase approval gates.
