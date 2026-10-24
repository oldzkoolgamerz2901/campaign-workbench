import { addLibraryFixture } from './preparation-fixtures';
import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('deletes working drafts without losing prepared copies or retained history', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'writing-delete-'));
  const json = async (method: 'post' | 'put', path: string, data?: unknown) => {
    const response = await request[method](path, { data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  try {
    const source = '# Source\nSource files remain manual.\n';
    await writeFile(join(root, 'source.md'), source);
    const campaign = await json('post', '/api/campaigns', {
      name: 'Deletion browser fixture',
      directory: root,
    });
    const base = `/api/campaigns/${campaign.id}`;
    const capture = (await json('post', `${base}/sources/refresh`)).capture;
    const created = await json('post', `${base}/drafts`, { type: 'npc', template: false });
    const draft = await json('put', `${base}/drafts/${created.id}`, {
      revision: 0,
      fields: {
        ...created.fields,
        title: 'Delete Captain',
        summary: 'Keep the prepared captain.',
        path: 'captain.md',
        body: '# Captain\nFrozen original.',
      },
    });
    const report = await json('post', `${base}/drafts/${draft.id}/export-inspection`, {
      revision: draft.revision,
      capture,
    });
    const artifact = await json('post', `${base}/drafts/${draft.id}/exports`, {
      revision: draft.revision,
      capture,
      fingerprint: report.fingerprint,
      acknowledgeWarnings: true,
    });
    let session = await json('post', `${base}/sessions`, {
      title: 'Retained captain session',
      objective: '',
    });
    session = await (
      await addLibraryFixture(request, `${base}/sessions/${session.id}`, {
        data: {
          revision: 0,
          draft: draft.id,
          draftRevision: draft.revision,
        },
      })
    ).json();
    session = await json('put', `${base}/sessions/${session.id}`, {
      revision: session.revision,
      title: session.title,
      objective: '',
      notes: 'Session notes survive.',
      items: [{ id: session.items[0].id, notes: 'Captain-specific note.' }],
    });
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Delete Captain');
    page.once('dialog', async (d) => {
      expect(d.message()).toContain('Delete Captain');
      expect(d.message()).toContain('no undo');
      await d.dismiss();
    });
    await page.getByRole('button', { name: 'More writing actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete draft', exact: true }).click();
    expect((await request.get(`${base}/drafts/${draft.id}`)).ok()).toBe(true);
    const draftUrl = `**/api/campaigns/${campaign.id}/drafts/${draft.id}?revision=*`;
    await page.route(draftUrl, async (route) => {
      if (route.request().method() === 'DELETE') {
        const current = await (await request.get(`${base}/drafts/${draft.id}`)).json();
        await json('put', `${base}/drafts/${draft.id}`, {
          revision: current.revision,
          fields: { ...current.fields, body: '# Elsewhere\nChanged in another browser.' },
        });
      }
      await route.continue();
    });
    await page
      .getByLabel('Markdown body', { exact: true })
      .fill('# Unsaved\nKeep this local text.');
    const stale = page.waitForResponse((r) => r.request().method() === 'DELETE');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'More writing actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete draft', exact: true }).click();
    expect((await stale).status()).toBe(409);
    await expect(page.getByLabel('Draft save status')).toHaveText('Deletion unresolved');
    await expect(page.getByLabel('Markdown body', { exact: true })).toHaveValue(
      '# Unsaved\nKeep this local text.',
    );
    await expect(page.getByRole('alert')).toContainText('reload explicitly');
    await page.unroute(draftUrl);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Reload / discard local edits', exact: true }).click();
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await expect(page.getByLabel('Markdown body', { exact: true })).toHaveValue(
      '# Elsewhere\nChanged in another browser.',
    );
    const deletion = page.waitForResponse((r) => r.request().method() === 'DELETE');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'More writing actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete draft', exact: true }).click();
    expect((await deletion).status()).toBe(204);
    await expect(
      page.getByRole('status').filter({ hasText: 'Deleted “Delete Captain”' }),
    ).toBeVisible();
    await expect(page.getByLabel('Draft editor')).toHaveCount(0);
    await expect(page.getByLabel('Writing library')).not.toContainText('Delete Captain');
    await page.screenshot({ path: info.outputPath('deleted-writing-draft.png') });
    expect((await request.get(`${base}/drafts/${draft.id}`)).status()).toBe(404);
    expect(
      (
        await request.put(`${base}/drafts/${draft.id}`, {
          data: { revision: 2, fields: draft.fields },
        })
      ).status(),
    ).toBe(404);
    await page.reload();
    await expect(page.getByLabel('Writing library')).not.toContainText('Delete Captain');
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Session Library', exact: true });
    await expect(picker).not.toContainText('Delete Captain');
    await picker.getByRole('button', { name: 'Close session Library', exact: true }).click();
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'Delete Captain', exact: true })
      .click();
    await expect(page.locator('.source-page')).toContainText('Keep the prepared captain.');
    await expect(page.getByLabel('Item Markdown notes')).toHaveValue('Captain-specific note.');
    expect(await (await request.get(`${base}/sessions/${session.id}`)).json()).toEqual(session);
    const bytes = await (
      await request.get(`/api/writing-recovery/campaigns/${campaign.id}/archive`)
    ).body();
    const archive = JSON.parse(bytes.toString());
    expect(archive.drafts).toHaveLength(0);
    expect(archive.approved).toHaveLength(1);
    expect(archive.exports).toHaveLength(1);
    const restored = await request.post('/api/writing-recovery', {
      data: bytes,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    expect(restored.ok()).toBe(true);
    const workspace = await restored.json();
    const historical = await request.get(
      `/api/writing-recovery/${workspace.id}/markdown?key=export:${artifact.id}`,
    );
    expect(historical.ok()).toBe(true);
    expect(await historical.text()).toBe(report.markdown);
    expect(await readFile(join(root, 'source.md'), 'utf8')).toBe(source);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
