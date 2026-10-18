# Increment 2 visual design study — disposable

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
