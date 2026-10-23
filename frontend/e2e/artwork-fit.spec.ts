import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('cards fill the background with portrait, landscape and square artwork behind a readable bottom panel', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-artwork-fit-'));
  try {
    const campaign = await (
      await request.post('/api/campaigns', {
        data: { name: 'Full artwork fixtures', directory: root },
      })
    ).json();
    let draft = await (
      await request.post(`/api/campaigns/${campaign.id}/drafts`, {
        data: { type: 'npc', template: false },
      })
    ).json();
    const endpoint = `/api/campaigns/${campaign.id}/drafts/${draft.id}`;
    draft = await (
      await request.put(endpoint, {
        data: {
          revision: draft.revision,
          fields: {
            ...draft.fields,
            title: 'Complete artwork',
            summary: 'Artwork fills the card behind this parchment panel.',
            body: '# Full artwork\nComplete source document.',
            path: 'full-artwork.md',
          },
        },
      })
    ).json();
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    for (const [name, imageWidth, imageHeight] of [
      ['portrait', 360, 720],
      ['landscape', 720, 360],
      ['square', 480, 480],
    ] as const) {
      // Real raster uploads with coloured edges make cropping visible in the screenshots.
      const base64 = await page.evaluate(
        ({ width, height }) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d')!;
          context.fillStyle = '#f2dfb0';
          context.fillRect(0, 0, width, height);
          context.fillStyle = '#db2828';
          context.fillRect(0, 0, width, 20);
          context.fillStyle = '#2877db';
          context.fillRect(0, height - 20, width, 20);
          context.fillStyle = '#288c39';
          context.fillRect(0, 20, 20, height - 40);
          context.fillStyle = '#9147c7';
          context.fillRect(width - 20, 20, 20, height - 40);
          context.fillStyle = '#25352b';
          context.font = '28px sans-serif';
          context.fillText('Whole image', 35, height / 2);
          return canvas.toDataURL('image/png').split(',')[1];
        },
        { width: imageWidth, height: imageHeight },
      );
      const saving = page.waitForResponse(
        (response) =>
          response.url().endsWith(`${endpoint}/artwork`) &&
          response.request().method() === 'POST' &&
          response.ok(),
      );
      await page.getByLabel('Card artwork', { exact: true }).setInputFiles({
        name: `${name}.png`,
        mimeType: 'image/png',
        buffer: Buffer.from(base64, 'base64'),
      });
      await saving;
      const card = page.locator('.preview-panel playing-card article');
      const image = card.locator('img');
      await expect(image).toHaveAttribute('src', /^blob:/);
      await expect
        .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth / el.naturalHeight))
        .toBeCloseTo(imageWidth / imageHeight, 2);
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const outer = (await card.boundingBox())!;
        expect(outer.width / outer.height).toBeCloseTo(243 / 420, 2);
        if (width === 1280) expect(outer.width).toBe(320);
        await expect(image).toHaveCSS('object-fit', 'cover');
        const area = (await image.boundingBox())!;
        expect(area.height / outer.height).toBeGreaterThan(0.98);
        const panel = (await card.locator('.card-content').boundingBox())!;
        expect(panel.height / outer.height).toBeGreaterThan(0.35);
        expect(panel.height / outer.height).toBeLessThanOrEqual(0.41);
        expect(panel.y + panel.height).toBeLessThanOrEqual(outer.y + outer.height);
        await expect(card.locator('.card-content')).toHaveCSS(
          'background-color',
          'rgb(242, 239, 220)',
        );
        // Resizing can move the lazy artwork out of view and reload its Blob.
        // Scroll it into view, then measure loaded pixels and layout in one frame.
        await image.scrollIntoViewIfNeeded();
        await expect(async () => {
          await expect(image).toHaveAttribute('src', /^blob:/);
          const measured = await image.evaluate((el: HTMLImageElement) => {
            const box = el.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              naturalWidth: el.naturalWidth,
              naturalHeight: el.naturalHeight,
            };
          });
          expect(measured.naturalWidth / measured.naturalHeight).toBeCloseTo(
            imageWidth / imageHeight,
            2,
          );
          const scale = Math.max(
            measured.width / measured.naturalWidth,
            measured.height / measured.naturalHeight,
          );
          expect(measured.naturalWidth * scale).toBeGreaterThanOrEqual(measured.width - 0.01);
          expect(measured.naturalHeight * scale).toBeGreaterThanOrEqual(measured.height - 0.01);
        }).toPass();
        await card.screenshot({ path: info.outputPath(`${name}-${width}.png`) });
      }
      await page.setViewportSize({ width: 1280, height: 900 });
    }
    await page
      .locator('.preview-panel playing-card')
      .getByRole('button', { name: 'Open full document' })
      .click();
    await expect(page.locator('draft-reader')).toContainText('Complete source document.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
