import { historicalSourceItem, importHistoricalSession } from './preparation-fixtures';
import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('portrait geometry retains dense text through external reading in narrow containers', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-geometry-'));
  const title = 'The keeper of the forgotten harbour and the extraordinarily long name '
    .repeat(3)
    .slice(0, 190)
    .trim();
  try {
    for (const type of ['scene', 'npc', 'item']) {
      await writeFile(
        join(root, `${type}.md`),
        `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: ${type === 'npc' ? title : `Geometry ${type}`}\n  type: ${type}\n  purpose: session\n  status: current\n  summary: ${'Every detail remains readable. '.repeat(30)}\n  backText: ${'Historical secret. '.repeat(700)}\n  tags: [${Array.from({ length: 30 }, (_, i) => `detail-${i}`).join(', ')}]\n---\n# Full ${type}\nComplete geometry fixture document.`,
      );
    }
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Geometry fixtures', directory: root } })
    ).json();
    const capture = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Geometry session', objective: '' },
      })
    ).json();
    const items = [];
    for (const type of ['scene', 'npc', 'item']) {
      items.push(
        await historicalSourceItem(request, campaign.id, {
          capture: capture.capture,
          path: `${type}.md`,
          section: null,
        }),
      );
    }
    session = await importHistoricalSession(request, campaign.id, session, items);
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare&mode=play`);
    const cards = page.locator('play-tabletop .shelf playing-card article');
    await expect(cards).toHaveCount(3);
    for (const width of [1440, 1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const card of await cards.all()) {
        const box = (await card.boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(243 / 420, 2);
        expect(box.width).toBeLessThanOrEqual(320);
        if (width >= 1280) expect(box.width).toBe(320);
        await expect(card.getByRole('button', { name: 'Read all front text' })).toBeVisible();
        expect(
          await card.evaluate((el) =>
            [...el.querySelectorAll('*')].some(
              (child) =>
                ['auto', 'scroll'].includes(getComputedStyle(child).overflowY) &&
                child.scrollHeight > child.clientHeight,
            ),
          ),
        ).toBe(false);
        const action = card.getByRole('button', { name: 'Open full document' });
        // Keyboard scrolling can still be animating; compare both rectangles in one frame.
        expect(
          await action.evaluate((button) => {
            const card = button.closest('article')!.getBoundingClientRect();
            return button.getBoundingClientRect().bottom <= card.bottom;
          }),
        ).toBe(true);
        await expect(card.locator('img')).toHaveAttribute('src', '/card-placeholder.svg');
      }
      await cards.nth(1).getByRole('button', { name: 'Read all front text' }).click();
      const reader = page.getByRole('dialog', { name: 'Complete card side text' });
      await expect(reader.getByRole('heading')).toHaveText(title);
      await expect(reader.getByRole('listitem')).toHaveCount(30);
      await reader.getByRole('button', { name: 'Close card text' }).click();
      await cards.nth(1).getByRole('button', { name: 'Flip to back' }).click();
      await cards.nth(1).getByRole('button', { name: 'Read all back text' }).click();
      await expect(reader).toContainText('Historical secret. '.repeat(700).trim());
      await reader.getByRole('button', { name: 'Close card text' }).click();
      await cards.nth(1).getByRole('button', { name: 'Flip to front' }).click();
      await expect(cards.nth(1)).toHaveAttribute('data-side', 'front');

      await page.screenshot({ path: info.outputPath(`dense-play-${width}.png`), fullPage: true });
    }
    await cards.nth(2).getByRole('button', { name: 'Open full document' }).press('Enter');
    await expect(page.locator('.source-page')).toContainText('Complete geometry fixture document.');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Prepared presentation' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    const preview = page.locator('.source-page playing-card article');
    await expect(preview).toBeVisible();
    const bounds = (await preview.boundingBox())!;
    expect(bounds.width / bounds.height).toBeCloseTo(243 / 420, 2);
    await preview.getByRole('button', { name: 'Open full document' }).press('Enter');
    await expect(page.locator('.source-page')).toContainText('Complete geometry fixture document.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
