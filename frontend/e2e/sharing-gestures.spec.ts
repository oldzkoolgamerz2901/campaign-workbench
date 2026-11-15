import { test, expect, APIRequestContext, Page, Locator } from '@playwright/test';
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

async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 80);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, from.y + 85, { steps: 4 });
  await target.scrollIntoViewIfNeeded();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}

test('G3.5 direct distribution, organization, modal claim, transfer and confirmed removal preserve identity', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-gestures-'));
  const context = await browser.newContext({
    viewport: { width: 800, height: 1280 },
    hasTouch: true,
  });
  try {
    const { campaign, session, item } = await seed(request, root),
      prefix = `/api/campaigns/${campaign}/sharing`;
    const preparedBefore = await (
      await request.get(`/api/campaigns/${campaign}/sessions/${session}`)
    ).json();
    const player = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Mira' } })
    ).json();
    const collection = async (recipient = '') =>
      (
        await request.get(`${prefix}/collection${recipient ? '?recipient=' + recipient : ''}`)
      ).json();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    const destinations = page.getByRole('navigation', { name: 'Collections' });
    await expect(destinations.getByRole('button', { name: 'Mira', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('dm-destinations.png'), fullPage: true });
    const shareButton = page.getByRole('button', { name: 'Share Harbour guide', exact: true });
    const buttonBox = (await shareButton.boundingBox())!;
    await page.mouse.move(buttonBox.x + 20, buttonBox.y + 15);
    await page.mouse.down();
    await page.mouse.move(buttonBox.x + 45, buttonBox.y + 15);
    await expect(page.locator('.sharing-drop-eligible')).toHaveCount(0);
    await page.mouse.move(2, 2);
    await page.mouse.up();

    await drag(
      page,
      page.locator('.source-entry'),
      destinations.getByRole('button', { name: 'Group', exact: true }),
    );
    const review = page.getByRole('dialog', { name: 'Share card', exact: true });
    await expect(review).toBeVisible();
    expect((await collection()).cards).toHaveLength(0);
    await expect(review.getByLabel('Mode', { exact: true })).toHaveValue('');
    await review.getByLabel('Mode', { exact: true }).selectOption('INVENTORY');
    await review.getByRole('button', { name: 'Confirm sharing' }).click();
    await expect(review).not.toBeVisible();
    const first = (await collection()).cards[0];
    await page.getByRole('button', { name: 'New pile', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Organize collection' });
    await editor.getByLabel('Pile name').fill('Found');
    await editor.getByRole('button', { name: 'Save organization' }).click();
    const pile = page.getByRole('region', { name: 'Found', exact: true });
    await expect(pile).toBeVisible();
    await drag(page, page.locator(`[data-shared-card="${first.id}"]`), pile);
    await expect.poll(async () => (await collection()).cards[0].pile).not.toBeNull();
    await pile.getByRole('button', { name: 'Show all', exact: true }).click();
    const all = page.getByRole('dialog', { name: 'Show all cards', exact: true });
    await drag(
      page,
      all.locator(`[data-shared-card="${first.id}"]`),
      all.getByText('Move to Unsorted', { exact: true }),
    );
    await expect.poll(async () => (await collection()).cards[0].pile).toBeNull();
    await all.getByRole('button', { name: 'Close pile' }).click();
    await drag(
      page,
      page.locator(`[data-shared-card="${first.id}"]`),
      destinations.getByRole('button', { name: 'Mira', exact: true }),
    );
    await expect
      .poll(async () => (await collection(player.id)).cards.map((c: any) => c.id))
      .toEqual([first.id]);
    await destinations.getByRole('button', { name: /Mira/ }).click();
    await expect(page.locator(`[data-shared-card="${first.id}"]`)).toBeVisible();
    await drag(
      page,
      page.locator(`[data-shared-card="${first.id}"]`),
      page
        .locator('.cards-workspace > .panel .drop-destinations')
        .getByText('Group · Found', { exact: true }),
    );
    await expect
      .poll(async () => (await collection()).cards.map((c: any) => c.id))
      .toEqual([first.id]);
    await destinations.getByRole('button', { name: /Group/ }).click();
    await expect.poll(async () => (await collection()).cards[0].pile).not.toBeNull();
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (
      await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })
    ).json();
    const tablet = await context.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    const groupPile = tablet.getByRole('region', { name: 'Found', exact: true });
    await expect(groupPile.getByRole('button', { name: 'Show all', exact: true })).toHaveCount(0);
    await expect(groupPile.locator('.pile-menu')).toHaveCount(0);
    await expect(tablet.getByText('Card actions', { exact: true })).toHaveCount(0);
    await drag(
      tablet,
      groupPile.locator('[data-shared-card]'),
      tablet.getByText('Move to Unsorted', { exact: true }),
    );
    await expect.poll(async () => (await collection()).cards[0].pile).toBeNull();
    await drag(tablet, tablet.locator('.tray [data-shared-card]'), groupPile);
    await expect.poll(async () => (await collection()).cards[0].pile).not.toBeNull();
    await tablet.getByRole('region', { name: 'Found', exact: true }).locator('article').click();
    const modal = tablet.getByRole('dialog', { name: 'Show all cards', exact: true });
    await expect(modal.getByText('My Cards · Claim', { exact: true })).toHaveCount(0);
    await drag(
      tablet,
      modal.locator(`[data-shared-card="${first.id}"]`),
      modal.getByText('My Cards · Claim', { exact: true }),
    );
    await expect
      .poll(async () => (await collection(player.id)).cards.map((c: any) => c.id))
      .toEqual([first.id]);
    await expect(tablet.getByRole('heading', { name: 'Group Cards', exact: true })).toBeVisible();
    await modal.getByRole('button', { name: 'Close pile' }).click();
    await tablet.getByRole('button', { name: /My Cards/ }).click();
    const personal = tablet.locator(`[data-shared-card="${first.id}"]`);
    await expect(personal).toBeVisible();

    // Personal drag uses the authenticated organization command, including inside Show all.
    await tablet.getByRole('button', { name: 'New pile', exact: true }).click();
    const personalEditor = tablet.getByRole('dialog', { name: 'Organize collection' });
    await personalEditor.getByLabel('Pile name').fill('Equipment');
    await personalEditor.getByRole('button', { name: 'Save organization' }).click();
    const equipment = tablet.getByRole('region', { name: 'Equipment', exact: true });
    await expect(equipment).toBeVisible();
    await drag(tablet, personal, equipment);
    await expect.poll(async () => (await collection(player.id)).cards[0].pile).not.toBeNull();
    await equipment.locator('article').click();
    const personalAll = tablet.getByRole('dialog', { name: 'Show all cards', exact: true });
    await drag(
      tablet,
      personalAll.locator(`[data-shared-card="${first.id}"]`),
      personalAll.getByText('Move to Unsorted', { exact: true }),
    );
    await expect.poll(async () => (await collection(player.id)).cards[0].pile).toBeNull();
    await personalAll.getByRole('button', { name: 'Close pile' }).click();
    // A control tap must flip without starting a drag or opening the expanded reader.
    await personal.getByRole('button', { name: 'Flip to back', exact: true }).tap();
    await expect(personal.locator('article')).toHaveAttribute('data-side', 'back');
    await expect(
      tablet.getByRole('dialog', { name: 'Expanded card', exact: true }),
    ).not.toBeVisible();
    await drag(tablet, personal, tablet.getByText('Remove · confirm', { exact: true }));
    const remove = tablet.getByRole('dialog', { name: 'Remove inventory' });
    await expect(remove).toBeVisible();
    await remove.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await collection(player.id)).cards[0].id).toBe(first.id);
    await drag(tablet, personal, tablet.getByText('Remove · confirm', { exact: true }));
    await remove.getByRole('button', { name: 'Confirm removal', exact: true }).click();
    await expect.poll(async () => (await collection(player.id)).cards.length).toBe(0);
    await tablet.screenshot({ path: info.outputPath('tablet-after-removal.png'), fullPage: true });
    expect(
      await (await request.get(`/api/campaigns/${campaign}/sessions/${session}`)).json(),
    ).toEqual(preparedBefore);
  } finally {
    await request.post('/api/gateway/disable', { data: {} }).catch(() => {});
    await context.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('G3.5 touch hold claims, swipe scrolls and cancellation never mutates', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-touch-'));
  const context = await browser.newContext({
    viewport: { width: 600, height: 800 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const { campaign, session, item } = await seed(request, root),
      prefix = `/api/campaigns/${campaign}/sharing`;
    const player = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Mira' } })
    ).json();
    const preview = await (
      await request.post(`${prefix}/preview`, { data: { session, item } })
    ).json();
    for (let i = 0; i < 3; i++)
      await request.post(`${prefix}/cards`, {
        data: {
          operation: crypto.randomUUID(),
          session,
          item,
          fingerprint: preview.fingerprint,
          mode: 'INVENTORY',
          recipient: null,
        },
      });
    await request.put(`/api/campaigns/${campaign}/selection`, { data: {} });
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (
      await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })
    ).json();
    const tablet = await context.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    const cards = tablet.locator('[data-shared-card]');
    await expect(cards).toHaveCount(3);
    const image = cards.first().locator('img');
    await expect(image).toHaveCSS('user-select', 'none');
    expect(
      await image.evaluate(
        (el) =>
          !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      ),
    ).toBe(true);
    const cdp = await context.newCDPSession(tablet);
    async function touch(type: string, x?: number, y?: number) {
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: x === undefined ? [] : [{ x, y, id: 1 }],
      });
    }
    const from = (await cards.first().boundingBox())!,
      x = from.x + 100,
      y = from.y + 100;
    await touch('touchStart', x, y);
    await touch('touchMove', x - 90, y);
    await touch('touchEnd');
    await expect
      .poll(() => tablet.locator('.tray').evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    expect((await (await request.get(`${prefix}/collection`)).json()).cards).toHaveLength(3);
    await cards.first().scrollIntoViewIfNeeded();
    let box = (await cards.first().boundingBox())!;
    await touch('touchStart', box.x + 100, box.y + 100);
    await expect(cards.first()).toHaveClass(/sharing-grabbed/);
    await expect(tablet.locator('.sharing-drop-eligible').first()).toBeVisible();
    await touch('touchEnd');
    await expect(tablet.locator('.sharing-grabbed')).toHaveCount(0);
    await expect(
      tablet.getByRole('dialog', { name: 'Expanded card', exact: true }),
    ).not.toBeVisible();
    expect((await (await request.get(`${prefix}/collection`)).json()).cards).toHaveLength(3);

    await touch('touchStart', box.x + 100, box.y + 100);
    await tablet.waitForTimeout(230);
    await touch('touchMove', box.x + 115, box.y + 105);
    await expect(tablet.locator('.sharing-drop-eligible').first()).toBeVisible();
    await touch('touchCancel');
    await expect(tablet.locator('.sharing-drop-eligible')).toHaveCount(0);
    expect((await (await request.get(`${prefix}/collection`)).json()).cards).toHaveLength(3);
    // Escape cancels a mouse drag even if released over an eligible target.
    box = (await cards.first().boundingBox())!;
    await tablet.mouse.move(box.x + 100, box.y + 100);
    await tablet.mouse.down();
    await tablet.mouse.move(box.x + 120, box.y + 105);
    await tablet.keyboard.press('Escape');
    const target = tablet.getByRole('button', { name: /My Cards/ }),
      to = (await target.boundingBox())!;
    await tablet.mouse.move(to.x + 10, to.y + 10);
    await tablet.mouse.up();
    expect((await (await request.get(`${prefix}/collection`)).json()).cards).toHaveLength(3);
    await cards.first().scrollIntoViewIfNeeded();
    box = (await cards.first().boundingBox())!;
    await touch('touchStart', box.x + 100, box.y + 100);
    await tablet.waitForTimeout(230);
    await touch('touchMove', box.x + 115, box.y + 105);
    const dest = (await target.boundingBox())!;
    await touch('touchMove', dest.x + dest.width / 2, dest.y + dest.height / 2);
    await expect(target).toHaveCSS('outline-style', 'solid');
    await expect(target).toHaveClass(/sharing-drop-hover/);
    await tablet.screenshot({ path: info.outputPath('touch-claim-target.png'), fullPage: true });
    await touch('touchEnd');
    await expect
      .poll(
        async () =>
          (await (await request.get(`${prefix}/collection?recipient=${player.id}`)).json()).cards
            .length,
      )
      .toBe(1);
    await expect(tablet.getByRole('heading', { name: 'Group Cards', exact: true })).toBeVisible();
    await expect(
      tablet.getByRole('dialog', { name: 'Expanded card', exact: true }),
    ).not.toBeVisible();
    await expect(tablet.getByLabel('Shared cards', { exact: true })).toBeFocused();
    // Authoritative disappearance during a held drag cancels before release.
    await cards.first().scrollIntoViewIfNeeded();
    box = (await cards.first().boundingBox())!;
    const disappearing = await cards.first().getAttribute('data-shared-card');
    await tablet.mouse.move(box.x + 100, box.y + 100);
    await tablet.mouse.down();
    await tablet.mouse.move(box.x + 120, box.y + 105);
    await request.post(`${prefix}/cards/${disappearing}/remove`, { data: {} });
    await expect(tablet.locator('.sharing-drop-eligible')).toHaveCount(0, { timeout: 10000 });
    await tablet.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2);
    await tablet.mouse.up();
    expect(
      (await (await request.get(`${prefix}/collection?recipient=${player.id}`)).json()).cards,
    ).toHaveLength(1);
    // Unknown transport loss also cancels; local reading remains usable until denial.
    await expect(cards).toHaveCount(1);
    await cards.first().scrollIntoViewIfNeeded();
    box = (await cards.first().boundingBox())!;
    await tablet.mouse.move(box.x + 100, box.y + 100);
    await tablet.mouse.down();
    await tablet.mouse.move(box.x + 120, box.y + 105);
    await tablet.route('**/player-api/collections', (route) => route.abort('connectionfailed'));
    await expect(tablet.getByText(/Connection lost/)).toBeVisible({ timeout: 10000 });
    await expect(tablet.locator('.sharing-drop-eligible')).toHaveCount(0);
    await tablet.mouse.move(dest.x + dest.width / 2, dest.y + dest.height / 2);
    await tablet.mouse.up();
    expect(
      (await (await request.get(`${prefix}/collection?recipient=${player.id}`)).json()).cards,
    ).toHaveLength(1);
    await cards.first().getByRole('button', { name: 'Flip to back', exact: true }).click();
    await expect(cards.first().locator('article')).toHaveAttribute('data-side', 'back');
    await tablet.unroute('**/player-api/collections');
    await expect(tablet.getByText('Connected', { exact: true })).toBeVisible({ timeout: 10000 });
    // A completed refresh after denial removes both readable content and gesture affordances.
    await request.put(`${prefix}/players/${player.id}/active`, { data: { active: false } });
    await expect(cards).toHaveCount(0, { timeout: 10000 });
    await expect(tablet.locator('.sharing-drop-eligible')).toHaveCount(0);
  } finally {
    await request.post('/api/gateway/disable', { data: {} }).catch(() => {});
    await context.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('G3.5 anchored modal reorder preserves cover, polling preserves drag and handouts cannot be claimed', async ({
  page,
  request,
  browser,
}, info) => {
  test.setTimeout(120000);
  const root = await mkdtemp(join(tmpdir(), 'sharing-reorder-'));
  const context = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  try {
    const { campaign, session, item } = await seed(request, root),
      prefix = `/api/campaigns/${campaign}/sharing`;
    const player = await (
      await request.post(`${prefix}/players`, { data: { displayName: 'Mira' } })
    ).json();
    const created = await (
      await request.post(`${prefix}/organization`, { data: { kind: 'CREATE', name: 'Handouts' } })
    ).json();
    const pile = created.piles[0];
    const preview = await (
      await request.post(`${prefix}/preview`, { data: { session, item } })
    ).json();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const card = await (
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
        })
      ).json();
      ids.push(card.id);
    }
    const collection = async () => (await request.get(`${prefix}/collection`)).json();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/share?campaign=${campaign}&session=${session}`);
    await page
      .getByRole('region', { name: 'Handouts', exact: true })
      .getByRole('button', { name: 'Show all', exact: true })
      .click();
    const all = page.getByRole('dialog', { name: 'Show all cards', exact: true });
    await drag(
      page,
      all.locator(`[data-shared-card="${ids[2]}"]`),
      all.locator(`[data-shared-card="${ids[0]}"]`),
    );
    await expect
      .poll(async () => (await collection()).cards.map((c: any) => c.id))
      .toEqual([ids[2], ids[0], ids[1]]);
    expect((await collection()).piles[0].cover).toBe(ids[0]);
    await all.screenshot({ path: info.outputPath('modal-reordered.png') });
    const source = all.locator(`[data-shared-card="${ids[1]}"]`),
      box = (await source.boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 90);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 95);
    // Wait for a real complete refresh while the pointer remains held.
    const polling = page.waitForResponse(
      (r) => r.url().includes('/sharing/collection') && r.request().method() === 'GET',
    );
    await polling;
    await expect(all.getByText('Move to Unsorted', { exact: true })).toBeVisible();
    const target = (await all.getByText('Move to Unsorted', { exact: true }).boundingBox())!;
    await page.mouse.move(target.x + 10, target.y + 10);
    await page.mouse.up();
    await expect
      .poll(async () => (await collection()).cards.find((c: any) => c.id === ids[1]).pile)
      .toBeNull();
    // Releasing outside every destination cancels and does not withdraw a handout.
    const remaining = all.locator(`[data-shared-card="${ids[0]}"]`),
      r = (await remaining.boundingBox())!;
    await page.mouse.move(r.x + 100, r.y + 90);
    await page.mouse.down();
    await page.mouse.move(r.x + 120, r.y + 95);
    await page.mouse.move(2, 2);
    await page.mouse.up();
    expect((await collection()).cards).toHaveLength(3);
    await all.getByRole('button', { name: 'Close pile' }).click();
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (
      await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })
    ).json();
    const tablet = await context.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    const handout = tablet.locator('.tray [data-shared-card]').first();
    await expect(handout).toBeVisible();
    const h = (await handout.boundingBox())!;
    await tablet.mouse.move(h.x + 100, h.y + 90);
    await tablet.mouse.down();
    await tablet.mouse.move(h.x + 125, h.y + 95);
    await expect(tablet.getByText('My Cards · Claim', { exact: true })).toHaveCount(0);
    await expect(tablet.getByText('Remove · confirm', { exact: true })).toHaveCount(0);
    await tablet.mouse.move(2, 2);
    await tablet.mouse.up();
    expect((await collection()).cards).toHaveLength(3);
    const handoutId = await handout.getAttribute('data-shared-card');
    await drag(tablet, handout, tablet.getByRole('region', { name: 'Handouts', exact: true }));
    await expect
      .poll(async () => (await collection()).cards.find((c: any) => c.id === handoutId).pile)
      .toBe(pile.id);
    await tablet.getByRole('region', { name: 'Handouts', exact: true }).locator('article').click();
    const playerAll = tablet.getByRole('dialog', { name: 'Show all cards', exact: true });
    await drag(
      tablet,
      playerAll.locator(`[data-shared-card="${handoutId}"]`),
      playerAll.getByText('Move to Unsorted', { exact: true }),
    );
    await expect
      .poll(async () => (await collection()).cards.find((c: any) => c.id === handoutId).pile)
      .toBeNull();
    await playerAll.getByRole('button', { name: 'Close pile' }).click();
    await tablet.setViewportSize({ width: 390, height: 844 });
    expect(await tablet.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await tablet.screenshot({ path: info.outputPath('handouts-390.png'), fullPage: true });
  } finally {
    await request.post('/api/gateway/disable', { data: {} }).catch(() => {});
    await context.close();
    await rm(root, { recursive: true, force: true });
  }
});
