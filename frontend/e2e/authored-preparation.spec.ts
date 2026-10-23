import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('approves an exact draft into a mixed session and reads a frozen portable copy', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'authored-preparation-'));
  const other = await mkdtemp(join(tmpdir(), 'authored-destination-'));
  try {
    await writeFile(join(root, 'scene.md'), '# Scene\nA source scene.');
    const campaign = await (
      await request.post('/api/campaigns', {
        data: { name: 'Authored preparation', directory: root },
      })
    ).json();
    const destination = await (
      await request.post('/api/campaigns', {
        data: { name: 'Authored destination', directory: other },
      })
    ).json();
    const capture = (
      await (await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)).json()
    ).capture;
    const sourceCapture = capture;
    const created = await (
      await request.post(`/api/campaigns/${campaign.id}/drafts`, {
        data: { type: 'npc', template: false },
      })
    ).json();
    const fields = {
      ...created.fields,
      title: 'Captain Mira',
      summary: 'A watchful captain.',
      tags: ['harbour'],
      path: 'mira.md',
      body:
        '# Captain Mira\n\n## Quick reference\nProtect the crew.\n\n[Scene](scene.md#scene)\n\n' +
        'A long readable scene. '.repeat(180),
    };
    const draft = await (
      await request.put(`/api/campaigns/${campaign.id}/drafts/${created.id}`, {
        data: { revision: created.revision, fields },
      })
    ).json();
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Mixed voyage', objective: '' },
      })
    ).json();
    for (let i = 0; i < 2; i++) {
      const response = await request.post(
        `/api/campaigns/${campaign.id}/sessions/${session.id}/sources`,
        {
          data: {
            revision: session.revision,
            capture: sourceCapture,
            path: 'scene.md',
            section: null,
          },
        },
      );
      expect(response.ok()).toBe(true);
      session = await response.json();
    }
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    const chooser = page.getByRole('region', { name: 'Session Library', exact: true });
    await chooser.getByRole('button', { name: 'Captain Mira · npc', exact: true }).click();
    await expect(chooser.getByLabel('Playing card preview')).toContainText('A watchful captain.');
    await chooser
      .getByRole('button', { name: 'Add selected card to session', exact: true })
      .click();
    await expect(page.getByLabel('Session outline')).toContainText('Captain Mira');
    await chooser.getByRole('button', { name: 'View prepared card', exact: true }).click();
    await expect(page.locator('.source-page')).toContainText('Protect the crew.');
    const saving = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith(`/sessions/${session.id}`) &&
        response.request().postDataJSON().items[1]?.notes === 'Session-specific secret.',
    );
    await page.getByRole('button', { name: 'Move up: Captain Mira', exact: true }).click();
    await page.getByLabel('Item Markdown notes').fill('Session-specific secret.');
    expect((await saving).ok()).toBe(true);
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    const saved = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(saved.items.map((i: { title: string }) => i.title)).toEqual([
      'scene.md',
      'Captain Mira',
      'scene.md',
    ]);
    expect(saved.items[1].capturedSource.classification.metadata.status).toBe('draft');
    await request.put(`/api/campaigns/${campaign.id}/drafts/${draft.id}`, {
      data: {
        revision: draft.revision,
        fields: {
          ...fields,
          title: 'Changed captain',
          summary: 'Changed summary',
          body: '# Changed',
        },
      },
    });
    await page.reload();
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'Captain Mira', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('A watchful captain.');
    await expect(page.getByLabel('Item Markdown notes')).toHaveValue('Session-specific secret.');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.source-page')).toContainText('Protect the crew.');
    await page.screenshot({ path: info.outputPath('authored-session-card.png') });
    await page.locator('.source-page').getByRole('link', { name: 'Scene', exact: true }).click();
    await expect(page.locator('.source-page')).toContainText('outside captured material');
    await page
      .locator('read-card-table')
      .getByRole('article', { name: 'Read: scene.md', exact: true })
      .first()
      .click();
    await expect(page.locator('.source-page')).toContainText('A source scene.');
    const archive = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions/export`, {
        data: { sessions: [session.id] },
      })
    ).json();
    expect(archive.version).toBe(8);
    const imported = await (
      await request.post(`/api/campaigns/${destination.id}/sessions/import`, { data: archive })
    ).json();
    await page.goto(
      `/?campaign=${destination.id}&session=${imported.sessions[0].id}&view=prepare&mode=read`,
    );
    await page
      .locator('read-card-table')
      .getByRole('article', { name: 'Read: Captain Mira', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('A watchful captain.');
    await expect(page.locator('.source-page')).toContainText('Protect the crew.');
    await expect(page.getByLabel('Working notes')).toContainText('Session-specific secret.');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(other, { recursive: true, force: true });
  }
});
