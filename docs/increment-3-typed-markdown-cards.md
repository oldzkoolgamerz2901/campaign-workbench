# Increment 3 — Typed Markdown cards and campaign organization

Date: 2026-10-17

Status: Future direction recorded at the owner's request. Increment 3 is reserved for this work; detailed requirements, architecture, scope, and implementation are not yet approved. This record does not authorize application changes or campaign-file migration.

## Intended outcome

Markdown files carry explicit metadata identifying their kind. The application presents them as reusable content cards, with a dedicated library section for each kind. The DM can compose a session using different kinds of cards.

Examples discussed are NPCs, in-world items, and background material. Scenes, encounters/combat, clues, locations, and handouts are possible later categories, not a finalized catalogue. The metadata syntax is deliberately undecided; no YAML schema, required fields, or templates are selected here.

## Direction established in discussion

- Add explicit content types to campaign Markdown and expose corresponding UI sections, such as NPCs, Items, and Background.
- Build on increment 2's generic prepared items, captured Markdown, source provenance, and session notes. A session remains a composition of selected material; typed cards enrich that workflow.
- Expand the domain model deliberately as those capabilities are defined. A source document, the campaign concept it describes, a card in the library, and an item prepared for a session need not share one identity.
- Defer metadata conventions, the type catalogue, additional tags, filtering, standardized templates, and dedicated type-specific UI sections to this future iteration. They are not dependencies of increment 2.
- Preserve independent campaign ownership and readability of ordinary Markdown. Changes to campaign repositories require separate authorization; application work must not automatically rewrite them.

## Terms to refine

| Term | Working distinction |
| --- | --- |
| Source document | A Markdown file supplying campaign content |
| Content type | The kind declared for that content, such as NPC or background |
| Content card | The library presentation of reusable Markdown content |
| Prepared item | Selected captured material and preparation notes belonging to a session |
| In-world item | An object in the campaign, distinct from a prepared session item |
| Tag | A cross-cutting label, distinct from the primary content type |

These distinctions guide the later requirements discussion; they do not establish aggregates, database tables, or module boundaries.

## Questions for the future requirements phase

1. Which content types are needed initially, and can a file have more than one type?
2. Are cards always whole files, or can explicitly marked sections in mixed documents become cards?
3. What metadata identifies a card independently of its path, and how are renames, duplicates, or several documents about the same NPC handled?
4. Which type-specific fields and Markdown sections are recommended or required? How are unknown types, missing metadata, and invalid metadata displayed?
5. Which filters and tags are useful, and how do they affect library browsing, search, and session composition?
6. Which domain relationships matter, such as an encounter referring to NPCs, locations, or items? Which module owns each responsibility within the accepted architecture?
7. How do classification changes interact with frozen prepared items and versioned session exports? Existing preparation must not silently change.
8. Is any campaign-content migration desired, and what separate authoring scope should be authorized?

## Candidate review scenario

Classify a small, explicitly authorized example set as NPC, item, and background cards. Browse each UI section, find a card, add different kinds to one session, and reopen that session without changing its captured content. Include unclassified legacy Markdown and differently structured campaigns. Refine this scenario when increment 3 requirements work is authorized.

Increment 2 remains defined in [the product specification](product-specification.md) and [the implementation plan](implementation-plan.md). AI, play journals, player publication, and wider campaign-authoring features are not implicitly added by this future direction.
