import { APIRequestContext, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

/** Exercise the supported whole-card mutation contract in ordinary fixture setup. */
export async function addLibraryFixture(
  request: APIRequestContext,
  endpoint: string,
  options: {
    data: {
      revision: number;
      capture?: string | null;
      path?: string;
      section?: string | null;
      draft?: string;
      draftRevision?: number;
    };
  },
) {
  const base = endpoint.substring(0, endpoint.indexOf('/sessions/'));
  const catalogue = await (await request.get(`${base}/cards`)).json();
  const selection = options.data;
  const entry = catalogue.entries.find((entry: any) =>
    selection.draft
      ? entry.draft === selection.draft
      : entry.sources.some((source: any) => source.path === selection.path),
  );
  expect(entry, `Library fixture entry ${selection.path ?? selection.draft}`).toBeTruthy();
  expect(selection.section ?? null, 'New additions must be complete cards').toBeNull();
  const response = await request.post(`${endpoint}/library`, {
    data: {
      revision: selection.revision,
      key: entry.key,
      capture: selection.capture === undefined ? catalogue.capture : selection.capture,
      draft: entry.draft ?? null,
      draftRevision: selection.draftRevision ?? entry.revision ?? null,
    },
  });
  return {
    ok: () => response.ok(),
    status: () => response.status(),
    text: () => response.text(),
    json: async () => {
      const result = await response.json();
      return response.ok() ? result.session : result;
    },
  };
}

/** Build archived Source evidence only in tests. Offsets and relationships come from the captured document.
 * The local raw file is fixture input, never production source capture or an alternate mutation API.
 */
export async function historicalSourceItem(
  request: APIRequestContext,
  campaign: string,
  selection: { capture: string; path: string; section: string | null },
) {
  const campaigns = await (await request.get('/api/campaigns')).json();
  const directory = campaigns.campaigns.find((entry: any) => entry.id === campaign).directory;
  const raw = await readFile(join(directory, selection.path), 'utf8');
  const response = await request.get(`/api/campaigns/${campaign}/sources/document`, {
    params: {
      capture: selection.capture,
      path: selection.path,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const doc = await response.json();
  const section =
    selection.section === null ? null : doc.sections.find((s: any) => s.id === selection.section);
  expect(selection.section === null || section).toBeTruthy();
  const bodyStart = raw.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0].length ?? 0;
  const start = section
    ? section.id === 'start'
      ? bodyStart
      : Number(section.id.substring(2))
    : 0;
  const end = section
    ? doc.sections
        .slice(doc.sections.indexOf(section) + 1)
        .find((s: any) => s.level != null && (section.id === 'start' || s.level <= section.level))
        ?.id
    : undefined;
  const finish = end ? Number(end.substring(2)) : raw.length;
  const markdown = raw.substring(start, finish);
  const selectedSections = doc.sections.filter((s: any) => {
    const offset = s.id === 'start' ? bodyStart : Number(s.id.substring(2));
    return offset >= start && offset < finish;
  });
  const slugs = (sections: any[]) => {
    const used = new Set<string>();
    return sections
      .filter((s) => s.level != null)
      .map((s) => {
        const base =
          s.heading
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_ -]/gu, '')
            .replaceAll(' ', '-') || 'section';
        let slug = base,
          suffix = 1;
        while (used.has(slug)) slug = `${base}-${suffix++}`;
        used.add(slug);
        return [s.id, slug];
      });
  };
  const original = new Map(slugs(doc.sections));
  const anchors = Object.fromEntries(
    slugs(selectedSections).map(([id, slug]) => [original.get(id), slug]),
  );
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  return {
    id: randomUUID(),
    title: section?.heading ?? doc.classification.metadata?.title ?? selection.path,
    markdown,
    notes: '',
    anchors,
    provenance: {
      campaign,
      ...selection,
      documentHash: hash(raw),
      contentHash: hash(markdown),
      kind: 'source',
      authored: null,
    },
    capturedSource: {
      interpretation: doc.classification.interpretation,
      bodyStart: section ? 0 : bodyStart,
      classification: { metadata: doc.classification.metadata, issues: doc.classification.issues },
      relationships: doc.relationships
        .filter((r: any) => !section || selectedSections.some((s: any) => s.id === r.originSection))
        .map((r: any) => ({
          key: r.key,
          originSection: r.originSection,
          destination: r.destination,
          sceneCandidate: r.sceneCandidate,
          classification: r.classification
            ? { metadata: r.classification.metadata, issues: r.classification.issues }
            : null,
          target: {
            document: r.target.document,
            section: r.target.section,
            external: r.target.external,
            missing: r.target.missing,
          },
        })),
    },
  };
}

/** Restore a separate historical session through the unchanged, validated current-format contract. */
export async function importHistoricalSession(
  request: APIRequestContext,
  campaign: string,
  session: any,
  items: any[],
) {
  const response = await request.post(`/api/campaigns/${campaign}/sessions/import`, {
    data: {
      version: 10,
      sessions: [{ ...session, items }],
      notes: [],
      workspaces: [{ session: session.id, workspace: null }],
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const id = (await response.json()).sessions[0].id;
  return (await request.get(`/api/campaigns/${campaign}/sessions/${id}`)).json();
}
