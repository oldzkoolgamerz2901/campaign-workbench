# Campaign Workbench — Product specification

Date: 2026-10-17

Status: Requirements approved by the owner on 2026-10-17, with subsequent accepted revisions for local laptop operation, direct campaign-folder access, and multiple campaigns. Outstanding decisions remain explicit. Architectural proposals and implementation plans require their own approval; this specification does not authorize implementation.

## Reading and decision precedence

This specification retains the evolution of accepted requirements. A later, explicitly accepted refinement supersedes only conflicting earlier behavior; broad requirements may describe future capabilities rather than delivered features. [Current delivery/evidence](implementation-plan.md) and [future work](future-work.md) distinguish implementation status from acceptance and proposals.

| Area | Most specific accepted reference |
| --- | --- |
| Library, Writing and frozen preparation | [Unified requirements](#unified-library-writing-and-preparation--accepted-requirements--2026-10-22), then [UX refinements](#library--write--prepare-visual-simplification--accepted-requirements--2026-10-23) and UX-C6/C7 below |
| Tabletop, notes, history and P7/P8 | [2026-10-24 reconciliation](#play-tabletop--accepted-requirements-reconciliation--2026-10-24); original Q10 decisions remain traceability context |
| Creative co-author | [Accepted requirements](#creative-co-author--accepted-requirements--2026-10-19), with unresolved choices retained; not implemented by P8 |
| Earlier outstanding questions | Dated investigation context; consult later accepted decisions and evidence before treating them as unresolved |

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

Encountering a clue, learning a fact, and forming a theory are distinct. For the initial Playthrough release, the DM expresses those distinctions in freeform Markdown PlayNotes; no structured discovery category, knowledge state or automatic inference is required. The Used pile means set aside, not discovered or understood.

Acceptance:

- Records survive closing and reopening the app and remain associated with their session.
- The DM can correct a discovery or outcome.
- The DM can distinguish player theories from confirmed revelations in editable note text; structured classification is deferred.
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

Status: Originally deferred outside the UI cleanup on 2026-10-20. The owner approved the per-card image requirements below on 2026-10-21 and authorized architecture work. Implementation remains unauthorized and no increment number is assigned.

Goal: associate a selected image with a card and reuse it for that card's presentation in Write, Prepare and Play (formerly Read), including compact material-library thumbnails. Show the existing application placeholder when no image is selected. The owner identified the illustrated Prepare concept `exec-9d5145fc-95ac-4099-91e6-42d07ec7fa3d.png` as a desirable visual direction; that mockup does not establish an asset-storage or content-import contract.

The requirements below supersede the deferred selection and behavior questions. Architecture and implementation still require their own approvals. An optional text-only shelf remains a proposal outside this increment.

#### Per-card images — accepted requirements — 2026-10-21

The owner approved these requirements and authorized architecture work. No increment number or implementation scope has yet been approved.

- Select one local image file per Writing card in **Write**, then carry its saved artwork into **Prepare** and **Play**. Accept static JPEG, PNG and WebP files up to 10 MiB; reject unsupported, animated or oversized inputs with a clear message. URL fetching, image generation and galleries are deferred. A successfully saved image no longer depends on the original file.
- Allow replacement and removal in Write; removal restores the existing placeholder. Artwork changes are draft edits using existing save status and revision checks. Failed uploads retain the previous image and offer retry. Approval captures successfully saved text and artwork together.
- Freeze the artwork alongside the approved draft revision in Prepare. Later replacement/removal in Write does not change existing prepared copies or their Play presentation. Direct source-card image assignment is outside this increment.
- Show artwork in Write's card preview, draft/prepared thumbnails in Prepare, and active/used cards in Play. Use centered cropping in the existing card/image dimensions and compact thumbnails. Manual crop/focal-point controls are deferred. Full-document readers retain their existing text presentation and Markdown image omission.
- Session archives and Writing recovery archives include the image data needed to retain artwork after restoration. Older archives restore without artwork using placeholders. New archives with missing or invalid referenced image data fail validation before any import writes. Cards with no selected image remain valid. Archive capacity must accommodate the supported illustrated-card volume; concrete aggregate limits remain an architecture decision.
- Reviewed Markdown downloads remain text-only. Illustrated Markdown export and asset packaging are deferred.
- Resizing for display is permitted while leaving the user's original file untouched. Retain sufficient image quality for reasonable future enlargement. Keep card and image dimensions unchanged now, but allow a future increment to adjust them without requiring users to reselect artwork; size controls are deferred. The retention/quality tradeoff must be explicit in architecture.

### Play naming and group lookup — owner direction 2026-10-20

Accepted goals: rename the user-facing Read mode to **Play**, so mode navigation becomes **Write / Prepare / Play**. Add a group filter to the Play card table so the DM can quickly locate a particular kind of card. This naming supersedes Read in future UI work; earlier sections retain historical terminology. The rename does not itself introduce journals, lifecycle transitions or new play records. Application behavior/labels have not yet been changed by this documentation update.

Existing vocabulary: groups are the primary content types NPC, Location, Faction, Item, Scene, Adventure, Handout and Reference, as defined for manual writing. They are distinct from tags and custom user-defined collections.

Proposed filter behavior, pending approval: place a compact Group chooser beside Find cards, with All and the eight existing types; select one group at a time and default to All. Combine it with the existing text find, apply it to both the active table and opened Used cards tray, and show matching/total counts. All includes untyped legacy entries; filtering never invents a type, changes either saved order or moves entries between piles. Keep the selected full text open even when its card is filtered out. Clear filters to show the full arrangement again. Keep filter state local to the view. Reordering while filters are active needs an explicit interaction decision; the initial recommendation is to require clearing filters before rearranging, matching current text-find behavior. Filter details are requirements proposals, not an accepted implementation plan.

### Shared mode UI and Prepare placeholders — accepted 2026-10-20

The owner approved the proposed common two-row shell and per-mode cleanup, including previously proposed Play filter details. Use Write / Prepare / Play navigation, a shared campaign chooser/save-status/More header, consistent contextual tools and global dark menus. Automatically check backend availability at startup and foreground return; display failures with retry, without a permanent healthy indicator. Save confirmation remains independent. Retain all existing save/discard/conflict guards.

Write exposes Markdown early, expandable card metadata, draft-title search combined with the existing type/tag filters, compact New draft choices and on-demand export inspection/history. Prepare uses compact multi-type/filter controls, full-document-first viewing and the same application-owned placeholder image on source result/document and draft tiles; image assignment remains deferred. Preserve source searches, diagnostics, capture/approval validation and explicit material assembly. Play uses All or one existing primary card type combined with text find across active/used cards, matching/total counts and local filter state. Filtering leaves selected text and saved arrangements intact; clear filters before reordering. Readers place metadata/provenance/summary behind details, preserving authored Markdown and access to all information. No source-owned image loading or new asset storage is included.


### TODO — Align Prepare's Drafts view with Sources — 2026-10-21

Owner-requested follow-up: improve the **Drafts view within Prepare** so it fits the Sources view's layout, visual styling and interaction patterns. The current draft chooser presents its own list and preview, with **Approve revision … and add** below the preview; the owner needed help locating that action while trying to prepare illustrated drafts.

Proposed points to resolve in the follow-up:

- Match Sources' compact browsing controls, material tiles, thumbnail treatment, selection styling, spacing and typography; provide consistent draft finding/filtering where useful.
- Present the selected draft in a consistent reader area with familiar Card/Document controls, keeping artwork visible in the appropriate thumbnail/card views.
- Make the destination session and **Approve revision … and add** action easy to find beside the selected draft; explain disabled approval and validation issues without hiding the action below a long document.
- Clarify the difference between a source copy, a working draft and an approved prepared copy, including that artwork travels with the approved draft and does not update similarly named source entries automatically.
- Preserve explicit approval of the exact saved revision, frozen text/artwork, validation and existing save/navigation protection. Review keyboard access, scrolling and the 1280×800 / 1440×900 layouts.

Status: TODO captured; exact layout, action placement, labels, filtering and implementation scope remain to be agreed. This records the requested improvement and discussion points, not an approved design or implementation increment.


## Play workspace discovery — accepted owner decisions — 2026-10-22

Status: Accepted product direction from the DM playtest and owner interview. This section refines R6, R7, R10 and the existing manual-writing/card requirements; it is **not** authorization for architecture, planning or implementation. Existing implemented Play behavior and historical increment scopes remain unchanged until separately authorized. Details explicitly marked for investigation are not approved requirements.

### Authoring and cards

- **Card background presentation — accepted 2026-10-23:** Artwork fills the entire existing 243:420 card behind an opaque parchment text panel positioned at the bottom, approximately 35–40% of the card height, following the owner's supplied Brother Colm visual reference. Centered cover fitting may crop images to fill the card without distortion; this supersedes P2A's separate 55% artwork window and uncropped/letterboxed presentation. The lower panel retains existing title, type, authored summary, tags and full-document access; long titles/summaries remain keyboard-scrollable. Preserve the 320px default width, proportional responsive sizing, selection/menu/drag behavior, placeholder/loading/failure/retry, frozen artwork selection and thumbnail presentation. Apply through the shared card renderer in Library, Write, Prepare, Play and recovery. No new stat fields or image persistence changes are implied.
- **P2A — full-image card artwork, accepted 2026-10-22; presentation superseded by Card background presentation below:** Preserve the existing 243:420 outer card and 320px default width. Enlarge the internal artwork window from 35% to approximately 55% and show the entire image without cropping or distortion; differing proportions may leave space around it. Apply consistently in Write, Prepare, Play Active/Used and Writing recovery. Retain readable/keyboard-scrollable titles and summaries, full-document access, artwork loading/failure/retry and frozen image selection. List thumbnails retain their existing presentation. No new image fields, processing, persistence or card backs.
- **Gap-closure requirements approved 2026-10-22:** Card backs and front/back flipping are excluded from the initial Playthrough scope. The required card shape is 243:420, with proportional, container-driven sizing and the existing 320px default width. Full-document access remains available. Shape changes may be delivered in a separate presentation increment; changing shape does not authorize a new card-content model, automated extraction or richer authoring fields. This decision supersedes front/back requirements in the earlier Playthrough planning document. The current implemented renderer uses 5:7; 243:420 is a required change, not existing behavior.
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

**Historical handoff:** These questions describe the interview's earlier state, not the current architecture backlog. The subsequently accepted [Playthrough architecture](playthrough-domain-architecture.md) resolves note ownership, identity failure rules, persistent/transient state, exact relationships, shared locking and separate preparation notes. R7 and the card requirements above incorporate the later approved notes-only and single-sided-card scope. The [revised implementation plan](playthrough-implementation-plan.md) maps delivery and evidence; neither link authorizes execution.

1. **What is a Play note?** Existing session notes and per-prepared-item Markdown fields are not necessarily individual timestamped records. Determine the minimal way to support individual note timestamps, optional primary resource association, pinning and cross-session history without silently changing the meaning or storage of existing notes.
2. **Who owns actual-play history?** Evaluate the documented Preparation vs Playthroughs boundary, including whether a small Playthroughs slice is warranted or whether reuse is feasible without violating ownership. The older R7 language about discoveries, theories and outcomes must be reconciled explicitly with the accepted notes-only initial scope; do not silently replace either.
3. **What identifies the same campaign card over time?** Distinguish source/card stable ID, prepared-item ID, frozen snapshot/provenance and session identity. Handle source revisions, rename/split, removed prepared cards, legacy/untyped cards, duplicates and imported archives without falsely merging histories.
4. **What is persistent Play state?** Decide ownership and serialization for active-scene ID, ordered focused-card IDs and active/used table, with transient previews and expanded state. Q10r requires restoration after reopen; Q10w requires expanded-state continuity during a same-session mode switch, not necessarily after restart.
5. **What constitutes an approved relationship?** Determine how existing typed/Markdown links yield contextual suggestions, including references to Used cards, missing or unprepared targets and manually approved relationships; do not infer links with AI by default.
6. **How do edits and removals behave?** Preserve existing autosave/revision conflict/campaign isolation and archive semantics. Ensure removing a prepared card invalidates scene/focus references safely without deleting historical notes or rewriting source.
7. **How does Play note capture coexist with current Prepare note editing?** Preserve existing session/item notes and note previews; avoid inventing an entirely new editor or conflating note context with whichever card is currently inspected.

**Review outcome:** The largest likely domain change is cross-session, resource-associated actual-play notes; the tabletop itself is mainly a UX/state extension of existing card-table behavior. This is a preliminary finding based on selected documentation and source files, **not** a verified implementation estimate or an approved architecture. Next step: owner-authorized Architecture phase focused on domain modeling, then a separately approved implementation plan/increment. No application code, existing session data or campaign files changed by this documentation.

## Unified Library, Writing and Preparation — accepted requirements — 2026-10-22

**Status:** Requirements accepted by the owner through Decisions 1–13 on 2026-10-22. Requirements phase closed; architecture review is next and is not yet approved or implemented. This section supersedes conflicting earlier Source/Draft selection, direct Source-to-Preparation and separate Prepare Sources/Drafts UX requirements. Existing runtime behavior and the accepted Playthrough P1–P8 plan remain unchanged pending architecture review. Preserve earlier sections as historical decision records rather than silently rewriting them.

### Goal and user-facing responsibilities

The DM has four coherent workspaces: **Library** discovers and manages available campaign cards; **Write** creates and enriches editable cards; **Prepare** selects and organizes frozen cards for a session; **Play** uses prepared cards and records actual play. Library is a dedicated navigation destination whose unified card discovery/search/filter capability is also available contextually in Write and Prepare. The same card should not be shown as competing Source and Draft entries, and the DM should not have to understand internal provenance to add a card. Reuse existing card presentation, full-document readers and session notes. A separate persistence-owning Library module is **not** a requirement; decide module composition during architecture.

**Source** denotes Markdown material captured from a registered campaign directory. **Draft** denotes a saved, editable authored card with its own revision/content, metadata and optional artwork. **PreparedItem** denotes session-specific frozen content. Maintain distinct lifecycle and authority concepts: metadata status, exact-revision approval for session use, and campaign canon/source authority. A session approval never confers campaign authority or writes Markdown to the repository.

### Accepted behavior (Decisions 1–13)

1. **Shared Library:** Provide one discoverable collection across Sources and saved Drafts, with a dedicated workspace and contextual selectors in Write/Prepare. Write edits; Prepare assembles; Play consumes frozen session items.
2. **Draft precedence:** When a Source and Draft are explicitly associated, display one Library card using Draft content, metadata and artwork. Keep original Source and provenance accessible from card details. Do not merge merely by matching title or path.
3. **Changed source:** Never overwrite a Draft from an external Source update. After detection, indicate changed Source and offer inspection/manual review/copying; selective merging is deferred.
4. **Export identity:** Markdown export preserves the logical card identity. After manual incorporation and Source refresh, recognize an exported Source as associated with its existing Draft and show one card; retain editable Draft and revision history. Report ambiguous/colliding identities, do not silently merge or infer canon status.
5. **Automatic Source-to-Draft:** On Add to session, reuse the associated Draft or automatically create a reusable Draft from the selected Source, then use the Draft path. One action for the DM, without mandatory navigation to Write. Avoid duplicate automatic Drafts across repeated use. Failed operations must not leave unexpected partial creations.
6. **Approval on addition:** Add captures the latest successfully saved Draft revision and explicitly approves that exact revision for session use. Unsaved edits must finish saving successfully or block the action visibly. No prerequisite independent approval screen in Write. Previously prepared versions remain frozen.
7. **Explicit prepared updates:** When a newer Draft revision exists, Prepare indicates an update and offers deliberate replacement of the frozen content. Preserve PreparedItem identity, preparation order and notes where valid. Never change already prepared cards automatically. Revalidate type/scene eligibility, frozen links and runtime state as appropriate; do not rewrite historical PlayNotes.
8. **Contextual access:** Library's shared collection and search/filter semantics are reused in both Write and Prepare, with workspace-specific presentation and actions rather than an enforced identical layout.
9. **Incomplete/legacy material:** All saved Drafts and Sources remain visible, including incomplete legacy Markdown. Clearly indicate missing/invalid required metadata. Block *new preparation* until essential metadata is valid; permit editing/saving incomplete Drafts. Artwork, summary and tags are optional. Automatically created Drafts from incomplete Sources guide the DM through completion; no separate legacy workflow.
10. **Delete fallback:** Deleting a working Draft leaves frozen PreparedItems, retained approved/exported revision history and PlayNotes intact. If an associated Source still exists, Library shows it again; otherwise the card disappears from Library. Do not alter repository files. Existing draft-delete safety guarantees remain applicable.
11. **Explicit refresh:** Continue using the captured Source library until the DM explicitly refreshes registered campaign files. Refresh reports changes and missing originals; no filesystem watching is required initially.
12. **Missing Source:** A Draft with a missing, moved or excluded original Source remains editable, preparable and exportable. Retain provenance and show Source unavailable. Restore the association if the original returns and identity can be established safely.
13. **Identity conflict:** Duplicate or ambiguous claimed logical identities are reported for explicit DM resolution. Do not merge or choose authority silently. Block newly preparing the affected identity until resolved; existing prepared snapshots and play history remain intact.

### Acceptance scenarios

- Browse one Library of mixed Source-only, draft-only and associated cards. Associated Source/Draft appears once; search, classification and selection remain consistent in the dedicated workspace and contextual selectors.
- Add a complete Source-only card once: a reusable Draft is created and its exact revision approved/frozen in the session. Add it to another session without creating a duplicate Draft. Saved changes in Write do not affect either existing frozen copy.
- Add an incomplete legacy Source: it remains findable, displays validation issues, and guides correction in Write before preparation. Missing optional artwork/summary/tags does not block preparation.
- Modify a Draft, return to Prepare, observe newer-version indication, and explicitly replace a prepared copy while retaining its identity, order and notes. Verify invalid scene/link effects are handled explicitly and historical notes remain unchanged.
- Export a Draft, manually add its Markdown to the campaign directory, refresh, and verify a single Library card associated by stable identity. Identity collisions never merge automatically and block affected new additions.
- Refresh changed/deleted Sources and verify drafts are neither overwritten nor removed; notifications distinguish changed from unavailable. Deleting an associated Draft restores the still-available Source; never changes frozen sessions.
- Exercise failed saves, incomplete additions, repeated/concurrent additions, revision conflicts, and campaign switching without partially created duplicates or cross-campaign mixing.

### Boundaries, compatibility and deferred work

- **Superseded for future redesign:** Direct Source capture as an independent Prepare pathway; the separate Sources and Drafts selection experience in Prepare; approval as a required separate Writing step before adding; automatic acceptance of invalid/unclassified legacy material into new sessions. Existing implementations remain until an approved implementation increment changes them.
- **Retained:** Sources capture/authority policy, source immutability and explicit refresh, Writing revision and deletion safeguards, manual Markdown export, immutable session snapshots until explicit replacement, image freezing, session notes, Playthroughs runtime ownership and historical note preservation.
- **Deferred:** Automatic file watching; automatic Source-to-Draft overwrite; selective document merges; implicit publication or canon adoption; new backend storage owned by Library without architectural justification.
- **Architecture questions, not further functional approvals:** Define logical card, Source/capture, Draft and PreparedItem identities and associations; export reidentification/collision resolution; the transaction and concurrency boundary of automatic Draft creation + approval + session addition; the exact semantics of prepared replacement for frozen relationship resolution, active scenes/focus and archives; public contracts and UI reuse. Reassess P4R frozen-link resolver, P6 resource history and P7 wider-library capture before revising P7/P8 plans. Do not reopen completed P1–P4 responsibilities without concrete evidence.



## Accepted unified-workspace UX refinement — 2026-10-23

The owner completed UX Decisions 1–27 (with Decisions 8/9 superseded and Decision 27 resolved as **no Create document action in Library**). The consolidated intended behavior, user journeys, failure states and revision/identity caveats are recorded in [Unified Library / Write / Prepare / Play UX design](unified-workspace-ux-design.md). This is a documentation-only requirements refinement, not an authorization to implement or enter planning. In particular, contextual Scene related cards will use **Preparation-owned session-specific associations** rather than authored frozen Markdown relationships; normal Library whole-card additions avoid duplicates without invalidating historical section captures or existing PreparedItem identities. Architecture review must reconcile existing contracts and accepted Playthrough behavior before any plan is changed.

**Subsequent architecture approval — 2026-10-23:** The owner approved the [unified-workspace architecture reconciliation](implementation-plan.md#unified-library--write--prepare--play--accepted-architecture-reconciliation--2026-10-23) and authorized its documentation. It records the resolved identity/association, atomic Add, Scene relationship, revision replacement, navigation and archive boundaries. Existing implementation and historical increment plans remain distinct from that target architecture; planning and implementation require separate authorization.


## Library / Write / Prepare visual simplification — accepted requirements — 2026-10-23

**Status:** Owner accepted the five UX stories and the recommendation that Library search include saved Drafts and incomplete documents by default. This is a scoped refinement of the [unified UX](unified-workspace-ux-design.md), informed by owner screenshots and inspection of the current Angular UI. Where this section differs from the earlier UX 10 decision to reuse the complete filters interface, **this later decision supersedes the visible-filter treatment**, not the underlying search/filter contracts. It does not authorize implementation or formal verification.

**Boundary:** Library, Write and Prepare only. Play is excluded from this initiative, as are P5 and later PlayNotes/history work, new AI behavior, new data models, backend search removal, database migrations, card-geometry redesign and campaign-content changes. Keep current P1–P4 behavior stable where shared components are involved.

### UX-01 — Compact, comprehensive Library search

**Story:** As a DM I can search all campaign documents in a compact, aligned toolbar without discovering hidden search modes or managing an oversized filter panel.

- Default search includes saved Drafts and incomplete documents, with clearly visible status/readiness in results; no separate **Search all** button or hidden second search scope. Preserve explicit conflict/incomplete diagnostics and safe Source/Draft precedence.
- Remove the visible **Filters** disclosure and advanced-filter controls from the simplified Library journey; do not delete backend filter support or unrelated consumers. Retain a compact type selector if it proves useful and can be aligned cleanly.
- One proportionate search input, consistently sized controls and aligned actions; keep independent results/reader scrolling and keyboard search. Ensure useful empty states and no surprise hiding of incomplete material.
- Verify full-text queries, Draft-only/incomplete/conflicting documents, clearing/searching, keyboard access, 1280×800, 1440×900 and narrow viewport layout.

#### UX-C3 — requirements clarification — 2026-10-23

**Status: ACCEPTED requirements clarification of UX-01.** Dedicated Library, Write contextual references and Prepare's unified picker share this simplified search behavior.

- Start with inclusive catalogue/search scope: all saved Drafts and captured Sources, including incomplete/unclassified, conflicting, guidance/tooling and superseded material. Preserve effective Draft precedence and campaign isolation. An associated Source becoming a Draft after Add must remain discoverable without changing search mode.
- Remove Search all, advanced Filters, active advanced-filter chips and the Play library shortcut from these simplified controls. Do not retain a hidden current/session restriction or obsolete Include drafts action/empty-state guidance. Preserve backend filter contracts and unrelated shared source-index behavior.
- Retain one compact type selector with **All types** as its default and an obvious way to return to that value. Selecting a type deliberately narrows results to documents with that recognized type; unclassified material remains available through All types. Keep this restriction visible.
- Provide one aligned search input and Search action, keyboard submission, and a clear-query action when text is present. Clearing text preserves the explicit type choice; selecting All types preserves the query. Search covers effective saved full content and never implies source refresh.
- Show saved metadata status when available and clear incomplete/conflict/preparation-readiness feedback in dedicated and contextual result rows. Broader visibility never makes an invalid, conflicting or non-session document preparable. Preserve reader diagnostics and authoritative backend checks.
- Preserve selected reading where supported, independent catalogue/reader scrolling, current-session destination and membership feedback, save/navigation guards and research return. Supporting-panel height/mode changes remain UX-C4.

**Acceptance:** Exercise default discovery and full-text search for Source-only, Draft-only, associated, incomplete/unclassified, conflicting, guidance/tooling and superseded entries; Source-to-Draft transition after Add; type selection/reset and query clearing; stale/failed operations and campaign switching; keyboard submission and search feedback. Review aligned controls, scrolling and overflow at 1280×800, 1440×900 and narrow widths in dedicated and contextual surfaces. Retain preparation safety, provenance, research return and saved/frozen revision behavior. Developer checks and separately authorized formal verification provide bounded evidence; owner visual acceptance remains separate.

**Exclusions:** Backend search/filter removal, persistence/API changes, UX-C4 panel refinements, broader visual redesign, general authored-link reconciliation, Play changes and campaign-content edits.

### UX-02 — Write supporting-panel clarity and full-height references

**Story:** As a DM I can switch my optional supporting area directly between **Preview** and **Library** without configuring it through a dropdown or losing the writing context.

- Replace the supporting-mode dropdown with obvious, compact Preview / Library tabs in the panel itself. Retain a single collapse/expand action; remove redundant View/hide controls for that same panel.
- Protect the editor's primary width and independently scrolling content; supporting Library references should use available vertical height, not the current `max-height: 220px` result-list cap. Preserve Preview's independent Card/Document mode.
- Preserve Write save/navigation guards and return context when opening a full reference in dedicated Library. Do not embed another full document editor/reader or invent a new panel system.
- Verify editor/panel scroll, mode switch, collapse/restore, reference selection and return, keyboard focus and laptop/narrow layouts.

### UX-03 — Retire the old Copy source expansion in Write

**Story:** As a DM I do not open an extra legacy source-browser column when I need existing material.

- Remove the visible **Copy source** toolbar action and its expanding legacy Source chooser from Write, along with orphaned UI state and duplication when safe.
- Preserve existing Draft creation/editing, contextual Library research and manual export; do not delete the underlying fork/copy capability without establishing whether it remains necessary elsewhere.
- If independent copying remains a real use case, investigate a separately approved Library-initiated action rather than silently changing the semantics of Edit or Add.
- Verify that existing Draft editing, associated-source editing, research return and export still work; remove dead UI only after checking callers.

#### UX-C2 — requirements clarification — 2026-10-23

**Status: ACCEPTED requirements clarification, grounded in the accepted [unified workspace UX decisions](unified-workspace-ux-design.md). Execution remains separately gated by the development workflow.**

- Retire the legacy **Copy source** toolbar action and expanding chooser. Remove `CampaignLibrary` and its template/styles only after a responsibility and caller audit confirms that each responsibility is obsolete or covered by unified Library. Remove orphaned imports, bindings, handlers and navigation paths within this scope.
- Retire the legacy Library **Related cards** list; do not migrate it or introduce a replacement panel or Source reader. Scene-to-card associations are session-specific, managed exclusively in Prepare, and consumed contextually in Play. Library has no relationship-management responsibility. Ordinary Markdown hyperlinks remain document-navigation links and do not create Scene associations.
- Preserve Markdown document/section navigation and visible missing-link feedback for broken targets in Library. Retiring the legacy reader must not remove that feedback. This does not authorize general authored-link identity reconciliation (UX-C7).
- Preserve shared source-index loading/state, source-derived tag suggestions, preview capture checks and rechecking, save/navigation guards, recovery, contextual research and Return to Write behavior. Remove chooser-only state only after tracing its consumers; names such as source-index or source notice do not establish that code is obsolete.
- Preserve new Draft creation, existing and associated-source Draft editing, manual export, retained provenance and recovery behavior. Retain the underlying fork/copy API and supported domain operations; no replacement independent-copy action is included.

**Acceptance criteria:**

1. Write has no Copy source action, expanding legacy chooser or reachable obsolete Source-reader path. The retired component has no remaining consumers, imports or template references before deletion.
2. Dedicated/contextual Library still supports browsing/research and full-document navigation, including document and section links and visible feedback for unavailable targets. No legacy Related cards list or replacement relationship panel is introduced.
3. Create/edit, associated-source editing, source-derived suggestions, preview/capture checks, save failures/guards, research return, export and recovery retain their supported behavior. Update browser journeys that currently use Copy source while preserving meaningful provenance/export coverage.
4. Relevant frontend checks/build and browser regressions pass; inspect imports, bindings and navigation callers for dead references. Developer evidence is distinct from separately authorized formal verification and owner acceptance.

**Exclusions:** UX-C3 search defaults, UX-C4 support-panel redesign, UX-C6 direct-add API retirement, UX-C7 general authored-link reconciliation, backend fork removal, relationship-management changes, archive changes and campaign-content edits.

### UX-04 — One Prepare Add material journey

**Story:** As a DM I click **Add material** and reach the unified Library for my explicitly selected session, rather than an old Sources-versus-Drafts menu.

- Route the existing Add material action directly into the accepted unified session Library picker; remove old Sources/Drafts menu entries, duplicate material tabs and chooser surfaces where no longer required.
- Preserve session/campaign selection, existing prepared content, selected card/notes, Scene planning, update-available state, explicit same-type replacement, whole-card deduplication and valid historical/section captures.
- Inspection does not add or replace content. Closing or failing the picker restores preparation context; late responses must not change another destination.
- Before retiring legacy components, inspect their callers for unique section/adventure/source-copy functions and retain or migrate required capabilities explicitly; do not silently remove them.
- Verify new/existing session, success/failure, duplicates, revisions, session switching, selection preservation and responsive layout.

#### UX-C1 — accepted product clarification — 2026-10-23

The owner explicitly discontinued section capture in the intended Prepare workflow and authorized this requirements update and investigation of the smallest coherent design. These decisions supersede earlier requirements to expose new section capture or retain legacy Prepare Source/Draft navigation. They do not authorize implementation; architecture proposals remain subject to approval.

- **Single selection interface:** Add material opens the unified Library directly. Remove the legacy Sources/Drafts menu, redundant chooser surfaces and secondary legacy Source reader from Prepare. Other Prepare addition entry points use the same unified journey.
- **Complete cards:** New preparation operates on complete cards. No section-capture action is offered. Individual Markdown sections remain readable through the existing full-document reader and heading navigation. Existing section-based PreparedItems remain intact and readable; this decision does not migrate or delete saved data.
- **Adventure assembly:** Preserve explicit selection of an Adventure and its linked Scenes within the unified Library. Reuse existing domain operations where suitable; do not preserve a legacy Source browser to provide this capability. Assembly adds complete cards and does not implicitly create Scene-planning relationships.
- **Explicit destination:** Without a selected session, use existing explicit session selection/creation before adding. Cancelling selection/creation adds nothing. Never infer or silently change the destination.
- **Context and asynchronous safety:** Preserve selected prepared content, notes scope and Scene-planning context while inspecting/closing the Library or recovering a failure. Validate campaign/session and active interaction across asynchronous saves, additions and refreshes. Closing or destroying a picker invalidates pending UI callbacks; already-dispatched operations remain bound to their original destination, and uncertain outcomes require safe reconciliation before retry.
- **Retained behavior:** Preserve existing session data, frozen complete-card contents, Source/Draft precedence, exact saved-revision approval, explicit replacement, duplicate prevention, session-specific Scene relationships and archive/recovery behavior. No campaign-source writes or Play redesign.
- **Deletion discipline:** Remove obsolete UI/state only after checking callers. Shared Write source-copy behavior and backend operations with remaining consumers are separate from retiring Prepare interfaces; compatibility alone is not a reason to retain obsolete Prepare UI.

**Completion evidence required:** Check Add material with existing/new/no session and cancellation; complete Source-only/Draft/associated-card addition; Adventure/Scene selection in Library; duplicate and newer-revision handling; partial failure/retry and uncertain outcomes; campaign/session switching and picker close during delayed work; retained selection/notes/Scene planning; reading historical section items; heading navigation without new section capture; keyboard access and laptop/narrow layouts. Adventure target-resolution and batch failure semantics are architecture proposals to be presented for owner approval before planning.

### UX-05 — Shared visual consistency and regression pass

**Story:** As a DM I encounter coherent control hierarchy, alignment, spacing, accessible feedback and predictable navigation across Library, Write and Prepare.

- Standardize search/control dimensions and spacing using existing shared styles/components; prioritize primary actions and reduce redundant controls without introducing a new design system.
- Verify disabled/saved/error states, keyboard navigation and focus, independent scrolling, panel density and no horizontal overflow at 1280×800, 1440×900 and narrow viewports.
- Review actual rendered screenshots with the owner; automated geometry tests alone do not establish visual acceptance.
- Preserve the shared PlayingCard 243:420 geometry, 320px default, full-card artwork and bottom parchment panel, and all existing frozen-content/recovery behavior.

#### UX-C5 — accepted bounded visual refinement — 2026-10-23

The owner approved dark green text and focus indicators on Write's parchment editor and Prepare's light panels; filled-button emphasis for Library's Add to session action while Edit and destination selection stay secondary; and distinct Library error/success feedback through color, border and spacing, retaining existing messages and accessibility roles. Preserve layout, shared card geometry, save/navigation guards and state ownership. Scope shared-style effects to Library, Write and Prepare; Play presentation remains unchanged. No new components, dependencies or backend changes.

Acceptance: inspect actual rendered control/focus contrast and error/success/disabled/saved feedback, keyboard access, independent scrolling and no horizontal overflow at 1280×800, 1440×900 and a narrow viewport. Run relevant regressions and separately authorized formal verification; present screenshots for owner visual acceptance. Automated checks do not grant aesthetic acceptance.

**Source-grounded visual observations:** Owner screenshots show oversized/misaligned search controls, shortened reference results, dropdown-based support selection and old Add material routing. Targeted source inspection found `library-filters.ts` still renders Search all/Filters, `library-references.ts` caps results at 220px, `writing-workspace.html` renders Copy source and the supporting dropdown, and `preparation/workspace.html` retains Sources/Drafts selection alongside unified Library. These are implementation investigation leads, not evidence that all old code is safe to delete.

**Not yet decided / preserve existing behavior:** Whether to relocate the independent Source fork action is not a requirement to implement it now. Retain existing APIs and archive semantics. Do not conflate simplified default Library search with indiscriminate disclosure of private or invalid data; continue existing campaign isolation and safe diagnostic presentation.

**Approval boundary:** These product requirements are accepted. Increment sequence and completion checks may be documented as a proposed handoff, but architecture decisions, plan acceptance, execution of each increment and formal verification retain their separate harness gates.

### UX-C6 — accepted legacy direct-add retirement requirements — 2026-10-24

The owner approved these requirements after the direct-add consumer investigation. They supersede earlier API-retention guidance only for the two legacy session-add HTTP operations identified here; independent Source fork/export and historical prepared-content support remain unchanged.

- Retire `POST /api/campaigns/{campaign}/sessions/{id}/sources` and `POST /api/campaigns/{campaign}/sessions/{id}/drafts`. Supported new additions continue through unified Library Add.
- Remove unused frontend direct-add methods, queue state and queue-specific guards while preserving active save/navigation protections.
- Preserve the internal Draft-freezing operation used by unified Library Add, including exact saved-revision retention and transactional membership ownership.
- Migrate test fixtures without losing historical section, duplicate-card, frozen-content and archive coverage. Retirement must not remove or rewrite existing prepared items.
- Preserve current Library Add/replacement behavior, campaign isolation, module ownership, historical reading and session import/export. Regenerate the API client and pass relevant backend, frontend and browser checks.
- Exclude persistence migrations, archive-format changes, campaign-content edits and UX-C7 authored-link reconciliation.

Architecture and the concrete bounded implementation plan require their own approval. Execution authorization remains in the conversation.

### UX-C7 — accepted authored-link reconciliation requirements — 2026-10-24

Following investigation with temporary fixtures, the owner approved the following behavior. Library currently represents an associated Source/Draft as one card while authored-link checks count both paths as competing documents; moving the Draft placement can also make heading checks inspect Source content while Library opens the effective Draft. These requirements correct that inconsistency without changing association authority.

- Resolve in-app authored links through unified card identity, using the effective Draft and its headings when one exists. An explicitly associated Source and Draft are one target, including supported Source-path and Draft-placement locators. Do not infer association from path, title, hash or independent-copy provenance.
- Preserve genuine competing identity/path claims as conflicts; never choose an arbitrary claimant. Preserve safe URI handling, missing-document/heading feedback, campaign isolation and Draft-only/self navigation.
- Keep export warnings accurate about campaign files and headings still requiring export/incorporation. Successful in-app navigation does not establish that a portable Markdown link already works in the captured campaign files. Preserve authored body bytes, manual incorporation and explicit warning acknowledgement.
- Track resolved target revisions so changing an associated target invalidates an export inspection even when its Draft placement differs from the linked Source path.
- Pin new preparation approvals to exact resolved target revisions. Preserve existing approved revisions, export artifacts, frozen sessions and historical link evidence; do not reinterpret or rewrite retained history.

Required evidence includes associated typed/untyped Source/Draft pairs, true identity/path collisions, moved Draft placement, Draft-only/self links, heading navigation, export warnings and stale reports, future exact-revision freezing, and historical session/Writing recovery regressions. The consequential resolver architecture and bounded implementation plan retain their own approval gates. All-stage execution authorization is recorded in the conversation.

## Play tabletop — accepted requirements reconciliation — 2026-10-24

**Status: ACCEPTED.** The owner approved reconciliation of the [reviewed tabletop UX](play-tabletop-ux-design.md) with Q10f–Q10x and the remaining P5–P8 requirements. This defines future behavior; existing implementation and historical verification remain unchanged. Architecture, bounded implementation plans and execution retain their separate approval gates.

### Placement, Scene transitions and inspection

- Exactly one runtime location per prepared item: ordered Session Cards, Pile 1, Pile 2, Used, or the reserved active Scene slot. The two named runtime piles have ordered unique membership and a displayed cover. This replaces the overlapping Active/Used plus three-independent-focus presentation in Q10f.
- Only Activate/Change Scene or Deactivate Scene changes the reserved slot. An active Scene cannot be dragged, marked Used or displaced by ordinary movement. Preparation remains authoritative for membership: removing the prepared Scene clears the slot.
- Scene activation/change offers Keep current piles or explicit customization of existing and incoming related cards. Confirmation applies the Scene change and selected movements atomically; cancellation changes nothing. Keep current piles removes the incoming Scene from its former location if necessary and discloses that exception. No automatic pile population or clearing. The previous Scene returns to the front of Session Cards.
- Related cards come exclusively from Preparation-owned session Scene associations, in preparation order. Inspection does not edit associations or add membership; normal Markdown links remain reader navigation.
- Cards returned from piles or Used go to the front of Session Cards; newly prepared cards also enter at the front. Initial Session Cards follow preparation order. Closed-pile drops append; open piles support precise reorder. When a cover leaves, choose the next surviving ordered card, wrapping to the first; an empty pile has no cover.
- Read opens the existing frozen Markdown reader in the right Notes/Document panel. Reading, choosing a pile cover and switching panel modes never move cards, activate a Scene or change a note's primary association. Pile Show all uses a separate temporary overlay. These replace Q10i's fourth-card/focus-replacement interaction and Q10s's expanded-focus treatment.
- Search/type filters narrow Session Cards and Used, retaining the selected document. Tabletop covers and opened pile contents remain visible and unfiltered, allowing precise pile movement/reorder. No additional global inventory duplicates assigned cards.
- Every drag operation has an accessible menu/button equivalent. Invalid/cancelled drops do not mutate state. Retain the shared 243:420 renderer, frozen artwork, heading-aware reader and usable independently scrolling layouts at 1280×800, 1440×900 and narrow widths.

### Continuity, notes and remaining capabilities

- Reopening restores active Scene, unique placements, pile order, optional names and covers; Play → Prepare → Play preserves committed tabletop state. Temporary overlays, drag state, panel mode and document selection need not persist. This supersedes Q10r/Q10w's focused-card restoration. Removal prunes only the removed item's placement, clears a removed active Scene and advances an affected cover without disturbing other placements or historical notes (Q10x).
- Notes is the default panel mode on Play entry. Before P5, it exposes existing Preparation notes read-only. P5 adds independent PlayNotes capture/history; Preparation notes remain distinct contextual references. Switching Notes/Document or interacting with the tabletop preserves unsubmitted note text and association context.
- P5 retains independent note revisions, immutable creation chronology, pinning, one optional explicit primary resource, server-captured Scene/resource evidence, expected-Scene checks, idempotent creation and originating-session safety. Scene changes do not rewrite existing notes; creating under changed Scene context requires explicit conflict recovery with text retained.
- Revised P7 reuses unified Library inspection and the supported atomic whole-card Add. Inspection alone changes no placement or Scene. Successful explicit Add targets the originating session and reconciles new membership into Session Cards without altering piles or Scene. Already-prepared entries retain their placement. Unavailable historical Markdown targets never silently become current Library content. The old P4R unprepared-suggestion completion dependency is superseded because contextual Scene associations only target already-prepared items.
- P6 retains separate campaign-scoped primary-resource and captured-Scene history queries, stable identity and chronology, with no duplicated note storage or title/path-based merging. P8 assesses the reconciled placement/Scene/panel behavior alongside Library access, notes/history and existing integration requirements.
- Every increment introducing persisted state includes complete current-format archive validation, reference remapping and round trips. Preserve independent revisions, save failure/retry/discard/navigation guards, campaign isolation and frozen content. Historical artifacts remain disposable under the existing policy; no reset is authorized here.

Exclusions remain unchanged: no combat automation, extra piles, card backs, freeform canvas, discovery/world-state engine, authored Scene relationship editing in Play, automatic source changes, mandatory review or new AI behavior.

**Delivery priority approved in the reconciliation:** tabletop foundation and UI, then P5, revised P7, P6 and P8. This is ordering direction, not an accepted detailed increment plan or implementation authorization.

## Flippable cards — accepted requirements — 2026-10-24

**Status: ACCEPTED, including refinements.** The owner approved the original requirements following investigation, then approved scroll-free fronts, the detailed flip animation and overflow handling below. This supersedes the tabletop reconciliation's exclusion of card backs and the existing scrollable-front presentation; other exclusions remain. Architecture and subsequent phases retain their separate approval gates.

- Each card has optional separately authored plain-text back text, with line breaks, independent of its summary and Markdown body. Existing cards have an empty back.
- Both sides retain the existing card dimensions and have no internal scrolling, automatic truncation or automatic font shrinking. The front's title, type, summary and tags must fit alongside its controls. The back uses its available area for plain text plus a flip control, without artwork. Preserve text during editing and show a clear fit warning. Fit must account for consistent typography and usable card sizes; a character limit alone is insufficient.
- Every full card representation supports an explicit flip control on either side, including contextual Library references, Writing recovery and all Play locations. Thumbnails and catalogue rows remain unchanged. Flipping does not open the document, select or move a card, activate a Scene or change note context.
- Newly opened views show the front. Orientation is temporary and is not persisted across application restarts. Reset to the front when displayed content changes, selection changes, a view reopens or the card moves between Play locations. Unrelated note saves, filters and workspace updates do not reset a card being read.
- Back text belongs to the card revision. Markdown export and Source capture preserve it; preparation freezes it; explicit revision replacement updates it. Session archives and Writing recovery retain it independently of live campaign files.
- Preserve the illustrated front, authored summary and full-document reader. Back text is not interpreted as rich Markdown.
- Deliberate flips have a small visual animation.

### Accepted fit, animation and historical-content refinements

- Extend the approved back-fit approval gate to both sides: allow saving and exporting oversized working Drafts with visible fit feedback, but block new session addition or explicit prepared replacement until both sides fit. Reuse of an already-prepared card does not become a blocked new addition.
- Use a brief vertical-axis flip, approximately 200–250 ms, without changing surrounding layout. Respect reduced-motion preferences with an immediate side change. Automatic resets to the front happen immediately.
- Existing frozen prepared cards remain usable and are never automatically rewritten, shortened, removed or replaced. If a side cannot fit, show a clear non-fitting-side state with an action to read all of that side's text outside the card, rather than showing clipped text. The front fallback must expose title, type, summary and every tag; the back fallback must expose all back text. Do not assume the existing full-document reader includes these fields. The external reading surface may scroll; neither card side may scroll. Retain flipping and existing Play actions. Correcting a working Draft affects the frozen card only through explicit replacement, which must satisfy both-side fit.
- Apply the same non-fitting-side state to oversized working previews, captured Sources and historical recovery previews, retaining their existing editability and authority restrictions.

Acceptance evidence must cover flipping in every full card representation, no internal scrolling on either side, the specified resets, animation and reduced motion, keyboard access, overflow feedback without lost text, and preservation through save/reload, export/capture, preparation, replacement, session archives and Writing recovery. Include oversized historical cards and complete external access to front metadata and back text. Architecture must resolve how fit is enforced consistently across session-addition paths and card sizes.
