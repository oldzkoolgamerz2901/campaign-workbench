import { addLibraryFixture } from './preparation-fixtures';
import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const scene = (body: string) =>
  `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: scene.md\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n${body}`;

for (const action of ['retry', 'reload'] as const) {
  test(`Preparation ${action} in Play restores the table without changing modes`, async ({
    page,
    request,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'workbench-preparation-recovery-'));
    try {
      await writeFile(join(root, 'scene.md'), scene('# Scene\nFrozen recovery material.'));
      const campaign = await (
        await request.post('/api/campaigns', {
          data: { name: 'Preparation recovery', directory: root },
        })
      ).json();
      const capture = await (
        await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
      ).json();
      const created = await (
        await request.post(`/api/campaigns/${campaign.id}/sessions`, {
          data: { title: 'Recovery session', objective: '' },
        })
      ).json();
      const endpoint = `/api/campaigns/${campaign.id}/sessions/${created.id}`;
      const added = await addLibraryFixture(request, `${endpoint}`, {
        data: {
          revision: created.revision,
          capture: capture.capture,
          path: 'scene.md',
          section: null,
        },
      });
      expect(added.ok(), await added.text()).toBe(true);
      const url = `/?campaign=${campaign.id}&session=${created.id}&view=prepare`;
      const card = page
        .locator('play-tabletop')
        .getByRole('article', { name: 'Read: scene.md', exact: true });
      await page.goto(url + (action === 'reload' ? '&mode=play' : ''));
      if (action === 'reload') {
        await expect(card).toBeVisible();
        await page.getByRole('button', { name: 'Prepare', exact: true }).click();
      }
      await page.route(`**${endpoint}`, (route) =>
        route.request().method() === 'PUT'
          ? route.fulfill({
              status: 503,
              contentType: 'application/problem+json',
              body: JSON.stringify({ detail: 'Preparation save unavailable' }),
            })
          : route.continue(),
      );
      await page
        .locator('.notes-page')
        .getByRole('button', { name: 'Session', exact: true })
        .click();
      await page
        .getByLabel('Session Markdown notes', { exact: true })
        .fill('Retained local recovery notes');
      await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      // Wait for Play entry's failed Preparation flush before restoring the endpoint.
      await expect(page.getByRole('alert')).toContainText('Preparation save unavailable');
      await page.unroute(`**${endpoint}`);
      if (action === 'reload') page.once('dialog', (dialog) => dialog.accept());
      await page
        .getByRole('button', {
          name: action === 'retry' ? 'Retry save' : 'Reload / discard local edits',
          exact: true,
        })
        .click();
      await expect(card).toBeVisible();
      await expect(page.getByLabel('Session save status')).toHaveText('Saved');
      await expect(card).not.toHaveAttribute('aria-disabled', 'true');
      await page
        .locator('play-tabletop')
        .getByRole('button', { name: 'Card actions: scene.md', exact: true })
        .click();
      await page.getByRole('menuitem', { name: 'Mark used', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Used cards (0)', exact: true })).toBeVisible();
      await expect(page.getByLabel('Session save status')).toHaveText('Saved');
      const saved = await (await request.get(endpoint)).json();
      expect(saved.notes).toBe(action === 'retry' ? 'Retained local recovery notes' : '');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

for (const destination of ['session', 'campaign', 'cancel'] as const) {
  test(`pending Preparation reload protects failed table edits on ${destination} departure`, async ({
    page,
    request,
  }) => {
    const root = await mkdtemp(join(tmpdir(), 'workbench-reload-navigation-'));
    let releaseReload = () => {};
    try {
      await writeFile(join(root, 'scene.md'), scene('# Scene\nFrozen navigation material.'));
      const campaign = await (
        await request.post('/api/campaigns', {
          data: { name: 'Reload navigation origin', directory: root },
        })
      ).json();
      const capture = await (
        await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
      ).json();
      const origin = await (
        await request.post(`/api/campaigns/${campaign.id}/sessions`, {
          data: { title: 'Reload origin', objective: '' },
        })
      ).json();
      const endpoint = `/api/campaigns/${campaign.id}/sessions/${origin.id}`;
      const added = await addLibraryFixture(request, `${endpoint}`, {
        data: {
          revision: origin.revision,
          capture: capture.capture,
          path: 'scene.md',
          section: null,
        },
      });
      expect(added.ok(), await added.text()).toBe(true);
      // A separate directory makes this an independent campaign registration.
      const otherRoot = await mkdtemp(join(root, 'destination-'));
      const otherCampaign =
        destination === 'campaign'
          ? await (
              await request.post('/api/campaigns', {
                data: { name: 'Reload navigation destination', directory: otherRoot },
              })
            ).json()
          : campaign;
      const other = await (
        await request.post(`/api/campaigns/${otherCampaign.id}/sessions`, {
          data: { title: 'Reload destination', objective: '' },
        })
      ).json();
      await page.goto(`/?campaign=${campaign.id}&session=${origin.id}&mode=play&view=prepare`);
      const table = page.locator('play-tabletop');
      await expect(
        table.getByRole('article', { name: 'Read: scene.md', exact: true }),
      ).toBeVisible();
      await page.route(`**${endpoint}/workspace/move`, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({
              status: 409,
              contentType: 'application/problem+json',
              body: JSON.stringify({ detail: 'Retained table conflict' }),
            })
          : route.continue(),
      );
      await table.getByRole('button', { name: 'Card actions: scene.md', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Mark used', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Review / retry table action', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Prepare', exact: true }).click();
      await page.route(`**${endpoint}`, (route) =>
        route.request().method() === 'PUT'
          ? route.fulfill({
              status: 503,
              contentType: 'application/problem+json',
              body: JSON.stringify({ detail: 'Retained Preparation failure' }),
            })
          : route.continue(),
      );
      await page
        .locator('.notes-page')
        .getByRole('button', { name: 'Session', exact: true })
        .click();
      await page
        .getByLabel('Session Markdown notes', { exact: true })
        .fill('Discard only Preparation notes');
      await expect(
        page.getByRole('alert').filter({ hasText: 'Retained Preparation failure' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(
        page.getByRole('alert').filter({ hasText: 'Retained Preparation failure' }),
      ).toBeVisible();
      await page.unroute(`**${endpoint}`);
      const held = new Promise<void>((resolve) => {
        releaseReload = resolve;
      });
      let reloadHeld = false;
      let reloadDelivered = false;
      await page.route(`**${endpoint}`, async (route) => {
        const response = await route.fetch();
        reloadHeld = true;
        await held;
        await route.fulfill({ response });
        reloadDelivered = true;
      });
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Reload / discard local edits', exact: true }).click();
      await expect.poll(() => reloadHeld).toBe(true);
      const leave = async () => {
        if (destination === 'campaign') {
          await page.getByLabel('Campaign', { exact: true }).selectOption(otherCampaign.id);
        } else {
          await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
          await page.getByRole('button', { name: 'Reload destination', exact: true }).click();
        }
      };
      const dialogs: string[] = [];
      page.once('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.dismiss();
      });
      await leave();
      await expect.poll(() => dialogs.length).toBe(1);
      expect(dialogs[0]).toContain('Table actions have not been confirmed saved');
      await expect(page).toHaveURL(new RegExp(`session=${origin.id}`));
      await expect(
        page.getByRole('button', { name: 'Review / retry table action', exact: true }),
      ).toBeVisible();
      if (destination === 'cancel') {
        releaseReload();
        await expect.poll(() => reloadDelivered).toBe(true);
        await expect(
          table.getByRole('button', { name: 'Used cards (0)', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Review / retry table action', exact: true }),
        ).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`session=${origin.id}`));
        expect((await (await request.get(`${endpoint}/workspace`)).json()).used).toEqual([]);
        return;
      }
      // Retry departure while the same reload is still held. Only explicit workspace discard permits it.
      page.once('dialog', async (dialog) => {
        dialogs.push(dialog.message());
        await dialog.accept();
      });
      await leave();
      await expect.poll(() => dialogs.length).toBe(2);
      expect(dialogs[1]).toContain('Table actions have not been confirmed saved');
      await expect(page).toHaveURL(
        new RegExp(
          destination === 'session' ? `session=${other.id}` : `campaign=${otherCampaign.id}`,
        ),
      );
      if (destination === 'campaign') {
        await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
        await page.getByRole('button', { name: 'Reload destination', exact: true }).click();
      }
      await expect(
        page.getByRole('heading', { name: 'Reload destination', exact: true }),
      ).toBeVisible();
      releaseReload();
      await expect.poll(() => reloadDelivered).toBe(true);
      await expect(
        page.getByRole('heading', { name: 'Reload destination', exact: true }),
      ).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`session=${other.id}`));
      await expect(
        page.getByRole('button', { name: 'Review / retry table action', exact: true }),
      ).toHaveCount(0);
      expect((await (await request.get(`${endpoint}/workspace`)).json()).used).toEqual([]);
      expect((await (await request.get(endpoint)).json()).notes).toBe('');
    } finally {
      releaseReload();
      await rm(root, { recursive: true, force: true });
    }
  });
}
