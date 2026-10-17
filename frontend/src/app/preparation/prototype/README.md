# Increment 2 visual design study — disposable

Question: which atmospheric layout best supports finding, ordering, reading, and annotating session material?

From `frontend/`, run `npm run prototype:preparation`, then open:

- A, the writing desk: http://127.0.0.1:4200/?prototype=preparation&variant=A
- B, the session folio: http://127.0.0.1:4200/?prototype=preparation&variant=B
- C, the scene board: http://127.0.0.1:4200/?prototype=preparation&variant=C

The experiment uses the existing root view so the shell/library/preparation relationship can be compared. The normal application remains at `/`. The floating bar and arrow keys cycle variants; arrow keys inside inputs/editors retain their normal behavior. Selection, ordering, notes, source addition, and simulated save failures use in-memory sample state. Refreshing resets it. The state strip identifies the selected item, number of items, and simulated save state.

Use Source library/Add material to add sample content, edit item/session notes, and try the simulated save-failure checkbox and Retry. Export only describes the proposed contents; no file or record is created. Markdown preview supports sample headings and bullets only. These are visual/interaction sketches, not production implementations of autosave, export/import, or source snapshots. Sample content is invented and independent of real campaign repositories. No API requests, filesystem reads, database writes, external assets, or network fonts are involved in the study.

Production uses a no-op loader through Angular file replacement; the prototype component and switcher are excluded from production bundles. The owner selected A for preparation and B for reading the same prepared session; C is not selected. Production integration and cleanup/preservation require the owner's approved implementation scope. No prototype branch or commit has been created.
