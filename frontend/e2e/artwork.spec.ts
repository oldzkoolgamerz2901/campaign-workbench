import { test, expect } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('local artwork saves, freezes in Play and survives portable session and Writing recovery round trips', async ({
  page,
  request,
}, info) => {
  test.setTimeout(60000);
  const root = await mkdtemp(join(tmpdir(), 'artwork-ui-'));
  const other = await mkdtemp(join(tmpdir(), 'artwork-ui-destination-'));
  const json = async (method: 'post' | 'put', url: string, data: unknown) => {
    const response = await request[method](url, { data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const illustrated = async (selector: string) => {
    const image = page.locator(selector).first();
    await expect(async () => {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toHaveAttribute('src', /^blob:/);
    }).toPass({ timeout: 10000 });
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    const card = image.locator('xpath=ancestor::playing-card/article');
    if (await card.count()) {
      const bounds = (await card.boundingBox())!;
      expect(bounds.width / bounds.height).toBeCloseTo(243 / 420, 2);
      await expect(image).toHaveCSS('object-fit', 'cover');
      const artworkBounds = (await image.boundingBox())!;
      expect(artworkBounds.height / bounds.height).toBeGreaterThan(0.98);
      const action = card.getByRole('button', { name: 'Open full document' });
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeVisible();
    }
  };
  try {
    const campaign = await json('post', '/api/campaigns', {
      name: 'Artwork journey',
      directory: root,
    });
    const destination = await json('post', '/api/campaigns', {
      name: 'Artwork destination',
      directory: other,
    });
    let draft = await json('post', `/api/campaigns/${campaign.id}/drafts`, {
      type: 'npc',
      template: false,
    });
    draft = await json('put', `/api/campaigns/${campaign.id}/drafts/${draft.id}`, {
      revision: draft.revision,
      fields: {
        ...draft.fields,
        title: 'Illustrated captain',
        summary: 'An illustrated captain.',
        body: '# Captain\nFrozen document.',
        path: 'captain.md',
      },
    });
    const session = await json('post', `/api/campaigns/${campaign.id}/sessions`, {
      title: 'Illustrated voyage',
      objective: '',
    });
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    // Failure keeps the local preview and blocks navigation unless explicitly discarded.
    const route = `**/api/campaigns/${campaign.id}/drafts/${draft.id}/artwork`;
    await page.route(route, (r) =>
      r.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Image save temporarily unavailable.' }),
      }),
    );
    await page
      .getByLabel('Card artwork', { exact: true })
      .setInputFiles(resolve('../backend/src/test/resources/images/lossless.webp'));
    await expect(page.getByRole('alert')).toContainText('Image save temporarily unavailable.');
    await illustrated('.preview-panel playing-card img');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(page).toHaveURL(/\/writing/);
    await page.unroute(route);
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/drafts/${draft.id}/artwork`) && r.ok(),
    );
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    draft = await (await saved).json();
    const originalHash = draft.image.hash;
    await page.reload();
    await illustrated('.preview-panel playing-card img');
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      const bounds = (await page.locator('playing-card article').boundingBox())!;
      expect(bounds.width).toBeLessThanOrEqual(320);
      if (width >= 1280) expect(bounds.width).toBe(320);
      expect(bounds.width / bounds.height).toBeCloseTo(243 / 420, 2);
      await page.screenshot({ path: info.outputPath(`write-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    const chooser = page.getByRole('region', { name: 'Session Library', exact: true });
    await illustrated('preparation-library .reference-row img');
    await chooser.getByRole('button', { name: 'Illustrated captain · npc', exact: true }).click();
    await illustrated('preparation-library playing-card img');
    await chooser
      .getByRole('button', { name: 'Add selected card to session', exact: true })
      .click();
    await illustrated('session-contents img');
    await chooser.getByRole('button', { name: 'View prepared card', exact: true }).click();
    await page.getByRole('button', { name: 'Selected item', exact: true }).click();
    const notesSaved = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' && r.url().endsWith(`/sessions/${session.id}`) && r.ok(),
    );
    await page.getByLabel('Item Markdown notes').fill('Frozen illustrated note');
    await notesSaved;
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: info.outputPath(`prepare-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&mode=play&view=prepare`);
    await illustrated('play-tabletop playing-card img');
    await page
      .getByRole('button', { name: 'Card actions: Illustrated captain', exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Mark used', exact: true }).click();
    await page.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await illustrated('#used-card-tray playing-card img');
    await page
      .getByRole('button', { name: 'Card actions: Illustrated captain', exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Return to Session Cards', exact: true }).click();
    await illustrated('play-tabletop playing-card img');
    const imageRoute = `**/api/campaigns/${campaign.id}/sessions/${session.id}/items/*/artwork/DISPLAY`;
    await page.route(imageRoute, (r) => r.fulfill({ status: 503, body: 'Unavailable' }));
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Artwork unavailable · Retry', exact: true }),
    ).toBeVisible();
    await expect(page.locator('play-tabletop playing-card')).toHaveCSS('width', '320px');
    await page.unroute(imageRoute);
    await page.getByRole('button', { name: 'Artwork unavailable · Retry', exact: true }).click();
    await illustrated('play-tabletop playing-card img');
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: info.outputPath(`play-${width}.png`), fullPage: true });
    }
    // Replace then remove draft artwork through Write; prepared artwork must stay frozen.
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    let saving = page.waitForResponse(
      (r) => r.url().endsWith(`/drafts/${draft.id}/artwork`) && r.ok(),
    );
    await page
      .getByLabel('Card artwork', { exact: true })
      .setInputFiles(resolve('../backend/src/test/resources/images/transparent.webp'));
    draft = await (await saving).json();
    expect(draft.image.hash).not.toBe(originalHash);
    // Preserve an illustrated backup before removal.
    await page.goto('/writing/recovery');
    await page.getByLabel('Backup campaign', { exact: true }).selectOption(campaign.id);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Writing archive', exact: true }).click();
    const backup = await (await downloading).path();
    await page.getByLabel('Restore Writing archive', { exact: true }).setInputFiles(backup!);
    await page.getByRole('button', { name: /Illustrated captain · npc · revision/ }).click();
    await illustrated('writing-recovery playing-card img');
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: info.outputPath(`recovery-${width}.png`), fullPage: true });
    }
    await page.getByLabel('Destination campaign', { exact: true }).selectOption(destination.id);
    await page.getByRole('button', { name: 'Copy to campaign', exact: true }).click();
    await page.getByRole('button', { name: 'Open copied draft', exact: true }).click();
    await illustrated('.preview-panel playing-card img');
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    saving = page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().endsWith(`/drafts/${draft.id}`) && r.ok(),
    );
    await page.getByRole('button', { name: 'Remove artwork', exact: true }).click();
    expect((await (await saving).json()).image ?? null).toBeNull();
    await expect(page.locator('.preview-panel playing-card img')).toHaveAttribute(
      'src',
      '/card-placeholder.svg',
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&mode=play&view=prepare`);
    await illustrated('play-tabletop playing-card img');
    const frozen = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(frozen.items[0].image.hash).toBe(originalHash);
    const endpoint = `/api/campaigns/${campaign.id}/sessions/${session.id}/workspace`;
    const workspace = await (await request.get(endpoint)).json();
    expect(
      (
        await request.post(`${endpoint}/move`, {
          data: { revision: workspace.revision, item: frozen.items[0].id, destination: 'PILE_1' },
        })
      ).ok(),
    ).toBeTruthy();
    await page.reload();
    await illustrated('play-tabletop playing-card img');
    const workspaceSaved = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().endsWith(`/sessions/${session.id}/workspace/move`) &&
        r.ok(),
    );
    await page
      .getByRole('button', { name: 'Card actions: Illustrated captain', exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Mark used', exact: true }).click();
    await workspaceSaved;
    const downloadingSession = page.waitForEvent('download');
    await page.getByRole('button', { name: 'More session actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Export session', exact: true }).click();
    const sessionBytes = await readFile((await (await downloadingSession).path())!);
    await page.goto(`/?campaign=${destination.id}&view=library`);
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByLabel('Import sessions into Artwork destination').setInputFiles({
      name: 'illustrated.zip',
      mimeType: 'application/zip',
      buffer: sessionBytes,
    });
    await expect(
      page.getByText('Imported 1 new session(s). Existing sessions are preserved.'),
    ).toBeVisible();
    const imported = (await (await request.get(`/api/campaigns/${destination.id}/sessions`)).json())
      .sessions[0];
    const restored = await (
      await request.get(`/api/campaigns/${destination.id}/sessions/${imported.id}`)
    ).json();
    expect(restored.items[0].image.hash).toBe(originalHash);
    expect(restored.items[0].notes).toBe('Frozen illustrated note');
    await page.getByRole('button', { name: 'Illustrated voyage', exact: true }).click();
    await page.goto(`/?campaign=${destination.id}&session=${imported.id}&mode=play&view=prepare`);
    await expect(page.getByRole('button', { name: 'Used cards (1)', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await illustrated('#used-card-tray playing-card img');
    const restoredWorkspace = await (
      await request.get(`/api/campaigns/${destination.id}/sessions/${imported.id}/workspace`)
    ).json();
    expect(restoredWorkspace.sessionCards).toEqual([]);
    expect(restoredWorkspace.used).toEqual([restored.items[0].id]);
    expect(restoredWorkspace.pile1.items).toEqual([]);
    expect(restoredWorkspace.activeSceneItemId).toBeNull();
    expect(restored.items[0].id).not.toBe(frozen.items[0].id);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
