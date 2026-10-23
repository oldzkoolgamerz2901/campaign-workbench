import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const card = (
  title: string,
  type: string,
  body: string,
  purpose = 'session',
  status = 'current',
  id = randomUUID(),
) =>
  `---\nworkbench:\n  schema: 1\n  id: ${id}\n  title: ${title}\n  type: ${type}\n  purpose: ${purpose}\n  status: ${status}\n  tags: [reef, combat]\n  summary: Authored ${title} summary.\n---\n${body}`;

test('filters typed sources and explicitly assembles adventure selections with partial retry', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'workbench-typed-library-'));
  const types = [
    'npc',
    'location',
    'faction',
    'item',
    'scene',
    'adventure',
    'handout',
    'reference',
  ];
  for (const type of types)
    await writeFile(
      join(root, `${type}.md`),
      card(
        `Reef ${type}`,
        type,
        type === 'adventure'
          ? '# Adventure\n[scene](scene.md#encounter)\n[scene again](scene.md#encounter)\n[handout](handout.md)\n[reference](reference.md)\n[missing](missing.md)'
          : type === 'scene'
            ? '# Scene\nOutside subtree\n## Encounter\nFirst needle\n### Detail\nNested treasure\n## Encounter\nSecond needle\n[handout](handout.md)'
            : `# ${type}\nReef needle.`,
      ),
    );
  await writeFile(
    join(root, 'draft.md'),
    card('Draft adventure', 'adventure', '# Draft\nNeedle draft.', 'session', 'draft'),
  );
  await writeFile(
    join(root, 'guidance.md'),
    card('Guidance reference', 'reference', '# Guidance\nNeedle guidance.', 'guidance'),
  );
  await writeFile(
    join(root, 'tooling.md'),
    card('Tooling reference', 'reference', '# Tooling\nNeedle tooling.', 'tooling'),
  );
  await writeFile(join(root, 'legacy.md'), '# Legacy\nNeedle legacy.');
  await writeFile(
    join(root, 'invalid.md'),
    card('Invalid', 'unknown', '# Invalid\nNeedle invalid.'),
  );
  const duplicate = randomUUID();
  await writeFile(
    join(root, 'duplicate-a.md'),
    card('Duplicate A', 'scene', '# Duplicate A', 'session', 'current', duplicate),
  );
  await writeFile(
    join(root, 'duplicate-b.md'),
    card('Duplicate B', 'scene', '# Duplicate B', 'session', 'current', duplicate),
  );
  const runtimeErrors: string[] = [];
  page.on('pageerror', (e) => runtimeErrors.push(e.message));
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Typed reef', directory: root } })
    ).json();
    const session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Explicit reef', objective: '' },
      })
    ).json();
    await request.post(`/api/campaigns/${campaign.id}/sources/refresh`);
    await page.goto(`/library?campaign=${campaign.id}&session=${session.id}`);
    const shelf = page.getByRole('region', { name: 'Library catalogue', exact: true });
    await expect(shelf.locator('.catalogue-row')).toHaveCount(8);
    await expect(shelf.locator('.catalogue-row img[src="/card-placeholder.svg"]')).toHaveCount(8);
    const refreshes: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/sources/refresh')) refreshes.push(r.url());
    });
    await page.locator('.type-chooser > summary').click();
    for (const type of types) {
      const category = page.getByRole('button', {
        name: type === 'npc' ? 'NPC' : type,
        exact: true,
      });
      await category.click();
      await expect(shelf.locator('.catalogue-row')).toHaveCount(1);
      await expect(shelf).toContainText(`Reef ${type}`);
      await category.click();
      await expect(shelf.locator('.catalogue-row')).toHaveCount(8);
    }
    await page
      .locator('.type-chooser')
      .evaluate((node) => ((node as HTMLDetailsElement).open = false));
    await page.getByText('Filters', { exact: true }).click();
    await page.getByLabel('Tags (all required, comma separated)').pressSequentially('reef, combat');
    await page.getByLabel('draft', { exact: true }).check();
    await expect(shelf).toContainText('Draft adventure');
    await page.getByLabel('Search Library', { exact: true }).fill('Second needle');
    await expect(shelf.locator('.catalogue-row')).toHaveCount(1);
    await shelf.getByRole('button', { name: /Reef scene/ }).click();
    await expect(page.locator('.document-reader')).toContainText('Second needle');
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await expect(page.getByLabel('Search Library')).toHaveValue('Second needle');
    await expect(page.getByLabel('Active library criteria')).toBeEmpty();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(shelf.locator('.catalogue-row')).toHaveCount(14);
    const reader = page.getByRole('article', { name: 'Selected Library document', exact: true });
    for (const purpose of ['guidance', 'tooling']) {
      await shelf
        .getByRole('button', {
          name: new RegExp(purpose === 'guidance' ? 'Guidance reference' : 'Tooling reference'),
          exact: true,
        })
        .click();
      await expect(
        reader.getByRole('button', { name: 'Add to session', exact: true }),
      ).toBeDisabled();
      const library = await (await request.get(`/api/campaigns/${campaign.id}/sources`)).json();
      const rejected = await request.post(
        `/api/campaigns/${campaign.id}/sessions/${session.id}/sources`,
        {
          data: {
            revision: session.revision,
            capture: library.capture,
            path: `${purpose}.md`,
            section: null,
          },
        },
      );
      expect(rejected.ok()).toBe(false);
    }
    await page.getByText('Filters', { exact: true }).click();
    await page.getByLabel('Unclassified / invalid', { exact: true }).check();
    await page.getByLabel('Classification issues', { exact: true }).check();
    await expect(shelf.locator('.catalogue-row')).toHaveCount(3);
    await expect(shelf).toContainText('legacy.md');
    await expect(shelf).toContainText('Identity conflict');
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await shelf.getByRole('button', { name: /Reef adventure/ }).click();
    await reader.getByRole('button', { name: 'Choose adventure material', exact: true }).click();
    const chooser = reader.getByRole('region', { name: 'Adventure material chooser' });
    await expect(chooser.locator('input[type=checkbox]')).toHaveCount(3);
    await expect(chooser.getByLabel(/missing.md/)).toBeDisabled();
    await chooser.getByLabel(/Reef scene/).check();
    let failScene = true;
    await page.route(`**/sessions/${session.id}/library`, async (route) => {
      if (route.request().method() === 'POST' && failScene) {
        const payload = route.request().postDataJSON();
        const cards = await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json();
        if (cards.entries.find((e: any) => e.key === payload.key)?.title === 'Reef scene') {
          failScene = false;
          await route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Scene temporarily unavailable' }),
          });
          return;
        }
      }
      await route.continue();
    });
    await chooser.getByRole('button', { name: 'Add selected material', exact: true }).click();
    await expect(chooser.getByText('Reef adventure — completed', { exact: true })).toBeVisible();
    await expect(chooser.getByText('Reef scene — failed', { exact: true })).toBeVisible();
    await chooser.getByRole('button', { name: 'Retry remaining material', exact: true }).click();
    await expect(chooser.getByText('Reef scene — completed', { exact: true })).toBeVisible();
    const saved = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(saved.items.map((i: any) => i.provenance.path)).toEqual(['adventure.md', 'scene.md']);
    expect(saved.items[1].markdown).toContain('Outside subtree');
    expect(saved.items[1].markdown).toContain('Nested treasure');
    expect(saved.items[1].markdown).toContain('Second needle');
    expect(saved.sceneLinks).toEqual([]);
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath(`typed-library-${width}.png`) });
    }
    expect(refreshes).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
