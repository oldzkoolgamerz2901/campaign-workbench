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

test('G3.3 contextual claim transfer removal recovery and withdrawal during reading', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-lifecycle-'));
  const tabletContext = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  try {
    const { campaign, session, item } = await seed(request, root);
    const prefix = `/api/campaigns/${campaign}/sharing`;
    const player = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Mira' } })
    ).json();
    const preview = await (
      await request.post(`${prefix}/preview`, { data: { session, item } })
    ).json();
    async function distribute(mode: string) {
      const response = await request.post(`${prefix}/cards`, {
        data: {
          operation: crypto.randomUUID(),
          session,
          item,
          fingerprint: preview.fingerprint,
          mode,
          recipient: null,
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    }
    const inventory = await distribute('INVENTORY');
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await expect(page.locator('shared-card-tray .entry')).toHaveCount(1);
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (
      await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })
    ).json();
    const tablet = await tabletContext.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1);
    const actions = tablet.getByLabel('Actions for Harbour guide');
    await actions.focus();
    await tablet.keyboard.press('Enter');
    await tablet.getByRole('button', { name: 'Claim', exact: true }).click();
    await expect(tablet.getByRole('heading', { name: 'Group Cards', exact: true })).toBeVisible();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(0);
    await expect(tablet.getByLabel('Shared cards', { exact: true })).toBeFocused();
    await expect(tablet.getByRole('button', { name: /My Cards.*New/ })).toBeVisible();
    await tablet.getByRole('button', { name: /My Cards/ }).click();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1);
    await tablet.getByLabel('Actions for Harbour guide').click();
    await tablet.getByRole('button', { name: 'Remove', exact: true }).click();
    let confirmation = tablet.getByRole('dialog', { name: 'Remove inventory' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(
      (await (await request.get(`${prefix}/collection?recipient=${player.id}`)).json()).cards[0].id,
    ).toBe(inventory.id);
    await tablet.getByRole('button', { name: 'Remove', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Confirm removal' }).click();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(0);
    await expect(tablet.getByLabel('Shared cards', { exact: true })).toBeFocused();
    await request.put(`${prefix}/players/${player.id}/active`, { data: { active: false } });
    await page.getByRole('button', { name: 'Removed cards', exact: true }).click();
    const recovery = page.getByRole('dialog', { name: 'Removed cards', exact: true });
    await expect(recovery).toContainText('Mira');
    await page.screenshot({ path: info.outputPath('recovery-1440.png'), fullPage: true });
    await recovery.getByRole('button', { name: 'Restore Harbour guide' }).click();
    await expect(recovery.getByRole('button', { name: 'Restore Harbour guide' })).toHaveCount(0);
    await expect(recovery.getByRole('button', { name: 'Close removed cards' })).toBeFocused();
    expect(
      (await (await request.get(`${prefix}/collection?recipient=${player.id}`)).json()).cards[0].id,
    ).toBe(inventory.id);
    await recovery.getByRole('button', { name: 'Close removed cards' }).click();
    await page
      .getByRole('navigation', { name: 'Collections' })
      .getByRole('button', { name: 'Mira', exact: true })
      .click();
    await expect(page.locator('shared-card-tray .entry')).toHaveCount(1);
    await page.getByLabel('Actions for Harbour guide').click();
    await page.getByRole('button', { name: 'Transfer', exact: true }).click();
    const transfer = page.getByRole('dialog', { name: 'Transfer card', exact: true });
    await transfer.getByLabel('Transfer destination').selectOption('group');
    await transfer.getByRole('button', { name: 'Transfer now' }).click();
    await expect(transfer).not.toBeVisible();
    expect((await (await request.get(`${prefix}/collection`)).json()).cards[0].id).toBe(
      inventory.id,
    );
    await request.put(`${prefix}/players/${player.id}/active`, { data: { active: true } });
    await tablet.getByRole('button', { name: /Group Cards/ }).click();
    await tablet.reload();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1);
    await request.post(`${prefix}/cards/${inventory.id}/remove`, { data: {} });
    const handout = await distribute('HANDOUT');
    await expect(tablet.locator('shared-card-tray .entry small')).toHaveText('Handout', {
      timeout: 12000,
    });
    await expect(tablet.getByLabel('Actions for Harbour guide')).toHaveCount(0);
    await tablet.locator('shared-card-tray .entry article').click();
    const expanded = tablet.getByRole('dialog', { name: 'Expanded card', exact: true });
    await expanded.getByRole('button', { name: 'Flip to back' }).click();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'back');
    await tablet.screenshot({ path: info.outputPath('expanded-800.png'), fullPage: true });
    await page
      .getByRole('navigation', { name: 'Collections' })
      .getByRole('button', { name: 'Group', exact: true })
      .click();
    await expect(page.locator('shared-card-tray .entry small')).toHaveText('Handout');
    await page.getByLabel('Actions for Harbour guide').click();
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Withdraw card' })
      .getByRole('button', { name: 'Confirm removal' })
      .click();
    await expect(expanded).not.toBeVisible({ timeout: 12000 });
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(0);
    await expect(tablet.getByLabel('Shared cards', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Removed cards', exact: true }).click();
    await expect(recovery).toContainText('Withdrawn');
    await expect(recovery.getByRole('button', { name: 'Restore Harbour guide' })).toHaveCount(2);
    const list = (await (await request.get(`${prefix}/removed`)).json()).cards;
    expect(list.find((entry: any) => entry.card.id === handout.id).state).toBe('WITHDRAWN');
    await tablet.setViewportSize({ width: 390, height: 844 });
    await tablet.screenshot({ path: info.outputPath('empty-390.png'), fullPage: true });
  } finally {
    await request.post('/api/gateway/disable', { data: {} });
    await tabletContext.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('G3.3 interrupted command reconnects and competing claim refreshes without navigation', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(90000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-lifecycle-stale-'));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const { campaign, session, item } = await seed(request, root);
    const prefix = `/api/campaigns/${campaign}/sharing`;
    const player = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Reader' } })
    ).json();
    const other = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Competitor' } })
    ).json();
    const preview = await (
      await request.post(`${prefix}/preview`, { data: { session, item } })
    ).json();
    const card = await (
      await request.post(`${prefix}/cards`, {
        data: {
          operation: crypto.randomUUID(),
          session,
          item,
          fingerprint: preview.fingerprint,
          mode: 'INVENTORY',
          recipient: null,
        },
      })
    ).json();
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await expect(page.locator('shared-card-tray .entry')).toHaveCount(1);
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const origin = `http://127.0.0.1:${gateway.port}`;
    const invite = await (
      await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })
    ).json();
    const tablet = await context.newPage();
    await tablet.goto(`${origin}/player/pair#token=${invite.token}`);
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(1);
    await tablet.getByLabel('Actions for Harbour guide').click();
    await tablet.screenshot({ path: info.outputPath('actions-390.png'), fullPage: true });
    await tablet.route('**/player-api/cards/*/claim', (route) => route.abort('connectionfailed'));
    await tablet.getByRole('button', { name: 'Claim', exact: true }).click();
    await expect(tablet.getByText(/Connection lost/)).toBeVisible();
    await expect(tablet.getByRole('button', { name: 'Claim', exact: true })).toBeDisabled();
    await tablet.locator('shared-card-tray .entry article').click();
    const expanded = tablet.getByRole('dialog', { name: 'Expanded card', exact: true });
    await expanded.getByRole('button', { name: 'Flip to back' }).click();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'back');
    await expanded.getByRole('button', { name: 'Close expanded card' }).click();
    await tablet.unroute('**/player-api/cards/*/claim');
    await expect(tablet.getByRole('button', { name: 'Claim', exact: true })).toBeEnabled({
      timeout: 12000,
    });
    const invitation = await (
      await request.post(`${prefix}/players/${other.id}/pairing`, { data: {} })
    ).json();
    const paired = await (
      await request.post(`${origin}/player-api/pair`, { data: { token: invitation.token } })
    ).json();
    await tablet.route('**/player-api/cards/*/claim', async (route) => {
      const won = await request.post(`${origin}/player-api/cards/${card.id}/claim`, {
        data: {},
        headers: { Authorization: `Bearer ${paired.credential}` },
      });
      expect(won.ok()).toBe(true);
      await route.continue();
    });
    await tablet.getByRole('button', { name: 'Claim', exact: true }).click();
    await expect(
      tablet.getByText('This card is no longer available for that action.', { exact: true }),
    ).toBeVisible();
    await expect(tablet.locator('shared-card-tray .entry')).toHaveCount(0);
    await expect(tablet.getByLabel('Shared cards', { exact: true })).toBeFocused();
    await expect(tablet.getByRole('heading', { name: 'Group Cards', exact: true })).toBeVisible();
    expect(
      (await (await request.get(`${prefix}/collection?recipient=${other.id}`)).json()).cards[0].id,
    ).toBe(card.id);
  } finally {
    await request.post('/api/gateway/disable', { data: {} });
    await context.close();
    await rm(root, { recursive: true, force: true });
  }
});
