import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('writes grouped durable drafts with card and safe full-document previews', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'writing-browser-'));
  const other = await mkdtemp(join(tmpdir(), 'writing-other-'));
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Writing browser', directory: root } })
    ).json();
    const second = await (
      await request.post('/api/campaigns', { data: { name: 'Other writing', directory: other } })
    ).json();
    await page.goto(`/?campaign=${campaign.id}`);
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page.locator('.new-draft > summary').click();
    await page.getByRole('button', { name: 'Create document', exact: true }).click();
    await expect(page.getByLabel('Markdown body')).toBeInViewport();
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    const firstSave = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/drafts/') &&
        response.ok(),
    );
    await page.getByLabel('Title', { exact: true }).fill('Captain Mira');
    await page.getByLabel('Tags (comma separated)').fill('Harbour, ally');
    await page.getByLabel('Card summary', { exact: true }).fill('A watchful harbour captain.');
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Document', exact: true })
      .click();
    await page
      .getByLabel('Markdown body')
      .fill(
        '# Captain Mira\n\n## Quick reference\nKeeps the harbour safe.\n\n## Motivation\nProtect the crew.\n\n[Motivation](#motivation) [Unavailable](other.md)\n\n<script>window.writingInjected=true</script>',
      );
    await firstSave;
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await expect(page.getByLabel('Playing card preview')).toContainText(
      'A watchful harbour captain.',
    );
    await expect(page.getByLabel('Writing groups')).toContainText('NPCs (1)');
    const confirmed = await (await request.get(`/api/campaigns/${campaign.id}/drafts`)).json();
    expect(
      confirmed.drafts.find(
        (d: { fields: { title: string } }) => d.fields.title === 'Captain Mira',
      ),
      JSON.stringify(confirmed),
    ).toBeTruthy();
    await page.getByRole('button', { name: 'Open full document' }).click();
    await expect(page.locator('draft-reader')).toContainText('Protect the crew.');
    expect(
      await page.evaluate(
        () => (window as unknown as { writingInjected?: boolean }).writingInjected,
      ),
    ).toBeUndefined();
    await page
      .locator('draft-reader')
      .getByRole('link', { name: 'Motivation', exact: true })
      .click();
    await page
      .locator('draft-reader')
      .getByRole('link', { name: 'Unavailable', exact: true })
      .click();
    await expect(page.locator('draft-reader')).toContainText('Target unavailable');
    const beforeReload = await (await request.get(`/api/campaigns/${campaign.id}/drafts`)).json();
    expect(
      beforeReload.drafts.some(
        (d: { fields: { title: string } }) => d.fields.title === 'Captain Mira',
      ),
      JSON.stringify(beforeReload),
    ).toBe(true);
    await page.reload();
    await page
      .getByLabel('Writing library')
      .getByRole('button', { name: /Captain Mira/ })
      .click();
    await expect(page.getByLabel('Markdown body')).toHaveValue(/Protect the crew/);
    await page.locator('.new-draft > summary').click();
    await page.getByLabel('New card type').selectOption('scene');
    await page.getByRole('button', { name: 'Create document', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await expect(page.getByLabel('Content type', { exact: true })).toHaveValue('scene');
    await page.getByLabel('Title', { exact: true }).fill('Arrival');
    const sceneSave = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().includes('/drafts/') &&
        response.ok(),
    );
    const longText =
      '# Arrival\n\n' + 'A long scene remains available in the full document. '.repeat(250);
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Document', exact: true })
      .click();
    await page.getByLabel('Markdown body').fill(longText);
    await sceneSave;
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Open full document' }).click();
    await expect(page.locator('draft-reader')).toContainText('A long scene remains available');
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await page.getByLabel('Content type', { exact: true }).selectOption('location');
    await expect(page.getByLabel('Markdown body')).toHaveValue(longText);
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Card preview', exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath('writing-card.png') });
    await page.getByLabel('Writing groups').selectOption('');
    await page.getByRole('searchbox', { name: 'Find drafts', exact: true }).fill('mira');
    await expect(page.locator('.draft-list li')).toHaveCount(1);
    await expect(page.locator('.draft-list')).toContainText('Captain Mira');
    await page.getByLabel('Writing groups').selectOption('location');
    await expect(page.locator('.draft-list')).toContainText('No drafts match');
    await page.getByLabel('Writing groups').selectOption('');
    await page.getByRole('searchbox', { name: 'Find drafts', exact: true }).fill('');
    await page.getByLabel('Campaign', { exact: true }).selectOption(second.id);
    await expect(page.getByLabel('Writing library')).not.toContainText('Captain Mira');
    await expect(page.getByLabel('Writing library')).toContainText('All (0)');
    await page.getByLabel('Campaign', { exact: true }).selectOption(campaign.id);
    await page.getByLabel('Writing groups').selectOption('npc');
    await page
      .getByLabel('Writing library')
      .getByRole('button', { name: /Captain Mira/ })
      .click();
    const list = await (await request.get(`/api/campaigns/${campaign.id}/drafts`)).json();
    const draft = list.drafts.find(
      (d: { fields: { title: string } }) => d.fields.title === 'Captain Mira',
    );
    await page.route(`**/api/campaigns/${campaign.id}/drafts/${draft.id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Save unavailable' }),
          })
        : route.continue(),
    );
    await page.getByLabel('Title', { exact: true }).fill('Keep my local edit');
    await expect(page.getByLabel('Draft save status')).toHaveText('Save failed');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Keep my local edit');
    await page.unroute(`**/api/campaigns/${campaign.id}/drafts/${draft.id}`);
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Sessions / New session', exact: true }),
    ).toBeVisible();
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});

test('protects session edits on entry and conflicting draft edits on return', async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'writing-guards-'));
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Writing guards', directory: root } })
    ).json();
    const session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Guarded session', objective: '' },
      })
    ).json();
    const draft = await (
      await request.post(`/api/campaigns/${campaign.id}/drafts`, {
        data: { type: 'npc', template: false },
      })
    ).json();
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    const sessionUrl = `**/api/campaigns/${campaign.id}/sessions/${session.id}`;
    await page.route(sessionUrl, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'Session save unavailable' }),
          })
        : route.continue(),
    );
    await page.getByLabel('Session Markdown notes').fill('Keep session work');
    await expect(page.getByLabel('Session save status')).toHaveText('Save failed');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.getByLabel('Session Markdown notes')).toHaveValue('Keep session work');
    await page.unroute(sessionUrl);
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page
      .getByLabel('Writing library')
      .getByRole('button', { name: /Untitled npc/ })
      .click();
    await expect(page.getByLabel('Title', { exact: true })).toBeEnabled();
    const outside = { ...draft.fields, title: 'Other browser edit' };
    expect(
      (
        await request.put(`/api/campaigns/${campaign.id}/drafts/${draft.id}`, {
          data: { revision: draft.revision, fields: outside },
        })
      ).ok(),
    ).toBe(true);
    await page.getByLabel('Title', { exact: true }).fill('My conflicting title');
    await expect(page.getByLabel('Draft save status')).toHaveText('Save failed');
    await expect(page.getByRole('alert')).toContainText('changed elsewhere');
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toHaveCount(0);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('My conflicting title');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Reload / discard local edits', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Other browser edit');
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(page.getByLabel('Session Markdown notes')).toHaveValue('Keep session work');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('exports retained source evidence without the retired source chooser', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'writing-export-browser-'));
  const body = '# Captain\r\nUnicode café 🌊\r\n[Harbour](harbour.md#dock)\r\n';
  const original =
    '---\ncustom: {rating: 7, text: "007"}\nworkbench:\n  schema: 1\n  id: 92bb19a9-0741-4d9c-9df9-b74b969a649f\n  title: Captain\n  type: npc\n  purpose: session\n  status: current\n  tags: [Harbour]\n  summary: A captain\n  extension: {enabled: true}\n---\n' +
    body;
  await writeFile(join(root, 'captain.md'), original);
  await writeFile(
    join(root, 'harbour.md'),
    '# Harbour\nArrival.\n## Background\n### Dock\nA safe harbour',
  );
  await writeFile(join(root, 'legacy.md'), '# Legacy\nOld notes');
  await writeFile(join(root, 'unsafe.md'), '---\nworkbench: {schema: 2}\n---\nStill readable');
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Export browser', directory: root } })
    ).json();
    const capture = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    // Retained fork API supplies provenance for this export regression; it has no Write UI entry.
    const forkResponse = await request.post(`/api/campaigns/${campaign.id}/drafts/fork`, {
      data: { capture: capture.capture, path: 'captain.md', type: null },
    });
    expect(forkResponse.ok()).toBe(true);
    const fork = await forkResponse.json();
    await page.goto(`/writing?campaign=${campaign.id}&draft=${fork.id}`);
    await expect(page.getByRole('button', { name: 'Copy source', exact: true })).toHaveCount(0);
    await expect(page.locator('campaign-library, #source-reader')).toHaveCount(0);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Captain');
    await page
      .getByRole('navigation', { name: 'Editing tabs' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await expect(page.getByLabel('Metadata status')).toHaveValue('draft');
    const list = await (await request.get(`/api/campaigns/${campaign.id}/drafts`)).json();
    const draft = list.drafts[0];
    expect(draft.card).not.toBe('92bb19a9-0741-4d9c-9df9-b74b969a649f');
    expect(draft.fields.body).toBe(body);
    await page.getByLabel('Card summary', { exact: true }).fill('A revised captain');
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Open full document', exact: true }).click();
    await page.locator('draft-reader').getByRole('link', { name: 'Harbour', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Selected Library document' })).toContainText(
      'A safe harbour',
    );
    await expect(page.getByText('A safe harbour', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Return to Write', exact: true }).click();
    await page.getByRole('button', { name: 'Export to campaign', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect export', exact: true }).click();
    await expect(page.getByLabel('Markdown export')).toContainText('Unknown Workbench field');
    await page.getByLabel('I reviewed the warnings for this export.').check();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Markdown', exact: true }).click();
    const download = await downloading;
    const downloadedPath = info.outputPath('exported.md');
    await download.saveAs(downloadedPath);
    const exported = await readFile(downloadedPath, 'utf8');
    expect(exported.endsWith(body)).toBe(true);
    expect(exported).toContain('extension:');
    expect(exported).toContain(draft.card);
    expect(await readFile(join(root, 'captain.md'), 'utf8')).toBe(original);
    await page.getByLabel('Title', { exact: true }).fill('Later revision');
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await expect(page.getByRole('button', { name: 'Download Markdown', exact: true })).toHaveCount(
      0,
    );
    const repeating = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download again', exact: true }).click();
    const repeat = await repeating;
    const repeatedPath = info.outputPath('repeated.md');
    await repeat.saveAs(repeatedPath);
    expect(await readFile(repeatedPath, 'utf8')).toBe(exported);
    await writeFile(join(root, draft.fields.path), exported);
    const refreshed = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    expect(refreshed.capture).toBeTruthy();
    const document = await (
      await request.get(
        `/api/campaigns/${campaign.id}/sources/document?capture=${refreshed.capture}&path=${encodeURIComponent(draft.fields.path)}`,
      )
    ).json();
    expect(document.classification.metadata).toMatchObject({
      id: draft.card,
      type: 'npc',
      status: 'draft',
      tags: ['harbour'],
      summary: 'A revised captain',
    });
    const missingType = await request.post(`/api/campaigns/${campaign.id}/drafts/fork`, {
      data: { capture: refreshed.capture, path: 'legacy.md', type: null },
    });
    expect(missingType.ok()).toBe(false);
    const legacy = await request.post(`/api/campaigns/${campaign.id}/drafts/fork`, {
      data: { capture: refreshed.capture, path: 'legacy.md', type: 'item' },
    });
    expect(legacy.ok()).toBe(true);
    expect((await legacy.json()).fields.type).toBe('item');
    const unsafe = await request.post(`/api/campaigns/${campaign.id}/drafts/fork`, {
      data: { capture: refreshed.capture, path: 'unsafe.md', type: 'npc' },
    });
    expect(unsafe.ok()).toBe(false);
    await page.screenshot({ path: info.outputPath('writing-source-export.png'), fullPage: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
