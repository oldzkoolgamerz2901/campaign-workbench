import { historicalSourceItem, importHistoricalSession } from './preparation-fixtures';
import { test, expect, Page, APIRequestContext, Locator } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function fixture(
  request: APIRequestContext,
  related = false,
  backText?: string,
  extraCards = 0,
) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-t2-'));
  const names = [
    'Scene',
    'NPC',
    'Relic',
    'Fourth',
    'Extra',
    ...Array.from({ length: extraCards }, (_, index) => `Card ${index + 1}`),
  ];
  for (const [index, name] of names.entries()) {
    await writeFile(
      join(root, `${name}.md`),
      `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: ${name}\n  type: ${index === 0 || index === 3 ? 'scene' : index === 1 ? 'npc' : 'item'}\n  purpose: session\n  status: current\n  summary: Frozen reference for ${name}.\n  tags: [focus-fixture]\n  backText: ${JSON.stringify(backText ?? `Back of ${name}.`)}\n---\n# Full ${name}\nComplete frozen ${name} document. [Visit Fourth](Fourth.md) [Visit NPC](NPC.md) [Visit Scene](Scene.md) ${related ? '[Again](./NPC.md) [Section](NPC.md#background) [Extra](Extra.md) [Missing](Missing.md) [Unsafe](javascript:alert)' : ''}\n\n## Background\nReference background for ${name}.`,
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
  for (const name of [...names.slice(0, 4), ...names.slice(5)])
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
    await p1.getByRole('button', { name: 'Rename pile: Pile 1', exact: true }).click();
    await p1.getByLabel('Pile name', { exact: true }).fill('References');
    await p1.getByRole('button', { name: 'Save pile name', exact: true }).click();
    await saved(page);
    await p1.getByRole('button', { name: 'Show all: References', exact: true }).click();
    const pile = page.getByRole('dialog', { name: 'References · Show all', exact: true });
    await pile.getByRole('button', { name: 'Card actions: Relic', exact: true }).press('Enter');
    await page
      .getByRole('group', { name: 'Actions for Relic', exact: true })
      .getByRole('button', { name: 'Move earlier', exact: true })
      .press('Enter');
    await saved(page);
    w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.pile1.items).toEqual([relic, npc]);
    expect(w.pile1.cover).toBe(relic);
    await pile.getByRole('button', { name: 'Card actions: Relic', exact: true }).press('Enter');
    await page
      .getByRole('group', { name: 'Actions for Relic', exact: true })
      .getByRole('button', { name: 'Mark used', exact: true })
      .press('Enter');
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

async function startSurfaceDrag(page: Page, card: Locator) {
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height * 0.45, { steps: 4 });
  return box;
}

test('complete-side reader isolates text selection and Close gestures from card dragging', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    await page.route('**/api/card-layout', (route) => route.abort('failed'));
    await page.goto(f.url);
    const card = page
      .locator('play-tabletop')
      .getByRole('article', { name: 'Read: NPC', exact: true });
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    await card.getByRole('button', { name: 'Read all front text', exact: true }).click();
    const reader = page.getByRole('dialog', { name: 'Complete card side text', exact: true });
    const text = (await reader.locator('.plain').boundingBox())!;
    await page.mouse.move(text.x + 2, text.y + text.height / 2);
    await page.mouse.down();
    await page.mouse.move(text.x + 90, text.y + text.height / 2, { steps: 10 });
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBeTruthy();
    await expect(reader).toHaveCount(1);
    const close = (await reader
      .getByRole('button', { name: 'Close card text', exact: true })
      .boundingBox())!;
    await page.mouse.move(close.x + 5, close.y + close.height / 2);
    await page.mouse.down();
    await page.mouse.move(close.x + 35, close.y + close.height / 2, { steps: 8 });
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.up();
    await expect(reader).toBeHidden();
    await expect(card.getByRole('button', { name: 'Flip to back', exact: true })).toBeFocused();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    // Keyboard close and its focus return remain available after the pointer interaction.
    await card.getByRole('button', { name: 'Read all front text', exact: true }).press('Enter');
    await reader.getByRole('button', { name: 'Close card text', exact: true }).press('Enter');
    await expect(reader).toBeHidden();
    await expect(card.getByRole('button', { name: 'Flip to back', exact: true })).toBeFocused();
    // Closing the reader must leave ordinary card-surface dragging enabled.
    await startSurfaceDrag(page, card);
    await expect(page.locator('.cdk-drag-preview')).toBeVisible();
    const pile = page.getByRole('region', { name: 'Runtime Pile 1', exact: true });
    for (let pass = 0; pass < 3; pass++) {
      const target = (await pile.boundingBox())!;
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {
        steps: 15,
      });
    }
    await page.mouse.up();
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
      .toEqual([f.ids[1]]);
  } finally {
    await page.mouse.up();
    await rm(f.root, { recursive: true, force: true });
  }
});

test('surface gestures distinguish clicks and controls, preserve preview geometry and traverse locations', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto(f.url);
    const table = page.locator('play-tabletop');
    const card = () => table.getByRole('article', { name: 'Read: NPC', exact: true });
    const p1 = page.getByRole('region', { name: 'Runtime Pile 1', exact: true });
    const p2 = page.getByRole('region', { name: 'Runtime Pile 2', exact: true });
    const initial = await (await request.get(`${f.endpoint}/workspace`)).json();
    await expect(table.locator('.drag-handle')).toHaveCount(0);
    // Small pointer jitter remains a click rather than starting a drag.
    await card().scrollIntoViewIfNeeded();
    let box = (await card().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height * 0.45);
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('.source-page')).toContainText('Complete frozen NPC document.');
    await page
      .getByRole('navigation', { name: 'Play supporting panel' })
      .getByRole('button', { name: 'Notes', exact: true })
      .click();
    // Moving the pointer from nested controls must never initiate a card drag.
    for (const control of [
      card().getByRole('button', { name: 'Flip to back' }),
      card().getByRole('button', { name: 'Card actions: NPC' }),
      card().getByRole('button', { name: 'Open full document' }),
    ]) {
      box = (await control.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width + 30, box.y + box.height + 30, { steps: 5 });
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      await page.mouse.up();
    }
    await card().getByRole('button', { name: 'Flip to back' }).click();
    await expect(card()).toHaveAttribute('data-side', 'back');
    await expect(card()).not.toHaveClass(/flipping/);
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(initial);
    await page
      .getByRole('navigation', { name: 'Play supporting panel' })
      .getByRole('button', { name: 'Notes', exact: true })
      .click();
    // Drag from the back, then from displayed pile covers, Used and back to Session Cards.
    const targets = [
      p1,
      p2,
      page.getByRole('region', { name: 'Active Scene', exact: true }),
      table.locator('.collection-heading').getByLabel('Used cards drop target', { exact: true }),
      table.getByRole('list', { name: 'Session Cards', exact: true }),
    ];
    for (const [index, target] of targets.entries()) {
      const before = await (await request.get(`${f.endpoint}/workspace`)).json();
      const sourceBox = await startSurfaceDrag(page, card());
      const preview = page.locator('.cdk-drag-preview playing-card article');
      await expect(preview).toBeVisible();
      const previewBox = (await preview.boundingBox())!;
      expect(previewBox.width).toBeCloseTo(sourceBox.width, 0);
      expect(previewBox.height).toBeCloseTo(sourceBox.height, 0);
      await expect(page.getByRole('region', { name: 'Active Scene', exact: true })).toHaveCSS(
        'outline-style',
        'dashed',
      );
      const destination = (await target.boundingBox())!;
      await page.mouse.move(
        destination.x + destination.width / 2,
        destination.y + destination.height / 2,
        { steps: 25 },
      );
      // CDK relocates its placeholder between containers; follow the live target after layout settles.
      for (let pass = 0; pass < 2; pass++) {
        const live = (await target.boundingBox())!;
        await page.mouse.move(live.x + live.width / 2, live.y + live.height / 2, { steps: 10 });
      }
      if (index === 0) await page.screenshot({ path: info.outputPath('surface-drag-preview.png') });
      await page.mouse.up();
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      if (index === 2) {
        expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
      } else {
        const location = ['pile1', 'pile2', '', 'used', 'sessionCards'][index];
        await expect
          .poll(async () => {
            const w = await (await request.get(`${f.endpoint}/workspace`)).json();
            return location.startsWith('pile') ? w[location].items : w[location];
          })
          .toContain(f.ids[1]);
        if (index === 3)
          await table.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
        await expect(card()).toHaveAttribute('data-side', 'front');
        await expect(
          page
            .getByRole('navigation', { name: 'Play supporting panel' })
            .getByRole('button', { name: 'Notes', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
      }
    }
    // Keyboard movement also exposes ordering in Used, without requiring a drag.
    await action(page, 'NPC', 'Mark used');
    await saved(page);
    await action(page, 'Relic', 'Mark used');
    await saved(page);
    await table.getByRole('button', { name: 'Card actions: Relic', exact: true }).press('Enter');
    await page.getByRole('menuitem', { name: 'Move earlier', exact: true }).press('Enter');
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).used)
      .toEqual([f.ids[2], f.ids[1]]);
    // The active Scene has no draggable ancestor and cannot be moved by a surface gesture.
    await action(page, 'Scene', 'Activate Scene');
    await page
      .getByRole('dialog', { name: 'Activate / Change Scene', exact: true })
      .getByRole('button', { name: 'Keep current piles', exact: true })
      .click();
    await saved(page);
    const scene = table.getByRole('article', { name: 'Read: Scene', exact: true });
    expect(await scene.evaluate((el) => !!el.closest('.cdk-drag'))).toBe(false);
    await startSurfaceDrag(page, scene);
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.move(5, 5);
    await page.mouse.up();
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).activeSceneItemId).toBe(
      f.ids[0],
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('filtered, saving and failed cards cannot start surface drags', async ({ page, request }) => {
  const f = await fixture(request);
  let release = () => {};
  try {
    await page.goto(f.url);
    const card = page
      .locator('play-tabletop')
      .getByRole('article', { name: 'Read: NPC', exact: true });
    await page.getByRole('searchbox', { name: 'Find in session', exact: true }).fill('NPC');
    await startSurfaceDrag(page, card);
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.move(5, 5);
    await page.mouse.up();
    await page.getByRole('searchbox', { name: 'Find in session', exact: true }).clear();
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**${f.endpoint}/workspace/move`, async (route) => {
      await gate;
      await route.abort('failed');
    });
    await action(page, 'Relic', 'Move to Pile 1');
    await expect(card.locator('..').locator('..')).toHaveClass(/cdk-drag-disabled/);
    await startSurfaceDrag(page, card);
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.move(5, 5);
    await page.mouse.up();
    release();
    await expect(
      page.getByRole('button', { name: 'Review / retry table action', exact: true }),
    ).toBeVisible();
    await startSurfaceDrag(page, card);
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.move(5, 5);
    await page.mouse.up();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
  } finally {
    release();
    await rm(f.root, { recursive: true, force: true });
  }
});

test('direct card gestures transfer individual cards and invalid drops do not move them', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  const [, npc, relic] = f.ids;
  try {
    await page.goto(f.url);
    const source = page
      .locator('play-tabletop')
      .getByRole('article', { name: 'Read: NPC', exact: true });
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
      .getByRole('article', { name: 'Read: Relic', exact: true })
      .boundingBox())!;
    const to = (await overlay
      .getByRole('article', { name: 'Read: NPC', exact: true })
      .boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 15, from.y + from.height / 2, { steps: 4 });
    await expect(overlay.locator('.cdk-drag-preview')).toBeVisible();
    const overlayPreview = (await overlay.locator('.cdk-drag-preview article').boundingBox())!;
    expect(overlayPreview.width).toBeCloseTo(from.width, 0);
    expect(overlayPreview.height).toBeCloseTo(from.height, 0);
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
    const handle = target.getByRole('article', { name: 'Read: Relic', exact: true });
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

test('flips preserve Play actions and notes across all locations and reset reopened pile views', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    await page.goto(f.url);
    const table = page.locator('play-tabletop');
    const card = (name: string) =>
      table
        .locator('playing-card')
        .filter({ has: page.getByRole('article', { name: `Read: ${name}`, exact: true }) });
    const flipBack = async (target: ReturnType<typeof card>, name: string) => {
      await expect(
        target.getByRole('img', { name: `Card front: ${name}`, exact: true }),
      ).toBeVisible();
      await target.getByRole('button', { name: 'Flip to back' }).press('Enter');
      await expect(target.locator('article')).toHaveClass(/flipping/);
      expect(
        await target.locator('article').evaluate((el) => getComputedStyle(el).animationDuration),
      ).toBe('0.23s');
      await expect(
        target.getByRole('img', { name: `Card back: ${name}`, exact: true }),
      ).toBeVisible();
      await expect(target.locator('svg')).toContainText(`Back of ${name}.`);
    };
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    await flipBack(card('NPC'), 'NPC');
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    await expect(card('NPC').locator('article')).not.toHaveClass(/selected/);
    const notes = page.locator('play-notes');
    await notes
      .getByLabel('PlayNote Markdown', { exact: true })
      .fill('A note while reading the back.');
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(notes.getByLabel('PlayNote Markdown', { exact: true })).toHaveValue('');
    await expect(card('NPC').locator('article')).toHaveAttribute('data-side', 'back');
    await page.getByRole('searchbox', { name: 'Find in session', exact: true }).fill('NPC');
    await expect(card('NPC').locator('article')).toHaveAttribute('data-side', 'back');
    await page.getByRole('searchbox', { name: 'Find in session', exact: true }).clear();
    await action(page, 'NPC', 'Move to Pile 1');
    await saved(page);
    await expect(card('NPC').locator('article')).toHaveAttribute('data-side', 'front');
    await flipBack(card('NPC'), 'NPC');
    await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const pile = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
    const overlay = pile.locator('playing-card');
    await flipBack(overlay, 'NPC');
    await page.screenshot({ path: info.outputPath('pile-back.png'), fullPage: true });
    await pile.getByRole('button', { name: 'Close pile', exact: true }).click();
    await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    await expect(overlay.locator('article')).toHaveAttribute('data-side', 'front');
    await expect(overlay.getByRole('img', { name: 'Card front: NPC', exact: true })).toBeVisible();
    await pile.getByRole('button', { name: 'Close pile', exact: true }).click();
    // Opening an overlay does not reset the still-visible pile cover.
    await expect(card('NPC').locator('article')).toHaveAttribute('data-side', 'back');
    await action(page, 'NPC', 'Move to Pile 2');
    await saved(page);
    await flipBack(card('NPC'), 'NPC');
    await action(page, 'NPC', 'Mark used');
    await saved(page);
    await table.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await flipBack(card('NPC'), 'NPC');
    await action(page, 'Scene', 'Activate Scene');
    const sceneDialog = page.getByRole('dialog', { name: 'Activate / Change Scene', exact: true });
    await sceneDialog.getByRole('button', { name: 'Keep current piles', exact: true }).click();
    await saved(page);
    await flipBack(card('Scene'), 'Scene');
    await expect(card('NPC').locator('article')).toHaveAttribute('data-side', 'back');
    await card('Scene').getByRole('button', { name: 'Flip to front' }).click();
    await expect(card('Scene').getByRole('button', { name: 'Open full document' })).toBeVisible();
    await card('Scene').getByRole('button', { name: 'Open full document' }).click();
    await expect(page.locator('.source-page')).toContainText('Complete frozen Scene document.');
    expect((await (await request.get(`${f.endpoint}/play-notes`)).json()).notes).toHaveLength(1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test.describe('touch surface gestures', () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 1200 } });
  test('complete-side reader permits touch scrolling and keeps Close gestures out of card dragging', async ({
    page,
    request,
  }) => {
    const backText = Array.from(
      { length: 100 },
      (_, i) => `Reader line ${i + 1}: complete historical back text.`,
    ).join('\n');
    const f = await fixture(request, false, backText);
    const touch = await page.context().newCDPSession(page);
    let activeTouch = false;
    try {
      await page.goto(f.url);
      const card = page
        .locator('play-tabletop')
        .getByRole('article', { name: 'Read: NPC', exact: true });
      await card.getByRole('button', { name: 'Flip to back', exact: true }).tap();
      await card.getByRole('button', { name: 'Read all back text', exact: true }).tap();
      const reader = page.getByRole('dialog', { name: 'Complete card side text', exact: true });
      await expect(reader.locator('.plain')).toHaveText(backText);
      const before = await (await request.get(`${f.endpoint}/workspace`)).json();
      const box = (await reader.boundingBox())!;
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      activeTouch = true;
      await page.waitForTimeout(220); // Exceeds the tabletop touch-drag delay.
      for (let step = 1; step <= 8; step++) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y - step * 12 }],
        });
      }
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      activeTouch = false;
      await expect.poll(() => reader.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await reader.evaluate((el) => el.scrollTo(0, 0));
      const close = (await reader
        .getByRole('button', { name: 'Close card text', exact: true })
        .boundingBox())!;
      const closeX = close.x + 5,
        closeY = close.y + close.height / 2;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: closeX, y: closeY }],
      });
      activeTouch = true;
      await page.waitForTimeout(220);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: closeX + 30, y: closeY }],
      });
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      activeTouch = false;
      await reader.getByRole('button', { name: 'Close card text', exact: true }).tap();
      await expect(reader).toBeHidden();
      await expect(card.getByRole('button', { name: 'Flip to front', exact: true })).toBeFocused();
      expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    } finally {
      if (activeTouch)
        await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await touch.detach();
      await rm(f.root, { recursive: true, force: true });
    }
  });
  test('PUX-2 touch reorders the tray, transfers a cover and cancels a header drop safely', async ({
    page,
    request,
  }) => {
    const f = await fixture(request);
    const touch = await page.context().newCDPSession(page);
    let active = false;
    try {
      await fillPile(request, f.endpoint, [f.ids[1], f.ids[2]]);
      await page.goto(f.url);
      await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).tap();
      const tray = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
      const gesture = async (title: string, target: Locator, cancel = false) => {
        const source = tray.getByRole('article', { name: `Read: ${title}`, exact: true });
        await source.scrollIntoViewIfNeeded();
        const from = (await source.boundingBox())!,
          to = (await target.boundingBox())!;
        const x = from.x + from.width / 2,
          y = from.y + from.height * 0.45;
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y }],
        });
        active = true;
        await page.waitForTimeout(220);
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 20, y }],
        });
        await expect(page.locator('.cdk-drag-preview')).toBeVisible();
        for (let step = 1; step <= 18; step++)
          await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
              {
                x: x + 20 + ((to.x + to.width / 2 - x - 20) * step) / 18,
                y: y + ((to.y + to.height / 2 - y) * step) / 18,
              },
            ],
          });
        await touch.send('Input.dispatchTouchEvent', {
          type: cancel ? 'touchCancel' : 'touchEnd',
          touchPoints: [],
        });
        active = false;
        await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      };
      await gesture('NPC', tray.getByRole('article', { name: 'Read: Relic', exact: true }));
      await expect
        .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
        .toEqual([f.ids[2], f.ids[1]]);
      expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.cover).toBe(
        f.ids[1],
      );
      await gesture('NPC', tray.getByLabel('Other pile drop target', { exact: true }));
      await expect
        .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile2.items)
        .toEqual([f.ids[1]]);
      const committed = await (await request.get(`${f.endpoint}/workspace`)).json();
      expect(committed.pile1.cover).toBe(f.ids[2]);
      await gesture('Relic', tray.getByLabel('Used cards drop target', { exact: true }), true);
      expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(committed);
      await tray.getByRole('button', { name: 'Card actions: Relic', exact: true }).tap();
      await expect(
        page.getByRole('group', { name: 'Actions for Relic', exact: true }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tray).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tray).toBeHidden();
    } finally {
      if (active)
        await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await touch.detach();
      await rm(f.root, { recursive: true, force: true });
    }
  });
  test('tap reads while a held touch moves a single card', async ({ page, request }) => {
    const f = await fixture(request);
    try {
      await page.goto(f.url);
      const card = page
        .locator('play-tabletop')
        .getByRole('article', { name: 'Read: NPC', exact: true });
      await card.tap();
      await expect(page.locator('.source-page')).toContainText('Complete frozen NPC document.');
      await card.getByRole('button', { name: 'Flip to back' }).tap();
      await expect(card).toHaveAttribute('data-side', 'back');
      await expect(card).not.toHaveClass(/flipping/);
      const before = await (await request.get(`${f.endpoint}/workspace`)).json();
      const touch = await page.context().newCDPSession(page);
      await card.scrollIntoViewIfNeeded();
      const box = (await card.boundingBox())!;
      const x = box.x + box.width / 2,
        y = box.y + box.height * 0.45;
      // Movement before the hold delay permits scrolling rather than starting a drag.
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + 30, y }],
      });
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
      await card.scrollIntoViewIfNeeded();
      const nextBox = (await card.boundingBox())!;
      const nextX = nextBox.x + nextBox.width / 2,
        nextY = nextBox.y + nextBox.height * 0.45;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: nextX, y: nextY }],
      });
      await page.waitForTimeout(220); // Deliberate hold exceeds the configured 180 ms touch delay.
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: nextX + 20, y: nextY }],
      });
      await expect(page.locator('.cdk-drag-preview')).toBeVisible();
      const target = (await page
        .getByRole('region', { name: 'Runtime Pile 1', exact: true })
        .boundingBox())!;
      for (let step = 1; step <= 15; step++) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: nextX + 20 + ((target.x + target.width / 2 - nextX - 20) * step) / 15,
              y: nextY + ((target.y + target.height / 2 - nextY) * step) / 15,
            },
          ],
        });
      }
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect
        .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
        .toEqual([f.ids[1]]);
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      const committed = await (await request.get(`${f.endpoint}/workspace`)).json();
      const cover = (await card.boundingBox())!;
      const coverX = cover.x + cover.width / 2,
        coverY = cover.y + cover.height * 0.45;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: coverX, y: coverY }],
      });
      await page.waitForTimeout(220);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: coverX + 20, y: coverY }],
      });
      await expect(page.locator('.cdk-drag-preview')).toBeVisible();
      const other = (await page
        .getByRole('region', { name: 'Runtime Pile 2', exact: true })
        .boundingBox())!;
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: other.x + other.width / 2, y: other.y + other.height / 2 }],
      });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
      expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(committed);
      await touch.detach();
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  });
});

async function dragOnto(page: Page, card: Locator, target: Locator) {
  await startSurfaceDrag(page, card);
  await expect(page.locator('.cdk-drag-preview')).toBeVisible();
  for (let pass = 0; pass < 3; pass++) {
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  }
  await page.mouse.up();
  await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
}

test('PUX-2 modal grid reorders across rows and uses each header destination with native keyboard actions', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request, false, undefined, 8);
  try {
    let w = await (await request.get(`${f.endpoint}/workspace`)).json();
    for (const item of f.ids) {
      const response = await request.post(`${f.endpoint}/workspace/move`, {
        data: { revision: w.revision, item, destination: 'PILE_1' },
      });
      expect(response.ok()).toBe(true);
      w = await response.json();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(f.url);
    const pile = page.getByRole('region', { name: 'Runtime Pile 1', exact: true });
    const opener = pile.getByRole('button', { name: 'Show all: Pile 1', exact: true });
    await opener.click();
    const tray = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
    await expect(tray.getByRole('button', { name: /Display cover/ })).toHaveCount(0);
    await expect(tray.getByLabel('Pile name', { exact: true })).toHaveCount(0);
    const grid = tray.getByLabel('Pile cards', { exact: true });
    const bounds = await grid.locator('.pile-entry').evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width };
      }),
    );
    expect(bounds[4].y).toBe(bounds[0].y);
    expect(bounds[5].y).toBeGreaterThan(bounds[0].y);
    expect(await grid.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('tray-12-desktop.png') });
    const source = tray.getByRole('article', { name: 'Read: Card 4', exact: true });
    const target = tray.getByRole('article', { name: 'Read: NPC', exact: true });
    await dragOnto(page, source, target);
    const ordered = [...f.ids];
    ordered.splice(7, 1);
    ordered.splice(1, 0, f.ids[7]);
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
      .toEqual(ordered);
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.cover).toBe(
      f.ids[0],
    );
    // Native popovers stay interactive above the native modal and retain keyboard ordering.
    await tray.getByRole('button', { name: 'Card actions: NPC', exact: true }).press('Enter');
    const actions = page.getByRole('group', { name: 'Actions for NPC', exact: true });
    await expect(actions).toBeVisible();
    await actions.getByRole('button', { name: 'Move earlier', exact: true }).press('Enter');
    [ordered[1], ordered[2]] = [ordered[2], ordered[1]];
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
      .toEqual(ordered);
    for (const [title, id, label, destination] of [
      ['NPC', f.ids[1], 'Other pile drop target', 'PILE_2'],
      ['Scene', f.ids[0], 'Session Cards drop target', 'SESSION_CARDS'],
      ['Relic', f.ids[2], 'Used cards drop target', 'USED'],
    ]) {
      await dragOnto(
        page,
        tray.getByRole('article', { name: `Read: ${title}`, exact: true }),
        tray.getByLabel(label, { exact: true }),
      );
      await expect
        .poll(async () => {
          const state = await (await request.get(`${f.endpoint}/workspace`)).json();
          return destination === 'PILE_2'
            ? state.pile2.items
            : destination === 'USED'
              ? state.used
              : state.sessionCards;
        })
        .toContain(id);
      await expect(tray).toBeVisible();
    }
    w = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(w.pile1.cover).toBe(f.ids[7]);
    await tray.getByRole('button', { name: 'Close pile', exact: true }).press('Enter');
    await expect(opener).toBeFocused();
  } finally {
    await page.mouse.up();
    await rm(f.root, { recursive: true, force: true });
  }
});

async function fillPile(request: APIRequestContext, endpoint: string, ids: string[]) {
  let w = await (await request.get(`${endpoint}/workspace`)).json();
  for (const item of ids) {
    const response = await request.post(`${endpoint}/workspace/move`, {
      data: { revision: w.revision, item, destination: 'PILE_1' },
    });
    expect(response.ok()).toBe(true);
    w = await response.json();
  }
  return w;
}

test('PUX-2 compact piles handle zero, one and two cards, rename and cover cycling without changing the reader', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    await page.goto(f.url);
    const p1 = page.getByRole('region', { name: 'Runtime Pile 1', exact: true });
    const p2 = page.getByRole('region', { name: 'Runtime Pile 2', exact: true });
    await expect(p1.locator('.pile-count')).toHaveText('0 cards');
    await expect(
      p1.getByRole('button', { name: 'Next cover: Pile 1', exact: true }),
    ).toBeDisabled();
    await p1.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const tray = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
    await expect(tray).toContainText('This pile is empty.');
    await expect(tray.getByRole('button', { name: 'Close pile', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(p1.getByRole('button', { name: 'Show all: Pile 1', exact: true })).toBeFocused();
    await action(page, 'NPC', 'Move to Pile 1');
    await saved(page);
    await expect(p1.locator('.pile-count')).toHaveText('1 card');
    await expect(p1.locator('.stacked')).toHaveCount(0);
    await expect(
      p1.getByRole('button', { name: 'Next cover: Pile 1', exact: true }),
    ).toBeDisabled();
    await action(page, 'Relic', 'Move to Pile 1');
    await saved(page);
    await expect(p1.locator('.pile-count')).toHaveText('2 cards');
    await expect(p1.locator('.stacked')).toHaveCount(1);
    await expect(p1.locator('.cdk-drag')).toHaveCount(1);
    await p1.getByRole('button', { name: 'Rename pile: Pile 1', exact: true }).click();
    await expect(p1.getByLabel('Pile name', { exact: true })).toBeFocused();
    await p1.getByLabel('Pile name', { exact: true }).fill('Discarded');
    await p1.getByLabel('Pile name', { exact: true }).press('Escape');
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.name).toBeNull();
    await read(page, 'NPC');
    await p1.getByRole('button', { name: 'Next cover: Pile 1', exact: true }).press('Enter');
    await saved(page);
    await expect(p1.getByRole('article', { name: 'Read: Relic', exact: true })).toBeVisible();
    await expect(page.locator('.source-page')).toContainText('Complete frozen NPC document.');
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items).toEqual([
      f.ids[1],
      f.ids[2],
    ]);
    const cardBox = (await p1.locator('.pile-display').boundingBox())!;
    const emptyBox = (await p2.locator('.pile-display').boundingBox())!;
    const sceneBox = (await page
      .getByRole('region', { name: 'Active Scene', exact: true })
      .locator('.empty-slot')
      .boundingBox())!;
    expect(Math.abs(cardBox.y - emptyBox.y)).toBeLessThan(2);
    expect(Math.abs(cardBox.y - sceneBox.y)).toBeLessThan(2);
    expect(cardBox.height).toBeCloseTo(emptyBox.height, 0);
    await page.screenshot({ path: info.outputPath('focus-piles.png'), fullPage: true });
    await p1.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    await tray.getByRole('article', { name: 'Read: NPC', exact: true }).press('Enter');
    await expect(tray).toBeHidden();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-2 tray stays bounded and scrolls independently at desktop and narrow widths', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request, false, undefined, 8);
  try {
    await fillPile(request, f.endpoint, f.ids);
    await page.goto(f.url);
    await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const tray = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
    const grid = tray.getByLabel('Pile cards', { exact: true });
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await grid.evaluate((el) => el.scrollTo(0, 0));
      const dialog = (await tray.boundingBox())!;
      expect(dialog.x).toBeGreaterThanOrEqual(0);
      expect(dialog.y).toBeGreaterThanOrEqual(0);
      expect(dialog.x + dialog.width).toBeLessThanOrEqual(size.width);
      expect(dialog.y + dialog.height).toBeLessThanOrEqual(size.height);
      const heading = tray.locator('.tray-heading');
      const top = (await heading.boundingBox())!.y;
      for (const label of [
        'Other pile drop target',
        'Session Cards drop target',
        'Used cards drop target',
      ]) {
        const box = (await tray.getByLabel(label, { exact: true }).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(dialog.x);
        expect(box.x + box.width).toBeLessThanOrEqual(dialog.x + dialog.width);
        if (size.width > 1000)
          expect(
            Math.abs(
              box.y -
                (await tray.getByRole('button', { name: 'Close pile', exact: true }).boundingBox())!
                  .y,
            ),
          ).toBeLessThan(10);
      }
      const card = (await grid.locator('playing-card article').first().boundingBox())!;
      expect(card.height / card.width).toBeCloseTo(420 / 243, 2);
      await page.screenshot({ path: info.outputPath(`tray-${size.width}.png`) });
      await grid.hover();
      await page.mouse.wheel(0, 600);
      await expect.poll(() => grid.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect((await heading.boundingBox())!.y).toBe(top);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await tray.getByRole('button', { name: 'Close pile', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Show all: Pile 1', exact: true })).toBeFocused();
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-2 failed modal movement retains intent and retries with accessible keyboard destinations', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    const before = await fillPile(request, f.endpoint, f.ids.slice(0, 3));
    await page.goto(f.url);
    await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const tray = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
    await page.route(`**${f.endpoint}/workspace/move`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Tray move failed' }),
      }),
    );
    const keyboardMove = async (title: string, name: string) => {
      await tray
        .getByRole('button', { name: `Card actions: ${title}`, exact: true })
        .press('Enter');
      await page
        .getByRole('group', { name: `Actions for ${title}`, exact: true })
        .getByRole('button', { name, exact: true })
        .press('Enter');
    };
    await keyboardMove('Scene', 'Mark used');
    await expect(tray.getByRole('alert')).toContainText('Tray move failed');
    await expect(
      tray.getByRole('button', { name: 'Card actions: NPC', exact: true }),
    ).toBeDisabled();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    await page.unroute(`**${f.endpoint}/workspace/move`);
    page.once('dialog', (dialog) => dialog.accept());
    await tray.getByRole('button', { name: 'Review / retry table action', exact: true }).click();
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).used)
      .toEqual([f.ids[0]]);
    await expect(tray.getByRole('alert')).toHaveCount(0);
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.cover).toBe(
      f.ids[1],
    );
    await keyboardMove('NPC', 'Move to Other pile');
    await saved(page);
    await keyboardMove('Relic', 'Return to Session Cards');
    await saved(page);
    await expect(tray).toContainText('This pile is empty.');
    const after = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(after.pile2.items).toEqual([f.ids[1]]);
    expect(after.pile1.cover).toBeNull();
    expect(after.sessionCards).toEqual([f.ids[2], f.ids[3]]);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-2 reading after closing the tray keeps the current page position', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(f.url);
    await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Pile 1 · Show all', exact: true })
      .getByRole('button', { name: 'Close pile', exact: true })
      .click();
    const card = page
      .locator('play-tabletop')
      .getByRole('article', { name: 'Read: NPC', exact: true });
    await card.scrollIntoViewIfNeeded();
    await card.focus();
    const y = await page.evaluate(() => scrollY);
    expect(y).toBeGreaterThan(0);
    await card.press('Enter');
    await expect(page.locator('.source-page')).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(y);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-2 keyboard reordering restores the saved card action focus for the next command', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    await fillPile(request, f.endpoint, [f.ids[1], f.ids[2]]);
    await page.goto(f.url);
    await page.getByRole('button', { name: 'Show all: Pile 1', exact: true }).click();
    const tray = page.getByRole('dialog', { name: 'Pile 1 · Show all', exact: true });
    const trigger = tray.getByRole('button', { name: 'Card actions: Relic', exact: true });
    for (const [command, expected] of [
      ['Move earlier', [f.ids[2], f.ids[1]]],
      ['Move later', [f.ids[1], f.ids[2]]],
    ] as const) {
      await trigger.press('Enter');
      await page
        .getByRole('group', { name: 'Actions for Relic', exact: true })
        .getByRole('button', { name: command, exact: true })
        .press('Enter');
      await expect
        .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.items)
        .toEqual(expected);
      await expect(trigger).toBeFocused();
    }
    expect((await (await request.get(`${f.endpoint}/workspace`)).json()).pile1.cover).toBe(
      f.ids[1],
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-2 side arrows leave fitting card-back text unobscured at laptop and narrow widths', async ({
  page,
  request,
}, info) => {
  const back = Array.from({ length: 24 }, (_, i) => `Middle line ${i + 1}.`).join('\n');
  const f = await fixture(request, false, back);
  try {
    await fillPile(request, f.endpoint, [f.ids[1], f.ids[2]]);
    await page.goto(f.url);
    const pile = page.getByRole('region', { name: 'Runtime Pile 1', exact: true });
    const card = pile.getByRole('article', { name: 'Read: NPC', exact: true });
    await card.getByRole('button', { name: 'Flip to back', exact: true }).click();
    await expect(card.getByRole('img', { name: 'Card back: NPC', exact: true })).toBeVisible();
    await expect(card).not.toHaveClass(/flipping/);
    for (const size of [
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 800, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await expect(card.getByRole('img', { name: 'Card back: NPC', exact: true })).toBeVisible();
      const overlaps = await pile.evaluate((el) => {
        const arrows = Array.from(el.querySelectorAll('.cover-arrow')).map((node) =>
          node.getBoundingClientRect(),
        );
        return Array.from(el.querySelectorAll('svg text'))
          .filter((node) => {
            const t = node.getBoundingClientRect();
            return arrows.some(
              (a) =>
                Math.min(t.right, a.right) > Math.max(t.left, a.left) &&
                Math.min(t.bottom, a.bottom) > Math.max(t.top, a.top),
            );
          })
          .map((node) => node.textContent);
      });
      await page.screenshot({
        path: info.outputPath(`pile-back-${size.width}.png`),
        fullPage: true,
      });
      expect(overlaps).toEqual([]);
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
