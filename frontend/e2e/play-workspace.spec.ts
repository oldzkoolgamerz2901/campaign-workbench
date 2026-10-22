import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('workspace conflicts retain the table, guard navigation and recover independently of preparation', async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-play-save-'));
  try {
    await writeFile(
      join(root, 'scene.md'),
      `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: scene.md\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Scene\nFrozen scene text.`,
    );
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Play save fixture', directory: root } })
    ).json();
    const capture = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    const created = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Play save session', objective: '' },
      })
    ).json();
    const endpoint = `/api/campaigns/${campaign.id}/sessions/${created.id}`;
    const session = await (
      await request.post(`${endpoint}/sources`, {
        data: {
          revision: created.revision,
          capture: capture.capture,
          path: 'scene.md',
          section: null,
        },
      })
    ).json();
    const other = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Other session', objective: '' },
      })
    ).json();
    const initialWorkspace = await (await request.get(`${endpoint}/workspace`)).json();
    expect(initialWorkspace.activeSceneItemId).toBeNull();
    expect(initialWorkspace.focusedItemIds).toEqual([]);
    expect(
      (
        await request.put(`${endpoint}/workspace`, {
          data: {
            ...initialWorkspace,
            activeSceneItemId: session.items[0].id,
            focusedItemIds: [session.items[0].id],
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&mode=play&view=prepare`);
    const card = page.locator('read-card-table');
    await expect(card.getByRole('article', { name: 'Read: scene.md', exact: true })).toBeVisible();
    await page.route(`**${endpoint}/workspace`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 409,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Workspace changed elsewhere' }),
          })
        : route.continue(),
    );
    await card.getByRole('button', { name: 'Card actions: scene.md', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Mark used', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
    await expect(page.getByRole('alert')).toContainText('Workspace changed elsewhere');
    await expect(card.getByRole('button', { name: 'Used cards (1)', exact: true })).toBeVisible();
    const untouched = await (await request.get(endpoint)).json();
    expect(untouched.revision).toBe(session.revision);
    expect(untouched.notes).toBe(session.notes);
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Other session', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`session=${session.id}`));
    await page.unroute(`**${endpoint}/workspace`);
    await page.getByRole('button', { name: 'Retry table save', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    expect((await (await request.get(`${endpoint}/workspace`)).json()).used).toEqual([
      session.items[0].id,
    ]);
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByRole('button', { name: 'Other session', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`session=${other.id}`));
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByRole('button', { name: 'Play save session', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Used cards (1)', exact: true })).toBeVisible();
    const before = await (await request.get(`${endpoint}/workspace`)).json();
    expect(before.activeSceneItemId).toBe(session.items[0].id);
    expect(before.focusedItemIds).toEqual([session.items[0].id]);
    await request.put(`${endpoint}/workspace`, {
      data: { ...before, active: [session.items[0].id], used: [] },
    });
    await card.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await card.getByRole('button', { name: 'Card actions: scene.md', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Return to table', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Reload / discard table changes', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await expect(card.getByRole('article', { name: 'Read: scene.md', exact: true })).toBeVisible();
    const retained = await (await request.get(`${endpoint}/workspace`)).json();
    expect(retained.activeSceneItemId).toBe(session.items[0].id);
    expect(retained.focusedItemIds).toEqual([session.items[0].id]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
