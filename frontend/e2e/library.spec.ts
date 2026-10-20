import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('register, browse, search, refresh, configure and reopen isolated campaigns', async ({
  page,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-browser-'));
  const first = join(root, 'first'),
    second = join(root, 'second');
  const name = 'Library ' + root.split('/').pop();
  const original =
    '# Repeat\nFirst needle\n\n# Repeat\nSecond needle\n\n[next](nested/next%20page.md#destination)\n\n[missing](absent.md)\n\n| A | B |\n| - | - |\n| x | y |\n\n![remote](https://example.invalid/image.png)\n\n<script>window.campaignInjected = true</script>';
  await mkdir(join(first, 'nested'), { recursive: true });
  await mkdir(join(second, 'different'), { recursive: true });
  await writeFile(join(first, 'source.md'), original);
  await writeFile(join(first, 'nested/next page.md'), '# Destination\nLinked target');
  await writeFile(join(first, 'AGENTS.md'), '# Instructions');
  await symlink(join(first, 'source.md'), join(first, 'alias.md'));
  await writeFile(join(second, 'different/else.md'), '# Else\nOther campaign');
  const remote: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('example.invalid')) remote.push(request.url());
  });
  const manageCampaign = async () => {
    await page.getByRole('button', { name: 'More session actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Manage campaign', exact: true }).click();
  };
  try {
    await page.goto('/');
    if (!(await page.getByText('Register a campaign', { exact: true }).isVisible()))
      await manageCampaign();
    if (!(await page.getByLabel('Display name').isVisible()))
      await page.getByText('Register a campaign', { exact: true }).click();
    await page.getByLabel('Display name').fill(name);
    await page.getByLabel('Folder path').fill(first);
    await page.getByRole('button', { name: 'Register campaign', exact: true }).click();
    await expect(page.getByLabel('Campaign', { exact: true }).locator('option:checked')).toHaveText(
      name,
    );
    await expect(page.getByLabel('Campaign', { exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await expect(page.getByRole('button', { name: 'source.md', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close campaign management', exact: true }).click();
    await expect(page.getByRole('button', { name: 'AGENTS.md', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'alias.md', exact: true })).toHaveCount(0);
    await page.getByLabel('Search sources').fill('NEEDLE');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const hits = page.locator('.results button');
    await expect(hits).toHaveCount(2);
    await hits.nth(1).click();
    await expect(page.locator('#source-reader div:focus')).toContainText('Second needle');
    await expect(page.locator('#source-reader')).toContainText('Second needle');
    await expect(page.locator('#source-reader table')).toBeVisible();
    await expect(page.locator('#source-reader img')).toHaveCount(0);
    expect(await page.evaluate(() => 'campaignInjected' in window)).toBe(false);
    expect(remote).toEqual([]);
    await page.getByRole('link', { name: 'next', exact: true }).click();
    await expect(page.locator('#source-reader')).toContainText('Linked target');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('button', { name: 'source.md', exact: true }).click();
    await page.getByRole('link', { name: 'missing', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('missing');
    expect(await readFile(join(first, 'source.md'), 'utf8')).toBe(original);
    await writeFile(join(first, 'source.md'), '# Updated\nNew passage');
    await page.getByRole('button', { name: 'source.md', exact: true }).click();
    await expect(page.locator('#source-reader')).toContainText('First needle');
    await manageCampaign();
    await page.getByRole('button', { name: 'Refresh library', exact: true }).click();
    await expect(
      page.getByRole('status', { name: 'Source library status', exact: true }),
    ).toContainText('Library refreshed');
    await page.getByRole('button', { name: 'Close campaign management', exact: true }).click();
    await page.getByRole('button', { name: 'source.md', exact: true }).click();
    await expect(page.locator('#source-reader')).toContainText('New passage');
    await manageCampaign();
    await page.getByRole('button', { name: 'Source rules', exact: true }).click();
    await page.getByLabel('Exclude patterns').fill('**/AGENTS.md\nsource.md');
    await page.getByRole('button', { name: 'Save source rules' }).click();
    await expect(
      page.getByRole('status', { name: 'Source library status', exact: true }),
    ).toContainText('need refresh');
    await page.getByRole('button', { name: 'Refresh library', exact: true }).click();
    await expect(page.getByRole('button', { name: 'source.md', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close rules' }).click();
    if (!(await page.getByLabel('Display name').isVisible()))
      await page.getByText('Register a campaign', { exact: true }).click();
    await page.getByLabel('Display name').fill(name + ' Other');
    await page.getByLabel('Folder path').fill(second);
    await page.getByRole('button', { name: 'Register campaign', exact: true }).click();
    await expect(page.getByLabel('Campaign', { exact: true }).locator('option:checked')).toHaveText(
      name + ' Other',
    );
    await expect(page.getByLabel('Campaign', { exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'different/else.md', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'nested/next page.md', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Close campaign management', exact: true }).click();
    // Captured documents can appear before the saved campaign has finished opening.
    const selector = page.getByLabel('Campaign', { exact: true });
    const otherId = await selector.inputValue();
    let finishOpening!: () => void;
    const openingGate = new Promise<void>((resolve) => {
      finishOpening = resolve;
    });
    const openingUrl = `**/api/campaigns/${otherId}/sources/refresh`;
    await page.route(openingUrl, async (route) => {
      await openingGate;
      await route.continue();
    });
    const openingStarted = page.waitForRequest((request) =>
      request.url().endsWith(`/api/campaigns/${otherId}/sources/refresh`),
    );
    await page.reload();
    await openingStarted;
    await expect(selector.locator('option:checked')).toHaveText(name + ' Other');
    await expect(selector).toBeDisabled();
    await expect(page.getByRole('button', { name: 'different/else.md', exact: true })).toBeHidden();
    finishOpening();
    await expect(selector).toBeEnabled();
    await page.unroute(openingUrl);
    await selector.selectOption({ label: name });
    await expect(selector).toBeEnabled();
    await page.getByRole('button', { name: 'Search all', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'nested/next page.md', exact: true }),
    ).toBeVisible();
    expect(await readFile(join(first, 'source.md'), 'utf8')).toBe('# Updated\nNew passage');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
