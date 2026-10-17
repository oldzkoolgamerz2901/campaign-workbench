# Campaign Workbench — Product specification

Date: 2026-10-17

Status: Requirements approved by the owner on 2026-10-17, with subsequent accepted revisions for local laptop operation, direct campaign-folder access, and multiple campaigns. Outstanding decisions remain explicit. Architectural proposals and implementation plans require their own approval; this specification does not authorize implementation.

## Purpose and audience

The app supports two main activities: **preparing a session** and **playing a session**. Assisted creation is part of preparation and is optionally available during play.

The accepted application name is **Campaign Workbench**, with repository name `campaign-workbench` and local target `/Users/huibvanstraten/campaign-workbench/`. This is separate from the Sea Witch campaign repository. Repository creation and application-document transfer are covered by setup increment 0; campaign-content migration is excluded.

The app serves a DM preparing and playing any registered campaign. The first version supports multiple campaign folders and one selected campaign at a time. Sea Witch is an initial example, not a required campaign structure. The DM operates the app; players receive material deliberately displayed or exported by the DM. Player accounts and a player portal are excluded initially.

Markdown in independent campaign directories remains the authority for campaign content. The application monorepo is separate from those directories. The local backend reads a selected directory directly and detects source changes; prepared content remains pinned until the DM accepts updates. The database owns application state, drafts, playthrough records, and prepared snapshots. The app does not automatically rewrite campaign files.

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

Given a session objective, assisted creation can adapt existing material and draft missing scenes, NPC interactions, clues, and handouts. Broader campaign development is outside the initial scope.

Context includes the objective, selected sources, designated campaign canon, revelation rules, and recorded discoveries. Outputs cite sources, identify conflicts, and distinguish invented additions from source-supported material. Citations and automated checks assist review; they do not guarantee correctness.

Acceptance:

- The DM can request an adaptation or missing piece for a session.
- Source-supported claims have traceable references; newly invented content is labeled.
- Selected revelation restrictions and recorded discovery context are available to the generation process.
- Outputs remain reviewable drafts and are not automatically published or adopted as canon.

### R4 — Draft approval and export

Generated material remains a session draft until the DM approves it. Approval makes it usable in the session; adopting it as campaign canon is a separate decision. Approved content can be exported as Markdown for manual incorporation into the repository.

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

Sessions support draft, ready, in play, and completed states and can be reopened. Completion offers a review of notes, discoveries, and unresolved threads. States organize work rather than constrain narrative order.

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

Provider selection and associated data handling terms remain unresolved.

### R14 — Explicit generation and spending controls

Each generation requires an explicit action. There is no background generation. Usage is visible where available, and a configurable spending limit constrains generation. Reaching the limit or losing AI access leaves existing preparation and play usable.

Acceptance:

- No generation starts solely because content is opened, edited, or refreshed.
- Generation is blocked when the configured spending limit is reached.
- Usage display distinguishes available usage information from estimates or unavailable information.
- AI failure or spending limits do not remove access to existing material or manual recording.

Provider accounting capabilities, limit enforcement semantics, and the actual budget require resolution before this requirement can be finalized for implementation.

### R15 — Campaign registration and isolation

The DM can register multiple independent campaign directories and switch the selected campaign. Selection does not merge sources, drafts, sessions, classifications, or playthrough records. A campaign does not require Sea Witch's folder structure or terminology.

Acceptance:

- Register two differently structured campaign directories and switch between them.
- Each campaign retains its own sources, authority assignments, prepared sessions, drafts, and journal records.
- Search and AI context are scoped to the selected campaign; campaign switching cannot silently apply an outstanding save or generation result to another campaign.
- Selecting or reopening a campaign does not rewrite its Markdown.

Supporting multiple concurrent groups or playthroughs of one campaign is not established by this requirement and remains deferred.

## Evaluation scenario

Proposed review scenario: prepare and run the Agelus investigation from Tordeck's chest through the monastery, using linked scenes, NPC context, clues, handouts, assisted creation, and discovery records.

This scenario is grounded in existing material and was recommended during discussion, but was not explicitly selected by the owner. Confirm it or choose another representative session before treating it as the acceptance scenario.

Campaign independence also requires a second, differently structured campaign fixture with no Sea Witch-specific conventions.

## Initial exclusions

- Multiple concurrent DMs or groups sharing application state.
- Player accounts, a hosted player portal, and automatic cross-device synchronization.
- Automatic repository edits or automatic canon adoption.
- Unattended generation or automatic application of AI-interpreted outcomes.
- General campaign authoring beyond session preparation.
- A full virtual tabletop, tactical combat engine, or autonomous world simulation.
- Tablet delivery in the first increments.

Ship accounting, interactive maps, and comprehensive automated consistency audits remain assessment opportunities, not committed first-version requirements.

## Outstanding decisions and limits

- Confirm the representative evaluation session.
- Select an AI provider and model, acceptable provider data handling, and a spending budget; settle how the limit is measured and enforced.
- Establish laptop browser targets and local startup/distribution expectations.
- PostgreSQL runs locally through Docker Compose; backup/restore behavior remains to be resolved before affected architecture decisions.
- Application repository name and location are agreed above. Setup increment 0 covers repository creation and transfer of application design documents; no campaign-content migration is authorized.
- Designate initial source authority and reconcile relevant conflicts; the app must not silently settle these.
- Enter current playthrough state manually; repository prose is insufficient evidence for actual player discoveries.

These items remain explicit rather than assumed. This document selects no technology stack, implementation increments, or deployment design.
