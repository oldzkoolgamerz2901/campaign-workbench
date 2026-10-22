# Playthrough domain architecture

**Status:** Accepted architecture, 2026-10-22. Documentation only; implementation planning and code changes require separate approval. Derived from the accepted tabletop requirements in [product-specification.md](product-specification.md) (Q10f–Q10x), Increment 5 card-table behavior, and Increment 6A–6C image implementation in [implementation-plan.md](implementation-plan.md).

## Domain ownership

```mermaid
flowchart TD
    SW["Sources / Writing<br/>authored Markdown, stable card identity,<br/>relationships, editable artwork"]
    P["Preparation<br/>Session, PreparedItem,<br/>frozen text and artwork,<br/>preparation notes, starting order"]
    PT["Playthroughs<br/>PlayWorkspace, PlayNote,<br/>runtime table, active scene, focus, history"]
    X["Session archive coordinator<br/>versioned ZIP, validation, ID remapping"]
    SW -->|"approved draft snapshot / source capture"| P
    PT -->|"public read contract: prepared membership,<br/>frozen content, scene classification"| P
    PT -->|"public read contract: resource identity / links"| SW
    X -->|"public module contracts"| P
    X -->|"public module contracts"| PT
```

Arrows indicate requests/data access, **not** cross-module repository access. Preparation does not own actual-play history. Playthroughs does not own artwork bytes, prepared text or source documents. The application-level coordinator handles cross-module archive transfers. No new Assets module or image store is introduced. Existing Preparation `CardTable` persistence is the current authority until a coordinated migration to Playthroughs; do not create two competing tables.

## Conceptual domain model

```mermaid
classDiagram
    direction LR
    class Campaign {
        +UUID id
    }
    class Session {
        +UUID id
        +UUID campaignId
        +Long revision
        +String title
        +String objective
        +String notes
    }
    class PreparedItem {
        +UUID id
        +String title
        +String markdown
        +Provenance provenance
        +ImageMetadata? image
        +String notes
    }
    class PlayWorkspace {
        +UUID sessionId
        +Long revision
        +UUID[] activeItemIds
        +UUID[] usedItemIds
        +UUID? activeSceneItemId
        +UUID[] focusedItemIds
    }
    class PlayNote {
        +UUID id
        +UUID campaignId
        +UUID sessionId
        +String markdown
        +ResourceSnapshot? scene
        +ResourceSnapshot? resource
        +Instant createdAt
        +Instant updatedAt
        +Boolean pinned
    }
    class ResourceSnapshot {
        +ResourceReference reference
        +String title
    }
    class ResourceReference {
        +UUID campaignId
        +UUID cardId
    }
    class ImageMetadata {
        +String hash
        +String mime
        +Int width
        +Int height
        +Int bytes
    }
    Campaign "1" --> "*" Session : contains
    Session "1" *-- "*" PreparedItem : prepared copies
    Session "1" --> "0..1" PlayWorkspace : runtime state
    Session "1" --> "*" PlayNote : actual-play notes
    PreparedItem --> "0..1" ImageMetadata : frozen image descriptor
    PlayWorkspace ..> PreparedItem : references IDs
    PlayNote --> "0..2" ResourceSnapshot : scene and primary resource
    ResourceSnapshot --> ResourceReference : identity
```

This is a **conceptual model**, not a JPA schema. `ResourceReference(campaignId, cardId)` identifies the original logical card across revisions/sessions. `PreparedItem.id` identifies a session-specific frozen copy. Image SHA-256 identifies immutable binary content, **not** a card. `ResourceSnapshot` captures the identity and title, not artwork or full Markdown. `PlayNote.campaignId` is the containing campaign; its resource's origin campaign may differ after import.

## Invariants and decisions

- **Preparation:** owns session lifecycle, prepared membership, preparation notes, prepared ordering, and independently frozen authored text and image. Existing session/per-item Markdown notes remain separate from PlayNotes; no implicit conversion.
- **Workspace:** at most one per session; lazily initialize on first Play entry from prepared order; restore on re-entry. Independent optimistic revision from Preparation. Active and Used are disjoint, ordered, and jointly contain every currently prepared item exactly once.
- **Card transitions:** new prepared items are **prepended** to Active (Increment 5); returning a Used card also prepends it. Removed items disappear from either pile and focus; if active scene, clear it. Preserve remaining order, focus and notes. Reconcile on workspace access/mutation against authoritative prepared membership, without event infrastructure initially.
- **Focus and scene:** up to three unique ordered prepared-item IDs; positions persist. Active scene is one explicitly selected prepared Scene or null. Inspecting or focusing a card does not activate a scene. Used cards can remain focused or be suggested with a Used indicator. Expanding one focused card survives Play → Prepare → Play in frontend state; not required to persist to DB. Temporary inspection, search/filter/scroll state are transient.
- **Inspection:** unprepared library cards can be inspected without adding or focusing them. Explicit addition uses existing capture/approval boundaries and produces a frozen prepared copy. Source-only cards retain placeholder artwork; no new source-image assignment.
- **PlayNotes:** independent timestamped Markdown records, no mandatory category or structured discovery state; optional one explicit primary resource, plus scene snapshot automatically captured at creation. Inspection/focus alone never assigns the primary resource. Scene changes affect future notes only. Editing content changes `updatedAt`, never `createdAt`; an explicit association correction captures the new title. Pinning does not alter chronology; pinned notes remain in full history. Deleting/renaming a source or removing a prepared item does not rewrite historical notes.
- **History:** session notes newest-first by immutable `createdAt`, with stable ID tie-break; separately query primary-resource history and captured-scene history by campaign-qualified `ResourceReference`. No duplicate note storage or implicit merging of these queries. Query visibility is restricted to sessions belonging to the requested/authorized containing campaign; origin identity may point to a different campaign after import. Never merge by title, path or image hash.
- **Relationships:** use existing typed/captured links for contextual suggestions; never invent or automatically approve relationships. Used suggestions carry a Used indicator. Unresolved/missing/unprepared targets require deliberate presentation; exact matching/ranking remains planning work.
- **Artwork:** Play renders frozen Preparation image derivatives through existing scoped APIs; Playthroughs does not retain bytes or image references. No artwork in PlayNotes. Historical notes remain readable even if a removed prepared item's artwork is pruned.
- **Concurrency:** workspace and Preparation have independent revisions. A workspace save must verify current prepared membership under an explicit transaction/locking strategy; independent revisions alone do not prevent races. Notes persist independently from workspace changes. Preserve originating campaign/session context on asynchronous UI operations.

## Workflow: open, reconcile, and restore

```mermaid
flowchart TD
    A["Enter Play for session"] --> B["Read prepared item IDs and types<br/>through Preparation public API"]
    B --> C{"Workspace exists?"}
    C -- No --> D["Initialize Active in preparation order;<br/>Used empty, scene null, focus empty"]
    C -- Yes --> E["Load persisted workspace and revision"]
    D --> F["Reconcile against prepared membership"]
    E --> F
    F --> G["Prepend newly prepared IDs to Active;<br/>remove deleted IDs from both piles"]
    G --> H["Remove invalid focus IDs;<br/>clear removed/invalid active scene"]
    H --> I["Persist with optimistic concurrency;<br/>retry or surface conflict safely"]
    I --> J["Render Active/Used shelf, frozen artwork,<br/>ordered focus and active scene"]
    J --> K["Temporary inspection and expanded focus<br/>managed by frontend"]
```

The first initialization and subsequent reconciliation must be concurrency-safe. A mode switch must not steal focus or change the active scene when new prepared items arrive.

## Workflow: tabletop actions and notes

```mermaid
sequenceDiagram
    actor DM
    participant UI as Play UI
    participant PT as Playthroughs
    participant P as Preparation
    DM->>UI: Reorder / mark Used / return card
    UI->>PT: Save table with workspace revision
    PT->>P: Read current prepared membership
    PT->>PT: Reconcile, validate, increment revision
    PT-->>UI: Updated workspace or conflict
    DM->>UI: Explicitly activate scene
    UI->>PT: Set activeSceneItemId
    PT->>P: Validate prepared Scene identity
    PT-->>UI: Saved workspace
    DM->>UI: Create PlayNote (optional primary resource)
    UI->>PT: Create note in session
    PT->>PT: Capture active scene identity/title<br/>and explicit primary resource identity/title
    PT->>PT: Persist independent note with createdAt
    PT-->>UI: Saved note
    DM->>UI: View resource history
    UI->>PT: Query resource reference + containing campaign
    PT-->>UI: Notes newest first, scoped to campaign
```

The capture operation must not depend on the currently inspected card. Note editing and pinning are independent writes; source documents and prepared copies are never modified by PlayNotes.

## Workflow: illustrated archive export/import

```mermaid
flowchart TD
    E["Export selected sessions"] --> F["Coordinator reads Preparation snapshots,<br/>workspace and PlayNotes"]
    F --> G["Build next-version session ZIP manifest<br/>plus existing deduplicated original images"]
    G --> H["Bounded, validated archive download"]
    I["Import ZIP (or supported older archive)"] --> J["Stage and validate complete manifest,<br/>references, images and byte limits"]
    J --> K{"Valid?"}
    K -- No --> L["Reject without durable writes"]
    K -- Yes --> M["Generate new session, prepared-item,<br/>PlayNote IDs; map workspace references"]
    M --> N["Preserve origin resource references,<br/>captured titles, timestamps and image originals"]
    N --> O["One coordinated database transaction:<br/>restore Preparation images/items and Playthrough state"]
    O --> P["Commit complete import or roll back all"]
```

Build on existing session **ZIP v5** and image archive rules, introducing a new manifest version for Playthrough state. Continue accepting supported older archives, which import with an uninitialized workspace and no PlayNotes where absent. Preserve image integrity validation, canonical ZIP paths, byte/count limits, staging, derivative regeneration and transactionality. Import does not rebind `ResourceReference` to the destination campaign; it remaps session, prepared-item and note IDs. A resource reference can remain historically meaningful even when the source card cannot be resolved locally. Imported note history is visible only within the destination containing campaign.

## Proposed public use cases

- `openWorkspace(sessionId)`: lazy initialization and reconciliation.
- `updateCardTable(sessionId, expectedRevision, ...)`: reorder, mark Used, return.
- `activateScene(sessionId, expectedRevision, itemId?)`: explicit scene selection.
- `updateFocus(sessionId, expectedRevision, orderedItemIds)`: maximum three.
- `createNote(sessionId, markdown, primaryResource?)`: capture active scene at creation.
- `editNote(noteId, ...)`, `pinNote(noteId, ...)`: independent note mutations.
- `sessionHistory(sessionId)`, `resourceHistory(containingCampaignId, reference)`, `sceneHistory(containingCampaignId, reference)`: separate chronological queries.

These are conceptual operations, not final REST endpoints or module interfaces. Use narrow public APIs, not cross-module JPA access. Image presentation remains Preparation-owned.

## Implementation consequences and unresolved planning risks

1. **Workspace ownership migration:** existing `CardTable` is persisted on Preparation's `Session` and used by Angular session autosave. Plan one authoritative transfer with data preservation, revision separation, frontend state/API updates and regression tests; avoid duplicate tables.
2. **Cross-module consistency:** define locking/transaction ordering for concurrent Prepare changes and Play saves, plus conflict/reconciliation retries.
3. **Resource identity resolution:** distinguish authored card UUID, source classification, frozen prepared provenance and imported foreign origin; no title/path fallback and no accidental cross-campaign history leakage.
4. **Contextual relationships:** decide mapping/ranking of existing typed/captured links to prepared/Used/unprepared cards, with explicit missing-target behavior.
5. **Archive evolution:** preserve current illustrated ZIP v5 and JSON legacy imports, complete image retention, strict validation, identity remapping and atomic restore; archive preservation must hold at each released increment, not only after a later cleanup.
6. **Frontend integration:** retain 320px playing cards, frozen artwork/thumbnail fetch and placeholder behavior, full-document reader, existing session and item notes, navigation protection and save status. No duplicate reader or new image-storage service.

Possible bounded implementation sequence (requires **separate planning approval**): (A) PlayWorkspace and CardTable ownership; (B) PlayNotes/history; (C) archive integration. Planning must ensure that exported sessions remain complete at each boundary; move archive work earlier or explicitly gate releases if necessary. No application code, tests or campaign files are authorized by this architecture document.
