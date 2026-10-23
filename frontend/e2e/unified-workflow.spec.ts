import { test, expect, Page, Locator, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 10_000 });
async function fixture(request: APIRequestContext) {
  const root = await mkdtemp(join(tmpdir(), 'uw6-workflow-'));
  for (const [name, type] of [
    ['Harbour arrival', 'scene'],
    ['Harbour keeper', 'npc'],
    ['Harbour relic', 'item'],
  ])
    await writeFile(
      join(root, `${type}.md`),
      `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: ${name}\n  type: ${type}\n  purpose: session\n  status: current\n  tags: [harbour]\n  summary: Authored ${name}.\n---\n# ${name}\nOriginal harbour research.\n` +
        Array.from(
          { length: 40 },
          (_, i) => `\n## Passage ${i}\nDetailed harbour research ${i}.\n`,
        ).join(''),
    );
  const campaign = await (
    await request.post('/api/campaigns', {
      data: { name: 'UW6 workflow', directory: root },
    })
  ).json();
  const base = `/api/campaigns/${campaign.id}`;
  await request.post(`${base}/sources/refresh`);
  const session = await (
    await request.post(`${base}/sessions`, {
      data: { title: 'Harbour session', objective: '' },
    })
  ).json();
  return { root, campaign, base, session, endpoint: `${base}/sessions/${session.id}` };
}
async function mode(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Workspace mode' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function tableAction(page: Page, title: string, name: string) {
  await page
    .locator('read-card-table')
    .getByRole('article', { name: `Read: ${title}`, exact: true })
    .getByRole('button', { name: `Card actions: ${title}`, exact: true })
    .click();
  await page.getByRole('menuitem', { name, exact: true }).click();
  await expect(page.getByLabel('Session save status')).toHaveText('Saved');
}
async function settledScroll(region: Locator) {
  // Keyboard scrolling animates after the first nonzero position; wait for its actual end.
  await region.evaluate(
    (node) =>
      new Promise<void>((resolve) => {
        let previous = node.scrollTop,
          stable = 0;
        const frame = () => {
          stable = node.scrollTop === previous ? stable + 1 : 0;
          previous = node.scrollTop;
          if (stable >= 6) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
}

test('research, author, prepare, plan, play and update preserve the same session through portable recovery', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  const f = await fixture(request);
  const reader = page.getByRole('article', { name: 'Selected Library document' });
  const prepared = page.getByRole('article', { name: 'Prepared source', exact: true });
  const outline = page.getByLabel('Session outline');
  try {
    await page.goto(`/library?campaign=${f.campaign.id}&session=${f.session.id}`);
    await page.getByRole('button', { name: 'Harbour keeper npc', exact: false }).click();
    await reader.getByRole('button', { name: 'Edit in Write', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Harbour keeper');
    const draftId = new URL(page.url()).searchParams.get('draft')!;
    await page.getByLabel('Markdown body').fill('# Keeper\nAuthored keeper revision one.');
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page.getByLabel('Supporting panel', { exact: true }).selectOption('library');
    const references = page.getByRole('region', { name: 'Library references' });
    await references.getByRole('button', { name: 'Harbour arrival · scene', exact: true }).click();
    await references.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect(reader).toContainText('Original harbour research.');
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Return to Write', exact: true }).click();
    await expect(page.getByLabel('Markdown body')).toHaveValue(
      '# Keeper\nAuthored keeper revision one.',
    );
    await mode(page, 'Library');
    await page.getByRole('button', { name: 'Harbour keeper npc', exact: false }).click();
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    await reader.getByRole('button', { name: 'View in Prepare', exact: true }).click();
    await outline.getByRole('button', { name: 'Harbour arrival', exact: true }).click();
    await prepared.getByRole('button', { name: 'Scene planning', exact: true }).click();
    const link = prepared.getByRole('button', { name: 'Link: Harbour keeper', exact: true });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(
      prepared.getByRole('button', { name: 'Unlink: Harbour keeper', exact: true }),
    ).toBeVisible();
    await mode(page, 'Play');
    await tableAction(page, 'Harbour arrival', 'Focus card');
    await page
      .getByRole('button', { name: 'Activate scene: Harbour arrival', exact: true })
      .press('Enter');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    const related = page.getByRole('region', { name: 'Related cards', exact: true });
    await expect(related).toContainText('Harbour keeper');
    await related.getByRole('button', { name: 'Focus: Harbour keeper', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await tableAction(page, 'Harbour keeper', 'Mark used');
    let frozen = await (await request.get(f.endpoint)).json();
    const scene = frozen.items.find((i: { title: string }) => i.title === 'Harbour arrival');
    const keeper = frozen.items.find((i: { title: string }) => i.title === 'Harbour keeper');
    // Observe the dispatched asynchronous mutation before comparing persisted runtime state.
    await expect
      .poll(async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).used)
      .toEqual([keeper.id]);
    let runtime = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(runtime.activeSceneItemId).toBe(scene.id);
    expect(runtime.focusedItemIds).toEqual([scene.id, keeper.id]);
    expect(runtime.used).toEqual([keeper.id]);

    await mode(page, 'Library');
    await page.getByRole('button', { name: 'Harbour relic item', exact: false }).click();
    await expect(reader).toContainText('Original harbour research.');
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(runtime);
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    frozen = await (await request.get(f.endpoint)).json();
    const afterAdd = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(afterAdd.focusedItemIds).toEqual(runtime.focusedItemIds);
    expect(afterAdd.activeSceneItemId).toBe(runtime.activeSceneItemId);
    expect(afterAdd.used).toEqual(runtime.used);
    expect(afterAdd.active[0]).toBe(frozen.items[2].id);
    runtime = afterAdd;
    await page.getByRole('button', { name: 'Harbour keeper npc', exact: false }).click();
    await reader.getByRole('button', { name: 'Edit in Write', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('draft')).toBe(draftId);
    await page.getByLabel('Markdown body').fill('# Keeper\nAuthored keeper revision two.');
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await mode(page, 'Library');
    await page.getByRole('button', { name: 'Harbour keeper npc', exact: false }).click();
    await reader.getByRole('button', { name: 'View in Prepare', exact: true }).click();
    await expect(prepared.getByText('Update available', { exact: true })).toBeVisible();
    await prepared.getByRole('button', { name: 'Use latest version', exact: true }).click();
    await expect(prepared).toContainText('Authored keeper revision two.');
    const updated = await (await request.get(f.endpoint)).json();
    expect(updated.items.map((i: { id: string }) => i.id)).toEqual(
      frozen.items.map((i: { id: string }) => i.id),
    );
    expect(updated.sceneLinks).toEqual(frozen.sceneLinks);
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(runtime);
    await mode(page, 'Play');
    await expect(page.getByRole('region', { name: 'Related cards', exact: true })).toContainText(
      'Used',
    );

    const archive = await request.post(`${f.base}/sessions/portable-export`, {
      data: { sessions: [f.session.id] },
    });
    expect(archive.ok()).toBe(true);
    const importedResponse = await request.post(`${f.base}/sessions/portable-import`, {
      data: await archive.body(),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    expect(importedResponse.ok(), await importedResponse.text()).toBe(true);
    const imported = (await importedResponse.json()).sessions[0];
    await page.goto(`/?campaign=${f.campaign.id}&session=${imported.id}&mode=play&view=prepare`);
    await expect(page.locator('play-tabletop')).toContainText('Active scene: Harbour arrival');
    await expect(page.getByRole('region', { name: 'Related cards', exact: true })).toContainText(
      'Used',
    );
    await page.getByRole('button', { name: 'Expand: Harbour keeper', exact: true }).click();
    await expect(prepared).toContainText('Authored keeper revision two.');
    await expect(prepared).toBeFocused();
    await expect(prepared).toHaveAttribute('tabindex', '0');
    const restored = await (
      await request.get(`${f.base}/sessions/${imported.id}/workspace`)
    ).json();
    expect(restored.focusedItemIds).toHaveLength(2);
    expect(restored.focusedItemIds).not.toContain(keeper.id);
    expect(restored.used).toHaveLength(1);
    expect(restored.activeSceneItemId).not.toBe(scene.id);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Write editor, preview and Prepare reader/notes scroll independently with keyboard access at laptop and narrow widths', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    await page.goto(`/library?campaign=${f.campaign.id}&session=${f.session.id}`);
    await page.getByRole('button', { name: 'Harbour keeper npc', exact: false }).click();
    await page.getByRole('button', { name: 'Edit in Write', exact: true }).click();
    await page.getByRole('button', { name: 'Full document', exact: true }).click();
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 });
      const editor = page.locator('.draft-editor'),
        preview = page.locator('.preview-panel');
      await expect(
        preview.getByText('Detailed harbour research 39.', { exact: true }),
      ).toBeVisible();
      await editor.evaluate((node) => (node.scrollTop = 0));
      await preview.evaluate((node) => {
        node.focus();
      });
      await expect(preview).toHaveAttribute('tabindex', '0');
      await page.keyboard.press('PageDown');
      await expect.poll(() => preview.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      await settledScroll(preview);
      expect(await editor.evaluate((node) => node.scrollTop)).toBe(0);
      await preview.evaluate((node) => (node.scrollTop = 0));
      await page
        .getByRole('navigation', { name: 'Editing tabs' })
        .getByRole('button', { name: 'Card', exact: true })
        .press('Enter');
      await expect(page.getByLabel('Card artwork')).toBeVisible();
      await editor.evaluate((node) => (node.scrollTop = 150));
      expect(await editor.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      expect(await preview.evaluate((node) => node.scrollTop)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`write-scroll-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await mode(page, 'Library');
    const reader = page.getByRole('article', { name: 'Selected Library document' });
    await page.getByRole('button', { name: 'Harbour keeper npc', exact: false }).click();
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    await reader.getByRole('button', { name: 'View in Prepare', exact: true }).click();
    await page.getByLabel('Item Markdown notes').fill('Working notes.\n'.repeat(90));
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 });
      const source = page.locator('.source-page'),
        notes = page.locator('.notes-page');
      await notes.evaluate((node) => (node.scrollTop = 0));
      await source.evaluate((node) => {
        node.scrollTop = 0;
        node.focus();
      });
      await expect(source).toHaveAttribute('tabindex', '0');
      await page.keyboard.press('PageDown');
      await expect.poll(() => source.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      await settledScroll(source);
      expect(await notes.evaluate((node) => node.scrollTop)).toBe(0);
      await notes.evaluate((node) => (node.scrollTop = 150));
      expect(await notes.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`prepare-scroll-${width}.png`),
        fullPage: true,
      });
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
