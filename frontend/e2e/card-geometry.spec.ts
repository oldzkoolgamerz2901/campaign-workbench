import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('portrait geometry retains dense content and keyboard reading in narrow containers', async ({
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
        `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: ${type === 'npc' ? title : `Geometry ${type}`}\n  type: ${type}\n  purpose: session\n  status: current\n  summary: ${'Every detail remains readable. '.repeat(30)}\n  tags: [${Array.from({ length: 30 }, (_, i) => `detail-${i}`).join(', ')}]\n---\n# Full ${type}\nComplete geometry fixture document.`,
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
    const endpoint = `/api/campaigns/${campaign.id}/sessions/${session.id}`;
    for (const type of ['scene', 'npc', 'item']) {
      session = await (
        await request.post(`${endpoint}/sources`, {
          data: {
            revision: session.revision,
            capture: capture.capture,
            path: `${type}.md`,
            section: null,
          },
        })
      ).json();
    }
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare&mode=play`);
    const cards = page.locator('read-card-table .shelf playing-card article');
    await expect(cards).toHaveCount(3);
    for (const width of [1440, 1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const card of await cards.all()) {
        const box = (await card.boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(243 / 420, 2);
        expect(box.width).toBeLessThanOrEqual(320);
        if (width >= 1280) expect(box.width).toBe(320);
        const summary = card.getByLabel('Card summary and tags', { exact: true });
        await summary.focus();
        await expect(summary).toBeFocused();
        expect(await summary.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
        await summary.press('End');
        await expect.poll(() => summary.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        const action = card.getByRole('button', { name: 'Open full document' });
        const buttonBox = (await action.boundingBox())!;
        const currentBox = (await card.boundingBox())!;
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(
          currentBox.y + currentBox.height,
        );
        await expect(card.locator('img')).toHaveAttribute('src', '/card-placeholder.svg');
      }
      const heading = cards.nth(1).getByRole('heading', { level: 3 });
      await heading.focus();
      await heading.press('End');
      await expect.poll(() => heading.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(heading).toHaveText(title);
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
