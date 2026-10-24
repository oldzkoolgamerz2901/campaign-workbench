import { test, expect, Page } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { historicalSourceItem, importHistoricalSession } from './preparation-fixtures';

async function panel(page: Page, mode: 'Notes' | 'Document') {
  await page
    .getByRole('navigation', { name: 'Play supporting panel' })
    .getByRole('button', { name: mode, exact: true })
    .click();
}

test('PlayNotes retain drafts across tabletop interactions, recover Scene context and round-trip pinned history', async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-p5-'));
  try {
    for (const [name, type] of [
      ['Scene', 'scene'],
      ['NPC', 'npc'],
    ])
      await writeFile(
        join(root, `${name}.md`),
        `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: ${name}\n  type: ${type}\n  purpose: session\n  status: current\n  tags: []\n---\n# ${name}\nFrozen ${name} document.`,
      );
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'P5 Notes', directory: root } })
    ).json();
    const capture = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'P5 session', objective: '' },
      })
    ).json();
    const items = [];
    for (const name of ['Scene', 'NPC'])
      items.push(
        await historicalSourceItem(request, campaign.id, {
          capture: capture.capture,
          path: `${name}.md`,
          section: null,
        }),
      );
    session = await importHistoricalSession(request, campaign.id, session, items);
    const endpoint = `/api/campaigns/${campaign.id}/sessions/${session.id}`,
      scene = session.items[0].id,
      npc = session.items[1].id;
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&mode=play&view=prepare`);
    const notes = page.locator('play-notes'),
      text = notes.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await text.fill('**The NPC escaped.**');
    await notes.getByLabel('Primary resource', { exact: true }).selectOption(npc);
    await page
      .locator('play-tabletop')
      .getByRole('article', { name: 'Read: NPC', exact: true })
      .press('Enter');
    await panel(page, 'Notes');
    await expect(text).toHaveValue('**The NPC escaped.**');
    await expect(notes.getByLabel('Primary resource', { exact: true })).toHaveValue(npc);
    // A real concurrent Scene command must not silently change the draft context.
    let w = await (await request.get(`${endpoint}/workspace`)).json();
    expect(
      (
        await request.post(`${endpoint}/workspace/scene`, {
          data: {
            revision: w.revision,
            preparationRevision: session.revision,
            scene,
            movements: [],
          },
        })
      ).ok(),
    ).toBe(true);
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(notes.getByRole('alert')).toContainText('active Scene changed');
    await expect(text).toHaveValue('**The NPC escaped.**');
    await notes.getByRole('button', { name: 'Refresh and use current Scene', exact: true }).click();
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    const chronology = notes.getByRole('region', { name: 'PlayNote chronology' });
    await expect(chronology.locator('strong')).toHaveText('The NPC escaped.');
    await expect(text).toHaveValue('');
    const original = await (await request.get(`${endpoint}/play-notes`)).json();
    expect(original.notes).toHaveLength(1);
    expect(original.notes[0].scene.title).toBe('Scene');
    expect(original.notes[0].resource.title).toBe('NPC');
    await notes.getByRole('button', { name: 'Edit / pin note', exact: true }).click();
    await notes.getByLabel('Pinned', { exact: true }).check();
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(notes.getByRole('region', { name: 'Pinned PlayNotes' })).toContainText(
      'The NPC escaped.',
    );
    await expect(chronology.locator('article')).toHaveCount(1);
    await notes.getByRole('button', { name: 'Edit / pin note', exact: true }).click();
    await notes.getByRole('button', { name: 'Clear primary association', exact: true }).click();
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(chronology).toContainText('Resource: None');
    // Lost create response: retry the same operation; no duplicate capture.
    let dropped = false;
    await page.route('**/play-notes', async (route) => {
      if (route.request().method() === 'POST' && !dropped) {
        dropped = true;
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    });
    await text.fill('Second capture');
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(
      notes.getByRole('button', { name: 'Retry PlayNote save', exact: true }),
    ).toBeVisible();
    await expect(text).toHaveValue('Second capture');
    await notes.getByRole('button', { name: 'Retry PlayNote save', exact: true }).click();
    await expect(chronology.locator('article')).toHaveCount(2);
    await page.unroute('**/play-notes');
    const saved = await (await request.get(`${endpoint}/play-notes`)).json();
    expect(saved.notes).toHaveLength(2);
    expect(saved.notes[1].createdAt).toBe(original.notes[0].createdAt);
    expect(saved.notes[1].pinned).toBe(true);
    // Leaving can be cancelled without dropping the draft or its association.
    await text.fill('Keep local draft');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Library', exact: true }).first().click();
    await expect(text).toHaveValue('Keep local draft');
    page.once('dialog', (d) => d.accept());
    await notes.getByRole('button', { name: 'Discard draft', exact: true }).click();
    const archive = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions/export`, {
        data: { sessions: [session.id] },
      })
    ).json();
    expect(archive.version).toBe(10);
    expect(archive.notes).toHaveLength(2);
    const imported = await request.post(`/api/campaigns/${campaign.id}/sessions/import`, {
      data: archive,
    });
    expect(imported.ok(), await imported.text()).toBe(true);
    const restored = (await imported.json()).sessions[0].id;
    await page.goto(`/?campaign=${campaign.id}&session=${restored}&mode=play&view=prepare`);
    await expect(chronology.locator('article')).toHaveCount(2);
    await expect(notes.getByRole('region', { name: 'Pinned PlayNotes' })).toBeVisible();
    const after = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${restored}/play-notes`)
    ).json();
    expect(after.notes[1].id).not.toBe(saved.notes[1].id);
    expect(after.notes[1].scene).toEqual(saved.notes[1].scene);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: '/tmp/p5-laptop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(text).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: '/tmp/p5-narrow.png', fullPage: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
