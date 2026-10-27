import { drag } from './sharing-drag';
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

test('G3.4 organization, atomic distribution, local cover browsing and stable reading across devices', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-piles-'));
  const context = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  const secondContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  try {
    const { campaign, session, item } = await seed(request, root),
      prefix = `/api/campaigns/${campaign}/sharing`;
    const player = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Mira' } })
    ).json();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await page.getByRole('button', { name: 'New pile', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Organize collection' });
    await editor.getByLabel('Pile name').fill('Empty');
    await editor.getByRole('button', { name: 'Save organization' }).click();
    await expect(page.getByRole('button', { name: 'Open empty pile Empty' })).toBeVisible();
    await page.getByRole('button', { name: 'Share Harbour guide', exact: true }).click();
    const share = page.getByRole('dialog', { name: 'Share card', exact: true });
    await share.getByLabel('Mode', { exact: true }).selectOption('INVENTORY');
    await share.getByLabel('Group destination').selectOption('new');
    await expect(share.getByRole('button', { name: 'Confirm sharing' })).toBeDisabled();
    await share.getByLabel('New pile name').fill('Found');
    for (const size of [
      { width: 1280, height: 720 },
      { width: 800, height: 600 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      const confirm = share.getByRole('button', { name: 'Confirm sharing' });
      await expect(confirm).toBeInViewport({ ratio: 1 });
      const bounds = await share.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await share.getByRole('button', { name: 'Confirm sharing' }).click();
    await expect(share).not.toBeVisible();
    const group = await (await request.get(`${prefix}/collection`)).json(),
      pile = group.piles.find((p: any) => p.name === 'Found'),
      first = group.cards[0];
    const preview = await (
      await request.post(`${prefix}/preview`, { data: { session, item } })
    ).json();
    await request.post(`${prefix}/cards`, {
      data: {
        operation: crypto.randomUUID(),
        session,
        item,
        fingerprint: preview.fingerprint,
        mode: 'HANDOUT',
        recipient: null,
        pile: pile.id,
      },
    });
    await expect(page.getByRole('region', { name: 'Found', exact: true })).toContainText('2 cards');
    const dmPile = page.getByRole('region', { name: 'Found', exact: true });
    await dmPile.getByRole('button', { name: 'Next cover in Found' }).click();
    await expect
      .poll(
        async () =>
          (await (await request.get(`${prefix}/collection`)).json()).piles.find(
            (p: any) => p.id === pile.id,
          ).cover,
      )
      .not.toBe(first.id);
    let savedCover = (await (await request.get(`${prefix}/collection`)).json()).piles.find(
      (p: any) => p.id === pile.id,
    ).cover;
    await dmPile.getByLabel('Actions for pile Found').click();
    await dmPile.getByRole('button', { name: 'Move pile earlier' }).click();
    await expect
      .poll(async () => (await (await request.get(`${prefix}/collection`)).json()).piles[0].id)
      .toBe(pile.id);
    const empty = page.getByRole('region', { name: 'Empty', exact: true });
    await empty.getByLabel('Actions for pile Empty').focus();
    await page.keyboard.press('Enter');
    await empty.getByRole('button', { name: 'Rename pile', exact: true }).click();
    await editor.getByLabel('Pile name').fill('Reserve');
    await editor.getByRole('button', { name: 'Save organization' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Reserve', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('dm-piles.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: info.outputPath('dm-piles-1280.png'), fullPage: true });
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    async function pair(ctx: typeof context) {
      const invite = await (
        await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })
      ).json();
      const tab = await ctx.newPage();
      tab.setDefaultTimeout(12000);
      await tab.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
      await expect(tab.getByRole('region', { name: 'Found', exact: true })).toBeVisible();
      return tab;
    }
    const tablet = await pair(context),
      second = await pair(secondContext);
    tablet.setDefaultTimeout(12000);
    second.setDefaultTimeout(12000);
    const found = tablet.getByRole('region', { name: 'Found', exact: true });
    await expect(found.locator('small')).toHaveText('Handout');
    for (const surface of [dmPile, found]) {
      const label = (await surface.locator('.card-mode').boundingBox())!;
      const card = (await surface.locator('article').boundingBox())!;
      expect(label.y + label.height).toBeLessThanOrEqual(card.y);
      expect(Math.abs(label.x - card.x)).toBeLessThan(1);
      await expect(surface.locator('.pile-cover')).toHaveClass(/stacked/);
      expect(
        await surface
          .locator('.pile-cover')
          .evaluate((node) => getComputedStyle(node, '::before').content),
      ).toBe('""');
    }
    const stackedWidth = (await found.locator('article').boundingBox())!.width;
    for (const width of [800, 390]) {
      await second.setViewportSize({ width, height: 844 });
      const headerPositions = () =>
        second.locator('.player-header').evaluate((header) =>
          ['.player-info', '.identity', '.connection', 'button'].map((selector) => {
            const box = header.querySelector(selector)!.getBoundingClientRect();
            return { x: box.x, y: box.y, width: box.width, height: box.height };
          }),
        );
      const before = await headerPositions();
      await second.getByRole('button', { name: /My Cards/ }).click();
      await expect(second.getByRole('heading', { name: 'My Cards', exact: true })).toBeVisible();
      expect(await headerPositions()).toEqual(before);
      await second.getByRole('button', { name: /Group Cards/ }).click();
      expect(await headerPositions()).toEqual(before);
    }
    await request.post(`${prefix}/organization`, {
      data: { kind: 'COVER', pile: pile.id, card: first.id },
    });
    savedCover = first.id;
    await request.post(`${prefix}/organization`, {
      data: { kind: 'RENAME', pile: pile.id, name: 'Updated Found' },
    });
    const updated = tablet.getByRole('region', { name: 'Updated Found', exact: true });
    await expect(updated).toBeVisible({ timeout: 10000 });
    await expect(updated.locator('small')).toHaveText('Handout');
    await request.post(`${prefix}/organization`, {
      data: { kind: 'RENAME', pile: pile.id, name: 'Found' },
    });
    await expect(found).toBeVisible({ timeout: 10000 });
    await found.getByRole('button', { name: 'Next cover in Found' }).click();
    expect(
      (await (await request.get(`${prefix}/collection`)).json()).piles.find(
        (p: any) => p.id === pile.id,
      ).cover,
    ).toBe(savedCover);
    await found.locator('article').click();
    const all = tablet.getByRole('dialog', { name: 'Show all cards', exact: true });
    await expect(all.locator('.entry')).toHaveCount(2);
    await all.locator('.entry').first().locator('article').click();
    const expanded = tablet.getByRole('dialog', { name: 'Expanded card', exact: true });
    await expanded.getByRole('button', { name: 'Flip to back' }).click();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'back');
    await request.post(`${prefix}/organization`, {
      data: { kind: 'MOVE', card: first.id, source: pile.id, pile: null },
    });
    await expect(all.locator('.entry')).toHaveCount(1, { timeout: 10000 });
    await expect(expanded).toBeVisible();
    await expect(expanded.locator('article')).toHaveAttribute('data-side', 'back');
    await expect(expanded.getByRole('button', { name: 'Close expanded card' })).toHaveCount(0);
    await expanded.locator('article').click();
    await expect(expanded).toBeVisible();
    await tablet.mouse.click(5, 5);
    await expect(expanded).not.toBeVisible();
    await all.getByRole('button', { name: 'Close pile' }).click();
    await expect(found.locator('.pile-cover')).not.toHaveClass(/stacked/);
    expect((await found.locator('article').boundingBox())!.width).toBe(stackedWidth);
    await expect(tablet.locator('body')).not.toHaveCSS('overflow', 'hidden');
    await tablet.screenshot({ path: info.outputPath('tablet-piles.png'), fullPage: true });
    await drag(
      tablet,
      tablet.locator('.tray [data-shared-card]'),
      tablet.getByRole('button', { name: /My Cards/ }),
    );
    await tablet.getByRole('button', { name: /My Cards/ }).click();
    await tablet.getByRole('button', { name: 'New pile', exact: true }).click();
    const personal = tablet.getByRole('dialog', { name: 'Organize collection' });
    await personal.getByLabel('Pile name').fill('Equipment');
    await personal.getByRole('button', { name: 'Save organization' }).click();
    await expect(tablet.getByRole('region', { name: 'Equipment', exact: true })).toBeVisible();
    await drag(
      tablet,
      tablet.locator('.tray [data-shared-card]'),
      tablet.getByRole('region', { name: 'Equipment', exact: true }),
    );
    await expect(tablet.locator('.tray .entry')).toHaveCount(0);
    await second.getByRole('button', { name: /My Cards/ }).click();
    await expect(second.getByRole('region', { name: 'Equipment', exact: true })).toContainText(
      '1 card',
      { timeout: 10000 },
    );
    await second.setViewportSize({ width: 390, height: 844 });
    expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const heading = second
      .getByRole('region', { name: 'Equipment', exact: true })
      .locator('.pile-heading');
    const titleBox = (await heading.locator('h4').boundingBox())!;
    const pencilBox = (await heading
      .getByRole('button', { name: 'Rename pile', exact: true })
      .boundingBox())!;
    expect(pencilBox.x - titleBox.x - titleBox.width).toBeLessThanOrEqual(5);
    const positions = await heading
      .locator('.pile-name > h4, .pile-name > button, :scope > span, :scope > details > summary')
      .evaluateAll((nodes) =>
        nodes
          .map((n) => n.getBoundingClientRect())
          .filter((r) => r.width > 0)
          .map((r) => ({ top: r.top, bottom: r.bottom })),
      );
    expect(Math.max(...positions.map((r) => r.top))).toBeLessThan(
      Math.min(...positions.map((r) => r.bottom)),
    );
    await request.put(`${prefix}/players/${player.id}/name`, {
      data: { displayName: 'Mira '.repeat(35).trim() },
    });
    await expect(second.locator('.player-header .identity')).toContainText('Mira Mira', {
      timeout: 10000,
    });
    await expect(second.locator('.player-header .connection')).toContainText('Connected');
    expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await second.screenshot({ path: info.outputPath('personal-pile-390.png'), fullPage: true });
    await second.getByLabel('Actions for pile Equipment').click();
    const pileMenu = second
      .getByRole('region', { name: 'Equipment', exact: true })
      .locator('.pile-options');
    await expect(pileMenu).toBeVisible();
    await expect(
      pileMenu.getByRole('button', { name: 'Move pile later', exact: true }),
    ).toBeVisible();
    expect(
      await pileMenu.locator('button').evaluateAll((buttons) =>
        buttons.every((button) => {
          const r = button.getBoundingClientRect();
          const hit = document.elementFromPoint(r.right - 12, r.top + 12);
          return !!hit && button.contains(hit);
        }),
      ),
    ).toBe(true);
    await second.getByRole('button', { name: 'Rename pile', exact: true }).click();
    const longName = 'Equipment '.repeat(18).trim();
    const secondEditor = second.getByRole('dialog', { name: 'Organize collection' });
    await secondEditor.getByLabel('Pile name').fill(longName);
    await secondEditor.getByRole('button', { name: 'Save organization' }).click();
    await expect(second.getByRole('region', { name: longName, exact: true })).toBeVisible();
    expect(await second.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await second.screenshot({
      path: info.outputPath('personal-long-name-390.png'),
      fullPage: true,
    });
    await second
      .getByRole('region', { name: longName, exact: true })
      .getByRole('button', { name: 'Rename pile', exact: true })
      .click();
    await secondEditor.getByLabel('Pile name').fill('Equipment');
    await secondEditor.getByRole('button', { name: 'Save organization' }).click();
    await expect(tablet.getByRole('region', { name: 'Equipment', exact: true })).toBeVisible({
      timeout: 10000,
    });
    await tablet.getByLabel('Actions for pile Equipment').click();
    await tablet.getByRole('button', { name: 'Delete pile', exact: true }).click();
    await personal.getByRole('button', { name: 'Confirm pile deletion' }).click();
    await expect(tablet.locator('.tray .entry')).toHaveCount(1);
    await expect(second.getByRole('region', { name: 'Equipment', exact: true })).toHaveCount(0, {
      timeout: 10000,
    });
    const reserve = page.getByRole('region', { name: 'Reserve', exact: true });
    if (!(await reserve.locator('details').evaluate((node) => (node as HTMLDetailsElement).open)))
      await reserve.getByLabel('Actions for pile Reserve').click();
    await reserve.getByRole('button', { name: 'Delete pile', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Reserve', exact: true })).toHaveCount(0);
    await page
      .getByRole('navigation', { name: 'Collections' })
      .getByRole('button', { name: /^Mira/ })
      .click();
    await expect(page.getByRole('button', { name: 'New pile', exact: true })).toHaveCount(0);
    await second.setViewportSize({ width: 600, height: 800 });
    await second.screenshot({ path: info.outputPath('personal-narrow.png'), fullPage: true });
  } finally {
    await request.post('/api/gateway/disable', { data: {} }).catch(() => {});
    await context.close();
    await secondContext.close();
    await rm(root, { recursive: true, force: true });
  }
});
