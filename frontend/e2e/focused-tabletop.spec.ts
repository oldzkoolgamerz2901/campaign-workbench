import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function fixture(request: APIRequestContext, related = false) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-p4-'));
  const names = ['Scene', 'NPC', 'Relic', 'Fourth', 'Extra'];
  for (const [index, name] of names.entries()) {
    await writeFile(
      join(root, `${name}.md`),
      `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: ${name}\n  type: ${index === 0 || index === 3 ? 'scene' : index === 1 ? 'npc' : 'item'}\n  purpose: session\n  status: current\n  summary: Frozen reference for ${name}.\n  tags: [focus-fixture]\n---\n# Full ${name}\nComplete frozen ${name} document. [Visit Fourth](Fourth.md) [Visit NPC](NPC.md) [Visit Scene](Scene.md) ${related ? '[Again](./NPC.md) [Section](NPC.md#background) [Extra](Extra.md) [Missing](Missing.md) [Unsafe](javascript:alert)' : ''}\n\n## Background\nReference background for ${name}.`,
    );
  }
  const campaign = await (
    await request.post('/api/campaigns', {
      data: { name: 'Focused tabletop fixtures', directory: root },
    })
  ).json();
  const capture = await (
    await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
  ).json();
  let session = await (
    await request.post(`/api/campaigns/${campaign.id}/sessions`, {
      data: { title: 'Focused session', objective: '' },
    })
  ).json();
  const endpoint = `/api/campaigns/${campaign.id}/sessions/${session.id}`;
  for (const name of names.slice(0, 4))
    session = await (
      await request.post(`${endpoint}/sources`, {
        data: {
          revision: session.revision,
          capture: capture.capture,
          path: `${name}.md`,
          section: null,
        },
      })
    ).json();
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
async function menu(page: Page, title: string, action: string) {
  await page
    .locator('read-card-table')
    .getByRole('button', { name: `Card actions: ${title}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}
async function saved(page: Page) {
  // Let Angular paint the edit before waiting for Saved; the old label may still be visible.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.getByLabel('Session save status')).toHaveText('Saved');
}
async function seed(request: APIRequestContext, endpoint: string, ids: string[]) {
  const workspace = await (await request.get(`${endpoint}/workspace`)).json();
  expect(
    (
      await request.put(`${endpoint}/workspace`, {
        data: { ...workspace, activeSceneItemId: ids[0], focusedItemIds: ids.slice(0, 3) },
      })
    ).ok(),
  ).toBeTruthy();
  return (await request.get(`${endpoint}/workspace`)).json();
}

test('focus, fourth-card inspection, explicit scene/replacement, expansion and Prepare continuity', async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const f = await fixture(request);
  const [scene, npc, relic, fourth] = f.ids;
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(f.url);
    for (const name of ['Scene', 'NPC', 'Relic']) {
      await menu(page, name, 'Focus card');
      await saved(page);
    }
    const tabletop = page.locator('play-tabletop');
    const slots = tabletop.locator('[data-focus-slot]');
    await expect(slots).toHaveCount(3);
    expect(
      await slots.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).dataset['itemId']),
      ),
    ).toEqual([scene, npc, relic]);
    expect(
      (await (await request.get(`${f.endpoint}/workspace`)).json()).activeSceneItemId,
    ).toBeNull();
    await tabletop
      .getByRole('button', { name: 'Activate scene: Scene', exact: true })
      .press('Enter');
    await saved(page);
    await menu(page, 'NPC', 'Mark used');
    await saved(page);
    await expect(slots.nth(1)).toContainText('Used');
    await page.locator('.notes-page').getByRole('button', { name: 'Session', exact: true }).click();
    await page.getByRole('button', { name: 'Hide notes', exact: true }).click();
    await expect(page.locator('.notes-page')).toBeHidden();
    await page.getByRole('button', { name: 'Show notes', exact: true }).click();
    await expect(page.locator('.notes-page')).toContainText('Anchored session note.');
    await saved(page);
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    await page
      .locator('read-card-table')
      .getByRole('article', { name: 'Read: Fourth', exact: true })
      .press('Enter');
    const inspection = tabletop.getByRole('complementary', {
      name: 'Temporary inspection',
      exact: true,
    });
    await expect(inspection).toBeVisible();
    await expect(
      inspection.getByRole('heading', { name: 'Temporary inspection: Fourth', exact: true }),
    ).toBeFocused();
    await expect(slots).toHaveCount(3);
    await saved(page);
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    await expect(page.locator('.notes-page')).toContainText('Anchored session note.');
    await page.screenshot({ path: info.outputPath('inspection-1280.png'), fullPage: true });
    await inspection
      .getByRole('button', { name: 'Replace focus 2: NPC', exact: true })
      .press('Enter');
    await saved(page);
    const replaced = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(replaced.focusedItemIds).toEqual([scene, fourth, relic]);
    expect(replaced.activeSceneItemId).toBe(scene);
    expect(replaced.used).toEqual([npc]);
    await expect(inspection).toHaveCount(0);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const card of await slots.locator('playing-card article').all()) {
        const box = (await card.boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(243 / 420, 2);
        expect(box.width).toBeLessThanOrEqual(320);
        expect(box.width).toBeGreaterThan(150);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width <= 390) {
        const notes = (await page.locator('.notes-page').boundingBox())!;
        const stage = (await tabletop.boundingBox())!;
        expect(notes.width).toBeCloseTo(stage.width, 0);
      }
      await tabletop.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`focus-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const layout = await page.locator('.notes-page').evaluate((node) => {
      const notes = node.getBoundingClientRect(),
        focus = document.querySelector('play-tabletop')!.getBoundingClientRect();
      return {
        alongside: notes.left >= focus.right,
        overlapY: notes.top < focus.bottom && notes.bottom > focus.top,
      };
    });
    expect(layout).toEqual({ alongside: true, overlapY: true });
    await tabletop.getByRole('button', { name: 'Expand: Scene', exact: true }).press('Enter');
    await expect(tabletop.getByRole('navigation', { name: 'Expanded focus' })).toBeVisible();
    await expect(page.locator('.source-page')).toContainText('Complete frozen Scene document.');
    await expect(page.locator('.source-page')).toBeFocused();
    await expect(page.locator('.notes-page')).toContainText('Anchored session note.');
    await page.screenshot({ path: info.outputPath('expanded-1280.png'), fullPage: true });
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Prepare', exact: true })
      .click();
    await page.getByRole('button', { name: 'Add source material', exact: true }).click();
    await page.getByRole('button', { name: 'Extra.md', exact: true }).click();
    await page.getByRole('button', { name: 'Add document to session', exact: true }).click();
    await saved(page);
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await expect(
      tabletop.getByRole('button', { name: 'Expand: Scene', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await saved(page);
    await expect(page.locator('.source-page')).toContainText('Complete frozen Scene document.');
    const added = await (await request.get(f.endpoint)).json();
    const extra = added.items.at(-1).id;
    const resumed = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(resumed.active[0]).toBe(extra);
    expect(resumed.focusedItemIds).toEqual([scene, fourth, relic]);
    expect(resumed.activeSceneItemId).toBe(scene);
    await tabletop
      .getByRole('button', { name: 'Return to focused cards', exact: true })
      .press('Enter');
    await expect(slots).toHaveCount(3);
    await expect(
      tabletop.getByRole('button', { name: 'Expand: Scene', exact: true }),
    ).toBeFocused();
    await page
      .locator('read-card-table')
      .getByRole('article', { name: 'Read: Extra', exact: true })
      .press('Enter');
    await expect(inspection).toBeVisible();
    await page.reload();
    await expect(page.locator('play-tabletop [data-focus-slot]')).toHaveCount(3);
    await expect(
      page.getByRole('complementary', { name: 'Temporary inspection', exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('play-tabletop')).toContainText('Active scene: Scene');
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Prepare', exact: true })
      .click();
    await page
      .locator('session-contents')
      .getByRole('button', { name: 'Scene', exact: true })
      .click();
    await page.getByRole('button', { name: 'Remove: Scene', exact: true }).click();
    await saved(page);
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await saved(page);
    await expect(page.locator('play-tabletop [data-focus-slot]')).toHaveCount(2);
    const removed = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(removed.focusedItemIds).toEqual([fourth, relic]);
    expect(removed.activeSceneItemId).toBeNull();
    expect(removed.used).toEqual([npc]);
    expect((await (await request.get(f.endpoint)).json()).notes).toBe('Anchored session note.');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('failed focus replacement retains local cards and expansion until explicit workspace discard', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    const original = await seed(request, f.endpoint, f.ids);
    const other = await (
      await request.post(`/api/campaigns/${f.campaign.id}/sessions`, {
        data: { title: 'Focus destination', objective: '' },
      })
    ).json();
    await page.goto(f.url);
    await expect(page.locator('play-tabletop [data-focus-slot]')).toHaveCount(3);
    await page.route(`**${f.endpoint}/workspace`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Focus changed elsewhere' }),
          })
        : route.continue(),
    );
    await menu(page, 'Fourth', 'Inspect / replace focus');
    await page.getByRole('button', { name: 'Replace focus 2: NPC', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
    await page
      .locator('play-tabletop')
      .getByRole('button', { name: 'Expand: Fourth', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('Complete frozen Fourth document.');
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Focus destination', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`session=${f.session.id}`));
    await expect(
      page.locator('play-tabletop').getByRole('button', { name: 'Expand: Fourth', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(original);
    await page.unroute(`**${f.endpoint}/workspace`);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Reload / discard table changes', exact: true }).click();
    await saved(page);
    await expect(page.locator('play-tabletop [data-focus-slot]')).toHaveCount(3);
    expect(
      await page
        .locator('play-tabletop [data-focus-slot]')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset['itemId'])),
    ).toEqual(f.ids.slice(0, 3));
    await expect(page.locator('play-tabletop nav[aria-label="Expanded focus"]')).toHaveCount(0);
    expect(other.id).not.toBe(f.session.id);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('a late same-session reopen cannot restore old focus or expansion after session departure', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    const original = await seed(request, f.endpoint, f.ids);
    const other = await (
      await request.post(`/api/campaigns/${f.campaign.id}/sessions`, {
        data: { title: 'Late focus destination', objective: '' },
      })
    ).json();
    await page.goto(f.url);
    await page
      .locator('play-tabletop')
      .getByRole('button', { name: 'Expand: Scene', exact: true })
      .click();
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Prepare', exact: true })
      .click();
    let delivered!: () => void;
    const deliveredResponse = new Promise<void>((resolve) => (delivered = resolve));
    let requested!: () => void;
    const opening = new Promise<void>((resolve) => (requested = resolve));
    await page.route(`**${f.endpoint}/workspace`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      requested();
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(original),
      });
      delivered();
    });
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await opening;
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByRole('button', { name: 'Late focus destination', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`session=${other.id}`));
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await saved(page);
    release();
    await deliveredResponse;
    await page.unroute(`**${f.endpoint}/workspace`);
    await expect(page.locator('play-tabletop')).toHaveCount(0);
    const current = await (
      await request.get(`/api/campaigns/${f.campaign.id}/sessions/${other.id}/workspace`)
    ).json();
    expect(current.focusedItemIds).toEqual([]);
    expect(current.activeSceneItemId).toBeNull();
    await expect(page).toHaveURL(new RegExp(`session=${other.id}`));
  } finally {
    release();
    await rm(f.root, { recursive: true, force: true });
  }
});

for (const target of [null, 'Fourth', 'NPC', 'Scene'] as const) {
  test(`delayed same-session reopen preserves ${target ?? 'unchanged expanded'} reader intent`, async ({
    page,
    request,
  }) => {
    const f = await fixture(request);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    try {
      const original = await seed(request, f.endpoint, f.ids);
      await page.goto(f.url);
      await page
        .locator('play-tabletop')
        .getByRole('button', { name: 'Expand: Scene', exact: true })
        .click();
      const modes = page.getByRole('navigation', { name: 'Workspace mode' });
      await modes.getByRole('button', { name: 'Prepare', exact: true }).click();
      if (!target) {
        // Normal restoration must still override a selection made in Prepare.
        await page
          .locator('session-contents')
          .getByRole('button', { name: 'Relic', exact: true })
          .click();
      }
      let requested!: () => void;
      const opening = new Promise<void>((resolve) => (requested = resolve));
      await page.route(`**${f.endpoint}/workspace`, async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const response = await route.fetch();
        requested();
        await gate;
        await route.fulfill({ response });
      });
      await modes.getByRole('button', { name: 'Play', exact: true }).click();
      await opening;
      const reader = page.locator('.source-page');
      if (target) {
        if (target === 'Scene') {
          // Returning to the original ID is still newer explicit intent.
          await reader.getByRole('link', { name: 'Visit Fourth', exact: true }).click();
          await expect(reader).toContainText('Complete frozen Fourth document.');
        }
        await reader.getByRole('link', { name: `Visit ${target}`, exact: true }).click();
        await expect(reader).toContainText(`Complete frozen ${target} document.`);
      }
      release();
      await expect(page.getByText('Opening Play workspace…', { exact: true })).toHaveCount(0);
      const expected = target ?? 'Scene';
      await expect(reader).toContainText(`Complete frozen ${expected} document.`);
      const tabletop = page.locator('play-tabletop');
      const inspection = tabletop.getByRole('complementary', {
        name: 'Temporary inspection',
        exact: true,
      });
      if (target === 'Fourth') {
        await expect(inspection).toContainText('Temporary inspection: Fourth');
        await inspection.getByRole('button', { name: 'Close inspection', exact: true }).click();
        await expect(reader).toContainText('Complete frozen Scene document.');
      } else {
        await expect(inspection).toHaveCount(0);
        await expect(
          tabletop.getByRole('button', { name: `Expand: ${expected}`, exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
      }
      expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(original);
    } finally {
      release();
      await rm(f.root, { recursive: true, force: true });
    }
  });
}

test('related cards use exact session associations and explicit focus or full-slot inspection', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request, true);
  try {
    const added = await request.post(`${f.endpoint}/sources`, {
      data: {
        revision: f.session.revision,
        capture: f.session.items[1].provenance.capture,
        path: 'NPC.md',
        section: null,
      },
    });
    expect(added.ok()).toBeTruthy();
    let session = await added.json();
    const [scene, npc, relic, fourth] = f.ids;
    for (const item of [npc, fourth, session.items.at(-1).id]) {
      const linked = await request.put(`${f.endpoint}/scene-links/${scene}/${item}`, {
        data: { revision: session.revision, linked: true },
      });
      expect(linked.ok()).toBeTruthy();
      session = await linked.json();
    }
    const opened = await (await request.get(`${f.endpoint}/workspace`)).json();
    const initial = {
      ...opened,
      active: opened.active.filter((id: string) => id !== npc),
      used: [npc],
      activeSceneItemId: scene,
      focusedItemIds: [scene],
    };
    expect((await request.put(`${f.endpoint}/workspace`, { data: initial })).ok()).toBeTruthy();
    await page.goto(f.url);
    const related = page.getByRole('region', { name: 'Related cards', exact: true });
    await expect(related).toContainText('Used');
    await expect(related).not.toContainText('Not prepared');
    await expect(related.locator('.relationship')).toHaveCount(3);
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    const npcRelation = related
      .locator('.relationship')
      .filter({ has: page.locator('strong', { hasText: /^NPC$/ }) });
    await npcRelation
      .getByRole('button', { name: 'Focus: NPC', exact: true })
      .first()
      .press('Enter');
    await saved(page);
    const focused = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(focused.focusedItemIds).toEqual([scene, npc]);
    expect(focused.active).toEqual(before.active);
    expect(focused.used).toEqual([npc]);
    expect(focused.activeSceneItemId).toBe(scene);
    await menu(page, 'Relic', 'Focus card');
    await saved(page);
    const full = await (await request.get(`${f.endpoint}/workspace`)).json();
    await expect(related.getByRole('button', { name: 'Focus: Fourth', exact: true })).toHaveCount(
      0,
    );
    await related.getByRole('button', { name: 'Inspect: Fourth', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Temporary inspection: Fourth', exact: true }),
    ).toBeVisible();
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(full);
    await page.getByRole('button', { name: 'Replace focus 3: Relic', exact: true }).click();
    await saved(page);
    const replaced = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(replaced.focusedItemIds).toEqual([scene, npc, fourth]);
    expect(replaced.active).toEqual(full.active);
    expect(replaced.used).toEqual(full.used);
    expect(replaced.activeSceneItemId).toBe(scene);
    expect((await (await request.get(f.endpoint)).json()).revision).toBe(session.revision);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(related).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('related-390.png'), fullPage: true });
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
