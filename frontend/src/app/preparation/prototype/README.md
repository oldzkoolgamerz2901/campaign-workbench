# Disposable preparation and reader studies

## Current review: complete A/B session workflow

Run `npm run prototype:preparation` from `frontend/`, then open:

- [A — prepare with the library desk](http://127.0.0.1:4200/?prototype=preparation&study=reader&variant=A)
- [B — read the prepared session](http://127.0.0.1:4200/?prototype=preparation&study=reader&variant=B)

Owner decision: **B is selected as the production layout direction**, including its grouped library toolbar/shelf during browsing and focused folio during reading. This supersedes the earlier recommendation to combine A for assembly with B for reading. Both study URLs remain available as disposable references. The proposed production increments 3C.1–3C.3 are recorded in `docs/implementation-plan.md`; 3C.1 now has a separate production implementation and developer-check record there. This prototype remains a disposable reference and is not imported by production components.

Question: can campaign/session selection, repeated source additions, and focused reading fit together without losing the current compilation or crowding long content?

The shared header selects a campaign and opens **Sessions / New session**. The default Sea Witch campaign uses static copies of ten migrated draft files: Thomas's crew reference, Arrival Hall, the Agelus overview, and all seven extracted scenes. **Inspect migrated Markdown** exposes each complete copied file. `reader-migrated-fixtures.ts` contains those snapshots and their original document hashes; no live files are read. Fixture summaries and section disclosure are explicit study choices. The earlier pre-migration comparison fixtures remain as historical study material and are no longer the reader's dataset.

Try this journey:

1. Open **Sessions / New session**, create a session with a title and optional objective.
2. Open the Agelus adventure, choose **Add adventure…**, and select two scenes. The overview and checked scenes enter **Session contents**; the library remains open at the same source. Related cards can be opened without adding them.
3. Add Thomas's document or one section. Reorder and remove entries in Session contents. Each addition creates a separate in-memory copy; repeated additions are allowed.
4. Select a prepared entry and show notes. Write item and session notes. Item notes belong to the selected prepared copy, including when the same source is added twice; browsing a source does not create item notes.
5. Choose **Read session**. B hides the library and opens the same ordered material and notes on facing pages. Related navigation uses only whole-document copies already in this session; an unavailable target reports that it was not captured. **Return to Prepare** retains selection and notes; **Browse source library** resumes the source you were browsing.
6. Reopen another session, then return. Switch campaigns and back: each keeps its own sessions in memory. The Hollow Marches campaign supplies guidance, legacy/invalid metadata, a hidden `silver heron` search match, and table/long-token stress fixtures.
7. Collapse contents, notes, or library to compare reading space. **Show document outline** opens headings inside the reader, separately from Session contents. The floating arrows compare A/B presentation while preserving the current mode and state; Prepare/Read actions select A/B respectively. Editor arrow keys remain editing keys.

All mutations are disposable and reset on refresh. There are no API/database calls, archive operations, save-failure simulation, campaign registration/rule editing, real snapshot persistence, or production link resolution in this extension. No separate compile/publish step is introduced. Markdown rendering is a limited offline fixture renderer; headings nested within a selected top-level section remain together. Guidance is available only in the invented dataset and cannot be added. This preview does not activate Sea Witch's source-exclusion rules in the application.

Production uses the existing no-op loader; this study, its data, and its switcher remain excluded from production output. This experiment is separate from production increment 3C. The sections below record earlier study stages and are historical where they describe C, pre-migration copies, or additions without a session builder.

Developer/design checks at 1280×800 and 1440×900 passed the journey above, including campaign isolation, empty-session behavior, unavailable prepared links, hidden-search-match reveal, panel collapse, table/long-token display, editor arrow keys, and refresh reset. No page overflow, runtime errors or API calls were observed. Development and production builds pass; final production JavaScript contains no study markers or fixture text. All ten raw fixture copies and document hashes match the migrated files, with body sections preserved in source order. Disposable component style-budget warnings remain; production budgets were not changed. These are prototype checks, not formal verification. Recommendation for review: A for assembly, with notes initially collapsed; B for reading, with its library shelf hidden.

### Feedback iteration: search placement and 30–50 session entries

The shared library toolbar now groups campaign-wide search, category tabs, result count, and a **Filters** disclosure for tags. Active tags remain visible as removable chips when the disclosure is closed. Search all content retains the typed query and clears category/tag restrictions. A places the toolbar above its results/reader area; B places it above the horizontal result shelf. The toolbar disappears with the library during session reading. The result list uses quieter separators and a clear selected state rather than a stack of boxed controls.

Open **Sessions / New session → Long session · 40 items** to review density. It intentionally contains the ten documents and thirty section captures from them, with overlap for layout stress testing. Session contents now has its own fixed heading/search and independently scrolling compact numbered rows. **Find in session** filters titles without changing order, selection, notes, or source-library filters; numbers retain their positions in the full compilation. Section rows lead with the section name and show the source document below. Full titles remain in accessible labels/tooltips. Reorder/remove controls appear on the selected entry during preparation. Clearing the session search brings the selected entry into view.

Follow-up Chromium checks at both laptop sizes exercised tag filtering/removal, all earlier session flows, the 40-entry list, finding/selecting entry 40, original numbering, empty session-filter results without changing the reader, restoring the selected entry, and adding ten more captures to reach 50 before reading. No page overflow, runtime errors or API requests were observed. Development and production builds pass; final production JavaScript inspection confirms that study controls, density fixtures and campaign text are excluded. `git diff --check` passes. Prototype library/session navigation styles are separated from reader/layout styles, without changing build budgets. This remains a disposable design iteration; it does not approve new production controls or 3C.

## Earlier increment 2 visual design study

Question: which atmospheric layout best supports finding, ordering, reading, and annotating session material?

From `frontend/`, run `npm run prototype:preparation`, then open:

- A, the writing desk: http://127.0.0.1:4200/?prototype=preparation&variant=A
- B, the session folio: http://127.0.0.1:4200/?prototype=preparation&variant=B
- C, the scene board: http://127.0.0.1:4200/?prototype=preparation&variant=C

The experiment uses the existing root view so the shell/library/preparation relationship can be compared. The normal application remains at `/`. The floating bar and arrow keys cycle variants; arrow keys inside inputs/editors retain their normal behavior. Selection, ordering, notes, source addition, and simulated save failures use in-memory sample state. Refreshing resets it. The state strip identifies the selected item, number of items, and simulated save state.

Use Source library/Add material to add sample content, edit item/session notes, and try the simulated save-failure checkbox and Retry. Export only describes the proposed contents; no file or record is created. Markdown preview supports sample headings and bullets only. These are visual/interaction sketches, not production implementations of autosave, export/import, or source snapshots. Sample content is invented and independent of real campaign repositories. No API requests, filesystem reads, database writes, external assets, or network fonts are involved in the study.

Production uses a no-op loader through Angular file replacement; the prototype component and switcher are excluded from production bundles. The owner selected A for preparation and B for reading the same prepared session; C is not selected. Production integration and cleanup/preservation require the owner's approved implementation scope. No prototype branch or commit has been created.

## Increment 3 disposable reader study

Authorized standalone design experiment, separate from production increment 3C. The original preparation variants remain available at the links above.

Use the same command/server, then open `http://127.0.0.1:4200/?prototype=preparation&study=reader&variant=A` (change `variant` to B or C, or use the floating arrows).

- A: library desk, persistent category/results rail, heading outline, source and notes.
- B: source folio, horizontal library shelf above facing source/notes pages. Hide the library to recover vertical space.
- C: outline-led source reading, overlay library drawer, notes below the source. Choose a result to dismiss the drawer.

Question: which arrangement makes long content usable while keeping essential scene information visible? The shared invented fixtures include a 1,660-word scene, short NPC, multi-scene adventure, guidance, and legacy/invalid metadata. Long records are deliberately repetitive stress content, not an editorial preservation example.

Review at 1280×800 and 1440×900:

1. Read the quick reference and mechanics; use the outline to open Keeper records. Unknown sections and legacy content stay visible.
2. Search `silver heron`, select the result, and confirm its collapsed background opens and receives focus. Search all clears category/tag restrictions.
3. Toggle full text, section focus, library, outline, and notes. Open the final section to inspect table/code scrolling and long-token wrapping.
4. Find Mara's motivation, follow related cards without adding them, browse guidance/issues, and try the adventure's explicit sample scene choice.
5. Edit notes and switch variants; selection, notes, filters, disclosure and sample additions remain in memory. Refresh resets them.

Limitations: the fixtures are structured sections rather than a Markdown parser. Section roles are explicit fixture values, not a proposed automatic heading classifier. Captures and adventure choices are simulated; no actual save, API, database, archive, frozen-link resolution, or production state is exercised. The folio uses the same sample library to permit comparisons; it is not evidence for production captured-link behavior. Ordinary body search highlights matching paragraphs. Tables and code are synthetic overflow fixtures. The existing development-only loader excludes this entire study from production output.

Initial checks: development and production builds pass; Chromium at both laptop sizes found no page overflow in all three initial/collapsed layouts, and revealed/focused the hidden background match. No page errors or API requests occurred. Production JavaScript contains none of the study markers. Angular reports style-budget warnings for disposable components; budgets were not changed. These are design/developer checks, not formal verification or owner approval.

Recommendation for review: A supports repeated browsing, but four visible columns constrain source width. B retains the accepted facing-page reading direction; its library shelf consumes substantial height until hidden. C gives long source text the strongest focus, at the cost of hiding results and moving notes below the text. Consider A for browsing and B with the library hidden for session reading; borrow C's focus affordance. Owner layout review remains outstanding and does not authorize 3C.

### A/B review with existing Markdown — 2026-10-18

The owner rejected C and authorized extending the study with the small Thomas crew profile, Arrival Hall, and one extracted Agelus scene. The reader switcher now cycles A/B only; old `variant=C` reader URLs fall back to A. The original increment 2 preparation study is unchanged.

The default reader dataset is now **Existing Sea Witch Markdown**. The Review content selector can return to the invented stress fixtures. No runtime campaign access or API calls are introduced: `reader-campaign-fixtures.ts` contains read-only copies taken for this disposable review. Those copies are excluded from production through the existing loader replacement.

Examples:

- Thomas Haggerty — Crew Reference: complete small crew profile; normalize topic headings without changing prose. Consolidation with the main NPC profile remains unresolved.
- Arrival Hall: complete scene; normalize heading hierarchy. Original Purpose, DM Notes, and Future Callbacks are explicitly marked as collapsible in fixture data. Pacing, player answers, atmosphere TODO, and Thomas's dialogue remain visible. The TODO is unresolved.
- The Island That Remembers: complete Scene 4 subtree from Agelus Trail. All twelve topics remain visible, including fallback clues and alternate routes.
- Agelus Trail — Overview: proposed copy retaining the original introduction and all non-scene campaign-level sections. Adds a link to the one extracted review scene. Other scenes have not been copied as independent cards.

Every example exposes **Review original and proposed Markdown**. Original shows the full source file, including all seven scenes for Agelus. Proposed shows illustrative draft metadata and normalized heading structure; these are proposals, not accepted campaign edits or classifications. Collapsible section treatment is explicit study data and is not a production classifier. Read-aloud, lists, emphasis and subordinate headings use a limited offline renderer; this is not the backend Markdown renderer. Overview Markdown links are inspectable in raw text; the related-card controls provide study navigation.

The adventure chooser includes the overview and lets the owner explicitly select the island scene. Opening the related scene does not add it. The additions list remains a simulation, not a complete session builder or frozen-link implementation.

Developer/design checks: development and production builds pass. Chromium reviewed all three examples in A/B at 1280×800 and 1440×900 without page overflow, runtime errors, or API requests; search reveal, overview-only addition, and related navigation without capture passed. Exact original-copy comparison and non-heading prose comparison passed for Thomas, Arrival Hall, and the extracted island scene. Production JavaScript contains no real-campaign study markers. Existing disposable style-budget warnings remain; budgets were not relaxed. No campaign files, database state, or production components were changed. Owner review and 3C authorization remain outstanding.
