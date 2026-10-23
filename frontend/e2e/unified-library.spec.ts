import { test, expect, APIRequestContext } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
test.use({ actionTimeout: 10_000 });
const card = (title: string, id = randomUUID()) =>
  `---\nworkbench:\n  schema: 1\n  id: ${id}\n  title: ${title}\n  type: npc\n  purpose: session\n  status: current\n  tags: [reef]\n  summary: Authored ${title} summary.\n---\n# ${title}\nLibrary needle. [Next passage](card-1.md#passage-20)\n${Array.from({ length: 45 }, (_, i) => `\n## Passage ${i}\nLong reading passage ${i}.`).join('\n')}`;
async function fixture(request: APIRequestContext) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-uw4-'));
  for (let i = 0; i < 35; i++)
    await writeFile(join(root, `card-${i}.md`), card(`Card ${String(i).padStart(2, '0')}`));
  await writeFile(join(root, 'legacy.md'), '# Incomplete legacy\nNeeds card metadata.');
  const collision = randomUUID();
  await writeFile(join(root, 'collision-a.md'), card('Collision A', collision));
  await writeFile(join(root, 'collision-b.md'), card('Collision B', collision));
  const campaign = await (
    await request.post('/api/campaigns', { data: { name: 'UW4 Library', directory: root } })
  ).json();
  await request.post(`/api/campaigns/${campaign.id}/sources/refresh`);
  const sessions = [];
  for (const title of ['First destination', 'Second destination'])
    sessions.push(
      await (
        await request.post(`/api/campaigns/${campaign.id}/sessions`, {
          data: { title, objective: '' },
        })
      ).json(),
    );
  return { root, campaign, sessions, url: `/library?campaign=${campaign.id}` };
}

test('unified Source Add, explicit destination, duplicate status, edit reuse and shared navigation', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const f = await fixture(request);
  const reader = page.getByRole('article', { name: 'Selected Library document' });
  try {
    await page.goto(f.url);
    await expect(page.getByLabel('Current session')).toHaveValue('');
    await page.getByRole('button', { name: 'Card 00 npc', exact: false }).click();
    await expect(reader.getByText('Long reading passage 0.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create document', exact: true })).toHaveCount(0);
    await reader.getByRole('button', { name: 'Add to session…', exact: true }).click();
    await page
      .getByLabel('Choose destination session')
      .getByRole('button', { name: 'First destination', exact: true })
      .click();
    await expect(page.getByLabel('Current session')).toHaveValue(f.sessions[0].id);
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    await expect(
      reader.getByRole('button', { name: 'View in Prepare', exact: true }),
    ).toBeVisible();
    const endpoint = `/api/campaigns/${f.campaign.id}/sessions/${f.sessions[0].id}`;
    expect((await (await request.get(endpoint)).json()).items).toHaveLength(1);
    await page.getByLabel('Current session').selectOption(f.sessions[1].id);
    await expect(reader.getByRole('button', { name: 'Add to session', exact: true })).toBeVisible();
    await expect(
      reader.getByRole('heading', { name: 'Card 00', exact: true, level: 2 }),
    ).toBeVisible();
    await page.getByLabel('Current session').selectOption('');
    await expect(
      reader.getByRole('button', { name: 'Add to session…', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Current session').selectOption(f.sessions[0].id);
    await reader.getByRole('button', { name: 'View in Prepare', exact: true }).click();
    await expect(page.getByLabel('Current session')).toHaveValue(f.sessions[0].id);
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    await expect(
      reader.getByRole('heading', { name: 'Card 00', exact: true, level: 2 }),
    ).toBeVisible();
    await reader.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    await reader.getByRole('button', { name: 'Edit in Write', exact: true }).click();
    await expect(page).toHaveURL(/\/writing\?.*draft=/);
    await expect(page.getByLabel('Current session')).toHaveValue(f.sessions[0].id);
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    const catalogue = await (await request.get(`/api/campaigns/${f.campaign.id}/cards`)).json();
    expect(catalogue.entries.filter((e: { title: string }) => e.title === 'Card 00')).toHaveLength(
      1,
    );
    expect((await (await request.get(endpoint)).json()).items).toHaveLength(1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Library layout, independent scrolling, card geometry, diagnostics and stale reload', async ({
  page,
  request,
}, info) => {
  test.setTimeout(60_000);
  const f = await fixture(request);
  const reader = page.getByRole('article', { name: 'Selected Library document' });
  try {
    await page.goto(f.url);
    const firstCard = page.getByRole('button', { name: 'Card 00 npc', exact: false });
    await firstCard.focus();
    await firstCard.press('Enter');
    await expect(reader.getByText('Long reading passage 0.', { exact: true })).toBeVisible();
    await page.getByLabel('Search Library', { exact: true }).fill('needle');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    // Inclusive search also returns the conflicting identity whose saved body matches.
    await expect(page.locator('.catalogue-row')).toHaveCount(36);
    await reader.getByRole('link', { name: 'Next passage', exact: true }).click();
    await expect(reader.getByRole('heading', { name: 'Passage 20', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await firstCard.click();
    for (const size of [
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(
        reader.getByRole('heading', { name: 'Card 00', exact: true, level: 2 }),
      ).toBeVisible();
      const dimensions = await page.evaluate(() => {
        const catalogue = document.querySelector('.catalogue') as HTMLElement;
        const reader = document.querySelector('.document-reader') as HTMLElement;
        catalogue.scrollTop = 130;
        reader.scrollTop = 180;
        return {
          page: document.documentElement.scrollWidth,
          width: innerWidth,
          catalogue: catalogue.scrollTop,
          reader: reader.scrollTop,
          a: catalogue.getBoundingClientRect().toJSON(),
          b: reader.getBoundingClientRect().toJSON(),
        };
      });
      expect(dimensions.page).toBeLessThanOrEqual(size.width);
      expect(dimensions.catalogue).toBeGreaterThan(0);
      expect(dimensions.reader).toBeGreaterThan(0);
      if (size.width > 750) expect(dimensions.a.right).toBeLessThanOrEqual(dimensions.b.left + 1);
      await reader.evaluate((node) => (node.scrollTop = 0));
      await page.screenshot({ path: info.outputPath(`uw4-${size.width}.png`), fullPage: true });
    }
    await reader.getByRole('button', { name: 'Card', exact: true }).click();
    const cardBounds = await reader.locator('playing-card article').boundingBox();
    expect(cardBounds!.width / cardBounds!.height).toBeCloseTo(243 / 420, 2);
    await reader.getByRole('button', { name: 'Open full document', exact: false }).click();
    await page.setViewportSize({ width: 1280, height: 800 });
    await writeFile(join(f.root, 'card-0.md'), card('Changed source'));
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    await expect(
      reader.getByRole('button', { name: 'Reload selected document', exact: true }),
    ).toBeVisible();
    await expect(reader.getByRole('button', { name: 'Edit in Write', exact: true })).toBeDisabled();
    await reader.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    // The fixture deliberately changes identity; choose the replacement explicitly.
    await page.getByRole('button', { name: 'Changed source npc', exact: false }).click();
    await expect(
      reader.getByRole('heading', { name: 'Changed source', exact: true, level: 2 }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'legacy.md Unclassified', exact: false }).click();
    await expect(reader.getByText('Preparation blocked.', { exact: false })).toBeVisible();
    await expect(reader.getByRole('button', { name: 'Edit in Write', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: /collision-a.md Unclassified/ }).click();
    await reader.getByText('Details', { exact: true }).click();
    await reader.getByRole('button', { name: 'Inspect collision-a.md', exact: true }).click();
    await expect(reader.getByRole('button', { name: 'Edit in Write', exact: true })).toBeDisabled();
    await expect(
      reader.getByRole('button', { name: 'Add to session…', exact: true }),
    ).toBeDisabled();
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('failed Add retries safely and a delayed Add keeps its captured destination', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const f = await fixture(request);
  const reader = page.getByRole('article', { name: 'Selected Library document' });
  try {
    await page.goto(`${f.url}&session=${f.sessions[0].id}`);
    await page.getByRole('button', { name: 'Card 01 npc', exact: false }).click();
    const endpoint = `/api/campaigns/${f.campaign.id}/sessions/${f.sessions[0].id}`;
    const pattern = `**${endpoint}/library`;
    await page.route(pattern, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Temporary Add failure.' }),
          })
        : route.continue(),
    );
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Temporary Add failure.');
    await expect(
      reader.getByRole('heading', { name: 'Card 01', exact: true, level: 2 }),
    ).toBeVisible();
    expect((await (await request.get(endpoint)).json()).items).toHaveLength(0);
    await page.unroute(pattern);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let dispatched = false;
    await page.route(pattern, async (route) => {
      if (route.request().method() === 'POST') {
        dispatched = true;
        await gate;
      }
      await route.continue();
    });
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect.poll(() => dispatched).toBe(true);
    await page.getByLabel('Current session').selectOption(f.sessions[1].id);
    await expect(
      reader.getByText('Destination: Second destination', { exact: true }),
    ).toBeVisible();
    release();
    await expect
      .poll(async () => (await (await request.get(endpoint)).json()).items.length)
      .toBe(1);
    await expect(page.getByLabel('Current session')).toHaveValue(f.sessions[1].id);
    await expect(
      reader.getByRole('heading', { name: 'Card 01', exact: true, level: 2 }),
    ).toBeVisible();
    await expect(reader.getByText('Already in session', { exact: true })).toHaveCount(0);
    expect(
      (
        await (
          await request.get(`/api/campaigns/${f.campaign.id}/sessions/${f.sessions[1].id}`)
        ).json()
      ).items,
    ).toHaveLength(0);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Draft precedence, update direction, changed/missing originals and deletion fallback', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const f = await fixture(request);
  const base = `/api/campaigns/${f.campaign.id}`;
  const reader = page.getByRole('article', { name: 'Selected Library document' });
  try {
    const catalogue = await (await request.get(`${base}/cards`)).json();
    const source = catalogue.entries.find((e: { title: string }) => e.title === 'Card 00');
    let associated = await (
      await request.post(`${base}/cards/edit-source`, {
        data: { capture: catalogue.capture, path: source.sources[0].path },
      })
    ).json();
    expect(associated.id).toBeTruthy();
    associated = await (
      await request.put(`${base}/drafts/${associated.id}`, {
        data: {
          revision: associated.revision,
          fields: {
            ...associated.fields,
            title: 'Associated revision',
            body: '# Associated revision\nSaved Draft wins.',
            status: 'current',
          },
        },
      })
    ).json();
    let independent = await (
      await request.post(`${base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    independent = await (
      await request.put(`${base}/drafts/${independent.id}`, {
        data: {
          revision: independent.revision,
          fields: {
            ...independent.fields,
            title: 'Independent document',
            path: 'independent.md',
            body: '# Independent document\nDraft-only text.',
            status: 'current',
          },
        },
      })
    ).json();
    await page.goto(`${f.url}&session=${f.sessions[0].id}`);
    await page.getByRole('button', { name: /Associated revision npc/ }).click();
    await expect(reader.getByText('Saved Draft wins.', { exact: true })).toBeVisible();
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    associated = await (
      await request.put(`${base}/drafts/${associated.id}`, {
        data: {
          revision: associated.revision,
          fields: { ...associated.fields, body: '# Associated revision\nNewer saved revision.' },
        },
      })
    ).json();
    await page.getByRole('button', { name: 'Reload catalogue', exact: true }).click();
    await expect(reader.getByText('Prepared · Update available', { exact: true })).toBeVisible();
    await expect(reader.getByRole('button', { name: 'Add to session', exact: true })).toHaveCount(
      0,
    );
    await writeFile(join(f.root, 'card-0.md'), card('Changed original', source.card));
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    await reader.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    await expect(reader.getByText('Newer saved revision.', { exact: true })).toBeVisible();
    await rm(join(f.root, 'card-0.md'));
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    await reader.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    await expect(reader.getByText('Newer saved revision.', { exact: true })).toBeVisible();
    await reader.getByText('Details', { exact: true }).click();
    await expect(reader.getByText(/card-0.md · unavailable/)).toBeVisible();
    await page.getByRole('button', { name: /Independent document npc/ }).click();
    await expect(reader.getByText('Draft-only text.', { exact: true })).toBeVisible();
    // Restore the original Source and delete only the associated working Draft.
    await writeFile(join(f.root, 'card-0.md'), card('Restored Source', source.card));
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    expect(
      (
        await request.delete(`${base}/drafts/${associated.id}?revision=${associated.revision}`)
      ).ok(),
    ).toBe(true);
    await page.getByRole('button', { name: 'Reload catalogue', exact: true }).click();
    await page.getByRole('button', { name: /Restored Source npc/ }).click();
    await expect(
      reader.getByRole('heading', { name: 'Restored Source', exact: true, level: 2 }),
    ).toBeVisible();
    expect(
      (await (await request.get(`${base}/sessions/${f.sessions[0].id}`)).json()).items,
    ).toHaveLength(1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Library navigation retains failed Writing edits until successful save and clears cross-campaign destination', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    const base = `/api/campaigns/${f.campaign.id}`;
    const draft = await (
      await request.post(`${base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    await page.goto(
      `/writing?campaign=${f.campaign.id}&draft=${draft.id}&session=${f.sessions[0].id}`,
    );
    const pattern = `**${base}/drafts/${draft.id}`;
    await page.route(pattern, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Temporary Writing save failure.' }),
          })
        : route.continue(),
    );
    await page
      .getByLabel('Markdown body', { exact: true })
      .fill('# Keep local edits\nDo not lose this text.');
    await expect(page.getByLabel('Draft save status')).toHaveText('Save failed');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    await expect(page).toHaveURL(/\/writing\?/);
    await expect(page.getByLabel('Markdown body', { exact: true })).toHaveValue(
      '# Keep local edits\nDo not lose this text.',
    );
    await page.unroute(pattern);
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    await expect(page).toHaveURL(/\/library\?/);
    await expect(page.getByLabel('Current session')).toHaveValue(f.sessions[0].id);
    const otherDirectory = join(f.root, 'other-campaign');
    await mkdir(otherDirectory);
    const otherResponse = await request.post('/api/campaigns', {
      data: { name: 'Other UW4 campaign', directory: otherDirectory },
    });
    expect(otherResponse.ok(), await otherResponse.text()).toBe(true);
    const another = await otherResponse.json();
    // Reload the app's campaign list, then explicitly change campaign in the shared header.
    await page.reload();
    await page.getByLabel('Campaign', { exact: true }).selectOption(another.id);
    await expect(page.getByLabel('Current session')).toHaveValue('');
    await expect(page).not.toHaveURL(/session=/);
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await expect(page.getByLabel('Current session')).toHaveValue('');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
