import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('assembles and navigates 50 saved items without losing library position or working notes', async ({
  page,
  request,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-large-session-'));
  const original =
    '# Material\nA shared reference.\n' +
    Array.from(
      { length: 50 },
      (_, i) =>
        `\n## Entry ${i + 1}\nClue ${i + 1}.\n### Detail ${i + 1}\nNested evidence ${i + 1}.\n`,
    ).join('');
  await writeFile(join(root, 'material.md'), original);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const campaign = await (
      await request.post('/api/campaigns', {
        data: { name: 'Large session campaign', directory: root },
      })
    ).json();
    const library = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    const doc = await (
      await request.get(`/api/campaigns/${campaign.id}/sources/document`, {
        params: { capture: library.capture, path: 'material.md' },
      })
    ).json();
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Fifty clues', objective: 'Follow the evidence.' },
      })
    ).json();
    for (const section of doc.sections
      .filter((s: { heading: string }) => /^Entry \d+$/.test(s.heading))
      .slice(0, 48)) {
      const response = await request.post(
        `/api/campaigns/${campaign.id}/sessions/${session.id}/sources`,
        {
          data: {
            revision: session.revision,
            capture: library.capture,
            path: 'material.md',
            section: section.id,
          },
        },
      );
      expect(response.ok()).toBe(true);
      session = await response.json();
    }
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=library`);
    const outline = page.getByLabel('Session outline'),
      rows = outline.locator('ol li');
    await expect(rows).toHaveCount(48);
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await page.getByRole('button', { name: 'material.md', exact: true }).click();
    const reader = page.getByRole('article', { name: 'Source reader', exact: true });
    const before = await reader.evaluate((el) => el.scrollTop);
    await reader.getByRole('button', { name: 'Add document to session', exact: true }).click();
    await expect(rows).toHaveCount(49);
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await expect(reader).toBeVisible();
    expect(new URL(page.url()).searchParams.get('view')).toBe('library');
    expect(Math.abs((await reader.evaluate((el) => el.scrollTop)) - before)).toBeLessThan(2);
    const addLast = reader.getByRole('button', { name: 'Add section: Entry 50', exact: true });
    await addLast.scrollIntoViewIfNeeded();
    const sectionPosition = await reader.evaluate((el) => el.scrollTop);
    await addLast.click();
    await expect(rows).toHaveCount(50);
    await expect(reader).toBeVisible();
    expect(Math.abs((await reader.evaluate((el) => el.scrollTop)) - sectionPosition)).toBeLessThan(
      2,
    );
    const find = outline.getByRole('searchbox', { name: 'Find in session', exact: true });
    await find.fill('Entry 50');
    await expect(rows).toHaveCount(1);
    await expect(rows).toHaveAttribute('value', '50');
    await outline.getByRole('button', { name: 'Entry 50', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Prepared source', exact: true })).toContainText(
      'Nested evidence 50.',
    );
    await page.getByLabel('Item Markdown notes').fill('The **fiftieth** clue.');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await expect(page.locator('.notes-page strong')).toHaveText('fiftieth');
    await outline.getByRole('button', { name: 'Move up: Entry 50', exact: true }).press('Enter');
    await expect(rows).toHaveAttribute('value', '49');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await find.fill('');
    await expect(rows).toHaveCount(50);
    await expect(outline.locator('[aria-current=page]')).toBeInViewport();
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('button', { name: 'Read session', exact: true }).click();
      await expect(page.getByRole('article', { name: 'Source reader', exact: true })).toBeHidden();
      await expect(outline.locator('[aria-current=page]')).toBeInViewport();
      await expect(page.locator('.notes-page strong')).toHaveText('fiftieth');
      expect(
        await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
        })),
      ).toEqual({ width, scroll: width });
      await page.screenshot({ path: testInfo.outputPath(`fifty-items-${width}.png`) });
      await page.getByRole('button', { name: 'Hide session contents', exact: true }).click();
      await page.getByRole('button', { name: 'Hide notes', exact: true }).click();
      await expect(outline).toBeHidden();
      await expect(page.locator('.notes-page')).toBeHidden();
      await page.getByRole('button', { name: 'Show session contents', exact: true }).click();
      await page.getByRole('button', { name: 'Show notes', exact: true }).click();
      await page.getByRole('button', { name: 'Return to Prepare', exact: true }).click();
      await expect(page.getByLabel('Item Markdown notes')).toHaveValue('The **fiftieth** clue.');
    }
    await find.fill('not a prepared title');
    await expect(rows).toHaveCount(1);
    await expect(outline).toContainText('No matching prepared material.');
    await expect(page.locator('.source-page')).toContainText('Entry 50');
    await outline.getByRole('button', { name: 'Show all session items', exact: true }).click();
    await outline.getByRole('button', { name: 'Remove: Entry 50', exact: true }).click();
    await expect(rows).toHaveCount(49);
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    const persisted = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(persisted.items).toHaveLength(49);
    expect(persisted.items.some((item: { title: string }) => item.title === 'Entry 50')).toBe(
      false,
    );
    await page.reload();
    await expect(rows).toHaveCount(49);
    expect(errors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
