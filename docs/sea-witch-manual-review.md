# Sea Witch — owner review queue

Created: 2026-10-17, at the owner's explicit request during the increment 3 requirements interview.

Campaign root: `/Users/huibvanstraten/sea_witch`.

This is an initial queue based on the investigation, not an exhaustive migration audit. No campaign files have been changed. Paths below are relative to the campaign root. Entries identify decisions or manual edits for the owner; they do not authorize automatic changes. Add uncertain cases here rather than assuming their intended meaning, classification, or authority. Keep entries open until the owner resolves them.

| ID | Files | Evidence / uncertainty | Owner review needed | Status |
| --- | --- | --- | --- | --- |
| SW-01 | `campaign_bible/The_Sea_Witch_Campaign_Bible_v0.2.md`, `v0.3.md`, `v0.4.md`, `v0.4.1.md`, `v0.5.md`, `v0.6.md` (all with the same filename prefix) | Multiple bible revisions exist. The v0.6 file title says v0.5. Latest filename does not establish authority. | Confirm the active bible, correct its title if appropriate, and identify which versions are superseded. | Open |
| SW-02 | `foundation/narrative_foundation_v0.1.md`, `foundation/narrative_foundation_v0.2.md`, `knowledge_architecture_v0.1.md`, `campaign_bible/Campaign_Bible_revision_suggestions.md`, `prompt.md` | Foundation, knowledge constraints, revision proposals, and authoring instructions have different purposes. | Confirm which are active AI guidance, proposals, or historical material and resolve any competing guidance. | Open |
| SW-03 | All five Markdown files in `chapter_3_design/` | Documents describe themselves variously as locked frameworks, working designs, and working models; the simulation explicitly contains assumptions that are not canon yet. | Confirm accepted constraints versus unresolved proposals. Decide whether mixed-status content needs separation before future AI use. | Open |
| SW-04 | `npcs/thomas_haggerty.md`, `the_ship/crew/thomas_haggerty.md` | Two profiles describe the same character with complementary detail. | Confirm whether to consolidate them and retain a crew index link, or preserve separate references with distinct purposes. | Open |
| SW-05 | `npcs/agelus_gherkin/agelus_gherkin.md` | The document is titled “Campaign Book – Oziach's Father Arc” and mixes biography, revelations, and arc structure. | Confirm the intended NPC reference and adventure/arc split; review against later chapter 3 material before consolidation. | Open |
| SW-06 | `items/the_tideheart_compass.md` | Mixes an item reference, chapter progression, and DM revelation guidance. | Confirm which information remains on the item card and which belongs in adventure guidance; preserve knowledge boundaries. | Open |
| SW-07 | `chapter_3/agelus/papers_from_agelus_worktable.md` | Empty file. | Supply intended content, confirm it is a deliberate placeholder, or authorize removal. | Open |
| SW-08 | `chapter_3/agelus/agelus_trail_playable_scenes.md`, `chapter_3/agelus/agelus_journey_and_company_investigation.md`, `chapter_3/church/chapter_3_church_missions_and_abyssal_tide_lead.md` | Multi-scene and campaign-level documents overlap in investigation and progression responsibilities. | Review proposed splits and identify authoritative facts before deduplicating or reconciling content. | Open |
| SW-09 | `chapter_2_the_broken_atoll/Whispering_Reef_Sanctuary_v1/09 - hag_territory.md`, `10 - the_drowned_meditation_chamber.md` | Both titles use Scene 12; filename order and scene numbering are not consistently aligned across the sanctuary. | Confirm intended sequence and numbering before changing titles, links, or transition text. | Open |
| SW-10 | `chapter_2_the_broken_atoll/Whispering_Reef_Sanctuary_v1/03 - arrival_hall.md` | Includes “TODO — Campaign Horror System” inside atmosphere guidance, while other sections emphasize wonder before horror. | Decide whether the TODO represents an active requirement and whether the suggested atmosphere fits the scene. | Open |
| SW-11 | `repository-app-assessment.md`, `docs/campaign-workbench.md` | Application proposals and a pointer to application records live in the campaign repository. | Confirm exclusion from session content and whether either belongs in future AI context; do not treat historical app proposals as accepted architecture. | Open |

## Handling decisions

- Preserve original prose and historical versions while review is pending.
- Do not resolve a conflict by choosing the newer filename or more detailed passage.
- A content type, such as Reference, does not establish canon status or eligibility as AI guidance.
- The owner has requested that campaign bibles and architectural/decision guidance be marked separately from session-preparation material. The exact metadata and future AI selection rules remain under discussion.
- Record the owner's resolution alongside each entry before applying its associated edit.
