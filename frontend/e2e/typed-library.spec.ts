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
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=library`);
    const shelf = page.getByRole('navigation', { name: 'Sources', exact: true });
    await expect(shelf.locator('.documents li')).toHaveCount(8);
    await expect(shelf.locator('.documents img[src="/card-placeholder.svg"]')).toHaveCount(8);
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
      await expect(shelf.locator('.documents li')).toHaveCount(1);
      await expect(shelf).toContainText(`Reef ${type}`);
      await category.click();
      await expect(shelf.locator('.documents li')).toHaveCount(8);
    }
    await page
      .locator('.type-chooser')
      .evaluate((node) => ((node as HTMLDetailsElement).open = false));
    await page.getByText('Filters', { exact: true }).click();
    await page.getByLabel('Tags (all required, comma separated)').pressSequentially('reef, combat');
    await page.getByLabel('draft', { exact: true }).check();
    await expect(shelf).toContainText('Draft adventure');
    await page.getByLabel('Search sources', { exact: true }).fill('Second needle');
    await expect(shelf.locator('.results button')).toHaveCount(1);
    await shelf.locator('.results button').click();
    await expect(page.locator('#source-reader div:focus')).toContainText('Second needle');
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await expect(page.getByLabel('Search sources')).toHaveValue('Second needle');
    await expect(page.getByLabel('Active library criteria')).toBeEmpty();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(shelf.locator('.documents li')).toHaveCount(15);
    const reader = page.getByRole('article', { name: 'Source reader', exact: true });
    for (const purpose of ['guidance', 'tooling']) {
      await shelf.getByRole('button', { name: `${purpose}.md`, exact: true }).click();
      await expect(
        reader.getByRole('button', { name: 'Add document to session', exact: true }),
      ).toHaveCount(0);
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
    await expect(shelf.locator('.documents li')).toHaveCount(4);
    await expect(shelf).toContainText('legacy.md');
    await expect(shelf).toContainText('duplicate-a.md');
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await shelf.getByRole('button', { name: 'adventure.md', exact: true }).click();
    const related = reader.getByLabel('Related cards');
    await related.getByRole('button', { name: 'Reef scene', exact: true }).first().click();
    await expect(reader).toContainText('Nested treasure');
    let saved = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(saved.items).toHaveLength(0);
    await shelf.getByRole('button', { name: 'adventure.md', exact: true }).click();
    await reader.getByRole('button', { name: 'Choose adventure material', exact: true }).click();
    let chooser = page.getByRole('region', { name: 'Adventure material chooser' });
    await expect(chooser.locator('input[type=checkbox]')).toHaveCount(2);
    await chooser.getByRole('button', { name: 'Add selected material', exact: true }).click();
    await expect(chooser.getByText('Overview — completed', { exact: true })).toBeVisible();
    await chooser.getByRole('button', { name: 'Close', exact: true }).click();
    saved = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(saved.items.map((i: any) => i.provenance.path)).toEqual(['adventure.md']);
    await reader.getByRole('button', { name: 'Choose adventure material', exact: true }).click();
    chooser = page.getByRole('region', { name: 'Adventure material chooser' });
    await chooser.getByLabel(/Reef scene/).check();
    let failScene = true;
    await page.route(`**/sessions/${session.id}/sources`, async (route) => {
      if (route.request().postDataJSON().path === 'scene.md' && failScene) {
        failScene = false;
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({ detail: 'Scene temporarily unavailable' }),
        });
      } else await route.continue();
    });
    await chooser.getByRole('button', { name: 'Add selected material', exact: true }).click();
    await expect(chooser.getByText('Overview — completed', { exact: true })).toBeVisible();
    await expect(chooser.getByText('Reef scene — failed', { exact: true })).toBeVisible();
    await chooser.getByRole('button', { name: 'Retry remaining material', exact: true }).click();
    await expect(chooser.getByText('Reef scene — completed', { exact: true })).toBeVisible();
    saved = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(saved.items.map((i: any) => i.provenance.path)).toEqual([
      'adventure.md',
      'adventure.md',
      'scene.md',
    ]);
    expect(saved.items[2].markdown).toContain('Nested treasure');
    expect(saved.items[2].markdown).not.toContain('Outside subtree');
    expect(saved.items[2].markdown).not.toContain('Second needle');
    await chooser.getByRole('button', { name: 'Close', exact: true }).click();
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
