import { historicalSourceItem, importHistoricalSession } from './preparation-fixtures';
import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function fixture(request: APIRequestContext, related = false) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-t2-'));
  const names = ['Scene', 'NPC', 'Relic', 'Fourth', 'Extra'];
  for (const [index, name] of names.entries()) {
    await writeFile(
      join(root, `${name}.md`),
      `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: ${name}\n  type: ${index === 0 || index === 3 ? 'scene' : index === 1 ? 'npc' : 'item'}\n  purpose: session\n  status: current\n  summary: Frozen reference for ${name}.\n  tags: [focus-fixture]\n---\n# Full ${name}\nComplete frozen ${name} document. [Visit Fourth](Fourth.md) [Visit NPC](NPC.md) [Visit Scene](Scene.md) ${related ? '[Again](./NPC.md) [Section](NPC.md#background) [Extra](Extra.md) [Missing](Missing.md) [Unsafe](javascript:alert)' : ''}\n\n## Background\nReference background for ${name}.`,
    );
  }
  const campaign = await (
    await request.post('/api/campaigns', {
      data: { name: 'Tabletop fixtures', directory: root },
    })
  ).json();
  const capture = await (
    await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
  ).json();
  let session = await (
    await request.post(`/api/campaigns/${campaign.id}/sessions`, {
      data: { title: 'Tabletop session', objective: '' },
    })
  ).json();
  const historicalItems = [];
  for (const name of names.slice(0, 4))
    historicalItems.push(
      await historicalSourceItem(request, campaign.id, {
        capture: capture.capture,
        path: `${name}.md`,
        section: null,
      }),
    );
  if (related)
    historicalItems.push(
      await historicalSourceItem(request, campaign.id, {
        capture: capture.capture,
        path: 'NPC.md',
        section: null,
      }),
    );
  session = await importHistoricalSession(request, campaign.id, session, historicalItems);
  const endpoint = `/api/campaigns/${campaign.id}/sessions/${session.id}`;
  session = await (
    await request.put(endpoint, {
      data: {
        revision: session.revision,
        title: session.title,
        objective: '',
        notes: 'Anchored session note.',
        items: session.items.map((item: { id: string }) => ({ id: item.id, notes: '' })),
      },
    })
  ).json();
  const ids = session.items.map((item: { id: string }) => item.id) as string[];
  const url = `/?campaign=${campaign.id}&session=${session.id}&mode=play&view=prepare`;
  return { root, campaign, session, endpoint, ids, url };
}

async function action(page: Page, title: string, name: string) {
  await page
    .locator('play-tabletop')
    .getByRole('button', { name: `Card actions: ${title}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
async function saved(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByLabel('Session save status')).toHaveText('Saved');
}
async function read(page: Page, title: string) {
  await page
    .locator('play-tabletop')
    .getByRole('article', { name: `Read: ${title}`, exact: true })
    .press('Enter');
  await expect(page.locator('.source-page')).toBeVisible();
}
async function mode(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Workspace mode' })
    .getByRole('button', { name, exact: true })
    .click();
}

test('P7 Library inspection and uncertain Add preserve piles, Scene, Used and guarded notes', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    const [scene, npc, relic, fourth] = f.ids;
    let w = await (await request.get(`${f.endpoint}/workspace`)).json();
    for (const [item, destination] of [
      [npc, 'PILE_1'],
      [relic, 'PILE_2'],
      [fourth, 'USED'],
    ]) {
      const response = await request.post(`${f.endpoint}/workspace/move`, {
        data: { revision: w.revision, item, destination },
      });
      expect(response.ok(), await response.text()).toBe(true);
      w = await response.json();
    }
    const activated = await request.post(`${f.endpoint}/workspace/scene`, {
      data: { revision: w.revision, preparationRevision: f.session.revision, scene, movements: [] },
    });
    expect(activated.ok(), await activated.text()).toBe(true);
    const before = await activated.json();
    await page.goto(f.url);
    const notes = page.locator('play-notes');
    const text = notes.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await text.fill('P7 guarded note');
    await notes.getByLabel('Primary resource', { exact: true }).selectOption(npc);
    page.once('dialog', (dialog) => dialog.dismiss());
    await mode(page, 'Library');
    await expect(text).toHaveValue('P7 guarded note');
    await expect(notes.getByLabel('Primary resource', { exact: true })).toHaveValue(npc);
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(text).toHaveValue('');
    const savedNotes = await (await request.get(`${f.endpoint}/play-notes`)).json();
    await mode(page, 'Library');
    await page.getByRole('button', { name: 'Extra item', exact: false }).click();
    const reader = page.getByRole('article', { name: 'Selected Library document' });
    await expect(reader).toContainText('Complete frozen Extra document.');
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    // Commit the Add but lose its response: reopening must reconcile membership safely.
    await page.route(`**${f.endpoint}/library`, async (route) => {
      if (route.request().method() === 'POST') {
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort('failed');
      } else await route.continue();
    });
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.unroute(`**${f.endpoint}/library`);
    await mode(page, 'Play');
    await expect(page.locator('play-tabletop')).toBeVisible();
    const after = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(after.pile1).toEqual(before.pile1);
    expect(after.pile2).toEqual(before.pile2);
    expect(after.used).toEqual(before.used);
    expect(after.activeSceneItemId).toBe(scene);
    expect(after.sessionCards).toHaveLength(1);
    expect(await (await request.get(`${f.endpoint}/play-notes`)).json()).toEqual(savedNotes);
    await mode(page, 'Library');
    await page.getByRole('button', { name: 'Extra item', exact: false }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    const session = await (await request.get(f.endpoint)).json();
    const catalogue = await (await request.get(`${f.endpoint}/library`)).json();
    const entry = catalogue.entries.find(
      (value: any) => value.entry.classification.metadata.title === 'Extra',
    ).entry;
    const retry = await request.post(`${f.endpoint}/library`, {
      data: {
        revision: session.revision,
        key: entry.key,
        capture: catalogue.capture,
        draft: entry.draft,
        draftRevision: entry.revision,
      },
    });
    expect(retry.ok(), await retry.text()).toBe(true);
    expect((await retry.json()).added).toBe(false);
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(after);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('two piles preserve covers/order, unique locations, reader and keyboard-accessible movement', async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const f = await fixture(request);
  const [scene, npc, relic, fourth] = f.ids;
  try {
    const other = await (
      await request.post(`/api/campaigns/${f.campaign.id}/sessions`, {
        data: { title: 'Another tabletop', objective: '' },
      })
    ).json();
    await page.goto(f.url);
    const table = page.locator('play-tabletop'),
      p1 = page.getByRole('region', { name: 'Runtime Pile 1', exact: true }),
      p2 = page.getByRole('region', { name: 'Runtime Pile 2', exact: true });
    await expect(
      page
        .getByRole('navigation', { name: 'Play supporting panel' })
        .getByRole('button', { name: 'Notes', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await action(page, 'NPC', 'Move to Pile 1');
    await saved(page);
    await action(page, 'Relic', 'Move to Pile 1');
    await saved(page);
    await expect(p1.getByRole('article', { name: 'Read: NPC', exact: true })).toBeVisible();
    await read(page, 'NPC');
    await expect(page.locator('.source-page')).toContainText('Complete frozen NPC document.');
    await p1.getByRole('button', { name: 'Next cover: Pile 1', exact: true }).press('Enter');
    await saved(page);
    await expect(p1).toContainText('Relic');
    await expect(page.locator('.source-page')).toContainText('Complete frozen NPC document.');
    let w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.pile1.items).toEqual([npc, relic]);
    expect(w.pile1.cover).toBe(relic);
    await p1.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const pile = page.getByRole('dialog');
    await pile.getByLabel('Pile name', { exact: true }).fill('References');
    await pile.getByRole('button', { name: 'Save pile name', exact: true }).click();
    await saved(page);
    await pile.getByRole('button', { name: 'Move earlier: Relic', exact: true }).press('Enter');
    await saved(page);
    w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.pile1.items).toEqual([relic, npc]);
    expect(w.pile1.cover).toBe(relic);
    await page
      .getByRole('dialog')
      .getByLabel('Move card: Relic', { exact: true })
      .selectOption('USED');
    await saved(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Close pile', exact: true }).click();
    await expect(p1.getByRole('article', { name: 'Read: NPC', exact: true })).toBeVisible();
    await table.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await action(page, 'Relic', 'Move to Pile 2');
    await saved(page);
    await expect(p2.getByRole('article', { name: 'Read: Relic', exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Find in session', exact: true }).fill('no match');
    await expect(
      table.getByRole('list', { name: 'Session Cards', exact: true }).getByRole('listitem'),
    ).toHaveCount(0);
    await expect(p1.getByRole('article')).toBeVisible();
    await expect(p2.getByRole('article')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Find in session', exact: true }).clear();
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    await page
      .getByRole('navigation', { name: 'Play supporting panel' })
      .getByRole('button', { name: 'Notes', exact: true })
      .click();
    await page
      .getByRole('navigation', { name: 'Play supporting panel' })
      .getByRole('button', { name: 'Document', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('Complete frozen NPC document.');
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    for (const size of [
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`tabletop-${size.width}.png`),
        fullPage: true,
      });
    }
    await page.reload();
    await expect(p1).toContainText('References');
    await expect(p2).toContainText('Relic');
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items).toEqual([
      npc,
    ]);
    await page
      .getByRole('navigation', { name: 'Play supporting panel' })
      .getByRole('button', { name: 'Document', exact: true })
      .click();
    await page.getByLabel('Current session', { exact: true }).selectOption(other.id);
    await expect(
      page
        .getByRole('navigation', { name: 'Play supporting panel' })
        .getByRole('button', { name: 'Notes', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Scene overview uses explicit links, atomically customizes piles and retains choices on conflict', async ({
  page,
  request,
}) => {
  const f = await fixture(request, true);
  const [scene, npc, relic, fourth] = f.ids;
  try {
    let s = f.session;
    for (const item of [npc, relic])
      s = await (
        await request.put(`${f.endpoint}/scene-links/${scene}/${item}`, {
          data: { revision: s.revision, linked: true },
        })
      ).json();
    await page.goto(f.url);
    await action(page, 'Scene', 'Activate Scene');
    const dialog = page.getByRole('dialog', { name: 'Activate / Change Scene', exact: true });
    await dialog.getByRole('button', { name: 'Customize placements', exact: true }).click();
    await dialog.getByLabel('Placement: NPC', { exact: true }).selectOption('PILE_1');
    await dialog.getByLabel('Placement: Relic', { exact: true }).selectOption('PILE_2');
    // A concurrent Preparation edit invalidates the overview, without moving anything.
    s = await (
      await request.put(f.endpoint, {
        data: {
          revision: s.revision,
          title: s.title,
          objective: 'Changed',
          notes: s.notes,
          items: s.items.map((i: any) => ({ id: i.id, notes: i.notes })),
        },
      })
    ).json();
    await dialog.getByRole('button', { name: 'Confirm Scene and placements', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Preparation changed');
    expect(
      (await (await request.get(`${f.endpoint}/workspace`)).json()).activeSceneItemId,
    ).toBeNull();
    await dialog
      .getByRole('button', { name: 'Refresh overview / retain choices', exact: true })
      .click();
    await expect(dialog.getByLabel('Placement: NPC', { exact: true })).toHaveValue('PILE_1');
    await dialog.getByRole('button', { name: 'Confirm Scene and placements', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await saved(page);
    let w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.activeSceneItemId).toBe(scene);
    expect(w.pile1.items).toEqual([npc]);
    expect(w.pile2.items).toEqual([relic]);
    await action(page, 'Fourth', 'Move to Pile 1');
    await saved(page);
    await page.getByRole('button', { name: 'Change Scene', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Scene', exact: true }).selectOption(fourth);
    await expect(dialog).toContainText('will move to the reserved Scene slot');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual({
      ...w,
      revision: w.revision + 1,
      sessionCards: w.sessionCards.filter((id: string) => id !== fourth),
      pile1: { ...w.pile1, items: [npc, fourth] },
    });
    await page.getByRole('button', { name: 'Change Scene', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Scene', exact: true }).selectOption(fourth);
    await dialog.getByRole('button', { name: 'Keep current piles', exact: true }).click();
    await saved(page);
    w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.activeSceneItemId).toBe(fourth);
    expect(w.pile1.items).toEqual([npc]);
    expect(w.pile2.items).toEqual([relic]);
    expect(w.sessionCards[0]).toBe(scene);
    await page.getByRole('button', { name: 'Deactivate Scene', exact: true }).click();
    await saved(page);
    expect(
      (await (await request.get(`${f.endpoint}/workspace`)).json()).sessionCards.slice(0, 2),
    ).toEqual([fourth, scene]);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('pointer drag handles transfer individual cards and invalid drops do not move them', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  const [, npc, relic] = f.ids;
  try {
    await page.goto(f.url);
    const source = page
      .locator('play-tabletop')
      .getByRole('button', { name: 'Drag card: NPC', exact: true });
    const target = page.getByRole('region', { name: 'Runtime Pile 1', exact: true });
    await source.scrollIntoViewIfNeeded();
    const a = (await source.boundingBox())!,
      b = (await target.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width / 2 + 15, a.y + a.height / 2, { steps: 4 });
    await expect(page.locator('.cdk-drag-preview')).toBeVisible();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 25 });
    await page.mouse.up();
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
      .toEqual([npc]);
    await action(page, 'Relic', 'Move to Pile 1');
    await saved(page);
    await page.setViewportSize({ width: 1440, height: 1200 });
    await target.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const overlay = page.getByRole('dialog');
    const from = (await overlay
      .getByRole('button', { name: 'Drag card: Relic', exact: true })
      .boundingBox())!;
    const to = (await overlay
      .getByRole('button', { name: 'Drag card: NPC', exact: true })
      .boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 15, from.y + from.height / 2, { steps: 4 });
    await expect(overlay.locator('.cdk-drag-preview')).toBeVisible();
    await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 25 });
    await page.mouse.up();
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
      .toEqual([relic, npc]);
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.cover).toBe(npc);
    await overlay.getByRole('button', { name: 'Close pile', exact: true }).click();
    await action(page, 'NPC', 'Move to Pile 2');
    await saved(page);
    const w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.pile1.items).toEqual([relic]);
    expect(w.pile2.items).toEqual([npc]);
    const handle = target.getByRole('button', { name: 'Drag card: Relic', exact: true });
    const c = (await handle.boundingBox())!;
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await page.mouse.down();
    await page.mouse.move(c.x + 20, c.y + 20, { steps: 4 });
    await page.mouse.move(5, 5, { steps: 12 });
    await page.mouse.up();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(w);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('failed and uncertain actions retain intent, guard navigation and never replay against a newer revision', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  const [, npc] = f.ids;
  try {
    await page.goto(f.url);
    await page.route(`**${f.endpoint}/workspace/move`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Connection uncertain' }),
      }),
    );
    await action(page, 'NPC', 'Mark used');
    await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
    await expect(page.getByRole('alert')).toContainText('Connection uncertain');
    page.once('dialog', (dialog) => dialog.dismiss());
    await mode(page, 'Library');
    await expect(page).toHaveURL(/mode=play/);
    let w = await (await request.get(`${f.endpoint}/workspace`)).json();
    await request.post(`${f.endpoint}/workspace/move`, {
      data: { revision: w.revision, item: npc, destination: 'USED' },
    });
    await page.unroute(`**${f.endpoint}/workspace/move`);
    await page.getByRole('button', { name: 'Review / retry table action', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('saved arrangement changed');
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).revision).toBe(
      w.revision + 1,
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Reload / discard table changes', exact: true }).click();
    await saved(page);
    await expect(page.getByRole('button', { name: 'Used cards (1)', exact: true })).toBeVisible();
    await mode(page, 'Prepare');
    await expect(page).toHaveURL(/mode=prepare/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Play → Prepare → Play reconciles additions/removals and preserves reader link intent while opening', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  const [scene, npc, relic, fourth] = f.ids;
  try {
    let w = await (await request.get(`${f.endpoint}/workspace`)).json();
    w = await (
      await request.post(`${f.endpoint}/workspace/move`, {
        data: { revision: w.revision, item: npc, destination: 'PILE_1' },
      })
    ).json();
    w = await (
      await request.post(`${f.endpoint}/workspace/scene`, {
        data: { revision: w.revision, preparationRevision: f.session.revision, scene },
      })
    ).json();
    await page.goto(f.url);
    await read(page, 'NPC');
    await expect(page.locator('.source-page')).toContainText('Complete frozen NPC');
    await mode(page, 'Prepare');
    let s = await (await request.get(f.endpoint)).json();
    s = await (
      await request.put(f.endpoint, {
        data: {
          revision: s.revision,
          title: s.title,
          objective: s.objective,
          notes: s.notes,
          items: s.items
            .filter((i: any) => i.id !== npc)
            .map((i: any) => ({ id: i.id, notes: i.notes })),
        },
      })
    ).json();
    await page.reload();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let started!: () => void;
    const opening = new Promise<void>((resolve) => (started = resolve));
    await page.route(`**${f.endpoint}/workspace`, async (route) => {
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    });
    await mode(page, 'Play');
    await opening;
    await page
      .getByRole('navigation', { name: 'Play supporting panel' })
      .getByRole('button', { name: 'Document', exact: true })
      .click();
    await page
      .locator('.source-page')
      .getByRole('link', { name: 'Visit Fourth', exact: true })
      .click();
    release();
    await expect(page.getByText('Opening Play workspace…', { exact: true })).toHaveCount(0);
    await expect(page.locator('.source-page')).toContainText('Complete frozen Fourth document.');
    const after = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(after.activeSceneItemId).toBe(scene);
    expect(after.pile1.items).toEqual([]);
    expect(after.sessionCards).toEqual([relic, fourth]);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
