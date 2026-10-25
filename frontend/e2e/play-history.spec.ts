import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { addLibraryFixture } from './preparation-fixtures';

test('cross-session history paginates pins and context without changing drafts, and uses guarded session navigation', async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-p6-'));
  try {
    const card = randomUUID();
    await writeFile(
      join(root, 'scene.md'),
      `---\nworkbench:\n  schema: 1\n  id: ${card}\n  title: Old Scene\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Frozen Scene`,
    );
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'P6 History', directory: root } })
    ).json();
    const base = `/api/campaigns/${campaign.id}`;
    const capture = await (await request.post(`${base}/sources/refresh`)).json();
    async function session(title: string) {
      const created = await (
        await request.post(`${base}/sessions`, { data: { title, objective: '' } })
      ).json();
      return (
        await addLibraryFixture(request, `${base}/sessions/${created.id}`, {
          data: { revision: created.revision, capture: capture.capture, path: 'scene.md' },
        })
      ).json();
    }
    const previous = await session('Previous session'),
      current = await session('Current session');
    const endpoint = `${base}/sessions/${previous.id}`;
    const ids: string[] = [];
    for (let i = 0; i < 23; i++) {
      const response = await request.post(`${endpoint}/play-notes`, {
        data: {
          operation: randomUUID(),
          expectedScene: null,
          resource: previous.items[0].id,
          markdown: `Historical event ${i}`,
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      ids.push((await response.json()).id);
    }
    expect(
      (
        await request.put(`${endpoint}/play-notes/${ids[0]}`, {
          data: {
            revision: 0,
            markdown: 'Pinned oldest event',
            pinned: true,
            changeResource: false,
            resource: null,
          },
        })
      ).ok(),
    ).toBe(true);
    const workspace = await (await request.get(`${endpoint}/workspace`)).json();
    expect(
      (
        await request.post(`${endpoint}/workspace/scene`, {
          data: {
            revision: workspace.revision,
            preparationRevision: previous.revision,
            scene: previous.items[0].id,
            movements: [],
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await request.post(`${endpoint}/play-notes`, {
          data: {
            operation: randomUUID(),
            expectedScene: previous.items[0].id,
            resource: null,
            markdown: 'Scene-only event',
          },
        })
      ).ok(),
    ).toBe(true);
    // A removed/renamed live original never changes frozen history identity or captured titles.
    await rename(join(root, 'scene.md'), join(root, 'renamed.md'));
    await request.post(`${base}/sources/refresh`);
    await page.goto(`/?campaign=${campaign.id}&session=${current.id}&mode=play&view=prepare`);
    const panel = page.locator('play-notes'),
      text = panel.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await text.fill('Preserve this independent draft');
    await panel.getByLabel('Primary resource', { exact: true }).selectOption(current.items[0].id);
    await panel
      .getByRole('navigation', { name: 'Notes views' })
      .getByRole('button', { name: 'History', exact: true })
      .click();
    await panel.getByRole('button', { name: 'Card history across sessions', exact: true }).click();
    const history = panel.getByRole('region', { name: 'Cross-session card history', exact: true });
    await history.getByLabel('History prepared copy').selectOption(current.items[0].id);
    const chronology = history.getByRole('region', {
      name: 'Card history chronology',
      exact: true,
    });
    const pins = history.getByRole('region', { name: 'Pinned card history', exact: true });
    await expect(chronology.locator('article')).toHaveCount(20);
    await expect(pins.locator('article')).toHaveCount(1);
    await expect(pins).toContainText('Pinned oldest event');
    await expect(chronology).not.toContainText('Scene-only event');
    await history.getByRole('button', { name: 'More card history', exact: true }).click();
    await expect(chronology.locator('article')).toHaveCount(23);
    await expect(chronology).toContainText('Pinned oldest event');
    await expect(text).toHaveValue('Preserve this independent draft');
    await expect(panel.getByLabel('Primary resource', { exact: true })).toHaveValue(
      current.items[0].id,
    );
    // Reading history and changing its association dimension never mutates note context.
    await history.getByLabel('History association').selectOption('scene');
    await expect(chronology.locator('article')).toHaveCount(1);
    await expect(chronology).toContainText('Scene-only event');
    await expect(text).toHaveValue('Preserve this independent draft');
    page.once('dialog', (d) => d.dismiss());
    await chronology.getByRole('link', { name: 'Open session: Previous session' }).click();
    await expect(text).toHaveValue('Preserve this independent draft');
    await expect(page).toHaveURL(new RegExp(`session=${current.id}`));
    await history
      .getByRole('heading', { name: 'Card history across sessions', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/p6-laptop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(history.getByLabel('History association')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '/tmp/p6-narrow.png', fullPage: true });
    page.once('dialog', (d) => d.accept());
    await chronology.getByRole('link', { name: 'Open session: Previous session' }).click();
    await expect(page).toHaveURL(new RegExp(`session=${previous.id}`));
    await expect(text).toHaveValue('');
    // Remove every prepared copy in this session; captured Scene evidence is still usable.
    const saved = await (await request.get(endpoint)).json();
    expect(
      (
        await request.put(endpoint, {
          data: {
            revision: saved.revision,
            title: saved.title,
            objective: saved.objective,
            notes: saved.notes,
            items: [],
          },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await panel
      .getByRole('navigation', { name: 'Notes views' })
      .getByRole('button', { name: 'History', exact: true })
      .click();
    await expect(panel.getByRole('region', { name: 'PlayNote chronology' })).toContainText(
      'Scene-only event',
    );
    await panel.getByRole('button', { name: 'Scene history: Old Scene', exact: true }).click();
    await expect(
      history.getByRole('region', { name: 'Card history chronology', exact: true }),
    ).toContainText('Scene-only event');
    await expect(history.getByLabel('History prepared copy').locator('option')).toHaveCount(1);
    // Independent archive imports retain separate note identities in the same history.
    const archive = await (
      await request.post(`${base}/sessions/export`, { data: { sessions: [previous.id] } })
    ).json();
    for (let i = 0; i < 2; i++)
      expect((await request.post(`${base}/sessions/import`, { data: archive })).ok()).toBe(true);
    const result = await (
      await request.get(`${base}/play-history/scene`, { params: { origin: campaign.id, card } })
    ).json();
    expect(result.entries).toHaveLength(3);
    expect(new Set(result.entries.map((e: any) => e.note.id)).size).toBe(3);
    expect(new Set(result.entries.map((e: any) => e.note.session)).size).toBe(3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
