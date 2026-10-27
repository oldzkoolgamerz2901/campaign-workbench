import { test, expect, APIRequestContext } from '@playwright/test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
async function seed(request: APIRequestContext, root: string, illustrated = false) {
  const campaign = await (
    await request.post('/api/campaigns', { data: { name: 'Sharing onboarding', directory: root } })
  ).json();
  const created = await (
    await request.post(`/api/campaigns/${campaign.id}/drafts`, {
      data: { type: 'npc', template: false },
    })
  ).json();
  let draft = await (
    await request.put(`/api/campaigns/${campaign.id}/drafts/${created.id}`, {
      data: {
        revision: created.revision,
        fields: {
          ...created.fields,
          title: 'Harbour guide',
          summary: 'Knows the harbour.',
          backText: illustrated
            ? 'LONG_BACK_MARKER ' + 'Complete frozen back text. '.repeat(8)
            : 'A useful contact.',
          body: '# Guide\nDM_PRIVATE_SOURCE_MARKER',
          path: 'guide.md',
        },
      },
    })
  ).json();
  if (illustrated) {
    const response = await request.post(
      `/api/campaigns/${campaign.id}/drafts/${draft.id}/artwork`,
      {
        multipart: {
          metadata: {
            name: 'metadata.json',
            mimeType: 'application/json',
            buffer: Buffer.from(
              JSON.stringify({
                revision: draft.revision,
                fields: draft.fields,
                imageAction: 'replace',
              }),
            ),
          },
          image: {
            name: 'card.webp',
            mimeType: 'image/webp',
            buffer: await readFile(resolve('../backend/src/test/resources/images/lossless.webp')),
          },
        },
      },
    );
    expect(response.ok(), await response.text()).toBe(true);
    draft = await response.json();
  }
  let session = await (
    await request.post(`/api/campaigns/${campaign.id}/sessions`, {
      data: { title: 'Harbour session', objective: '' },
    })
  ).json();
  const entries = await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json();
  const entry = entries.entries.find((e: any) => e.draft === draft.id);
  const add = await request.post(`/api/campaigns/${campaign.id}/sessions/${session.id}/library`, {
    data: {
      revision: session.revision,
      key: entry.key,
      capture: null,
      draft: draft.id,
      draftRevision: entry.revision,
    },
  });
  expect(add.ok(), await add.text()).toBe(true);
  session = (await add.json()).session;
  return { campaign: campaign.id, session: session.id, item: session.items[0].id };
}

test('G3.2 confirmed distribution, private collections, HTTP reading and stable reconnect', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-distribution-'));
  const tabletContext = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  try {
    const { campaign, session, item } = await seed(request, root);
    const player = await (
      await request.post(`/api/campaigns/${campaign}/sharing/players`, {
        data: { displayName: 'Mira' },
      })
    ).json();
    const stranger = await (
      await request.post(`/api/campaigns/${campaign}/sharing/players`, {
        data: { displayName: 'Other' },
      })
    ).json();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await page.getByRole('button', { name: 'Share Harbour guide', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Share card', exact: true });
    await expect(dialog.locator('playing-card')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Confirm sharing' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      (await (await request.get(`/api/campaigns/${campaign}/sharing/collection`)).json()).cards,
    ).toHaveLength(0);
    await page.getByRole('button', { name: 'Share Harbour guide', exact: true }).click();
    await dialog.getByLabel('Mode', { exact: true }).selectOption('HANDOUT');
    await dialog.getByRole('button', { name: 'Confirm sharing' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('shared-card-tray .entry')).toHaveCount(1);
    await page.screenshot({ path: info.outputPath('share-populated-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: info.outputPath('share-populated-1280.png'), fullPage: true });
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (
      await request.post(`/api/campaigns/${campaign}/sharing/players/${player.id}/pairing`, {
        data: {},
      })
    ).json();
    const tablet = await tabletContext.newPage();
    // Force the same SHA-256 path used by non-secure LAN origins, even at loopback.
    await tablet.addInitScript(() =>
      Object.defineProperty(window.crypto, 'subtle', { value: undefined }),
    );
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1, { timeout: 12000 });
    const card = tablet.locator('shared-card-tray .entry playing-card');
    await expect(card.locator('card-layout-renderer svg')).toHaveCSS('visibility', 'visible');
    await expect(tablet.getByRole('button', { name: 'Open full document' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Flip to back' }).click();
    await expect(card.locator('article')).toHaveAttribute('data-side', 'back');
    await expect(card.locator('svg')).toContainText('A useful contact.');
    await expect(card.locator('article')).toHaveAttribute('data-side', 'back', { timeout: 7000 });
    await card.locator('article').click();
    const expanded = tablet.getByRole('dialog', { name: 'Expanded card', exact: true });
    await expect(expanded).toBeVisible();
    await expect(tablet.locator('body')).toHaveCSS('overflow', 'hidden');
    await expanded.getByRole('button', { name: 'Flip to back' }).click();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'back');
    const preview = await (
      await request.post(`/api/campaigns/${campaign}/sharing/preview`, { data: { session, item } })
    ).json();
    const deliver = async (recipient: string | null) => {
      const response = await request.post(`/api/campaigns/${campaign}/sharing/cards`, {
        data: {
          operation: crypto.randomUUID(),
          session,
          item,
          fingerprint: preview.fingerprint,
          mode: 'INVENTORY',
          recipient,
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    };
    await deliver(player.id);
    const hidden = await deliver(stranger.id);
    await expect(tablet.getByRole('button', { name: /My Cards.*New/ })).toBeVisible({
      timeout: 12000,
    });
    await expect(expanded).toBeVisible();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'back');
    await tabletContext.setOffline(true);
    await expect(tablet.getByRole('status').filter({ hasText: 'Connection lost' })).toBeVisible({
      timeout: 12000,
    });
    await expanded.getByRole('button', { name: 'Flip to front' }).click();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'front');
    await tabletContext.setOffline(false);
    await expect(
      tablet.getByRole('status', { name: '' }).filter({ hasText: 'Connected' }),
    ).toBeVisible({ timeout: 12000 });
    await expanded.getByRole('button', { name: 'Close expanded card' }).click();
    await tablet.getByRole('button', { name: /My Cards/ }).click();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1);
    await tablet.reload();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1, { timeout: 12000 });
    const credential = await tablet.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('workbench.player.credentials.v1')!);
      return s.credentials[s.last];
    });
    const payload = await (
      await request.get(`http://127.0.0.1:${gateway.port}/player-api/collections`, {
        headers: { Authorization: `Bearer ${credential}` },
      })
    ).text();
    expect(payload).not.toContain('DM_PRIVATE_SOURCE_MARKER');
    expect(payload).not.toContain('provenance');
    expect(payload).not.toContain(hidden.id);
    expect(
      (
        await request.get(`http://127.0.0.1:${gateway.port}/player-api/cards/${hidden.id}/layout`, {
          headers: { Authorization: `Bearer ${credential}` },
        })
      ).status(),
    ).toBe(404);
    for (const [width, height] of [
      [800, 1280],
      [1280, 800],
      [390, 844],
    ]) {
      await tablet.setViewportSize({ width, height });
      await tablet.screenshot({
        path: info.outputPath(`player-populated-${width}.png`),
        fullPage: true,
      });
      expect(await tablet.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await request.put(`/api/campaigns/${campaign}/sharing/players/${player.id}/active`, {
      data: { active: false },
    });
    await expect(tablet.locator('shared-card-tray')).toHaveCount(0, { timeout: 12000 });
  } finally {
    await request.post('/api/gateway/disable', { data: {} });
    await tabletContext.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('G3.2 illustrated preview, lost delivery response, source deletion and complete side reading', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-illustrated-'));
  const tabletContext = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  try {
    const { campaign, session } = await seed(request, root, true);
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await page.route('**/sharing/preview/artwork', (route) => route.abort());
    await page.getByRole('button', { name: 'Share Harbour guide', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Share card', exact: true });
    await dialog.getByLabel('Mode', { exact: true }).selectOption('HANDOUT');
    await expect(dialog.getByRole('button', { name: 'Artwork unavailable · Retry' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirm sharing' })).toBeDisabled();
    await page.unroute('**/sharing/preview/artwork');
    await dialog.getByRole('button', { name: 'Artwork unavailable · Retry' }).click();
    await expect(dialog.locator('artwork-image img')).toHaveAttribute('src', /^blob:/);
    await expect(dialog.getByRole('button', { name: 'Confirm sharing' })).toBeEnabled();
    await page.screenshot({
      path: info.outputPath('illustrated-confirmation.png'),
      fullPage: true,
    });
    await page.route('**/sharing/cards', async (route) => {
      await route.fetch();
      await route.abort();
    });
    await dialog.getByRole('button', { name: 'Confirm sharing' }).click();
    await expect(dialog.getByRole('button', { name: 'Retry delivery' })).toBeVisible();
    await expect(dialog.getByLabel('Mode', { exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.unroute('**/sharing/cards');
    await page.getByRole('button', { name: 'Share Harbour guide', exact: true }).click();
    await dialog.getByRole('button', { name: 'Retry delivery' }).click();
    await expect(dialog).not.toBeVisible();
    expect(
      (await (await request.get(`/api/campaigns/${campaign}/sharing/collection`)).json()).cards,
    ).toHaveLength(1);
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const player = await (
      await request.post(`/api/campaigns/${campaign}/sharing/players`, {
        data: { displayName: 'Illustrated reader' },
      })
    ).json();
    const invite = await (
      await request.post(`/api/campaigns/${campaign}/sharing/players/${player.id}/pairing`, {
        data: {},
      })
    ).json();
    const tablet = await tabletContext.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    const card = tablet.locator('shared-card-tray .entry playing-card');
    await expect(card.locator('artwork-image img')).toHaveAttribute('src', /^blob:/, {
      timeout: 12000,
    });
    await tabletContext.setOffline(true);
    await expect(tablet.getByRole('status').filter({ hasText: 'Connection lost' })).toBeVisible({
      timeout: 12000,
    });
    await card.getByRole('button', { name: 'Flip to back' }).click();
    await expect(card.locator('article')).toHaveAttribute('data-side', 'back');
    await card.getByRole('button', { name: 'Flip to front' }).click();
    await expect(card.locator('artwork-image img')).toHaveAttribute('src', /^blob:/, {
      timeout: 3000,
    });
    await tabletContext.setOffline(false);
    await expect(tablet.getByRole('status').filter({ hasText: 'Connected' })).toBeVisible({
      timeout: 12000,
    });
    const before = await (
      await request.get(`/api/campaigns/${campaign}/sessions/${session}`)
    ).json();
    const removed = await request.put(`/api/campaigns/${campaign}/sessions/${session}`, {
      data: {
        revision: before.revision,
        title: before.title,
        objective: before.objective,
        notes: before.notes,
        items: [],
      },
    });
    expect(removed.ok(), await removed.text()).toBe(true);
    // Layout service loss must still permit complete frozen-side reading.
    await tablet.route('**/player-api/cards/*/layout', (route) => route.abort());
    await tablet.reload();
    await expect(card.locator('artwork-image img')).toHaveAttribute('src', /^blob:/, {
      timeout: 12000,
    });
    await card.locator('article').focus();
    await tablet.keyboard.press('Enter');
    const expanded = tablet.getByRole('dialog', { name: 'Expanded card', exact: true });
    await expanded.getByRole('button', { name: 'Flip to back' }).click();
    await expanded.getByRole('button', { name: 'Read all back text' }).click();
    const reader = tablet.getByRole('dialog', { name: 'Complete card side text', exact: true });
    await expect(reader).toContainText('LONG_BACK_MARKER');
    expect(await reader.locator('.plain').textContent()).toBe(
      'LONG_BACK_MARKER ' + 'Complete frozen back text. '.repeat(8),
    );
    await reader.getByRole('button', { name: 'Close card text' }).click();
    await expect(expanded).toBeVisible();
    await expanded.getByRole('button', { name: 'Close expanded card' }).click();
    await expect(card.locator('article')).toBeFocused();
  } finally {
    await request.post('/api/gateway/disable', { data: {} });
    await tabletContext.close();
    await rm(root, { recursive: true, force: true });
  }
});
