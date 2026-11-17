import { test, expect, Locator, Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function readImage(page: Page, card: Locator) {
  await card.getByRole('button', { name: 'Details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Card details', exact: true });
  const image = dialog.getByRole('img', { name: 'Additional card image', exact: true });
  await expect(image).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);
  const box = (await image.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(2, 2);
  await expect(image).toHaveCSS('object-fit', 'contain');
  return dialog;
}

test('CD4 Details image saves with retry, remains uncropped before reveal, freezes independently and recovers from ZIP', async ({ page, request, browser }, info) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  const root = await mkdtemp(join(tmpdir(), 'details-image-ui-'));
  const tabletContext = await browser.newContext({ viewport: { width: 800, height: 1100 }, hasTouch: true });
  try {
    const campaign = await (await request.post('/api/campaigns', { data: { name: 'Details maps', directory: root } })).json();
    let draft = await (await request.post(`/api/campaigns/${campaign.id}/drafts`, { data: { type: 'npc', template: false } })).json();
    draft = await (await request.put(`/api/campaigns/${campaign.id}/drafts/${draft.id}`, { data: { revision: draft.revision, fields: {
      ...draft.fields, title: 'Map keeper', path: 'map-keeper.md', backText: 'CD4_PRIVATE_BACK', body: '# Keeper\nCD4_PRIVATE_SOURCE',
    } } })).json();
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    const encoded = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 600;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f2efdc'; ctx.fillRect(0, 0, 1200, 600);
      ctx.strokeStyle = '#46684d'; ctx.lineWidth = 6; ctx.strokeRect(20, 20, 1160, 560);
      ctx.fillStyle = '#28352b'; ctx.font = '36px sans-serif';
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
        ctx.strokeRect(45 + col * 285, 55 + row * 130, 250, 100);
        ctx.fillText(`Harbour ${row * 4 + col + 1}`, 58 + col * 285, 115 + row * 130);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByRole('navigation', { name: 'Editing tabs' }).getByRole('button', { name: 'Card', exact: true }).click();
    const upload = `**/api/campaigns/${campaign.id}/drafts/${draft.id}/details-image`;
    await page.route(upload, (route) => route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'Map upload unavailable.' }) }));
    await page.getByLabel('Details image', { exact: true }).setInputFiles({ name: 'harbour-map.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
    await expect(page.getByRole('alert')).toContainText('Map upload unavailable.');
    let details = await readImage(page, page.locator('writing-workspace playing-card'));
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    expect((await (await request.get(`/api/campaigns/${campaign.id}/drafts/${draft.id}`)).json()).detailsImage).toBeUndefined();
    await page.unroute(upload);
    const saved = page.waitForResponse((response) => response.url().endsWith(`/drafts/${draft.id}/details-image`) && response.ok());
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    draft = await (await saved).json();
    expect(draft.detailsImage.hash).toBeTruthy();
    await page.reload();
    details = await readImage(page, page.locator('writing-workspace playing-card'));
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({ path: info.outputPath(`details-map-${width}.png`), fullPage: true });
    }
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    let session = await (await request.post(`/api/campaigns/${campaign.id}/sessions`, { data: { title: 'Map session', objective: '' } })).json();
    const entry = (await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json()).entries.find((value: any) => value.draft === draft.id);
    const add = await request.post(`/api/campaigns/${campaign.id}/sessions/${session.id}/library`, { data: { revision: session.revision, key: entry.key, capture: null, draft: draft.id, draftRevision: draft.revision } });
    expect(add.ok(), await add.text()).toBe(true); session = (await add.json()).session;
    expect(session.items[0].detailsImage.hash).toBe(draft.detailsImage.hash);
    const backup = await request.get(`/api/writing-recovery/campaigns/${campaign.id}/portable-archive`);
    expect(backup.ok()).toBe(true); const zip = await backup.body();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/share?campaign=${campaign.id}&session=${session.id}`);
    const prefix = `/api/campaigns/${campaign.id}/sharing`;
    const player = await (await request.post(`${prefix}/players`, { data: { displayName: 'Map reader' } })).json();
    await page.getByRole('button', { name: 'Share Map keeper', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Share card', exact: true });
    await review.getByLabel('Mode', { exact: true }).selectOption('HANDOUT');
    await expect(review.getByRole('button', { name: 'Confirm sharing' })).toBeDisabled();
    details = await readImage(page, review.locator('playing-card'));
    await expect(details).toContainText('Back not revealed');
    await expect(details).not.toContainText('CD4_PRIVATE_BACK');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await review.getByRole('button', { name: 'Confirm sharing' }).click();
    await expect(review).toBeHidden();
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })).json();
    const tablet = await tabletContext.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    const card = tablet.locator('shared-card-tray .entry playing-card');
    details = await readImage(tablet, card);
    await expect(details).toContainText('Back not revealed');
    await expect(tablet.locator('body')).not.toContainText('CD4_PRIVATE_BACK');
    await expect(tablet.locator('body')).not.toContainText('CD4_PRIVATE_SOURCE');
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Details', exact: true })).toBeFocused();
    // A fresh failed read exposes Retry in the same Details window.
    await tablet.route('**/player-api/cards/*/details-image', (route) => route.abort());
    await tablet.reload();
    await card.getByRole('button', { name: 'Details', exact: true }).click();
    details = tablet.getByRole('dialog', { name: 'Card details', exact: true });
    await expect(details.getByRole('button', { name: 'Image unavailable · Retry', exact: true })).toBeVisible();
    await tablet.unroute('**/player-api/cards/*/details-image');
    await details.getByRole('button', { name: 'Image unavailable · Retry', exact: true }).click();
    await expect(details.getByRole('img', { name: 'Additional card image', exact: true })).toHaveAttribute('src', /^blob:/);
    await details.getByRole('button', { name: 'Close details', exact: true }).click();
    // Removing live preparation prunes its images, without affecting the distributed copy.
    const removed = await request.put(`/api/campaigns/${campaign.id}/sessions/${session.id}`, { data: { revision: session.revision, title: session.title, objective: session.objective, notes: session.notes, items: [] } });
    expect(removed.ok(), await removed.text()).toBe(true);
    await tablet.reload();
    details = await readImage(tablet, card);
    await expect(details).not.toContainText('CD4_PRIVATE_BACK');
    // Standalone recovery renders the original image without its live Draft/session.
    await page.goto('/writing/recovery');
    await page.getByLabel('Restore Writing archive', { exact: true }).setInputFiles({ name: 'maps.zip', mimeType: 'application/zip', buffer: zip });
    await page.getByRole('region', { name: 'Recovered records' }).getByRole('button', { name: /Map keeper · npc · revision/ }).click();
    await readImage(page, page.locator('writing-recovery playing-card'));
  } finally {
    await request.post('/api/gateway/disable', { data: {} });
    await tabletContext.close();
    await rm(root, { recursive: true, force: true });
  }
});
