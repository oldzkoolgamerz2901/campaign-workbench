# Increment 3 — Typed Markdown cards and campaign organization

Date: 2026-10-17

Status: Requirements and architecture approved by the owner on 2026-10-17 following the increment 3 interview and architecture review. The 3A plan, metadata contract, parser choice, and 3B plan were accepted on 2026-10-18. Other bounded increments remain proposed in [the implementation plan](implementation-plan.md#increment-3--proposed-bounded-implementation-increments). Disposable prototype work and campaign-file edits remain separate. Persisted approval records do not supply execution permission for a later session.

## Intended outcome

Markdown files carry explicit metadata identifying their kind. The application presents them as reusable content cards, with a dedicated library section for each kind. The DM can compose a session using different kinds of cards.

The accepted initial types are NPC, Location, Faction, Item, Scene, Adventure, Handout, and Reference. Combat is initially a Scene tag/subtype. Versioned YAML front matter under `workbench` is the accepted metadata representation; the accepted version 1 contract follows below.

## Direction established in discussion

- Add explicit content types to campaign Markdown and expose corresponding UI sections, such as NPCs, Items, and Reference.
- Build on increment 2's generic prepared items, captured Markdown, source provenance, and session notes. A session remains a composition of selected material; typed cards enrich that workflow.
- Expand the domain model deliberately as those capabilities are defined. A source document, the campaign concept it describes, a card in the library, and an item prepared for a session need not share one identity.
- Increment 3 now includes classification conventions, tags/filtering, type-specific recommended structures, category navigation, and improved reading. These were not dependencies of increment 2.
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

## Approved requirements

The authoritative accepted requirements are in [the product specification](product-specification.md#increment-3--typed-cards-campaign-organization-and-reading). They distinguish content type, document purpose, revision/approval status, and tags; define whole-file cards, future authoring conventions, quick-reference reading, filtering, relationships, and frozen session behavior; and bound a separately approved Sea Witch pilot.

## Accepted architecture and remaining detail

The authoritative [accepted architecture](implementation-plan.md#increment-3--accepted-typed-card-architecture) defines document/card identity, namespaced YAML, separate purpose/status/authority, ordinary Markdown relationships, Sources/Preparation ownership, offset-preserving parsing, frozen classification, and version 2 session archives with version 1 import compatibility. Existing prepared text is not backfilled from current sources. A replace-with-latest command is excluded from increment 3.

Remaining work is bounded by the increment plans: a separately authorized reader study, production browsing, and owner resolution of campaign-content uncertainties. Frozen typed preparation and archive support are implemented in 3B; developer evidence is in the implementation plan. Campaign Bible v0.6 is the recommended guidance pilot example, conditional on owner confirmation of its status/title; no authority decision is inferred.

## Accepted version 1 metadata contract — 2026-10-18

One card corresponds to one Markdown document. Put its metadata in a YAML mapping named `workbench`, between `---` delimiter lines at the beginning of the file. A UTF-8 BOM and LF/CRLF line endings are supported. Delimiters occupy their entire line. Source text is never rewritten or normalized by the application.

```yaml
---
workbench:
  schema: 1
  id: '87b085da-326b-4cc4-933e-c908648ee712'
  title: Arrival Hall
  type: scene
  purpose: session
  status: current
  tags: [whispering-reef, combat]
  summary: First entry into the sanctuary.
---
# Arrival Hall
```

| Field | Contract |
| --- | --- |
| `schema` | Required integer, exactly `1`; a quoted string is invalid |
| `id` | Required canonical lowercase UUID, unique within the campaign capture; retain across rename, use new IDs for independently reusable split cards |
| `title` | Required nonblank string, maximum 200 characters |
| `type` | Required: `npc`, `location`, `faction`, `item`, `scene`, `adventure`, `handout`, `reference` |
| `purpose` | Required: `session`, `guidance`, `tooling` |
| `status` | Required: `draft`, `current`, `superseded` |
| `tags` | Optional list, at most 32 nonblank strings of at most 64 characters each; trim, lowercase using locale-independent rules, deduplicate |
| `summary` | Optional authored nonblank string, maximum 1,000 characters; omission is allowed, explicit null is invalid |

String limits use JVM UTF-16 length before trimming. Text values are trimmed for classification only. Labels are case-sensitive, except normalized tags. No folder, filename, title, or status establishes a missing label or AI authority.

| Input | Interpretation |
| --- | --- |
| No envelope, or valid unrelated front matter without `workbench` | Legacy/unclassified; body remains available |
| Closed envelope | Keep raw text; exclude the envelope from rendered body, headings, links, and ordinary body search |
| Unclosed envelope | Issue `metadata.unclosed`; keep all text visible/searchable rather than concealing a possible body |
| Invalid YAML, fields, unsupported schema/type, or resource limits | Document-level issue; readable body remains available and refresh may publish it |
| Unknown Workbench fields | Warning; ignore the field without invalidating otherwise valid classification |
| Unrelated top-level fields | No Workbench meaning; YAML syntax/resource restrictions still apply |
| Duplicate card IDs | Issue on every affected document, including a document with other field errors; no merging, all affected classifications become invalid |
| Scan/read failure | Existing atomic refresh behavior: preserve the previous capture |

Invalid classification returns no trusted metadata object, with diagnostic codes/fields/messages separately available. Retain an independently valid explicit purpose for selection enforcement: guidance/tooling cannot be selected into a session even when another field is invalid. Ambiguous/malformed purpose is not guessed. Legacy and other invalid documents remain selectable. Draft/superseded session material is accessible through explicit filters; purpose is the preparation restriction.

### Parser selection and limits

Use `org.snakeyaml:snakeyaml-engine:3.1.1`, pinned in `versions.toml`, solely inside the Sources Markdown adapter. Use its JSON scalar schema, not arbitrary object construction. Reject duplicate/non-scalar mapping keys, explicit tags, and all aliases, including scalar aliases. Accept one YAML document, at most 64 KiB of front matter, nesting depth 16, and 4,096 parser events. Inspect the bounded event stream before collection construction; keep environment substitution disabled.

Engine was selected for YAML 1.2 data parsing and an independent namespace. Classic `org.yaml:snakeyaml` would reuse a Boot-managed dependency, but requires a different schema/safe-loading policy. A custom parser would duplicate YAML behavior; JSON front matter was already rejected for authoring comfort. Neither alternative is introduced. Existing Boot configuration parsing remains Boot-owned.

Evidence: [Engine project documentation](https://github.com/snakeyaml/snakeyaml-engine) describes its data-oriented API and Java 11+ baseline; [Maven Central](https://central.sonatype.com/artifact/org.snakeyaml/snakeyaml-engine/3.1.1) publishes the selected artifact. The selected release's source JAR was inspected for `LoadSettingsBuilder` and streaming `Parse`; unlike the older documentation, 3.1.1 already defaults to JSON schema, but the adapter sets it explicitly. Compile/runtime evidence belongs in the implementation plan, rather than assuming compatibility from the baseline alone.

### Sources contract and preparation boundary

Library summaries, source documents, and search hits expose classification. Source documents expose heading levels and relationships with originating section, original destination, resolved target, target classification, and an explicit scene-candidate flag. Campaign/capture identity remains on the containing response. A scene candidate is a directly linked, valid Scene card with session purpose. Unknown/missing links remain identifiable; no graph traversal or automatic preparation occurs.

`GET /api/campaigns/{id}/sources` and `/search` accept optional repeated `types`, `tags`, `purposes`, and `statuses`, plus boolean `unclassified` and `issues`. Different filter fields combine with AND; values within type/purpose/status combine with OR; every requested tag must match. `unclassified=true` selects missing/invalid classification; `issues=true` selects warnings or errors. Omitted filters retain the complete library for existing consumers. The future production UI supplies the play-library default and Search all action in 3C.

Search includes full readable body text, paths, headings, and explicit title/tags. Metadata field names, IDs, summaries, and purpose/status values are not ordinary body text. A metadata-only hit opens the first body block; body hits retain their exact section/block. No automatic summarization is added.

Original character offsets determine section IDs and subtree selections even after envelope removal for parsing. Whole-document selections include the original envelope; section selections include only their exact original range. SHA-256 continues to hash UTF-8 encoding of exact raw document/selection text. `Sources.select` also returns classification, relationships within the selected section subtree, interpretation version, and whole-document body offset for later Preparation integration. Section selections never copy Quick reference prose from elsewhere.

3B now persists typed metadata in prepared items and suppresses the captured envelope in newly prepared rendering. Raw text and hashes remain unchanged. Existing items and v1 archive imports retain legacy rendering without reclassification from current sources. See the frozen preparation/archive contract below.

### Recommended Markdown structures

Use one H1, H2 topics, and H3 subtopics. These sections are optional recommendations, not parsing requirements; unknown headings remain visible.

| Type | Recommended sections |
| --- | --- |
| NPC | Quick reference, Motivation, Appearance, Relationships, Background |
| Location | Quick reference, Read aloud, Features, Connections, Background |
| Faction | Quick reference, Goals, Members, Relationships, Background |
| Item | Quick reference, Description, Mechanics, Background |
| Scene | Quick reference, Read aloud, Situation, Clues, Mechanics, Outcomes, Design notes |
| Adventure | Overview, Scenes, Leads, Timeline, Design notes |
| Handout | Handout text, DM notes |
| Reference | Quick reference, Details |

Use ordinary relative Markdown links in Relationships and Scenes. Heading links may target a scene subsection; they do not turn that subsection into a separate card. A Handout type does not publish its contents or establish player knowledge. Campaign conversions still require their separate review and authorization.

## Approved review direction

Use Thomas's two profiles, Arrival Hall, Agelus Trail, and one owner-selected guidance document for a proposed migration pilot. Demonstrate NPC lookup, scene running, investigation navigation, and full background access. Include legacy/unclassified material and a differently structured campaign in application checks. Preserve frozen sessions and archive readability. The [manual review queue](sea-witch-manual-review.md) records uncertain content decisions.

Increment 2 remains defined in [the product specification](product-specification.md) and [the implementation plan](implementation-plan.md). AI, play journals, player publication, and wider campaign-authoring features are not implicitly added by this future direction.

## Frozen preparation and archive contract — 3B

Preparation owns its captured values independently of Sources API evolution. New prepared items carry an optional `capturedSource` value with interpretation version `1`, the original UTF-16 `bodyStart` offset within the selected text, classification (metadata plus diagnostic issues), and direct relationships. Metadata retains stable document identity, type, purpose, revision status, normalized tags, and authored summary. Relationships retain their originating section ID, original destination, resolved document/section or external address, missing status, target classification, and scene-candidate flag. The containing item's provenance provides the original campaign/capture/path context.

The `V6__captured_source_metadata.sql` migration adds a nullable text column containing the structured snapshot as JSON. JSON encoding belongs to the persistence adapter; it introduces no database indexing or dependency. Existing rows remain null and are not looked up, reinterpreted, or rewritten. An item with null captured metadata uses legacy rendering, including any raw front matter it already contained. New selections use their saved body offset to suppress a recognized envelope without changing stored text. Section selections have offset zero and never include Quick reference prose from outside their selected subtree. Captured document summaries remain separate from section prose.

### Versioned archive shape

Both versions have exactly `version` and `sessions` at the root. Session fields remain `id`, `campaign`, `revision`, `title`, `objective`, `notes`, and ordered `items`. Provenance and anchor maps retain their existing shape.

| Version | Item fields and interpretation |
| --- | --- |
| 1 import | Exactly `id`, `title`, `markdown`, `provenance`, `anchors`, `notes`. Import as legacy material with no captured snapshot; do not consult sources. Typed fields, including an added null `capturedSource`, are rejected rather than silently ignored. |
| 2 export/import | The same fields plus required nullable `capturedSource`. Null explicitly preserves legacy material. A non-null value requires exactly `interpretation`, `bodyStart`, `classification`, and `relationships`, with exact nested field/type checks. |

Exports always use v2, including sessions containing legacy items. There is no downgrade export. Older v1 applications reject v2. The generated API's optional nullable field accommodates reading both legacy and new prepared items; the archive reader applies the version-specific wire requirements above.

Archive import rejects unsupported versions/interpretations, unknown or missing fields, duplicate JSON keys, trailing JSON, coercible scalar types, noncanonical UUID strings, out-of-range numeric values, invalid frozen classifications, and inconsistent fingerprints. The body offset must fit the text, must be zero for section selections, and may suppress only the first closed front-matter envelope. It cannot hide an arbitrary prose prefix. Card enums/limits and issue severity are validated as captured data; normalized tags may contain up to 128 UTF-16 units because lowercasing a valid 64-unit authored tag can expand it. Authored metadata limits are unchanged.

Existing limits remain 20 MiB per archive, 100 sessions, 1,000 prepared items total, and 2 MiB per text/note field. Full validation precedes all writes; persistence remains one transaction. Import gives sessions and prepared items fresh identities and resets destination session revisions, preserving descriptive source provenance and stable card IDs. Invalid archives create no partial sessions.

Imported rendering and links use only material captured in the imported session from the same original campaign/capture, even if a newer source at the same path is present. Missing or uncaptured relationships remain unavailable; no target is fetched automatically. Saved notes and reorder operations retain the frozen metadata. Hashes establish raw-content integrity, not authorship, canon approval, AI authority, or publication permission.
