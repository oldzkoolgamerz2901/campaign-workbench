import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { historicalSourceItem, importHistoricalSession } from './preparation-fixtures';

async function fixture(request: APIRequestContext, count = 0) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-pux3-'));
  for (const [title, type] of [
    ['Scene', 'scene'],
    ['NPC', 'npc'],
  ]) {
    await writeFile(
      join(root, `${title}.md`),
      `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: ${title}\n  type: ${type}\n  purpose: session\n  status: current\n  summary: Reference for ${title}.\n  tags: []\n---\n# Full ${title}\nFrozen ${title} document.`,
    );
  }
  const campaign = await (
    await request.post('/api/campaigns', { data: { name: 'PUX-3 Notes', directory: root } })
  ).json();
  const base = `/api/campaigns/${campaign.id}`;
  const capture = await (await request.post(`${base}/sources/refresh`)).json();
  let session = await (
    await request.post(`${base}/sessions`, { data: { title: 'PUX-3 session', objective: '' } })
  ).json();
  const items = [];
  for (const name of ['Scene', 'NPC'])
    items.push(
      await historicalSourceItem(request, campaign.id, {
        capture: capture.capture,
        path: `${name}.md`,
        section: null,
      }),
    );
  session = await importHistoricalSession(request, campaign.id, session, items);
  const endpoint = `${base}/sessions/${session.id}`;
  session = await (
    await request.put(endpoint, {
      data: {
        revision: session.revision,
        title: session.title,
        objective: '',
        notes: 'Preparation session context.',
        items: session.items.map((item: any) => ({
          id: item.id,
          notes: `${item.title} preparation context.`,
        })),
      },
    })
  ).json();
  const [scene, npc] = session.items.map((item: any) => item.id);
  const w = await (await request.get(`${endpoint}/workspace`)).json();
  expect(
    (
      await request.post(`${endpoint}/workspace/scene`, {
        data: { revision: w.revision, preparationRevision: session.revision, scene, movements: [] },
      })
    ).ok(),
  ).toBe(true);
  const notes = [];
  for (let i = 0; i < count; i++) {
    const response = await request.post(`${endpoint}/play-notes`, {
      data: {
        operation: randomUUID(),
        expectedScene: scene,
        resource: npc,
        markdown: `Recorded note ${i + 1}`,
      },
    });
    expect(response.ok()).toBe(true);
    notes.push(await response.json());
  }
  if (notes.length) {
    const response = await request.put(`${endpoint}/play-notes/${notes[0].id}`, {
      data: {
        revision: notes[0].revision,
        markdown: notes[0].markdown,
        pinned: true,
        changeResource: false,
        resource: null,
      },
    });
    expect(response.ok()).toBe(true);
    notes[0] = await response.json();
  }
  return {
    root,
    campaign,
    session,
    endpoint,
    scene,
    npc,
    notes,
    url: `/?campaign=${campaign.id}&session=${session.id}&item=${npc}&mode=play&view=prepare`,
  };
}
async function view(page: Page, name: 'Live notes' | 'Preparation' | 'History') {
  await page
    .locator('play-notes')
    .getByRole('navigation', { name: 'Notes views', exact: true })
    .getByRole('button', { name, exact: true })
    .click();
}
async function panel(page: Page, name: 'Notes' | 'Document') {
  await page
    .getByRole('navigation', { name: 'Play supporting panel', exact: true })
    .getByRole('button', { name, exact: true })
    .click();
}

test('PUX-3 subviews preserve drafts, associations and document selection while exposing read-only preparation and full history', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request, 7);
  try {
    await page.goto(f.url);
    const notes = page.locator('play-notes');
    const text = notes.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await expect(
      notes
        .getByRole('navigation', { name: 'Notes views' })
        .getByRole('button', { name: 'Live notes', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      notes
        .getByRole('region', { name: 'Recent PlayNotes', exact: true })
        .locator('button[data-note-id]'),
    ).toHaveCount(5);
    const originalSession = await (await request.get(f.endpoint)).json();
    const mutations: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/play-notes') && ['POST', 'PUT'].includes(r.method()))
        mutations.push(r.method());
    });
    await text.fill('Keep this **live draft** across views.');
    await notes.getByLabel('Primary resource', { exact: true }).selectOption(f.npc);
    await view(page, 'Preparation');
    const preparation = notes.getByRole('region', { name: 'Preparation references', exact: true });
    await expect(
      preparation.getByRole('heading', { name: 'Preparation', exact: true }),
    ).toBeFocused();
    await preparation.getByRole('button', { name: 'Session', exact: true }).click();
    await expect(preparation).toContainText('Preparation session context.');
    await preparation.getByRole('button', { name: 'Selected item', exact: true }).click();
    await expect(preparation).toContainText('NPC preparation context.');
    await expect(preparation.locator('textarea')).toHaveCount(0);
    await view(page, 'History');
    await expect(
      notes.getByRole('region', { name: 'PlayNote chronology', exact: true }).locator('article'),
    ).toHaveCount(7);
    await expect(
      notes.getByRole('region', { name: 'Pinned PlayNotes', exact: true }),
    ).toContainText('Recorded note 1');
    await page
      .locator('play-tabletop')
      .getByRole('article', { name: 'Read: NPC', exact: true })
      .press('Enter');
    await expect(page.locator('.source-page')).toContainText('Frozen NPC document.');
    await panel(page, 'Notes');
    await expect(
      notes
        .getByRole('navigation', { name: 'Notes views' })
        .getByRole('button', { name: 'History', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await view(page, 'Live notes');
    await expect(text).toHaveValue('Keep this **live draft** across views.');
    await expect(notes.getByLabel('Primary resource', { exact: true })).toHaveValue(f.npc);
    await expect(notes.getByRole('region', { name: 'Live notes', exact: true })).toContainText(
      'New note · Scene: Scene',
    );
    expect(mutations).toEqual([]);
    expect(await (await request.get(f.endpoint)).json()).toEqual(originalSession);
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(text).toHaveValue('');
    const saved = await (await request.get(`${f.endpoint}/play-notes`)).json();
    expect(saved.notes).toHaveLength(8);
    expect(saved.notes[0].scene.title).toBe('Scene');
    expect(saved.notes[0].resource.title).toBe('NPC');
    for (const size of [
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      for (const title of ['History', 'Preparation', 'Live notes'] as const) {
        await view(page, title);
        await expect(notes.getByRole('heading', { name: title, exact: true })).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: info.outputPath(`notes-${title}-${size.width}.png`) });
      }
    }
    await page
      .getByRole('navigation', { name: 'Workspace mode', exact: true })
      .getByRole('button', { name: 'Prepare', exact: true })
      .click();
    const working = page.getByRole('article', { name: 'Working notes', exact: true });
    await working.getByRole('button', { name: 'Session', exact: true }).click();
    await expect(working.getByLabel('Session Markdown notes', { exact: true })).toHaveValue(
      'Preparation session context.',
    );
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-3 keeps captured Scene context across resource-only drafts, subviews and explicit conflict recovery', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    await page.goto(f.url);
    const notes = page.locator('play-notes'),
      text = notes.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await notes.getByLabel('Primary resource', { exact: true }).selectOption(f.npc);
    await view(page, 'History');
    await page.getByRole('button', { name: 'Deactivate Scene', exact: true }).click();
    await expect
      .poll(
        async () => (await (await request.get(`${f.endpoint}/workspace`)).json()).activeSceneItemId,
      )
      .toBeNull();
    await view(page, 'Live notes');
    await expect(notes.getByRole('region', { name: 'Live notes', exact: true })).toContainText(
      'New note · Scene: Scene',
    );
    await text.fill('Keep captured Scene context.');
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(notes.getByRole('alert')).toContainText('active Scene changed');
    await view(page, 'Preparation');
    await view(page, 'History');
    await expect(
      notes.getByRole('button', { name: 'Review Live note', exact: true }),
    ).toBeVisible();
    await notes.getByRole('button', { name: 'Review Live note', exact: true }).click();
    await expect(text).toHaveValue('Keep captured Scene context.');
    await expect(notes.getByLabel('Primary resource', { exact: true })).toHaveValue(f.npc);
    await notes.getByRole('button', { name: 'Refresh and use current Scene', exact: true }).click();
    const savedRequest = page.waitForRequest(
      (r) => r.url().endsWith('/play-notes') && r.method() === 'POST',
    );
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    expect((await savedRequest).postDataJSON()).toMatchObject({
      expectedScene: null,
      resource: f.npc,
      markdown: 'Keep captured Scene context.',
    });
    await expect(text).toHaveValue('');
    const saved = await (await request.get(`${f.endpoint}/play-notes`)).json();
    expect(saved.notes).toHaveLength(1);
    expect(saved.notes[0].scene).toBeNull();
    expect(saved.notes[0].resource.title).toBe('NPC');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-3 retains uncertain saves and edit drafts through History, guarded selection and revision recovery', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 1);
  let release = () => {};
  try {
    await page.goto(f.url);
    const notes = page.locator('play-notes'),
      text = notes.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await text.fill('One uncertain capture.');
    const requests: any[] = [];
    let started = () => {};
    const opened = new Promise<void>((r) => (started = r));
    const gate = new Promise<void>((r) => (release = r));
    await page.route(`**${f.endpoint}/play-notes`, async (route) => {
      if (route.request().method() === 'POST') {
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) {
          await route.fetch();
          started();
          await gate;
          await route.abort('failed');
        } else await route.continue();
      } else await route.continue();
    });
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await opened;
    await view(page, 'Preparation');
    await view(page, 'History');
    release();
    await expect(notes.getByRole('alert')).toBeVisible();
    await notes.getByRole('button', { name: 'Reload note history', exact: true }).click();
    await expect(
      notes.getByRole('region', { name: 'PlayNote chronology', exact: true }),
    ).toContainText('One uncertain capture.');
    await notes.getByRole('button', { name: 'Review Live note', exact: true }).click();
    await expect(text).toHaveValue('One uncertain capture.');
    await notes.getByRole('button', { name: 'Retry PlayNote save', exact: true }).click();
    await expect(text).toHaveValue('');
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect((await (await request.get(`${f.endpoint}/play-notes`)).json()).notes).toHaveLength(2);
    await page.unroute(`**${f.endpoint}/play-notes`);
    await text.fill('Do not replace my local draft.');
    await view(page, 'History');
    const original = notes
      .locator(`[data-note-id="${f.notes[0].id}"]`)
      .getByRole('button', { name: 'Edit / pin note', exact: true });
    page.once('dialog', (d) => d.dismiss());
    await original.click();
    await expect(
      notes
        .getByRole('navigation', { name: 'Notes views' })
        .getByRole('button', { name: 'History', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await view(page, 'Live notes');
    await expect(text).toHaveValue('Do not replace my local draft.');
    await view(page, 'History');
    page.once('dialog', (d) => d.accept());
    await original.click();
    await expect(text).toBeVisible();
    await expect(text).toHaveValue('Recorded note 1');
    await text.fill('Retained local revision.');
    await notes.getByLabel('Pinned', { exact: true }).uncheck();
    const changed = await request.put(`${f.endpoint}/play-notes/${f.notes[0].id}`, {
      data: {
        revision: f.notes[0].revision,
        markdown: 'Concurrent server revision.',
        pinned: true,
        changeResource: false,
        resource: null,
      },
    });
    expect(changed.ok()).toBe(true);
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(notes.getByRole('alert')).toBeVisible();
    await view(page, 'Preparation');
    await panel(page, 'Document');
    await panel(page, 'Notes');
    await view(page, 'History');
    page.once('dialog', (d) => d.accept());
    await notes
      .getByRole('button', { name: 'Reload saved revision for review', exact: true })
      .click();
    await expect(text).toBeVisible();
    await expect(text).toHaveValue('Retained local revision.');
    await expect(notes.getByLabel('Pinned', { exact: true })).not.toBeChecked();
    await notes.getByRole('button', { name: 'Save PlayNote', exact: true }).click();
    await expect(text).toHaveValue('');
    const saved = (await (await request.get(`${f.endpoint}/play-notes`)).json()).notes.find(
      (n: any) => n.id === f.notes[0].id,
    );
    expect(saved.markdown).toBe('Retained local revision.');
    expect(saved.pinned).toBe(false);
    expect(saved.createdAt).toBe(f.notes[0].createdAt);
    expect(saved.resource).toEqual(f.notes[0].resource);
  } finally {
    release();
    await rm(f.root, { recursive: true, force: true });
  }
});

test('PUX-3 late resource-history responses preserve the active view, focus and note association', async ({
  page,
  request,
}) => {
  const f = await fixture(request, 1);
  let release = () => {};
  try {
    await page.goto(f.url);
    const notes = page.locator('play-notes'),
      text = notes.getByLabel('PlayNote Markdown', { exact: true });
    await expect(text).toBeEnabled();
    await view(page, 'History');
    let started = () => {};
    const opened = new Promise<void>((r) => (started = r));
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/play-history/resource?*', async (route) => {
      const response = await route.fetch();
      started();
      await gate;
      await route.fulfill({ response });
    });
    await notes.getByRole('button', { name: 'Resource history: NPC', exact: true }).click();
    await opened;
    await view(page, 'Live notes');
    await expect(notes.getByRole('heading', { name: 'Live notes', exact: true })).toBeFocused();
    await text.fill('Keep focus and context.');
    await notes.getByLabel('Primary resource', { exact: true }).selectOption(f.npc);
    await text.focus();
    release();
    await expect(text).toBeFocused();
    await expect(text).toHaveValue('Keep focus and context.');
    await view(page, 'Preparation');
    await view(page, 'History');
    const history = notes.getByRole('region', { name: 'Cross-session card history', exact: true });
    await expect(
      history.getByRole('region', { name: 'Card history chronology', exact: true }),
    ).toContainText('Recorded note 1');
    await view(page, 'Live notes');
    await expect(notes.getByLabel('Primary resource', { exact: true })).toHaveValue(f.npc);
    await expect(text).toHaveValue('Keep focus and context.');
  } finally {
    release();
    await rm(f.root, { recursive: true, force: true });
  }
});
