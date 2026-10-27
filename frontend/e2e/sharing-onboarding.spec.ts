import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jsQR from 'jsqr';

async function seed(request: APIRequestContext, root: string) {
  const campaign = await (
    await request.post('/api/campaigns', { data: { name: 'Sharing onboarding', directory: root } })
  ).json();
  const created = await (
    await request.post(`/api/campaigns/${campaign.id}/drafts`, {
      data: { type: 'npc', template: false },
    })
  ).json();
  const draft = await (
    await request.put(`/api/campaigns/${campaign.id}/drafts/${created.id}`, {
      data: {
        revision: created.revision,
        fields: {
          ...created.fields,
          title: 'Harbour guide',
          summary: 'Knows the harbour.',
          backText: 'A useful contact.',
          body: '# Guide\nDM_PRIVATE_SOURCE_MARKER',
          path: 'guide.md',
        },
      },
    })
  ).json();
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
  return { campaign: campaign.id, session: session.id };
}
async function enable(page: Page) {
  await page.getByRole('button', { name: 'Enable sharing', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable sharing', exact: true })).toBeVisible();
}

test('Share QR pairs real player browser, reconnects, tracks rename/activity/revocation and protects assets', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-onboarding-'));
  const tabletContext = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  try {
    const { campaign, session } = await seed(request, root);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await expect(page.locator('share-workspace playing-card')).toHaveCount(1);
    await expect(
      page
        .locator('share-workspace playing-card')
        .getByRole('button', { name: 'Open full document' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enable sharing', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add player', exact: true }).click();
    const nameDialog = page.locator('dialog[open]');
    await nameDialog.getByLabel('Display name').fill('Mira');
    await nameDialog.getByRole('button', { name: 'Add player', exact: true }).click();
    const row = page.locator('.player-row').filter({ hasText: 'Mira' });
    await expect(row).toContainText('0 paired devices');
    await expect(page.getByRole('button', { name: 'Enable sharing', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('share-1440.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: info.outputPath('share-1280.png'), fullPage: true });
    await enable(page);
    await expect(row.getByRole('button', { name: 'Pair device', exact: true })).toBeEnabled();
    await row.getByRole('button', { name: 'Pair device', exact: true }).click();
    let dialog = page.locator('dialog[open]');
    await expect(dialog.getByAltText('Pairing QR code')).toBeVisible();
    const oldLink = await dialog.getByLabel('Pairing link').inputValue();
    await dialog.getByRole('button', { name: 'Regenerate code', exact: true }).click();
    await expect(dialog.getByAltText('Pairing QR code')).toBeVisible();
    await expect(dialog.getByLabel('Pairing link')).not.toHaveValue(oldLink);
    const link = await dialog.getByLabel('Pairing link').inputValue();
    const target = new URL(link);
    expect(target.pathname).toBe('/player/pair');
    expect(target.search).toBe('');
    expect(target.hash).toMatch(/^#token=/);
    const oldToken = new URLSearchParams(new URL(oldLink).hash.slice(1)).get('token');
    expect(
      (
        await request.post(`${target.origin}/player-api/pair`, { data: { token: oldToken } })
      ).status(),
    ).toBe(401);
    const pixels = await dialog
      .getByAltText('Pairing QR code')
      .evaluate((image: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        return {
          data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
          width: canvas.width,
          height: canvas.height,
        };
      });
    expect(jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data).toBe(link);
    await page.screenshot({ path: info.outputPath('pairing-modal.png') });
    const tablet = await tabletContext.newPage();
    const sent: string[] = [];
    tablet.on('request', (r) => sent.push(r.url()));
    const pairingResponse = tablet.waitForResponse(
      (r) => new URL(r.url()).pathname === '/player-api/pair' && r.request().method() === 'POST',
    );
    await tablet.goto(link);
    const paired = await (await pairingResponse).json();
    await expect(tablet.getByRole('heading', { name: 'Group Cards', exact: true })).toBeVisible();
    await expect(tablet.getByText('Playing as Mira', { exact: true })).toBeVisible();
    const replay = await browser.newPage();
    await replay.goto(link);
    await expect(replay.getByRole('status')).toContainText('already used');
    await expect(replay.locator('.identity')).toHaveCount(0);
    await replay.close();
    for (const url of sent.filter((url) => new URL(url).pathname.endsWith('.js'))) {
      const script = await (await request.get(url)).text();
      expect(script).not.toContain('/api/campaigns');
      expect(script).not.toContain('/api/card-layout');
      // Shared PlayingCard retains the DM capability; it is disabled on player instances.
    }
    await expect(tablet.getByRole('button', { name: 'Open full document' })).toHaveCount(0);
    expect(new URL(tablet.url()).hash).toBe('');
    expect(
      sent.some((url) => url.includes(new URLSearchParams(target.hash.slice(1)).get('token')!)),
    ).toBe(false);
    await expect(dialog).toContainText('Device paired', { timeout: 10000 });
    expect(await dialog.textContent()).not.toContain(paired.credential);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(row).toContainText('1 paired devices', { timeout: 10000 });
    await tablet.screenshot({ path: info.outputPath('player-portrait.png'), fullPage: true });
    await tablet.getByRole('button', { name: 'My Cards', exact: false }).click();
    await tablet.reload();
    await expect(tablet.getByRole('heading', { name: 'My Cards', exact: true })).toBeVisible();
    await expect(tablet.getByText('Playing as Mira', { exact: true })).toBeVisible();
    await tablet.setViewportSize({ width: 1280, height: 800 });
    await tablet.screenshot({ path: info.outputPath('player-landscape.png'), fullPage: true });
    await tabletContext.setOffline(true);
    await expect(tablet.getByRole('status')).toContainText('Connection lost', { timeout: 12000 });
    await expect(tablet.getByText('Playing as Mira', { exact: true })).toBeVisible();
    await tabletContext.setOffline(false);
    await expect(tablet.getByRole('status')).toHaveText('Connected', { timeout: 12000 });
    await row.getByLabel('Manage Mira', { exact: true }).click();
    await row.getByRole('button', { name: 'Rename', exact: true }).click();
    dialog = page.locator('dialog[open]');
    const renamed = 'Mira the harbour keeper with a long display name';
    await dialog.getByLabel('Display name').fill(renamed);
    await dialog.getByRole('button', { name: 'Save name', exact: true }).click();
    await expect(tablet.getByText(`Playing as ${renamed}`, { exact: true })).toBeVisible({
      timeout: 12000,
    });
    await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await expect(tablet.getByRole('status')).toContainText('inactive', { timeout: 12000 });
    await expect(tablet.locator('.identity')).toHaveCount(0);
    await row.getByRole('button', { name: 'Reactivate', exact: true }).click();
    await tablet.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(tablet.getByText(`Playing as ${renamed}`, { exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Manage devices', exact: true }).click();
    dialog = page.locator('dialog[open]');
    await dialog.getByRole('button', { name: 'Revoke device', exact: true }).click();
    await expect(tablet.getByRole('status')).toContainText('Access is unavailable', {
      timeout: 12000,
    });
    await expect(tablet.locator('.identity')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Manage devices', exact: true })).toBeFocused();
    await expect(row).toContainText('0 paired devices');
    for (const path of [
      '/api/campaigns',
      '/api/gateway/access',
      '/v3/api-docs',
      '/player/main.js.map',
      '/player/player-manifest.json',
      '/player/unknown',
    ])
      expect((await request.get(`${target.origin}${path}`)).status()).toBe(404);
  } finally {
    await tabletContext.close();
    await request.post('/api/gateway/disable', { data: {} });
    await rm(root, { recursive: true, force: true });
  }
});

test('closing a pending pairing overlay rejects late QR responses and retains navigation guards', async ({
  page,
  request,
}) => {
  test.setTimeout(45000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-late-'));
  try {
    const { campaign, session } = await seed(request, root);
    await request.post(`/api/campaigns/${campaign}/sharing/players`, {
      data: { displayName: 'Late player' },
    });
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await enable(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    await page.route('**/sharing/players/*/pairing', async (route) => {
      const response = await route.fetch();
      entered();
      await held;
      await route.fulfill({ response });
    });
    await page.getByRole('button', { name: 'Pair device', exact: true }).click();
    await started;
    await page.keyboard.press('Escape');
    release();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.getByAltText('Pairing QR code')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pair device', exact: true })).toBeEnabled();
    await page.unrouteAll();
    await page.getByRole('button', { name: 'Pair device', exact: true }).click();
    await expect(page.getByAltText('Pairing QR code')).toBeVisible();
    await page.route('**/api/gateway/access', async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      data.addresses = [];
      await route.fulfill({ response, json: data });
    });
    await expect(page.locator('dialog[open]')).toHaveCount(0, { timeout: 10000 });
    await page.unrouteAll();
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page).toHaveURL(/\/writing/);
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page).toHaveURL(/\/share/);
    await expect(page.getByRole('heading', { name: 'Share', exact: true })).toBeVisible();
  } finally {
    await request.post('/api/gateway/disable', { data: {} });
    await rm(root, { recursive: true, force: true });
  }
});

test('same-origin reconnect preserves credentials for multiple campaigns without a player selector', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(45000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-origins-'));
  const second = await mkdtemp(join(tmpdir(), 'sharing-other-'));
  const context = await browser.newContext();
  try {
    const first = await seed(request, root);
    const other = await seed(request, second);
    const access = await (await request.get('/api/gateway/access')).json();
    const host = access.addresses[0].address;
    const tablet = await context.newPage();
    const authorizations: { url: string; auth?: string }[] = [];
    tablet.on('request', (r) =>
      authorizations.push({ url: r.url(), auth: r.headers()['authorization'] }),
    );
    let abortPair = true;
    await tablet.route('**/player-api/pair', async (route) => {
      if (abortPair) {
        abortPair = false;
        await route.abort();
      } else await route.continue();
    });
    for (const [campaign, name] of [
      [first.campaign, 'First identity'],
      [other.campaign, 'Other identity'],
    ]) {
      await request.put(`/api/campaigns/${campaign}/selection`, { data: {} });
      const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
      const player = await (
        await request.post(`/api/campaigns/${campaign}/sharing/players`, {
          data: { displayName: name },
        })
      ).json();
      const invitation = await (
        await request.post(`/api/campaigns/${campaign}/sharing/players/${player.id}/pairing`, {
          data: {},
        })
      ).json();
      await tablet.goto(`http://${host}:${gateway.port}/player/pair#token=${invitation.token}`);
      if (name === 'First identity') {
        await expect(tablet.getByRole('status')).toContainText('interrupted');
        await tablet.getByRole('button', { name: 'Retry connection', exact: true }).click();
      }
      await expect(tablet.getByText(`Playing as ${name}`, { exact: true })).toBeVisible();
    }
    await request.put(`/api/campaigns/${first.campaign}/selection`, { data: {} });
    await request.post('/api/gateway/enable', { data: {} });
    await expect(tablet.locator('.identity')).toHaveCount(0, { timeout: 12000 });
    await tablet.getByRole('button', { name: 'Retry connection', exact: true }).click();
    await expect(tablet.getByText('Playing as First identity', { exact: true })).toBeVisible();
    const count = await tablet.evaluate(
      () =>
        Object.keys(
          JSON.parse(localStorage.getItem('workbench.player.credentials.v1')!).credentials,
        ).length,
    );
    expect(count).toBe(2);
    expect(
      authorizations.filter((r) => r.auth && !new URL(r.url).pathname.startsWith('/player-api/')),
    ).toEqual([]);
    await page.goto(`/share?campaign=${first.campaign}&session=${first.session}`);
    await expect(page.getByRole('heading', { name: 'Share', exact: true })).toBeVisible();
  } finally {
    await context.close();
    await request.post('/api/gateway/disable', { data: {} });
    await rm(root, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});

test('Share navigation cannot discard a failed Writing save', async ({ page, request }) => {
  const root = await mkdtemp(join(tmpdir(), 'sharing-save-guard-'));
  try {
    const { campaign } = await seed(request, root);
    const list = await (await request.get(`/api/campaigns/${campaign}/drafts`)).json();
    const draft = list.drafts[0];
    await page.goto(`/writing?campaign=${campaign}&draft=${draft.id}`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Harbour guide');
    await page.route(`**/api/campaigns/${campaign}/drafts/${draft.id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Save unavailable' }),
          })
        : route.continue(),
    );
    await page.getByLabel('Title', { exact: true }).fill('Unsaved title must remain');
    const dialog = page.waitForEvent('dialog');
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await (await dialog).dismiss();
    await expect(page).toHaveURL(/\/writing/);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Unsaved title must remain',
    );
  } finally {
    await page.unrouteAll();
    await rm(root, { recursive: true, force: true });
  }
});
