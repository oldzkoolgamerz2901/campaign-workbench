import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('prepares frozen material, autosaves both note levels, reads and imports portable sessions', async ({
  page,
  request,
}, testInfo) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-preparation-browser-'));
  const other = await mkdtemp(join(tmpdir(), 'workbench-preparation-import-'));
  const original =
    "---\nworkbench:\n  schema: 1\n  id: '87b085da-326b-4cc4-933e-c908648ee712'\n  title: observatory.md\n  type: location\n  purpose: session\n  status: current\n  tags: [observatory]\n  summary: A telescope and its hidden chamber.\n---\n" +
    '# Observatory\nOriginal telescope clue.\n\n![remote](https://example.invalid/image.png)\n\n<script>window.preparedInjected = true</script>\n\n[To chamber](#lower-chamber)\n\n## Lower chamber\nNested brass key. [Back to observatory](observatory.md#observatory)\n\n### Inscription\nAncient words.\n\n# Road home\nReturn safely.' +
    Array.from(
      { length: 100 },
      (_, index) =>
        `\n\nBackground passage ${index}: ${'A long captured document remains readable. '.repeat(8)}`,
    ).join('') +
    '\n\n```text\n' +
    'long-line-'.repeat(150) +
    '\n```';
  const remote: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('example.invalid')) remote.push(req.url());
  });
  const path = join(root, 'observatory.md');
  await writeFile(path, original);
  try {
    const first = await (
      await request.post('/api/campaigns', {
        data: { name: 'Observatory campaign', directory: root },
      })
    ).json();
    const second = await (
      await request.post('/api/campaigns', {
        data: { name: 'Import destination', directory: other },
      })
    ).json();
    await page.goto(`/?campaign=${first.id}&view=library`);
    await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveValue(
      first.id,
    );
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByLabel('New session title', { exact: true }).fill('Night at the observatory');
    await page
      .getByLabel('New session objective', { exact: true })
      .fill('Discover the hidden chamber');
    await page.getByRole('button', { name: 'Create session', exact: true }).click();
    await expect(page.getByLabel('Session title', { exact: true })).toHaveValue(
      'Night at the observatory',
    );
    await page.getByLabel('Session Markdown notes').fill('Opening **reminder** for the table.');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    const session = new URL(page.url()).searchParams.get('session')!;
    await page.getByRole('button', { name: 'Add source material', exact: true }).click();
    await page.getByRole('button', { name: 'observatory.md', exact: true }).click();
    await page.getByRole('button', { name: 'Add document to session', exact: true }).click();
    await expect(page.getByLabel('Item Markdown notes')).toBeVisible();
    await expect(page.locator('.source-page')).not.toContainText('workbench:');
    await page.getByLabel('Item Markdown notes').fill('Ask about the **brass key**.');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Add source material', exact: true }).click();
    await page.getByRole('button', { name: 'Add section: Lower chamber', exact: true }).click();
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'Lower chamber', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('Ancient words.');
    await expect(page.locator('.source-page')).not.toContainText('Return safely.');
    const reorderedSave = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' && response.url().endsWith(`/sessions/${session}`),
    );
    const moveUp = page.getByRole('button', { name: 'Move up: Lower chamber', exact: true });
    await moveUp.focus();
    await moveUp.press('Enter');
    expect((await reorderedSave).ok()).toBe(true);
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    const persistedOrder = await (
      await request.get(`/api/campaigns/${first.id}/sessions/${session}`)
    ).json();
    expect(persistedOrder.items.map((i: { title: string }) => i.title)).toEqual([
      'Lower chamber',
      'observatory.md',
    ]);
    await page.getByRole('button', { name: 'Read session', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Return to Prepare', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Session outline').locator('ol li').first()).toContainText(
      'Lower chamber',
    );
    await expect(page.getByLabel('Item Markdown notes')).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('folio-1280.png') });
    await page
      .locator('.source-page')
      .getByRole('link', { name: 'Back to observatory', exact: true })
      .click();
    await expect(page.locator('.source-page prepared-markdown h1:focus')).toHaveText('Observatory');
    await page
      .locator('.source-page')
      .getByRole('link', { name: 'To chamber', exact: true })
      .click();
    await expect(page.locator('.source-page prepared-markdown h2:focus')).toHaveText(
      'Lower chamber',
    );
    expect(remote).toEqual([]);
    await expect(page.locator('.source-page img')).toHaveCount(0);
    expect(await page.evaluate(() => 'preparedInjected' in window)).toBe(false);
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'observatory.md', exact: true })
      .click();
    await expect(page.locator('.notes-page strong')).toHaveText('brass key');
    await page.getByRole('button', { name: 'Session notes', exact: true }).click();
    await expect(page.locator('.session-notes strong')).toHaveText('reminder');
    await writeFile(path, '# Changed\nNew telescope text.');
    await request.post(`/api/campaigns/${first.id}/sources/refresh`);
    await rm(path);
    await request.post(`/api/campaigns/${first.id}/sources/refresh`);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Return to Prepare', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'observatory.md', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('Original telescope clue.');
    await expect(page.locator('.notes-page')).toContainText('brass key');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export session', exact: true }).click();
    const download = await downloadPromise;
    const downloaded = await download.path();
    const archive = JSON.parse(await readFile(downloaded!, 'utf8'));
    expect(archive.version).toBe(2);
    expect(archive.sessions).toHaveLength(1);
    expect(archive.sessions[0].items[0].title).toBe('Lower chamber');
    expect(archive.sessions[0].items[0].capturedSource.classification.metadata).toMatchObject({
      type: 'location',
      tags: ['observatory'],
      summary: 'A telescope and its hidden chamber.',
    });
    expect(archive.sessions[0].items[0].capturedSource.bodyStart).toBe(0);
    expect(archive.sessions[0].items[1].capturedSource.bodyStart).toBeGreaterThan(0);
    // Keep campaign initialization pending to exercise the import-readiness race deterministically.
    let finishRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      finishRefresh = resolve;
    });
    const refreshUrl = `**/api/campaigns/${second.id}/sources/refresh`;
    await page.route(refreshUrl, async (route) => {
      await refreshGate;
      await route.continue();
    });
    const refreshStarted = page.waitForRequest((request) =>
      request.url().endsWith(`/api/campaigns/${second.id}/sources/refresh`),
    );
    await page.goto(`/?campaign=${second.id}&view=library`);
    await refreshStarted;
    await expect(page.getByRole('combobox', { name: 'Campaign', exact: true })).toHaveValue(
      second.id,
    );
    const importInput = page.getByLabel('Import sessions into Import destination');
    await expect(importInput).toBeDisabled();
    finishRefresh();
    await expect(importInput).toBeEnabled();
    await page.unroute(refreshUrl);
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await importInput.setInputFiles(downloaded!);
    await expect(
      page.getByText('Imported 1 new session(s). Existing sessions are preserved.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Night at the observatory', exact: true }).click();
    expect(new URL(page.url()).searchParams.get('session')).not.toBe(session);
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'observatory.md', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('Original telescope clue.');
    await expect(page.locator('.notes-page')).toContainText('brass key');
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('preparation-1440.png') });
    // A malformed upload never creates a partial session.
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByLabel('Import sessions into Import destination').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":99,"sessions":[]}'),
    });
    await expect(page.getByRole('alert')).toContainText('Invalid or unsupported');
    const sessions = await (await request.get(`/api/campaigns/${second.id}/sessions`)).json();
    expect(sessions.sessions).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

test('failed saves retain edits across modes and guard session navigation', async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-preparation-failure-'));
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Failure checks', directory: root } })
    ).json();
    const a = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Session A', objective: '' },
      })
    ).json();
    const b = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Session B', objective: '' },
      })
    ).json();
    await page.goto(`/?campaign=${campaign.id}&session=${a.id}&view=prepare`);
    await page.route(`**/api/campaigns/${campaign.id}/sessions/${a.id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Save unavailable' }),
          })
        : route.continue(),
    );
    await page.getByLabel('Session Markdown notes').fill('Keep these local notes');
    await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
    await page.getByRole('button', { name: 'Read session', exact: true }).click();
    await expect(page.locator('.session-notes')).toContainText('Keep these local notes');
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Session B', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Session A', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Return to Prepare', exact: true }).click();
    await expect(page.getByLabel('Session Markdown notes')).toHaveValue('Keep these local notes');
    await page.unroute(`**/api/campaigns/${campaign.id}/sessions/${a.id}`);
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Sessions / New session', exact: true }).click();
    await page.getByRole('button', { name: 'Session B', exact: true }).click();
    await expect(page.getByLabel('Session title', { exact: true })).toHaveValue(b.title);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
