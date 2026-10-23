import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Write support modes use available height and retain independent editor context', async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const root = await mkdtemp(join(tmpdir(), 'ux-c4-'));
  try {
    for (let i = 0; i < 35; i++)
      await writeFile(join(root, `reference-${i}.md`), `# Reference ${i}\nResearch material.`);
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'UX-C4', directory: root } })
    ).json();
    const base = `/api/campaigns/${campaign.id}`;
    await request.post(`${base}/sources/refresh`);
    const draft = await (
      await request.post(`${base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    expect(
      (
        await request.put(`${base}/drafts/${draft.id}`, {
          data: {
            revision: draft.revision,
            fields: {
              ...draft.fields,
              title: 'Panel context',
              body: '# Writing context\n' + 'Long writing passage.\n'.repeat(200),
            },
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Panel context');
    const modes = page.getByRole('navigation', { name: 'Supporting panel modes' });
    const library = modes.getByRole('button', { name: 'Library', exact: true });
    const preview = modes.getByRole('button', { name: 'Preview', exact: true });
    await page.getByRole('button', { name: 'Full document', exact: true }).click();
    await expect(page.locator('select[aria-label="Supporting panel"]')).toHaveCount(0);
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await library.focus();
      await page.keyboard.press('Enter');
      await expect(library).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.reference-row')).toHaveCount(36);
      const content = page.locator('.support-content');
      await expect(content).toBeVisible();
      expect(await content.evaluate((el) => el.clientHeight)).toBeGreaterThan(300);
      expect(
        await page.locator('.reference-list').evaluate((el) => getComputedStyle(el).maxHeight),
      ).toBe('none');
      const editorScroll = await page.locator('.draft-editor').evaluate((el) => el.scrollTop);
      await content.focus();
      await page.keyboard.press('PageDown');
      await expect.poll(() => content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await content.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await page.locator('.draft-editor').evaluate((el) => el.scrollTop)).toBe(editorScroll);
      await page.getByRole('button', { name: 'Hide supporting panel', exact: true }).click();
      await expect(modes).toBeHidden();
      await page.getByRole('button', { name: 'Show supporting panel', exact: true }).click();
      await expect(library).toHaveAttribute('aria-pressed', 'true');
      await preview.click();
      await expect(
        page.getByRole('button', { name: 'Full document', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByLabel('Markdown body', { exact: true })).toHaveValue(
        /Long writing passage/,
      );
      await library.click();
      await content.evaluate((el) => {
        el.scrollTop = 0;
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`write-support-${width}.png`),
        fullPage: true,
      });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
