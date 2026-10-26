import { test, expect, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
test.use({ actionTimeout: 10_000 });
async function fixture(request: APIRequestContext) {
  const root = await mkdtemp(join(tmpdir(), 'uw5-browser-'));
  const names = ['Scene Alpha', 'Scene Beta', 'Reference NPC', 'Reference Relic'];
  for (const [index, name] of names.entries())
    await writeFile(
      join(root, `${index}.md`),
      `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: ${name}\n  type: ${index < 2 ? 'scene' : index === 2 ? 'npc' : 'item'}\n  purpose: session\n  status: current\n  tags: [research]\n  summary: Authored ${name}.\n---\n# ${name}\nOriginal ${name} text.\n${'\n## Reading passage\nLong reference text.\n'.repeat(12)}`,
    );
  const campaign = await (
    await request.post('/api/campaigns', { data: { name: 'UW5 fixtures', directory: root } })
  ).json();
  const base = `/api/campaigns/${campaign.id}`;
  await request.post(`${base}/sources/refresh`);
  let session = await (
    await request.post(`${base}/sessions`, { data: { title: 'UW5 preparation', objective: '' } })
  ).json();
  for (const name of names) {
    const library = await (await request.get(`${base}/cards`)).json();
    const entry = library.entries.find((e: { title: string }) => e.title === name);
    const response = await request.post(`${base}/sessions/${session.id}/library`, {
      data: {
        revision: session.revision,
        key: entry.key,
        capture: library.capture,
        draft: entry.draft,
        draftRevision: entry.revision,
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    session = (await response.json()).session;
  }
  const endpoint = `${base}/sessions/${session.id}`;
  const ids = session.items.map((i: { id: string }) => i.id) as string[];
  const workspace = await (await request.get(`${endpoint}/workspace`)).json();
  await request.post(`${endpoint}/workspace/scene`, {
    data: { revision: workspace.revision, preparationRevision: session.revision, scene: ids[0] },
  });
  const active = await (await request.get(`${endpoint}/workspace`)).json();
  await request.post(`${endpoint}/workspace/move`, {
    data: { revision: active.revision, item: ids[2], destination: 'PILE_1' },
  });
  return {
    root,
    campaign,
    base,
    session,
    endpoint,
    ids,
    url: `/?campaign=${campaign.id}&session=${session.id}&view=prepare&mode=prepare`,
  };
}

test('independent Write tabs, failed-save protection and full Library research return', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    const draft = await (
      await request.post(`${f.base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    await page.goto(`/writing?campaign=${f.campaign.id}&session=${f.session.id}&draft=${draft.id}`);
    const tabs = page.getByRole('navigation', { name: 'Editing tabs' });
    await tabs.getByRole('button', { name: 'Card', exact: true }).click();
    await page.getByLabel('Card summary', { exact: true }).fill('Keep my authoring context.');
    await page.getByRole('button', { name: 'Full document', exact: true }).click();
    await expect(tabs.getByRole('button', { name: 'Card', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page
      .getByRole('navigation', { name: 'Supporting panel modes' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    const references = page.getByRole('region', { name: 'Library references' });
    await references.getByLabel('Search Library references', { exact: true }).fill('Reference NPC');
    await references.getByRole('button', { name: 'Reference NPC · npc', exact: true }).click();
    const pattern = `**${f.base}/drafts/${draft.id}`;
    await page.route(pattern, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ detail: 'UW5 save failure' }),
          })
        : route.continue(),
    );
    await page.getByLabel('Title', { exact: true }).fill('Saved before research');
    await expect(page.getByLabel('Draft save status')).toHaveText('Save failed');
    await references.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect(page).toHaveURL(/\/writing\?/);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Saved before research');
    await page.unroute(pattern);
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await references.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect(page).toHaveURL(/\/library\?/);
    await expect(page.getByRole('article', { name: 'Selected Library document' })).toContainText(
      'Original Reference NPC text.',
    );
    await page.getByRole('button', { name: 'Return to Write', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Saved before research');
    await expect(tabs.getByRole('button', { name: 'Card', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page
        .getByRole('navigation', { name: 'Supporting panel modes' })
        .getByRole('button', { name: 'Library', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(references.getByLabel('Search Library references', { exact: true })).toHaveValue(
      'Reference NPC',
    );
    await page
      .getByRole('navigation', { name: 'Supporting panel modes' })
      .getByRole('button', { name: 'Preview', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Full document', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`write-${width}.png`), fullPage: true });
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Scene planning shares prepared targets, preserves notes scope and leaves runtime state unchanged', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    await page.goto(f.url);
    const source = page.getByRole('article', { name: 'Prepared source', exact: true });
    const outline = page.getByLabel('Session outline');
    await expect(source.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const before = await (await request.get(`${f.endpoint}/workspace`)).json();
    await source.getByRole('button', { name: 'Scene planning', exact: true }).click();
    await source.getByRole('button', { name: 'Link: Reference NPC', exact: true }).click();
    await expect(
      source.getByRole('button', { name: 'Unlink: Reference NPC', exact: true }),
    ).toBeVisible();
    await source.getByRole('button', { name: 'Link: Reference Relic', exact: true }).click();
    await expect(
      source.getByRole('button', { name: 'Unlink: Reference Relic', exact: true }),
    ).toBeVisible();
    const notes = page.getByRole('article', { name: 'Working notes' });
    await notes.getByRole('button', { name: 'Session', exact: true }).click();
    await page.getByLabel('Session Markdown notes').fill('Session scope stays fixed.');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await outline.getByRole('button', { name: 'Scene Beta', exact: true }).click();
    await source.getByRole('button', { name: 'Scene planning', exact: true }).click();
    await source.getByRole('button', { name: 'Link: Reference NPC', exact: true }).click();
    await expect(
      source.getByRole('button', { name: 'Unlink: Reference NPC', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Session Markdown notes')).toHaveValue(
      'Session scope stays fixed.',
    );
    await outline.getByRole('button', { name: 'Scene Alpha', exact: true }).click();
    await source.getByRole('button', { name: 'Scene planning', exact: true }).click();
    await source.getByRole('button', { name: 'Read related: Reference NPC', exact: true }).click();
    await expect(source).toContainText('Original Reference NPC text.');
    await expect(page.getByLabel('Session Markdown notes')).toHaveValue(
      'Session scope stays fixed.',
    );
    const back = source.getByRole('button', { name: 'Back to scene', exact: true });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(
      source.getByRole('button', { name: 'Scene planning', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const saved = await (await request.get(f.endpoint)).json();
    expect(saved.sceneLinks).toHaveLength(3);
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(before);
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`prepare-${width}.png`), fullPage: true });
    }
    await page
      .getByRole('navigation', { name: 'Workspace mode' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await page.getByRole('button', { name: 'Related cards', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Customize placements', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText('Reference NPC');
    await expect(page.getByRole('dialog')).toContainText('Reference Relic');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('explicit replacement preserves identities/runtime and linked removal confirms Scene names', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    let session = f.session;
    for (const scene of f.ids.slice(0, 2))
      session = await (
        await request.put(`${f.endpoint}/scene-links/${scene}/${f.ids[2]}`, {
          data: { revision: session.revision, linked: true },
        })
      ).json();
    const draftId = session.items[2].provenance.authored.draft;
    let draft = await (await request.get(`${f.base}/drafts/${draftId}`)).json();
    draft = await (
      await request.put(`${f.base}/drafts/${draftId}`, {
        data: {
          revision: draft.revision,
          fields: { ...draft.fields, body: '# New revision\nExplicitly updated text.' },
        },
      })
    ).json();
    await page.goto(f.url);
    const source = page.getByRole('article', { name: 'Prepared source', exact: true });
    const outline = page.getByLabel('Session outline');
    await outline.getByRole('button', { name: 'Reference NPC', exact: true }).click();
    await expect(source.getByText('Update available', { exact: true })).toBeVisible();
    const workspace = await (await request.get(`${f.endpoint}/workspace`)).json();
    await source.getByRole('button', { name: 'Use latest version', exact: true }).click();
    await expect(source).toContainText('Explicitly updated text.');
    let saved = await (await request.get(f.endpoint)).json();
    expect(saved.items.map((i: { id: string }) => i.id)).toEqual(f.ids);
    expect(saved.sceneLinks).toHaveLength(2);
    expect(await (await request.get(`${f.endpoint}/workspace`)).json()).toEqual(workspace);
    const archiveResponse = await request.post(`${f.base}/sessions/portable-export`, {
      data: { sessions: [f.session.id] },
    });
    expect(archiveResponse.ok(), await archiveResponse.text()).toBe(true);
    const importedResponse = await request.post(`${f.base}/sessions/portable-import`, {
      data: await archiveResponse.body(),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    expect(importedResponse.ok(), await importedResponse.text()).toBe(true);
    const imported = (await importedResponse.json()).sessions[0];
    await page.goto(`/?campaign=${f.campaign.id}&session=${imported.id}&view=prepare&mode=prepare`);
    await outline.getByRole('button', { name: 'Reference NPC', exact: true }).click();
    await expect(source).toContainText('Explicitly updated text.');
    await outline.getByRole('button', { name: 'Scene Alpha', exact: true }).click();
    await source.getByRole('button', { name: 'Scene planning', exact: true }).click();
    await expect(
      source.getByRole('button', { name: 'Unlink: Reference NPC', exact: true }),
    ).toBeVisible();
    await page.goto(f.url);
    await expect(source.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await outline.getByRole('button', { name: 'Reference NPC', exact: true }).click();
    const remove = outline.getByRole('button', { name: 'Remove: Reference NPC', exact: true });
    let dismissed!: () => void;
    const dismissal = new Promise<void>((resolve) => (dismissed = resolve));
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Scene Alpha');
      expect(dialog.message()).toContain('Scene Beta');
      await dialog.dismiss();
      dismissed();
    });
    await remove.click();
    await dismissal;
    expect((await (await request.get(f.endpoint)).json()).items).toHaveLength(4);
    page.once('dialog', (dialog) => dialog.accept());
    await remove.click();
    await expect(outline.getByRole('button', { name: 'Reference NPC', exact: true })).toHaveCount(
      0,
    );
    saved = await (await request.get(f.endpoint)).json();
    expect(saved.sceneLinks).toEqual([]);
    expect(saved.items).toHaveLength(3);
    expect((await request.get(`${f.base}/drafts/${draftId}`)).ok()).toBe(true);
    const reconciled = await (await request.get(`${f.endpoint}/workspace`)).json();
    expect(reconciled.pile1.items).toEqual([]);
    expect(reconciled.activeSceneItemId).toBe(f.ids[0]);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('contextual Prepare Library adds a whole card and invalid type updates remain explicit', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    await writeFile(
      join(f.root, 'extra.md'),
      `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: Extra Library card\n  type: item\n  purpose: session\n  status: current\n  tags: []\n---\n# Extra Library card\nExplicit membership.`,
    );
    await request.post(`${f.base}/sources/refresh`);
    await page.goto(f.url);
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'Add cards from Library', exact: true })
      .click();
    const library = page.getByRole('region', { name: 'Session Library', exact: true });
    await library.getByRole('button', { name: 'Extra Library card · item', exact: true }).click();
    await library
      .getByRole('button', { name: 'Add selected card to session', exact: true })
      .click();
    await expect(
      page
        .getByLabel('Session outline')
        .getByRole('button', { name: 'Extra Library card', exact: true }),
    ).toBeVisible();
    await expect(library.getByText('Already in session', { exact: true })).toBeVisible();
    await library.getByRole('button', { name: 'View prepared card', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Prepared source', exact: true })).toContainText(
      'Explicit membership.',
    );
    expect((await (await request.get(f.endpoint)).json()).items).toHaveLength(5);
    const draftId = f.session.items[2].provenance.authored.draft;
    let draft = await (await request.get(`${f.base}/drafts/${draftId}`)).json();
    await request.put(`${f.base}/drafts/${draftId}`, {
      data: { revision: draft.revision, fields: { ...draft.fields, type: 'item' } },
    });
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'Reference NPC', exact: true })
      .click();
    const source = page.getByRole('article', { name: 'Prepared source', exact: true });
    await expect(
      source.getByRole('button', { name: 'Use latest version', exact: true }),
    ).toBeDisabled();
    await expect(source).toContainText('changed card type');
    await expect(source).toContainText('Original Reference NPC text.');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('a delayed Writing save cannot open an older reference after the user selects another', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    const draft = await (
      await request.post(`${f.base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    await page.goto(`/writing?campaign=${f.campaign.id}&draft=${draft.id}`);
    await page
      .getByRole('navigation', { name: 'Supporting panel modes' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    const references = page.getByRole('region', { name: 'Library references' });
    await references.getByRole('button', { name: 'Reference NPC · npc', exact: true }).click();
    let release!: () => void;
    let dispatched = false;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**${f.base}/drafts/${draft.id}`, async (route) => {
      if (route.request().method() === 'PUT') {
        dispatched = true;
        await gate;
      }
      await route.continue();
    });
    await page.getByLabel('Title', { exact: true }).fill('A delayed save');
    await references.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect.poll(() => dispatched).toBe(true);
    await references.getByRole('button', { name: 'Reference Relic · item', exact: true }).click();
    release();
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await expect(page).toHaveURL(/\/writing\?/);
    await references.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect(page.getByRole('article', { name: 'Selected Library document' })).toContainText(
      'Original Reference Relic text.',
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('native Back restores a locally selected Draft and changed references require explicit reload', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    const draft = await (
      await request.post(`${f.base}/drafts`, { data: { type: 'npc', template: false } })
    ).json();
    await page.goto(`/writing?campaign=${f.campaign.id}`);
    await page
      .getByLabel('Writing library')
      .getByRole('button', { name: /Untitled npc/ })
      .click();
    await page.getByLabel('Title', { exact: true }).fill('Research origin');
    await page
      .getByRole('navigation', { name: 'Supporting panel modes' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    const refs = page.getByRole('region', { name: 'Library references' });
    await refs.getByRole('button', { name: 'Reference NPC · npc', exact: true }).click();
    await refs.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect(page).toHaveURL(/\/library\?/);
    await expect(page.getByRole('article', { name: 'Selected Library document' })).toContainText(
      'Original Reference NPC text.',
    );
    await page.goBack();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Research origin');
    await expect(
      page
        .getByRole('navigation', { name: 'Supporting panel modes' })
        .getByRole('button', { name: 'Library', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    const referenceId = f.session.items[2].provenance.authored.draft;
    const reference = await (await request.get(`${f.base}/drafts/${referenceId}`)).json();
    await request.put(`${f.base}/drafts/${referenceId}`, {
      data: {
        revision: reference.revision,
        fields: { ...reference.fields, body: '# Changed reference\nExplicit reload required.' },
      },
    });
    await refs.getByRole('button', { name: 'Open full document', exact: false }).click();
    await expect(page.getByRole('alert')).toContainText('reference changed');
    await page.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    await expect(page.getByRole('article', { name: 'Selected Library document' })).toContainText(
      'Explicit reload required.',
    );
    await page.getByRole('button', { name: 'Return to Write', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Research origin');
    expect((await (await request.get(`${f.base}/drafts/${draft.id}`)).json()).fields.title).toBe(
      'Research origin',
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
