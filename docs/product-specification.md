# Campaign Workbench — Product specification

Date: 2026-10-17

Status: Requirements approved by the owner on 2026-10-17, with subsequent accepted revisions for local laptop operation, direct campaign-folder access, and multiple campaigns. Outstanding decisions remain explicit. Architectural proposals and implementation plans require their own approval; this specification does not authorize implementation.

## Purpose and audience

The app supports two main activities: **preparing a session** and **playing a session**. Assisted creation is part of preparation and is optionally available during play.

The accepted application name is **Campaign Workbench**, with repository name `campaign-workbench` and local target `/Users/huibvanstraten/campaign-workbench/`. This is separate from the Sea Witch campaign repository. Repository creation and application-document transfer are covered by setup increment 0; campaign-content migration is excluded.

The app serves a DM preparing and playing any registered campaign. The first version supports multiple campaign folders and one selected campaign at a time. Sea Witch is an initial example, not a required campaign structure. The DM operates the app; players receive material deliberately displayed or exported by the DM. Player accounts and a player portal are excluded initially.

Markdown in independent campaign directories remains the authority for repository campaign content. The application monorepo is separate from those directories. The local backend reads a selected directory directly and detects source changes; prepared content remains pinned until the DM accepts updates. The database owns application state, drafts, playthrough records, and prepared snapshots. The accepted creative co-author extension below adds explicit campaign decisions that may guide assistance before repository incorporation; overriding a source passage requires explicit owner resolution. The app does not automatically rewrite campaign files.

Campaign conventions are configurable: folders and filenames may vary, authority sources are designated by the DM, and revelation rules apply when supplied. No Sea Witch names, paths, lore, or mechanics are built into application behavior.

The [repository assessment](../../sea_witch/repository-app-assessment.md) supplies investigation evidence and broader opportunities. Its feature suggestions are not requirements unless included here.

## Preparing a session

### R1 — Source access and authority

The DM can browse and search material from the selected campaign directory and open the relevant source document and section. The DM explicitly designates current canon and superseded documents; filename versions alone do not determine authority.

Unresolved source conflicts must remain visible for owner resolution. Assisted creation identifies affected passages and does not treat disputed facts as settled.

Acceptance:

- A search result identifies its source and opens the matching passage.
- The DM can distinguish active authority from superseded material.
- An unresolved conflict presented to the assistant is identified rather than silently resolved in generated material.

### R2 — Session assembly

The DM can collect and order scenes, NPC references, clues, and handouts in a saved session. Preparation is saved continuously.

Acceptance:

- A saved session retains its selected material and order after closing and reopening the app.
- The DM can add existing material and assisted drafts to the same preparation workspace.

### R3 — Assisted creation

Given a session objective, assisted creation can adapt existing material and draft missing scenes, NPC interactions, clues, and handouts. The original session-specific scope is extended by the accepted creative co-author requirements below to include campaign development conversations and drafts.

Context includes the objective, selected sources, designated campaign canon, revelation rules, and recorded discoveries. Outputs cite sources, identify conflicts, and distinguish invented additions from source-supported material. Citations and automated checks assist review; they do not guarantee correctness.

Acceptance:

- The DM can request an adaptation or missing piece for a session.
- Source-supported claims have traceable references; newly invented content is labeled.
- Selected revelation restrictions and recorded discovery context are available to the generation process.
- Outputs remain reviewable drafts and are not automatically published or adopted as canon.

### R4 — Draft approval and export

Generated material remains a draft until the DM approves it. Approval for session use makes that draft version usable in preparation; accepting a campaign decision is a separate action. Approved finished content can be exported as Markdown for manual incorporation into the repository. Campaign-scoped drafts need not belong to a session.

Acceptance:

- Draft status and session approval are distinguishable.
- Session approval does not change source authority or repository files.
- Exported Markdown contains the approved content selected by the DM.

### R5 — Source change detection and explicit prepared updates

The local backend detects changes in the registered campaign directory and shows changed documents. Existing prepared sessions retain their prepared version until the DM accepts updates. Snapshot-package upload is no longer the normal source workflow.

Acceptance:

- Source change detection identifies changed documents in the registered directory.
- A source edit does not silently alter a prepared or running session.
- The DM can retain the prepared version or accept a source update.

## Playing a session

### R6 — Flexible live reference

The DM can open prepared scenes in any order, find NPCs and clues quickly, access private notes and relevant scene material, and display selected handouts. The app does not force a predetermined route or require every prepared scene to be played.

Acceptance:

- Opening another scene or reference does not discard session progress or notes.
- The DM can return to previously opened material during play.
- Prepared material remains accessible while optional AI generation runs.

### R7 — Manual recording and proposed updates

Notes, discoveries, and scene outcomes save automatically through the local backend to the database, remain editable, and retain their campaign and session context. AI may suggest record updates, but applying them requires DM confirmation.

Encountering a clue, learning a fact, and forming a theory are distinct. Marking a clue encountered must not automatically mark its underlying truth as understood.

Acceptance:

- Records survive closing and reopening the app and remain associated with their session.
- The DM can correct a discovery or outcome.
- Player theories remain distinguishable from confirmed revelations.
- AI suggestions do not change playthrough records before confirmation.

### R8 — Player material

The DM previews exactly what players will see before displaying or exporting selected handouts. Sharing is manual in the first version.

Acceptance:

- Displayed or exported player material matches the approved preview.
- Unselected DM notes, source context, and secrets are absent from player output.
- Using generated content during play does not automatically share it.

### R9 — Optional improvisation

A quick drafting action can use the current scene and permitted campaign context to propose an improvisation. Results remain private drafts until the DM chooses to use or share them.

Acceptance:

- The DM can request an improvisation without leaving the running session.
- Prepared material remains usable during generation or generation failure.
- Session use, sharing, and canon adoption remain separate decisions.

### R10 — Session lifecycle

Sessions support draft, ready, in play, and completed states and can be reopened. Notes, discoveries, and unresolved threads remain available for a DM-initiated review at any time, including after completion; ending a session does not automatically launch or require review. States organize work rather than constrain narrative order.

Acceptance:

- Sessions can move through the lifecycle and be reopened after completion.
- Completing a session does not require marking every scene played.
- Completion review exposes recorded notes, discoveries, and unresolved threads.

## Playthrough state and devices

### R11 — Initial state

Start with an empty playthrough journal. The DM can enter existing discoveries and past events. Unrecorded knowledge means unknown, not undiscovered. Campaign definition and actual playthrough events remain separate.

Acceptance:

- Initial import does not infer completed scenes or player knowledge from campaign prose.
- The DM can enter historical events and discoveries.
- Missing discovery records do not become claims that players lack that knowledge.

### R12 — Local laptop operation and offline play

The first increments support preparation and play on a laptop using an Angular browser interface and a locally running Kotlin/Spring backend. No hosted deployment is required initially. With the local backend and database running, prepared sessions and manual notes remain usable without internet access; external AI assistance requires connectivity.

Tablet support is deferred. A later tablet web interface may connect to the active laptop, but no tablet connection or synchronization is required initially. Backup and transfer must preserve both database-owned application state and relevant campaign sources; Git alone does not back up session state.

Acceptance:

- After preparing a session on the chosen device, the DM can access its prepared material and record manual notes without internet access.
- AI unavailability does not block preparation using existing material or manual play.
- Export/import preserves preparation and playthrough records for backup or device transfer.

PostgreSQL is the selected database. Exact laptop browser targets, startup/distribution, and backup and restore behavior remain to be specified before affected implementation work. Browser-local storage and a service worker are no longer required architectural mechanisms.

## AI access and spending

### R13 — Permitted context and private exclusions

Assisted creation may send relevant campaign passages, DM instructions, and selected session notes to an external AI provider. The DM can exclude private notes; excluded notes must remain outside AI requests.

Acceptance:

- Excluded notes are absent from outgoing AI context.
- Assistance uses the applicable campaign and session context without treating all stored notes as implicitly shareable.

The creative co-author initially targets OpenAI ChatGPT plan access as specified below. Model availability, account eligibility, and associated data handling terms remain to be verified before live integration; separately billed API access is not enabled by that choice.

### R14 — Explicit generation and spending controls

Each generation requires an explicit action. There is no background generation. Usage is visible where available, and a configurable spending limit constrains generation. Reaching the limit or losing AI access leaves existing preparation and play usable.

Acceptance:

- No generation starts solely because content is opened, edited, or refreshed.
- Generation is blocked when the configured spending limit is reached.
- Usage display distinguishes available usage information from estimates or unavailable information.
- AI failure or spending limits do not remove access to existing material or manual recording.

Provider accounting capabilities, limit enforcement semantics, and the actual budget require resolution before this requirement can be finalized for implementation.

For the accepted subscription-first co-author, distinguish plan allowance from separately billed API spending. Use existing ChatGPT Plus allowance where supported, with no automatic paid fallback or app-initiated credit purchase. If access or allowance is unavailable, preserve manual work and explain the limitation. A paid API path requires explicit owner enablement and a configured budget before use; API cost estimates must not be represented as subscription-allowance measurements.

### R15 — Campaign registration and isolation

The DM can register multiple independent campaign directories and switch the selected campaign. Selection does not merge sources, drafts, sessions, classifications, or playthrough records. A campaign does not require Sea Witch's folder structure or terminology.

Acceptance:

- Register two differently structured campaign directories and switch between them.
- Each campaign retains its own sources, authority assignments, prepared sessions, drafts, and journal records.
- Search and AI context are scoped to the selected campaign; campaign switching cannot silently apply an outstanding save or generation result to another campaign.
- Selecting or reopening a campaign does not rewrite its Markdown.

Supporting multiple concurrent groups or playthroughs of one campaign is not established by this requirement and remains deferred.

## Increment 1 — Searchable campaign library

Status: Requirements accepted by the owner on 2026-10-17. This slice delivers parts of R1 and R15; neither requirement is complete. Architecture and implementation require their own approval.

### Scope and behavior

- Register an independent campaign folder by entering its path and a display name. Retain registrations after application restart. Reject unavailable folders and duplicate registrations of the same resolved directory.
- Work with one selected campaign and remember the last selection. Browse and search only that campaign; responses originating from another campaign must not replace its current view.
- Discover Markdown recursively with configurable included and excluded paths per campaign. Exclude hidden files, tooling directories, and agent instructions by default. Do not follow symlinks.
- Browse documents and safely render headings, lists, tables, and code. Support links between discovered Markdown documents and their sections; identify missing targets explicitly. Images and other assets are deferred.
- Search paths, headings, and body text case-insensitively. Each result identifies its document path, section, and matching excerpt, and opens the matching passage.
- Refresh the source library when opening a campaign or through an explicit refresh action. Browsing and search use the same content captured at the last successful refresh; subsequent file edits appear after refresh. Missing or unreadable sources produce visible status. Consistent refresh content does not establish retained historical versions.

### Acceptance criteria

- Register two differently structured campaign folders, restart the application, and recover both registrations and the last selected campaign. Unavailable-folder and duplicate-directory registration attempts produce useful errors.
- Switch between those campaigns and confirm that document listings, reading, and search remain isolated, including when a response from a previously selected campaign arrives late.
- Configure source inclusion/exclusion independently for each campaign. Confirm recursive Markdown discovery, default exclusions, and that symlinks are not followed. Registration, reading, searching, and refreshing do not rewrite campaign files.
- Read documents containing headings, lists, tables, and code; follow local document and section links, and see explicit missing-target feedback. Campaign Markdown cannot execute active content through rendering.
- Find matches in paths, headings, and body text regardless of case. Results show source path, section, and excerpt and open the matching passage, including when headings repeat.
- Edit source files after a successful refresh. Existing browsing and search continue to agree on the captured content until another successful refresh exposes the edits. Missing or unreadable sources are reported visibly.

### Exclusions and remaining detail

Automatic watching, retained source history, authority assignments, images/assets, session preparation, play, and AI are outside this increment. Their approved broader requirements remain in effect for later increments. This slice does not complete R5 or claim session-use packaging, backup/restore, or full browser compatibility.

The accepted increment 1 architecture and plan in `docs/implementation-plan.md` refine filter syntax/defaults, refresh failure handling, and literal search semantics. Chromium is the increment acceptance browser; broader browser support remains outstanding.

## Increment 2 — Manual session preparation and visual design

Status: Requirements accepted by the owner on 2026-10-17. The accepted production design and increment plan, following the three disposable visual studies, are recorded in `docs/implementation-plan.md`. Developer implementation evidence is recorded there; formal verification remains separate.

### Scope and behavior

- Create and reopen campaign-scoped sessions with a title and objective. Collect whole source documents or sections, reorder selected items, and remove items from the session.
- Selecting a heading section includes its content and all subsections until the next heading of equal or higher level. Preserve the captured prepared material when original files change or disappear; source text is read-only in this slice.
- Provide session-level and per-item Markdown preparation notes, with a rendered preview and automatic saving. Display saving, saved, and failed states based on completed saves. Preserve working edits on failure and prevent navigation from silently discarding them.
- Export/import selected sessions with their order, notes, and captured material. Imports create new sessions under an explicitly selected registered campaign; they do not overwrite existing sessions. Campaign ownership remains explicit.
- Apply a coherent atmospheric campaign-desk visual design to the shared application shell, existing source library, and new preparation workspace. Use darker surfaces, warm accents, and a stronger fantasy character while preserving readable text, keyboard access, clear controls, and clear interaction/save states. Remain campaign-independent and reuse the accepted Angular Material/CDK foundation.
- Use the writing-desk layout (prototype A) for preparation and the session-folio layout (prototype B) for reading prepared material, including during a session. Both views use the same saved session; changing views does not create copies or lose edits. The reading view does not introduce play journals, outcomes, discoveries, or lifecycle transitions.

### Acceptance criteria

- After app/backend restart, recover the session title/objective, selected items, order, and notes. Switching campaigns and late saves/responses cannot put work into another campaign/session.
- Add a complete document and a section with nested headings, and confirm the exact intended content is retained. Refresh/edit/remove the original sources and reopen the prepared material unchanged.
- Edit both levels of notes, observe save completion, and preview Markdown. Simulate failed saves; retain working edits and expose the failure without falsely claiming success or silently losing edits during navigation.
- Export a session and import it as a new session under an explicitly chosen campaign. Recover its prepared material, ordering, objective, and notes without overwriting an existing session or needing the original source files to read the captured material.
- Review the visual direction across the shared shell, source library, and preparation workspace at laptop sizes. Demonstrate keyboard access, readable content, clear selected states, and distinguishable save/error states.
- Switch between preparation and reading views and confirm they retain the same session, item order, captured material, and notes without losing working edits.

### Exclusions

AI, play journals, player output, full session lifecycle, automatic source updates, assets, and full database/campaign backup remain outside this increment. Session export/import protects session preparation only; it is not full-system backup. The accepted architecture is recorded in `docs/implementation-plan.md`; the accepted increment plan and developer evidence are recorded there. Metadata conventions, typed Markdown cards, tags/filtering, and dedicated type-specific UI sections are deferred to [increment 3](increment-3-typed-markdown-cards.md).

## Increment 3 — Typed cards, campaign organization, and reading

Status: Requirements approved by the owner on 2026-10-17 after the increment 3 interview. The owner subsequently accepted the architecture recorded in the implementation plan. The 3A plan, detailed metadata contract, and 3B plan were accepted on 2026-10-18. After reviewing the extended disposable study, the owner selected B, authorized production planning and accepted the 3C.1 plan; its implementation/developer evidence is recorded in the implementation plan. The 3C.2 plan is also accepted and implemented, with developer evidence in the implementation plan. The 3C.3 plan is accepted and implemented with integrated developer evidence in the implementation plan. Owner implementation review, formal verification and campaign-file edits retain separate authorization boundaries. The separate Sea Witch migration has its own scope and approval boundary.

### Classification and conventions

- Initially support NPC, Location, Faction, Item, Scene, Adventure, Handout, and Reference. Each card has one primary type and optional cross-cutting tags. Combat is a Scene tag/subtype initially. An in-world Item is distinct from a prepared session item.
- Distinguish document purpose independently of type: session content, campaign guidance, and application/tooling documentation. Campaign bibles and campaign design decisions guide future AI authoring and remain outside session preparation. Application/tooling documents govern software work and are not campaign-authoring authority.
- Distinguish revision/approval status from purpose and type. Only explicitly approved, current guidance may be authoritative for future AI. Filenames, version numbers, document detail, and guidance labels alone do not establish authority. Preserve drafts and historical material outside the default play library, with explicit access to them.
- Migrated cards have a stable ID, title, type, purpose, and revision status; tags and a short authored summary are optional. Metadata syntax and identity semantics require architecture approval.
- A reusable card normally corresponds to a whole Markdown file. Split independently reusable scenes/references into linked files rather than treating every heading as a card. Preserve existing section selection for preparation.
- Recommend type-specific structures while allowing irrelevant sections to be omitted. Future in-app authoring should supply metadata and the appropriate structure automatically, without inventing missing facts. Building that editor is outside increment 3.
- Support other campaigns and ordinary legacy Markdown without requiring Sea Witch paths or templates. Unclassified, unknown-type, and invalid-metadata documents remain readable/searchable with visible classification issues. Do not guess their intended labels.

### Browsing, reading, and composition

- Provide category navigation and combined type/tag filters. Search full content within active filters, with an obvious way to search all content and a separate guidance browsing area.
- Browse through compact entries showing title, type, optional summary, and useful tags; open full content in a dedicated reader.
- Prioritize reference during play while preserving full preparation background. Show quick-reference/actionable material first, expandable background/design commentary, Expand all, and heading navigation. Search matches reveal and focus collapsed content.
- Clearly distinguish read-aloud passages, mechanics, and DM guidance. Provide comfortable reading width and a source-focused option that can collapse notes and the campaign rail while retaining the accepted writing-desk/folio modes.
- Quick references primarily arrange existing information; optional summaries must not duplicate complete factual accounts or reveal information ambiguously. Uncertain summaries enter the owner review queue.
- Show explicit relationships to locations, NPCs, items, and other scenes. Following a link does not automatically capture its target. Adding an Adventure offers its scenes for explicit selection.
- Captured session material retains its text, labels, and quick-reference content after source changes. Existing sessions remain readable without source migration. Replacing material requires an explicit action; automatic replacement is excluded. Whether a replacement command is delivered in this increment remains an architecture/scope decision.
- A Handout label does not publish content or establish player knowledge. A guidance label does not itself grant AI execution authority.

### Accepted B layout refinement

The owner's selection of B after the library-control and large-session review establishes the increment 3 visual direction. It supersedes the study's recommendation to combine A for assembly with B for reading. Prepare and Read remain views of the same saved session; the earlier increment 2 decision is retained above as historical context.

- Use B's shared campaign/session header, a library toolbar with grouped search/categories and optional filters, and its horizontal results shelf while browsing. Reading hides the library toolbar and shelf and retains the source/notes folio. The session contents and notes can collapse for focused reading. Production has no A/B study switcher.
- Keep the current session's ordered contents accessible while browsing. Successful document/section additions retain library selection and reading position rather than forcing a return to a different screen. Creating or opening a session establishes an explicit destination for subsequent additions; there is no separate compilation or publication step.
- Support a typical session of 30–50 prepared items with a compact, independently scrolling numbered list and a find-in-session control separate from library search. Finding an entry preserves its full-session number, order, selection and notes. Section entries prioritize their section title with frozen source context; reorder/remove controls are available on the selected entry in Prepare.
- Preserve established saves, navigation protection, Markdown notes/previews, frozen-source/link semantics, archive compatibility, campaign management, and legacy reading behavior. The prototype's in-memory copies, simplified rendering and mutation shortcuts do not replace those contracts.

The production plan is recorded under **Increment 3C — B production implementation plan** in `docs/implementation-plan.md`. Layout acceptance does not authorize implementation or change the accepted module boundaries.

### Separate Sea Witch content refactor

- Review a representative conversion before considering a repository-wide migration: Thomas's two profiles, Arrival Hall, Agelus Trail, and one guidance document. Selection of that guidance document remains open.
- Preserve each distinct fact, mechanic, condition, exception, clue, and narrative/knowledge constraint. Consolidate repetition and fragmented prose, split reusable content, and retain recoverable originals. Do not impose an arbitrary maximum word count.
- Preserve read-aloud passages, dialogue, and in-world handouts verbatim unless the owner separately approves editing them.
- Keep a manual owner review queue. Uncertain classifications, deletions, reconciliations, authority assignments, summaries, and editorial cuts enter that queue rather than being assumed. Uncertainty blocks only the affected edit within an otherwise authorized migration.
- The initial queue is [sea-witch-manual-review.md](sea-witch-manual-review.md). It is not an exhaustive migration audit. Application implementation never implicitly authorizes campaign changes.

#### Expanded Sea Witch migration and editorial review — accepted 2026-10-18

The owner approved requirements for a repository-wide migration and editorial review of the 85 existing Sea Witch Markdown files, ahead of production increment 3C. This expands the small pilot's content scope; file organization, exclusion design, detailed planning, and implementation retain their separate approval boundaries. The disposable A/B review is not production approval.

- Perform campaign edits on `refactor/typed-campaign-content` in the independent Sea Witch repository, preserving existing untracked files and historical versions. No work on its main branch is included.
- Review each file for classification, mixed responsibilities, repeated information, unnecessary verbosity, and inconsistent structure. Use the accepted Workbench metadata where classification is clear; do not infer canon approval or authoritative versions from filenames.
- Improve ordinary explanatory prose while retaining every distinct fact, mechanic, exception, clue, and knowledge boundary. Keep dialogue, read-aloud passages, and in-world handouts verbatim. Do not use a target word count to justify cuts.
- Split independently reusable scenes and consolidate overlapping references where the intended relationship is clear; repair affected links and anchors. Preserve recoverable originals and historical material.
- Leave uncertain passages unchanged and provide an owner review list containing file, concern, proposed manual action, and decision needed. Uncertainty blocks only the affected edit.
- Identify campaign-consistency rules and design material separately from session content. Such documents remain available to the agent as refactor guidance but must be excluded from session-library reading. Their labels or presence do not settle conflicting versions or grant authority. Retain essential scene-running instructions with their scenes.
- Provide a file inventory, classification/exclusion list, split/merge mapping, protected-text comparisons, link checks, and unresolved review items. Mechanical checks do not prove semantic preservation.
- Application code changes, database changes, production increment 3C, commits, merges, and deployment are outside this migration scope. An existing source-rule configuration step must be distinguished from campaign-file edits and separately identified before execution.

### Acceptance and exclusions

- Demonstrate finding an NPC's motivation, running a scene without reading its design commentary, following investigation clues, and opening full background when needed.
- Confirm combined filters/search, legacy and invalid metadata access, separation of guidance from preparation, related-card navigation, explicit adventure scene selection, and unchanged frozen sessions after source refactoring.
- Confirm preserved information, working links/anchors, keyboard-accessible reading controls, and usable layouts at 1280×800 and 1440×900. Review representative long content in the proposed layout before production implementation; any disposable prototype requires separate authorization.
- Preserve session archive compatibility through an explicitly designed versioning strategy; imported sessions must remain readable without original campaign files.
- Campaign authoring, AI execution, player publication, play journals, automated source replacement, and a repository-wide Sea Witch migration are not implicitly included. Broader existing product requirements remain future work where not selected here.

The [increment 3 record](increment-3-typed-markdown-cards.md) links this accepted scope to the architecture discussion. It does not authorize later phases.

## Development startup automation

Status: Requirements accepted by the owner on 2026-10-17. This concerns developer operation; it does not establish session-use distribution or authorize implementation.

- Provide one development task runnable from IntelliJ's Gradle panel and the terminal.
- Assume Docker Desktop is already running. Load existing local `.env` configuration, start PostgreSQL through Compose, and wait for database readiness.
- Start the backend, generate the Angular client from its live OpenAPI contract, then start the frontend.
- Display startup errors and service logs. Stopping the task stops the backend and frontend processes it started. PostgreSQL remains running, with its data preserved.
- Normal builds and tests retain their existing startup behavior.

Acceptance: from the Gradle task, reach the Angular interface and its local backend without separate startup commands; observe useful errors on startup failure; stop the task and confirm its backend/frontend processes terminate while database state remains. Ordinary build/test tasks must not start the development stack.

## Manual writing and playing cards — accepted requirements — 2026-10-19

Status: The owner approved the requirements below and authorized architecture work. This is the first addition to develop before AI integration. It supersedes the co-author's subscription-feasibility-first sequence, not the accepted longer-term co-author requirements. Architecture, increment planning, implementation, and verification retain their separate approval boundaries.

### Goal and scope

Provide manual campaign writing that produces ordinary Workbench-compatible Markdown, can be prepared directly for sessions, and has an in-app playing-card presentation. No AI access is required. Groups mean the existing primary content types, not a second taxonomy or a synonym for tags.

### Observable requirements

- **MW1 — Grouped writing library:** Provide All and NPC, Location, Faction, Item, Scene, Adventure, Handout, and Reference tabs. A document has one primary type. Optional free-form campaign tags support cross-cutting filtering, with suggestions/reuse of existing tags; no compulsory taxonomy, custom groups, or tag hierarchy is included.
- **MW2 — Manual editor:** Provide dedicated title, type, optional tags, and optional authored-summary controls alongside a Markdown body editor. Offer optional type-specific starting templates, using the existing recommended headings as a starting point, not compulsory document structure. Metadata status remains distinct from session-use approval.
- **MW3 — Durable drafts:** Save campaign-scoped drafts across restart. Show saving/saved/failure states based on completed saves, retain working edits on failure, and protect navigation against silent loss. Concurrent/late saves must not overwrite newer revisions or another campaign's work.
- **MW4 — Draft from source:** Create an editable draft from an existing captured library document, retaining its source reference and leaving the source untouched. Draft/source identity and export behavior must be explicit before implementation; copying must not silently overwrite sources or introduce duplicate card identities.
- **MW5 — Playing-card face:** Use a portrait playing-card presentation with default placeholder artwork, title, type, tags, and authored summary. When the summary is absent, show a clear missing-summary state. Never invent a summary or silently substitute truncated body text. Full content remains accessible rather than being forced into the card face.
- **MW6 — Preview and full reading:** Preview both the card and full Markdown document during writing. Use the same presentation rules for prepared material. Long Scenes remain readable; card presentation does not change Markdown content or remove full reading access.
- **MW7 — Direct preparation:** Explicitly approve an exact draft revision for session use and add a frozen copy before export. Subsequent draft edits must not change prepared content or labels. Existing per-entry notes remain available.
- **MW8 — Planner groups and ordering:** Type tabs organize available material; each saved session retains one mixed, manually ordered collection. Group navigation must not partition or reorder the saved session. Preserve existing source access, filtering, full reading, and session notes.
- **MW9 — Markdown export and compatibility:** Export a selected finished draft revision using the existing Workbench front-matter contract. Preserve authored body text and warn about nonportable links. After manual incorporation into a registered campaign fixture and refresh, the exported file must classify and render correctly with matching type, tags, summary, body, and supported link behavior. Export does not write campaign files, imply canon acceptance, or automatically approve session use.
- **MW10 — Export placement and link checks:** Retain a suggested campaign-relative export path for each draft. Check relative Markdown links against intended placement and show link/placement warnings before download. The DM still places exported files manually; do not promise links remain valid at arbitrary locations.
- **MW11 — Manual draft recovery:** Include a portable draft archive with tested restore covering saved drafts, retained approved/exported revisions, and source provenance. Restore into a separate recovered workspace without overwriting existing work. This is distinct from finished-document Markdown export and does not require the future AI conversation/decision archive.
- **MW12 — Delete a Writing draft — accepted 2026-10-20:** Provide Delete draft for the selected campaign-scoped draft, with confirmation naming it and explaining that its working copy and unsaved edits will be deleted while retained history and prepared copies remain. Successful deletion removes it from Writing and the planner's available drafts, clears the editor and shows confirmation. Preserve campaign files, frozen session contents, retained exports/approved revisions and existing recovery workspaces. Target the exact saved revision; reject stale requests and require explicit reload. On failure retain the editor/local edits, and prevent pending saves or late responses from recreating a deleted draft. No trash or undo is included; previously downloaded recovery archives remain unchanged.

Accepted architecture-related refinements: copying a source creates an independent card identity with retained source provenance. New cards default to metadata status draft, with explicit status controls; session approval remains independent. Portrait cards expose overflowing summary/tags through explicit expansion or scrolling rather than silent clipping. Exported draft-status cards remain accessible through the existing Include drafts library control.

### Acceptance walkthrough

1. Create an NPC draft with metadata/body; find it under NPCs and preview both card and full text.
2. Restart and recover the saved draft. Demonstrate save failure, retained working edits, and safe navigation/retry.
3. Approve a revision and add its frozen copy between Scenes in one mixed session; add session-specific notes.
4. Edit the draft and verify the prepared copy retains its text, metadata, summary, order, and notes.
5. Export the draft, manually incorporate it into an isolated campaign fixture, refresh, and verify classification/rendering/link compatibility. Do not modify the real Sea Witch campaign as an implicit part of this check.
6. Repeat with a long Scene and a draft copied from existing material. Verify campaign isolation, source preservation, and existing prepared/archive compatibility.
7. Exercise placement-dependent link warnings; export and restore the manual draft archive into a separate recovered workspace, verifying retained revisions/provenance and preservation of existing work.
8. Delete unexported and exported drafts, including a draft with unsaved edits and a prepared copy. Verify retained history, unchanged campaign files/prepared copies, disappearance from available drafts and persistence after restart. Exercise failed deletion, concurrent revision changes and campaign isolation without losing local edits or resurrecting the draft.

### Exclusions and design questions

AI, direct source-file editing, custom groups, structured relationships/inventories, image upload/generation, dragging/stacking, standalone HTML export, and player sharing are excluded. Default placeholder artwork is included. Cards are in-app HTML presentations, not standalone exported HTML artifacts or a separately deployed rendering service requirement.

Source forks have independent identities, draft status/session approval remain separate, overflow is explicitly expandable/scrollable, and suggested export paths support link checks. Exact visual layout, prepared-draft provenance/archive evolution, metadata serialization/validation, and draft-archive format/bounds remain design details before affected implementation. The broader Writing recovery archive remains accepted future scope; its full conversation/decision content does not become a prerequisite for the accepted bounded manual-draft recovery path.

## Creative co-author — accepted requirements — 2026-10-19

Status: The owner approved these requirements and authorized architecture work in the current conversation. This records product decisions, not authorization to plan or implement. Architecture proposals belong in `implementation-plan.md` and require separate approval.

### Goal and scope

Build first for the owner's campaigns. Provide an ongoing creative collaboration grounded in campaign material, rather than only single-request session gap filling. Measure usefulness through preparation effort, creative continuity, repeated explanation, correction effort, and usability of the prepared result. No numerical time-saving target has been established.

Initial topic guidance covers world/lore, characters/factions, and scenes/adventures. Retain the existing small content-type vocabulary, optional templates, ordinary Markdown links, and per-prepared-item notes before introducing structured relationships. Enemies need not become a separate type from NPCs, nor weapons a separate type from items merely to support this scope.

### Observable requirements

- **CW1 — Saved conversations:** Save and resume campaign-scoped topic conversations across application restart. Campaign switching and late generation/save results must not mix conversations, sources, decisions, drafts, or guidance between campaigns.
- **CW2 — Approved topic guidance:** Apply approved guidance appropriate to the creative topic. AI-proposed guidance changes have no effect until explicitly approved. Keep creative instructions distinct from facts about the campaign.
- **CW3 — Explicit decisions:** The DM can explicitly accept, edit, and supersede campaign decisions independently of document completion. Accepted decisions become available to subsequent relevant conversations before Markdown export. Suggestions and unaccepted brainstorms do not acquire authority through inclusion in conversation history.
- **CW4 — Visible authority conflicts:** Distinguish source material, accepted decisions, drafts, and proposals. Show identified contradictions without automatically choosing a winner. The DM may explicitly approve a decision overriding an identified source passage for future assistance, pending manual repository incorporation. Preserve the original source and resolution; do not infer that an entire document is overridden. Automated detection does not guarantee exhaustive consistency.
- **CW5 — Inspectable context:** Show the sources, decisions, drafts, and topic guidance selected for a request and allow adjustment. Excluded material must remain outside outgoing requests, including automatically selected derived context. Expose context limitations rather than silently representing partial context as complete campaign knowledge. Existing R13 privacy constraints apply.
- **CW6 — Reviewable drafts:** Create, manually edit, and explicitly request AI revision of Markdown drafts. Distinguish invented additions from source-supported claims and retain references to supporting material. Export selected finished content for manual incorporation into the campaign repository; no campaign-file writes are included.
- **CW7 — Separate approvals:** Session approval, campaign-decision acceptance, guidance approval, and finished-document export are distinct actions. None automatically performs another or establishes whole-draft canon authority.
- **CW8 — Preparation integration:** Add a session-approved draft version as a frozen prepared item before export. Later draft edits do not silently change the prepared copy. Retain the existing prepared-item notes and session behavior.
- **CW9 — Revision traceability:** Preserve superseded decisions and their origins. Make conversation and supporting-material origins inspectable for decisions and drafts. Flag potentially affected drafts for review without automatically rewriting them or claiming exhaustive impact detection.
- **CW10 — Persistence and failures:** Preserve saved conversations, decisions, guidance, and drafts across restart and generation failure. Existing preparation and manual work remain usable when AI is unavailable. Generation requires an explicit action; R14 usage visibility and spending constraints remain mandatory.
- **CW11 — Creative-work recovery:** Include a portable Writing archive and tested restoration covering conversations, decisions, guidance, drafts, and retained source evidence. Validate before import and restore to a separate recovered workspace without overwriting or merging existing work. Preserve internal relationships and historical approvals; recovered material influences new conversations only after explicit selection. Source-folder attachment and sign-in are separate actions. Exclude credentials; restoration must not reset spending records. This is distinct from finished-document export and existing prepared-session archives.

Accepted access/export refinements: prioritize minimal additional spending by using the owner's existing ChatGPT Plus allowance where supported. This supersedes the earlier API-credentials-first choice. Separately billed API use remains disabled unless explicitly enabled. Ordinary document export downloads one selected finished draft as Markdown, preserving authored text and warning about nonportable links. Existing ChatGPT conversations are not presumed available through sign-in.

Acceptance is assessed against these observable behaviors; a source reference establishes traceability, not proof that a generated claim is correct.

### Sea Witch pilot acceptance scenario

Use one real Sea Witch preparation task, with its exact subject selected before pilot execution:

1. Resume a creative conversation with selected campaign material and approved topic guidance.
2. Brainstorm, refine, and explicitly accept a campaign decision.
3. Open a related conversation and demonstrate that the accepted decision can inform it.
4. Revise the decision, preserve its history, and expose potentially affected drafts for review. Exercise explicit resolution of a conflict with a selected source passage.
5. Produce and manually edit a Markdown draft with inspectable context and traceable references.
6. Approve the draft version for session use and add a frozen prepared copy before export. Demonstrate that subsequent draft edits leave that copy intact.
7. Export the finished draft for manual repository incorporation. Export does not change sources or silently accept decisions.
8. Confirm persistence after restart, exclusion of private context, campaign isolation, and preservation of work after failed generation.

Evaluate the creative result with the owner. Campaign independence also needs a differently structured fixture; Sea Witch terminology must not become application behavior. This pilot does not require the broader Agelus/playthrough scenario below or complete journal functionality.

### Exclusions and unresolved decisions

The first co-author scope excludes direct campaign-file editing, images/image generation, spatial card layouts, structured inventories, battle simulation, autonomous campaign-wide editing, and networked player sharing. Direct Markdown source authoring remains a longer-term direction, separately designed and authorized. Existing non-AI preparation and reading remain supported.

OpenAI subscription access is selected subject to eligibility and integration verification. Manual writing/cards take priority; subscription feasibility remains a prerequisite before building the full AI workflow, not the next development increment. Verify sign-in, model availability, and additional-credit controls before co-author implementation; return to the owner if this route cannot meet the spending constraint. Model choice, acceptable data handling, precise allowance/usage behavior, detailed context selection, archive format/validation details, and the exact pilot task remain unresolved before affected implementation. No numerical paid budget has been approved. No existing discovery records or comprehensive source-authority system may be presumed implemented. Full conversation/decision recovery belongs to the accepted Writing archive scope and is not supplied by existing prepared-session archives.

## Evaluation scenario

Proposed review scenario: prepare and run the Agelus investigation from Tordeck's chest through the monastery, using linked scenes, NPC context, clues, handouts, assisted creation, and discovery records.

This scenario is grounded in existing material and was recommended during discussion, but was not explicitly selected by the owner. Confirm it or choose another representative session before treating it as the acceptance scenario.

Campaign independence also requires a second, differently structured campaign fixture with no Sea Witch-specific conventions.

## Initial exclusions

- Multiple concurrent DMs or groups sharing application state.
- Player accounts, a hosted player portal, and automatic cross-device synchronization.
- Automatic repository edits or automatic canon adoption.
- Unattended generation or automatic application of AI-interpreted outcomes.
- General campaign authoring beyond the explicitly accepted manual-writing and creative co-author scopes above.
- A full virtual tabletop, tactical combat engine, or autonomous world simulation.
- Tablet delivery in the first increments.

Ship accounting, interactive maps, and comprehensive automated consistency audits remain assessment opportunities, not committed first-version requirements.

## Outstanding decisions and limits

- Confirm the representative evaluation session.
- Verify the selected OpenAI subscription access, model availability and acceptable data handling; settle allowance handling. Separately billed API use requires explicit enablement and a configured budget.
- Establish laptop browser targets and local startup/distribution expectations.
- PostgreSQL runs locally through Docker Compose; backup/restore behavior remains to be resolved before affected architecture decisions.
- Application repository name and location are agreed above. Setup increment 0 covers repository creation and transfer of application design documents; no campaign-content migration is authorized.
- Designate initial source authority and reconcile relevant conflicts; the app must not silently settle these.
- Enter current playthrough state manually; repository prose is insufficient evidence for actual player discoveries.

These items remain explicit rather than assumed. This document selects no technology stack, implementation increments, or deployment design.

### Increment 5 — Read-session card table — accepted 2026-10-20

This supersedes the earlier folio layout and shared-order reading behavior; both views still use the same saved session and frozen entries.

Read presents existing 320px portrait cards with unchanged title/type, authored summary, tags, placeholder artwork and full-document action in a horizontally scrolling row above the full-text reader. Cards determine row height; short screens permit page scrolling. Drag handles and move-left/right buttons rearrange cards. Selection highlights the card and opens its frozen content with existing reader tools and notes.

Prepare owns starting order; first Read initializes a separate persistent table arrangement. Read changes never reorder Prepare. New prepared entries appear at the front of the active row; removals disappear from either pile. Mark used moves a card into a persistent Used cards tray without deletion, retaining its selected text. Used cards remain readable; Return to table prepends them to the active row. Archives preserve table state; older archives start uninitialized with preparation order and all cards active. No journals or lifecycle transitions are introduced.

#### Increment 5 interaction and Read-header adjustment — accepted 2026-10-20

Supersedes external per-card control rows: click or keyboard-activate the card to select it, with a gold outline on the card itself. Drag the card directly to reorder it or drop it onto a persistent visible Used cards pile beside the horizontal row. Open the pile to read used cards and drag them back; restoration still prepends. On-card action menus retain keyboard move/used/return alternatives. Preserve card dimensions, authored text, summary scrolling, full-document access, saved state and selection retention after marking used.

Read uses compact campaign/session chooser controls, save status, Return to Prepare and a More menu for Writing, campaign management, session details/objective and export. A second compact row provides card find, Notes and View controls. Panel/focus/session-note actions remain accessible through View. Reduce application branding/connection controls in Read and hide routine library/success notices there; keep failures and explicit recovery visible. Prepare retains its existing composition controls. No persistence or archive changes are needed.

### Deferred increment — per-card images — owner direction 2026-10-20

Status: The owner requested a separate later increment for per-card images and authorized documenting that deferral. It is outside the current UI cleanup and has no implementation authorization or assigned increment number.

Goal: associate a selected image with a card and reuse it for that card's presentation in Write, Prepare and Play (formerly Read), including compact material-library thumbnails. Show the existing application placeholder when no image is selected. The owner identified the illustrated Prepare concept `exec-9d5145fc-95ac-4099-91e6-42d07ec7fa3d.png` as a desirable visual direction; that mockup does not establish an asset-storage or content-import contract.

Before implementation, settle image selection/acquisition, ownership and identity, frozen prepared-copy behavior, replacement/removal, archive/recovery portability, supported formats and size limits, and missing-image behavior. Compact thumbnails and an optional text-only shelf are recommendations for that increment, not yet approved acceptance criteria. Existing source/reader image omission and placeholder behavior remain in effect until the later increment is designed and implemented.

### Play naming and group lookup — owner direction 2026-10-20

Accepted goals: rename the user-facing Read mode to **Play**, so mode navigation becomes **Write / Prepare / Play**. Add a group filter to the Play card table so the DM can quickly locate a particular kind of card. This naming supersedes Read in future UI work; earlier sections retain historical terminology. The rename does not itself introduce journals, lifecycle transitions or new play records. Application behavior/labels have not yet been changed by this documentation update.

Existing vocabulary: groups are the primary content types NPC, Location, Faction, Item, Scene, Adventure, Handout and Reference, as defined for manual writing. They are distinct from tags and custom user-defined collections.

Proposed filter behavior, pending approval: place a compact Group chooser beside Find cards, with All and the eight existing types; select one group at a time and default to All. Combine it with the existing text find, apply it to both the active table and opened Used cards tray, and show matching/total counts. All includes untyped legacy entries; filtering never invents a type, changes either saved order or moves entries between piles. Keep the selected full text open even when its card is filtered out. Clear filters to show the full arrangement again. Keep filter state local to the view. Reordering while filters are active needs an explicit interaction decision; the initial recommendation is to require clearing filters before rearranging, matching current text-find behavior. Filter details are requirements proposals, not an accepted implementation plan.

### Shared mode UI and Prepare placeholders — accepted 2026-10-20

The owner approved the proposed common two-row shell and per-mode cleanup, including previously proposed Play filter details. Use Write / Prepare / Play navigation, a shared campaign chooser/save-status/More header, consistent contextual tools and global dark menus. Automatically check backend availability at startup and foreground return; display failures with retry, without a permanent healthy indicator. Save confirmation remains independent. Retain all existing save/discard/conflict guards.

Write exposes Markdown early, expandable card metadata, draft-title search combined with the existing type/tag filters, compact New draft choices and on-demand export inspection/history. Prepare uses compact multi-type/filter controls, full-document-first viewing and the same application-owned placeholder image on source result/document and draft tiles; image assignment remains deferred. Preserve source searches, diagnostics, capture/approval validation and explicit material assembly. Play uses All or one existing primary card type combined with text find across active/used cards, matching/total counts and local filter state. Filtering leaves selected text and saved arrangements intact; clear filters before reordering. Readers place metadata/provenance/summary behind details, preserving authored Markdown and access to all information. No source-owned image loading or new asset storage is included.


## Play workspace discovery — accepted owner decisions — 2026-10-22

Status: Accepted product direction from the DM playtest and owner interview. This section refines R6, R7, R10 and the existing manual-writing/card requirements; it is **not** authorization for architecture, planning or implementation. Existing implemented Play behavior and historical increment scopes remain unchanged until separately authorized. Details explicitly marked for investigation are not approved requirements.

### Authoring and cards

- Preserve the existing Campaign Writer approach: one resource has both a complete Markdown document and a separately authored playing-card presentation. Improve this dual editing experience rather than adding an independent card-authoring system. Documents remain the comprehensive source; cards are concise play-facing views, with full-document access preserved. The card and document should not silently overwrite one another.
- Consider smarter authoring (e.g. assisted extraction of card text, card previews, content-change awareness, layouts appropriate to NPCs/scenes/items), but these are **investigation opportunities**, not accepted automation or data-model commitments. AI may assist only when explicitly requested; manual authoring must remain fully usable.

### Play workspace and navigation

- Use a flexible card tabletop with a focus area supporting **two or three cards simultaneously**, rather than replacing the current card every time a second reference is opened. A DM can keep a scene and NPC visible and open an encounter or item alongside them. The exact layout, sizing, pinning and overflow interaction remain to be designed.
- Expose **contextual related cards** from the active scene/resource (e.g. its NPCs, encounter, map or items), allowing one-click access to an available focus slot. Retain manual search/selection; do not require AI or automatically infer unapproved relationships. How relationships are authored, approved and stored remains an open design question.
- Notes stay independently and persistently accessible while focused cards change. Card focus and note entry must not discard each other or force a scene transition.

### Session notes, outcomes and review

- Provide **fast manual note capture** during play. Notes automatically retain the active campaign/session and scene context, with a timestamp and optional association to a relevant card/resource where available. The DM should not need to file a note before continuing play. Preserve manual editing and durable storage consistent with R7.
- Keep actual playthrough events and discoveries separate from prepared campaign documents/canon. A note about an NPC's changed allegiance or an item changing hands does not silently rewrite the NPC or item source. Distinguish recorded events, player theories and confirmed discoveries as already required by R7.
- Notes **accumulate until the DM chooses to review them**, whether during play, after a session or much later. Do not force or automatically launch a post-session review. Manual review can organize notes and identify significant outcomes or lasting consequences. Optional, explicitly invoked AI assistance may suggest summaries, links or consequences, but is never required and must not apply changes without DM approval. This clarification supersedes any reading of R10 that would mandate a completion-time review prompt.

### Combat scope

- **Accepted current scope: reference-only.** Cards can show encounter preparation, stat blocks, maps and mechanics; notes capture narrative outcomes. No integrated initiative, HP, condition or turn tracking, combat automation or tactical grid is required for this scope. An unexpected fight does not require switching to a separate combat mode or automatically replacing the active scene.
- **Deferred possible expansion (not approved):** optional lightweight encounter tracking for HP, conditions and initiative, without full virtual-tabletop mechanics. Reassess based on DM usage and a separately approved increment.

### Open UX questions

- Tabletop arrangement and retrieval with dozens of cards: free positioning, ordering, grouping, filtering and contextual relevance.
- Focus-area layout at laptop sizes, third-slot behavior, pinning, and notes-panel ergonomics.
- Relationship authoring and storage, card/document update awareness, and how DM-approved important events are represented in playthrough history.

No application code, campaign source material or existing prepared sessions are changed by these documentation decisions.


### Play tabletop interview closure and implementation gap review — accepted 2026-10-22

**Status:** The owner closed the tabletop requirements interview and authorized documentation of its decisions and findings. This subsection refines and, where more specific, supersedes the earlier open UX questions above. It is a **requirements and investigation handoff**, not an accepted domain model, architecture, implementation plan, or authorization to code. Existing implementation remains unchanged.

#### Accepted interaction decisions (Q10f–Q10x)

| ID | Decision | Initial behavior |
| --- | --- | --- |
| Q10f | Contextual tabletop | Retain the existing ordered, searchable prepared-card shelf and access to all prepared cards. Highlight cards related to the explicitly active scene and allow 2–3 simultaneously focused cards. No free positioning. |
| Q10g | Explicit active scene | Opening/inspecting a scene does not activate it. A separate explicit action sets the active scene, affecting related-card suggestions and default note context; it does not clear focus or mark anything complete. |
| Q10h | Manual note context override | A new play note defaults to the active scene when present, retains its session, and can be manually associated with a different resource. Merely inspecting a card never changes the note's context. |
| Q10i | Temporary inspection | With all focus slots occupied, an additional card opens in a readable temporary preview; the DM can explicitly replace a focus slot. Inspection does not change the active scene. |
| Q10j | Wider-library inspection and explicit capture | Search the broader campaign library during Play, inspect an unprepared card, and optionally add it to the session. Inspection alone does not add it or change active scene/focus. Preserve frozen prepared-content behavior; exact reuse of existing capture paths needs investigation. |
| Q10k | Improvisation as notes | Record improvised NPCs, locations and events as notes, not new authored resources, during Play. An explicitly invoked future “create resource from note” workflow in Write is deferred. |
| Q10l | World changes as notes | Record deaths, destruction, allegiance changes and other outcomes in notes; do not automatically update authored cards, introduce NPC status tracking, or create a general world-state engine. Manual authoring changes can happen later in Write. |
| Q10m | Cross-session card history | From the same underlying campaign card, access notes associated with it across previous sessions, newest first, retaining session provenance and original context. Do not alter authored source or require AI summaries. Identity across prepared copies and revisions is an investigation priority. |
| Q10n | One primary resource per note initially | Reuse existing session/per-prepared-item note functionality where feasible. A play note has at most one manually chosen primary card/resource association initially; multiple associations and inferred relationships are deferred. |
| Q10o | Manual note pinning | The DM may pin important notes above the chronological history; pinned notes remain in the full history. No automatic classification. |
| Q10p | Existing full-document reader | Keep the full Markdown document with heading navigation and existing reading tools. No parallel scene reader, section dashboard or new document system. |
| Q10q | Existing preparation review | Previous sessions and their notes remain accessible through existing session navigation, complemented by card-bound cross-session history. No new campaign-history browser or mandatory review workspace. |
| Q10r | Restore working context | Reopening a session restores explicitly active scene and 2–3 focused-card identities alongside existing persisted prepared content, notes, card ordering and active/used piles. Temporary inspection previews close. Exact scroll, expanded sections and filters need not persist. |
| Q10s | Expand a focused card | Temporarily enlarge one focused card for reading while retaining quick access to the other focused cards. Return to the prior arrangement in one action; reuse existing document reading tools. |
| Q10t | No discovery state | Use notes and the existing Used pile to manage discoveries. “Used” means set aside by the DM, **not** “discovered by players”; no discovered marker or structured discovery journal initially. |
| Q10u | Used cards remain discoverable | A related Used card may appear in contextual suggestions with a Used indicator. Inspection does not return it to the active pile; returning is explicit. Contextual suggestions never rearrange the table. |
| Q10v | No recent-scene control initially | Select scenes through the existing shelf/search. Compact recent-scenes navigation is deferred as an optional future enhancement; no scene-transition history. |
| Q10w | Preserve Play while visiting Prepare | Switching Play → Prepare → Play retains active scene, focused cards and expanded focus state. Newly added prepared cards join the shelf without stealing focus or changing active scene. |
| Q10x | Simple removal behavior | Removing a prepared card closes it in Play focus. If it was the active scene, clear that selection. Leave remaining focus, notes and arrangement alone; no tombstone view, special warnings or automatic replacement. |

**Scope and constraints:** Manual-first, AI optional and explicitly invoked, generic campaigns, authored Markdown remains separate from what happened in play. Avoid new combat tracking, discovery journals, world-state tracking, recent-scenes history, freeform/resizable tabletop windows, automatic card promotion, automatic scene changes, automatic post-session review and extra reading interfaces. Reuse existing card/document authoring and current Play/Prepare components. The deferred note-to-resource action, multiple note associations and optional recent-scenes shortcut are not authorized initial features.

#### Evidence-based current implementation baseline (targeted review, not exhaustive)

- `frontend/src/app/preparation/session-state.ts` exposes a single `selectedItem`, session/item note editing, and persisted `table.active`/`table.used` operations. Removal filters the item out of both piles and changes the selected item if needed. The existing selected item is **not** equivalent to the proposed multi-card focus or explicit active scene.
- `frontend/src/app/preparation/card-table.ts` renders the horizontal active-card shelf, searchable/type-filtered card entries, selection, drag/reorder, Used pile, and explicit Return to table. It is an appropriate starting point, not a disposable prototype.
- `frontend/src/app/preparation/workspace.ts` retains UI signals for note panel/scope and reading focus, initializes the table when entering Read/Play, and uses existing session state. Its current `focusSource` panel mode is **not** evidence that the proposed independently expandable multi-card focus already exists.
- Existing accepted increment 5 specifies independent persisted Read table ordering, active/used piles, frozen prepared content, archive preservation and full-document access. Existing preparation and session-level/item-level notes survive restart; source capture is immutable for prepared entries.
- Existing typed Sources relationships and prepared captured metadata offer a foundation for contextual suggestions, but the precise selection/ranking, missing targets and identity mapping remain unresolved.
- The existing architecture distinguishes Preparation-owned prepared sessions/notes from the proposed Playthroughs responsibility for actual-play history. That boundary is documented, but the new cross-session note model and ownership are **not yet designed**.

#### Gap classification for the next domain-modeling session

| Capability | Assessment | Next investigation |
| --- | --- | --- |
| Prepared cards, frozen source, session order, active/used piles, session and per-item notes, full reader | Existing foundation | Reuse current APIs, persistence, archive and components; avoid duplicating data |
| Search, type filtering, existing relationships, wider library | Partial foundation | Confirm Play-side inspection and explicit add flows, stable card IDs and relationship behavior |
| Explicit active scene, 2–3 focus slots, temporary preview, expand one focus, contextual suggestion presentation | New Play behavior | Separate scene activation, focus, selection, inspection and table membership; identify persistence boundary |
| Restored active scene/focus across reopen; mode-switch continuity | New or modified state | Determine minimal persistent vs transient state and safe handling of removed/renamed cards |
| Notes defaulting to scene, one primary resource association, pinning, cross-session chronological history | Significant extension | Distinguish current item notes from individual play notes; model provenance, stable underlying resource identity and history retrieval |
| Structured discoveries, automatic world changes, combat tracker, recent-scenes shortcut, new resource creation in Play | Deferred/excluded | No initial domain model or implementation |

#### Domain questions intentionally left unresolved

1. **What is a Play note?** Existing session notes and per-prepared-item Markdown fields are not necessarily individual timestamped records. Determine the minimal way to support individual note timestamps, optional primary resource association, pinning and cross-session history without silently changing the meaning or storage of existing notes.
2. **Who owns actual-play history?** Evaluate the documented Preparation vs Playthroughs boundary, including whether a small Playthroughs slice is warranted or whether reuse is feasible without violating ownership. The older R7 language about discoveries, theories and outcomes must be reconciled explicitly with the accepted notes-only initial scope; do not silently replace either.
3. **What identifies the same campaign card over time?** Distinguish source/card stable ID, prepared-item ID, frozen snapshot/provenance and session identity. Handle source revisions, rename/split, removed prepared cards, legacy/untyped cards, duplicates and imported archives without falsely merging histories.
4. **What is persistent Play state?** Decide ownership and serialization for active-scene ID, ordered focused-card IDs and active/used table, with transient previews and expanded state. Q10r requires restoration after reopen; Q10w requires expanded-state continuity during a same-session mode switch, not necessarily after restart.
5. **What constitutes an approved relationship?** Determine how existing typed/Markdown links yield contextual suggestions, including references to Used cards, missing or unprepared targets and manually approved relationships; do not infer links with AI by default.
6. **How do edits and removals behave?** Preserve existing autosave/revision conflict/campaign isolation and archive semantics. Ensure removing a prepared card invalidates scene/focus references safely without deleting historical notes or rewriting source.
7. **How does Play note capture coexist with current Prepare note editing?** Preserve existing session/item notes and note previews; avoid inventing an entirely new editor or conflating note context with whichever card is currently inspected.

**Review outcome:** The largest likely domain change is cross-session, resource-associated actual-play notes; the tabletop itself is mainly a UX/state extension of existing card-table behavior. This is a preliminary finding based on selected documentation and source files, **not** a verified implementation estimate or an approved architecture. Next step: owner-authorized Architecture phase focused on domain modeling, then a separately approved implementation plan/increment. No application code, existing session data or campaign files changed by this documentation.
