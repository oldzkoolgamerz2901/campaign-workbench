import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('restores detached Writing history and explicitly resumes a fresh draft without overwriting work', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'recovery-origin-'));
  const destinationRoot = await mkdtemp(join(tmpdir(), 'recovery-destination-'));
  const json = async (method: 'post' | 'put', url: string, data?: unknown) => {
    const response = await request[method](url, { data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  try {
    const recoveryBefore = (await (await request.get('/api/writing-recovery')).json()).workspaces
      .length;
    await writeFile(join(root, 'original.md'), '# Original scene\nRetained evidence.');
    const origin = await json('post', '/api/campaigns', {
      name: 'Recovery walkthrough',
      directory: root,
    });
    const destination = await json('post', '/api/campaigns', {
      name: 'Resume destination',
      directory: destinationRoot,
    });
    const capture = (await json('post', `/api/campaigns/${origin.id}/sources/refresh`)).capture;
    const fork = await json('post', `/api/campaigns/${origin.id}/drafts/fork`, {
      capture,
      path: 'original.md',
      type: 'scene',
    });
    const draft = await json('put', `/api/campaigns/${origin.id}/drafts/${fork.id}`, {
      revision: fork.revision,
      fields: {
        ...fork.fields,
        title: 'Long recovered Scene',
        summary: 'A scene worth keeping.',
        path: 'recovered-scene.md',
        body: '# Scene\n\n## Quick reference\nA secret.\n\n' + 'Long readable scene. '.repeat(200),
      },
    });
    const report = await json(
      'post',
      `/api/campaigns/${origin.id}/drafts/${draft.id}/export-inspection`,
      { revision: draft.revision, capture },
    );
    const artifact = await json('post', `/api/campaigns/${origin.id}/drafts/${draft.id}/exports`, {
      revision: draft.revision,
      capture,
      fingerprint: report.fingerprint,
      acknowledgeWarnings: true,
    });
    const markdownResponse = await request.get(
      `/api/campaigns/${origin.id}/drafts/${draft.id}/exports/${artifact.id}/markdown`,
    );
    const originalMarkdown = await markdownResponse.body();
    await writeFile(join(root, 'recovered-scene.md'), originalMarkdown);
    await json('post', `/api/campaigns/${origin.id}/sources/refresh`);
    const classified = await (await request.get(`/api/campaigns/${origin.id}/sources`)).json();
    expect(JSON.stringify(classified)).toContain('Long recovered Scene');
    let session = await json('post', `/api/campaigns/${origin.id}/sessions`, {
      title: 'Recovery mixed session',
      objective: '',
    });
    const currentCapture = (await (await request.get(`/api/campaigns/${origin.id}/sources`)).json())
      .capture;
    session = await json('post', `/api/campaigns/${origin.id}/sessions/${session.id}/sources`, {
      revision: session.revision,
      capture: currentCapture,
      path: 'original.md',
      section: null,
    });
    session = await json('post', `/api/campaigns/${origin.id}/sessions/${session.id}/drafts`, {
      revision: session.revision,
      draft: draft.id,
      draftRevision: draft.revision,
    });
    session = await json('post', `/api/campaigns/${origin.id}/sessions/${session.id}/sources`, {
      revision: session.revision,
      capture: currentCapture,
      path: 'original.md',
      section: null,
    });
    session = await json('put', `/api/campaigns/${origin.id}/sessions/${session.id}`, {
      revision: session.revision,
      title: session.title,
      objective: '',
      notes: 'Session notes',
      items: session.items.map((item: { id: string }, i: number) => ({
        id: item.id,
        notes: i === 1 ? 'Frozen scene note' : '',
      })),
    });
    const changed = await json('put', `/api/campaigns/${origin.id}/drafts/${draft.id}`, {
      revision: draft.revision,
      fields: { ...draft.fields, title: 'Current scene', body: '# Current\nUpdated working text.' },
    });
    const beforeDestination = await (
      await request.get(`/api/campaigns/${destination.id}/drafts`)
    ).json();
    await page.goto('/writing/recovery');
    await page.getByLabel('Backup campaign', { exact: true }).selectOption(origin.id);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Writing archive', exact: true }).click();
    const downloaded = await downloading;
    const bytes = await readFile((await downloaded.path())!);
    const archive = JSON.parse(bytes.toString());
    expect(archive.approved).toHaveLength(1);
    expect(archive.exports).toHaveLength(1);
    await rm(root, { recursive: true, force: true });
    await page
      .getByLabel('Restore Writing archive', { exact: true })
      .setInputFiles({ name: 'writing.json', mimeType: 'application/json', buffer: bytes });
    await expect(page.getByRole('region', { name: 'Recovered records' })).toContainText(
      '1 current drafts',
    );
    await page
      .getByRole('button', { name: 'Current scene · scene · revision 2', exact: true })
      .click();
    await expect(page.getByRole('article', { name: 'Recovered document' })).toContainText(
      'Current scene',
    );
    await page.getByText('Original source evidence · original.md', { exact: true }).click();
    await expect(page.getByRole('article', { name: 'Recovered document' })).toContainText(
      'Retained evidence.',
    );
    await page.getByLabel('Record kind', { exact: true }).selectOption('export');
    await page
      .getByRole('button', { name: 'Long recovered Scene · scene · revision 1', exact: true })
      .click();
    const oldDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download original Markdown', exact: true }).click();
    expect(await readFile((await (await oldDownload).path())!)).toEqual(originalMarkdown);
    const reexportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download recovered archive', exact: true }).click();
    const reexportBytes = await readFile((await (await reexportDownload).path())!);
    expect(JSON.parse(reexportBytes.toString())).toEqual(archive);
    await page
      .getByLabel('Restore Writing archive', { exact: true })
      .setInputFiles({ name: 'again.json', mimeType: 'application/json', buffer: reexportBytes });
    await expect(
      page.getByRole('navigation', { name: 'Recovery workspaces' }).getByRole('button'),
    ).toHaveCount(recoveryBefore + 2);
    await page
      .getByRole('button', { name: 'Current scene · scene · revision 2', exact: true })
      .click();
    await page.getByLabel('Destination campaign', { exact: true }).selectOption(destination.id);
    await page.getByRole('button', { name: 'Copy to campaign', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Open copied draft', exact: true }),
    ).toBeVisible();
    const destinationDrafts = await (
      await request.get(`/api/campaigns/${destination.id}/drafts`)
    ).json();
    expect(destinationDrafts.drafts).toHaveLength(beforeDestination.drafts.length + 1);
    const copy = destinationDrafts.drafts.at(-1);
    expect(copy.id).not.toBe(changed.id);
    expect(copy.card).not.toBe(changed.card);
    expect(copy.revision).toBe(0);
    expect(copy.recovery.draft).toBe(changed.id);
    await page.screenshot({ path: info.outputPath('recovery-history.png'), fullPage: true });
    await page.getByRole('button', { name: 'Open copied draft', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Current scene');
    const newSession = await json('post', `/api/campaigns/${destination.id}/sessions`, {
      title: 'Resumed session',
      objective: '',
    });
    const approved = await json(
      'post',
      `/api/campaigns/${destination.id}/sessions/${newSession.id}/drafts`,
      { revision: newSession.revision, draft: copy.id, draftRevision: 0 },
    );
    expect(approved.items[0].provenance.authored.draft).toBe(copy.id);
    const frozen = await (
      await request.get(`/api/campaigns/${origin.id}/sessions/${session.id}`)
    ).json();
    expect(frozen.items[1].title).toBe('Long recovered Scene');
    expect(frozen.items[1].notes).toBe('Frozen scene note');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(destinationRoot, { recursive: true, force: true });
  }
});
