import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('authors a separate back, reports physical fit and preserves frozen and recovered text', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'card-back-browser-'));
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Card backs', directory: root } })
    ).json();
    const created = await (
      await request.post(`/api/campaigns/${campaign.id}/drafts`, {
        data: { type: 'npc', template: false },
      })
    ).json();
    const draft = await (
      await request.put(`/api/campaigns/${campaign.id}/drafts/${created.id}`, {
        data: {
          revision: created.revision,
          fields: {
            ...created.fields,
            title: 'Mira',
            summary: 'Harbour keeper.',
            path: 'mira.md',
            body: '# Mira\nFull background.',
          },
        },
      })
    ).json();
    const session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Back test', objective: '' },
      })
    ).json();
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    const back = page.getByLabel('Card back text', { exact: true });
    await expect(back).toBeVisible();
    await back.fill('Long back line\n'.repeat(30));
    await expect(back).toHaveValue('Long back line\n'.repeat(30));
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await expect(back).toHaveValue('Long back line\n'.repeat(30));
    await expect(page.getByLabel('Card fit feedback').first()).toContainText(
      'Back text does not fit',
    );
    let entry = (
      await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json()
    ).entries.find((e: any) => e.draft === draft.id);
    expect(entry.ready).toBe(false);
    const blocked = await request.post(
      `/api/campaigns/${campaign.id}/sessions/${session.id}/library`,
      {
        data: {
          revision: session.revision,
          key: entry.key,
          capture: null,
          draft: draft.id,
          draftRevision: entry.revision,
        },
      },
    );
    expect(blocked.status()).toBe(400);
    const text = 'Motivation\nProtect the harbour.\n\n<script>literal text</script>';
    await back.fill(text);
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await page.getByText('Check physical card fit', { exact: true }).click();
    const fit = page.getByRole('region', { name: 'Physical card fit' });
    await expect(fit).toContainText('Both sides fit on the card.');
    await fit.getByRole('button', { name: 'Back layout', exact: true }).click();
    await expect(fit.getByRole('img', { name: 'Back text layout' })).toBeVisible();
    await expect(fit.locator('script')).toHaveCount(0);
    await expect(fit.locator('text').last()).toHaveText('<script>literal text</script>');
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: info.outputPath(`back-fit-${width}.png`), fullPage: true });
    }
    entry = (await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json()).entries.find(
      (e: any) => e.draft === draft.id,
    );
    expect(entry.ready).toBe(true);
    const added = await request.post(
      `/api/campaigns/${campaign.id}/sessions/${session.id}/library`,
      {
        data: {
          revision: session.revision,
          key: entry.key,
          capture: null,
          draft: draft.id,
          draftRevision: entry.revision,
        },
      },
    );
    expect(added.ok(), await added.text()).toBe(true);
    const frozen = (await added.json()).session;
    expect(frozen.items[0].capturedSource.classification.metadata.backText).toBe(text);
    await back.fill('Changed working back.');
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    expect(
      (await (await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)).json())
        .items[0].capturedSource.classification.metadata.backText,
    ).toBe(text);
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    await page.getByText('Card back text', { exact: true }).click();
    await expect(page.locator('.source-page')).toContainText(text);
    // A standalone Writing recovery needs no live campaign material to retain the new field.
    const backup = await request.get(`/api/writing-recovery/campaigns/${campaign.id}/archive`);
    expect(backup.ok(), await backup.text()).toBe(true);
    const archive = await backup.json();
    expect(archive.version).toBe(5);
    expect(archive.drafts[0].fields.backText).toBe('Changed working back.');
    await page.goto('/writing/recovery');
    await page.getByLabel('Restore Writing archive', { exact: true }).setInputFiles({
      name: 'backs.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(archive)),
    });
    await page
      .getByRole('region', { name: 'Recovered records' })
      .getByRole('button', { name: /Mira · npc · revision/ })
      .click();
    const recovered = page.getByRole('article', { name: 'Recovered document' });
    await recovered.getByText('Card back text', { exact: true }).click();
    await expect(recovered).toContainText('Changed working back.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
