import { test, expect, Locator, Page } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const card = (title: string, purpose = 'session', status = 'current', id = randomUUID()) =>
  `---\nworkbench:\n  schema: 1\n  id: ${id}\n  title: ${title}\n  type: npc\n  purpose: ${purpose}\n  status: ${status}\n  tags: []\n---\n# ${title}\nDeep discovery needle.\n`;

async function compact(page: Page, scope: Locator) {
  await expect(scope.getByRole('button', { name: 'Search all', exact: true })).toHaveCount(0);
  await expect(scope.getByText('Filters', { exact: true })).toHaveCount(0);
  await expect(scope.getByRole('button', { name: 'Include drafts', exact: true })).toHaveCount(0);
  await expect(scope.getByLabel('Library type', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const input = await scope.locator('input[type=search]').boundingBox();
  const type = await scope.getByLabel('Library type', { exact: true }).boundingBox();
  if (page.viewportSize()!.width >= 1280) {
    expect(Math.abs(input!.y - type!.y)).toBeLessThan(2);
    expect(Math.abs(input!.height - type!.height)).toBeLessThan(2);
  }
}

test('inclusive search and type reset preserve safety across Library, Write and Prepare after Add', async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const root = await mkdtemp(join(tmpdir(), 'ux-c3-'));
  try {
    for (const [name, purpose, status] of [
      ['Source captain', 'session', 'current'],
      ['Old captain', 'session', 'superseded'],
      ['Guide', 'guidance', 'current'],
      ['Tool', 'tooling', 'current'],
    ])
      await writeFile(join(root, `${name}.md`), card(name, purpose, status));
    await writeFile(join(root, 'legacy.md'), '# Legacy\nDeep discovery needle.');
    const collision = randomUUID();
    await writeFile(
      join(root, 'collision-a.md'),
      card('Collision A', 'session', 'current', collision),
    );
    await writeFile(
      join(root, 'collision-b.md'),
      card('Collision B', 'session', 'current', collision),
    );
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'UX-C3', directory: root } })
    ).json();
    const base = `/api/campaigns/${campaign.id}`;
    await request.post(`${base}/sources/refresh`);
    const created = await (
      await request.post(`${base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    const saved = await request.put(`${base}/drafts/${created.id}`, {
      data: {
        revision: created.revision,
        fields: {
          ...created.fields,
          title: 'Saved draft',
          path: 'saved.md',
          body: '# Saved\nDraft-only discovery needle.',
        },
      },
    });
    expect(saved.ok()).toBe(true);
    const session = await (
      await request.post(`${base}/sessions`, {
        data: { title: 'Discovery session', objective: '' },
      })
    ).json();
    await page.goto(`/library?campaign=${campaign.id}&session=${session.id}`);
    const shelf = page.getByRole('region', { name: 'Library catalogue', exact: true });
    const reader = page.getByRole('article', { name: 'Selected Library document' });
    await expect(shelf.locator('.catalogue-row')).toHaveCount(7);
    for (const text of [
      'Saved draft',
      'Old captain',
      'Guide',
      'Tool',
      'legacy.md',
      'Identity conflict',
    ])
      await expect(shelf).toContainText(text);
    await expect(shelf).toContainText('superseded');
    await expect(shelf).toContainText('Not preparable');
    const search = page.getByLabel('Search Library', { exact: true });
    await search.fill('discovery needle');
    await search.press('Enter');
    await expect(shelf.locator('.catalogue-row')).toHaveCount(7);
    await page.getByLabel('Library type', { exact: true }).selectOption('npc');
    await expect(shelf.locator('.catalogue-row')).toHaveCount(5);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByLabel('Library type', { exact: true })).toHaveValue('npc');
    await search.fill('legacy');
    await search.press('Enter');
    await expect(shelf.locator('.catalogue-row')).toHaveCount(0);
    await page.getByLabel('Library type', { exact: true }).selectOption('');
    await expect(search).toHaveValue('legacy');
    await expect(shelf.locator('.catalogue-row')).toHaveCount(1);
    await shelf.getByRole('button', { name: /legacy.md/ }).click();
    await expect(
      reader.getByRole('button', { name: 'Add to session', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await shelf.getByRole('button', { name: /collision-a.md/ }).click();
    await expect(
      reader.getByRole('button', { name: 'Add to session', exact: true }),
    ).toBeDisabled();
    await shelf.getByRole('button', { name: /^Source captain npc/ }).click();
    await reader.getByRole('button', { name: 'Add to session', exact: true }).click();
    await expect(reader.getByText('Already in session', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Reload catalogue', exact: true }).click();
    await expect(shelf.locator('.catalogue-row')).toHaveCount(7);
    await expect(shelf.locator('.catalogue-row').filter({ hasText: 'Source captain' })).toHaveCount(
      1,
    );
    await expect(
      shelf.locator('.catalogue-row').filter({ hasText: 'Source captain' }),
    ).toContainText('draft');
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 900 : width === 390 ? 844 : 800,
      });
      await compact(page, page.locator('unified-library'));
      await page.screenshot({ path: info.outputPath(`library-${width}.png`), fullPage: true });
    }
    await page.goto(`/writing?campaign=${campaign.id}&draft=${created.id}&session=${session.id}`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Saved draft');
    await page
      .getByRole('navigation', { name: 'Supporting panel modes' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    const refs = page.getByRole('region', { name: 'Library references', exact: true });
    await expect(refs.locator('.reference-row')).toHaveCount(7);
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 900 : width === 390 ? 844 : 800,
      });
      await compact(page, refs);
      await page.screenshot({ path: info.outputPath(`write-${width}.png`), fullPage: true });
    }
    await refs.getByLabel('Search Library references', { exact: true }).fill('Draft-only');
    await refs.getByLabel('Search Library references', { exact: true }).press('Enter');
    await expect(refs.locator('.reference-row')).toHaveCount(1);
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Session Library', exact: true });
    await expect(picker.getByLabel('Search Library references', { exact: true })).toHaveValue('');
    await expect(picker.locator('.reference-row')).toHaveCount(7);
    await picker.getByRole('button', { name: 'Source captain · npc', exact: true }).click();
    await expect(
      picker.getByRole('button', { name: 'View prepared card', exact: true }),
    ).toBeVisible();
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({
        width,
        height: width === 1440 ? 900 : width === 390 ? 844 : 800,
      });
      await compact(page, picker);
      await page.screenshot({ path: info.outputPath(`prepare-${width}.png`), fullPage: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
