import { test, expect, Locator, Page, TestInfo } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}

async function keyboardFocus(page: Page, target: Locator, surface: Locator) {
  await page.keyboard.press('Tab');
  await target.focus();
  await expect(target).toBeFocused();
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  const focus = await target.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.outlineColor, style: s.outlineStyle, width: s.outlineWidth };
  });
  expect(focus.style).toBe('solid');
  expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
  expect(
    contrast(focus.color, await surface.evaluate((el) => getComputedStyle(el).backgroundColor)),
  ).toBeGreaterThanOrEqual(3);
}

async function screenshots(page: Page, info: TestInfo, name: string) {
  for (const [width, height] of [
    [1280, 800],
    [1440, 900],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true });
  }
}

test('cross-workspace action hierarchy, feedback and light-panel keyboard contrast', async ({
  page,
  request,
}, info) => {
  test.setTimeout(90_000);
  const root = await mkdtemp(join(tmpdir(), 'ux-c5-'));
  try {
    await writeFile(
      join(root, 'captain.md'),
      `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: Harbour captain\n  type: npc\n  purpose: session\n  status: current\n  summary: Keeps watch over the harbour.\n  tags: [harbour]\n---\n# Harbour captain\nA patient keeper of tide charts.\n`,
    );
    await writeFile(join(root, 'unfinished.md'), '# Unfinished reference\nUnclassified research.');
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Visual review', directory: root } })
    ).json();
    const base = `/api/campaigns/${campaign.id}`;
    await request.post(`${base}/sources/refresh`);
    const session = await (
      await request.post(`${base}/sessions`, { data: { title: 'Harbour watch', objective: '' } })
    ).json();
    await page.goto(`/library?campaign=${campaign.id}&session=${session.id}`);
    const reader = page.getByRole('article', { name: 'Selected Library document' });
    const shelf = page.getByRole('region', { name: 'Library catalogue', exact: true });
    await shelf.getByRole('button', { name: /unfinished.md/ }).click();
    await expect(
      reader.getByRole('button', { name: 'Add to session', exact: true }),
    ).toBeDisabled();
    await expect(reader).toContainText('Preparation blocked.');
    await shelf.getByRole('button', { name: /^Harbour captain npc/ }).click();
    const add = reader.getByRole('button', { name: 'Add to session', exact: true });
    await expect(add).toBeEnabled();
    const action = await add.evaluate((el) => ({
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    }));
    expect(contrast(action.color, action.background)).toBeGreaterThanOrEqual(4.5);
    await screenshots(page, info, 'library');
    await page.route(`**${base}/sources/refresh`, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        body: JSON.stringify({ detail: 'Visual review refresh failure' }),
      }),
    );
    await page.getByRole('button', { name: 'Refresh sources', exact: true }).click();
    const alert = page.locator('.feedback[role=alert]');
    await expect(alert).toBeVisible();
    const errorStyle = await alert.evaluate((el) => ({
      color: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
      border: getComputedStyle(el).borderInlineStartWidth,
    }));
    expect(contrast(errorStyle.color, errorStyle.background)).toBeGreaterThanOrEqual(4.5);
    expect(parseFloat(errorStyle.border)).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: info.outputPath('library-error-390.png'), fullPage: true });
    await page.unroute(`**${base}/sources/refresh`);
    await add.click();
    const notice = page.locator('.feedback[role=status]');
    await expect(notice).toHaveText('Added to session.');
    expect(await notice.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      errorStyle.background,
    );
    await page.screenshot({ path: info.outputPath('library-success-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    await reader.getByRole('button', { name: 'Edit in Write', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Harbour captain');
    const editor = page.locator('.draft-editor');
    const cardTab = page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true });
    expect(
      contrast(
        await cardTab.evaluate((el) => getComputedStyle(el).color),
        await editor.evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    ).toBeGreaterThanOrEqual(4.5);
    await keyboardFocus(page, page.getByLabel('Title', { exact: true }), editor);
    await screenshots(page, info, 'write');
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Prepare', exact: true })
      .click();
    const prepared = page.getByRole('article', { name: 'Prepared source', exact: true });
    await expect(prepared).toContainText('A patient keeper of tide charts.');
    await keyboardFocus(page, prepared, prepared);
    const notes = page.locator('.notes-page');
    await keyboardFocus(page, page.getByLabel('Item Markdown notes', { exact: true }), notes);
    await screenshots(page, info, 'prepare');
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await expect(page.locator('.reading-desk')).toBeVisible();
    // The scoped Prepare override must not alter Play's existing gold focus.
    expect(
      await page
        .locator('.notes-page')
        .evaluate((el) => getComputedStyle(el).getPropertyValue('--workbench-focus').trim()),
    ).toBe('');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
