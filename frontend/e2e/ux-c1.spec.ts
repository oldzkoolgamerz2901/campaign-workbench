import { test, expect, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function fixture(request: APIRequestContext) {
  const root = await mkdtemp(join(tmpdir(), 'ux-c1-'));
  await writeFile(
    join(root, 'scene.md'),
    `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: Harbour Scene\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Harbour\nComplete opening.\n## Arrival\nWhole Scene details.`,
  );
  const campaign = await (
    await request.post('/api/campaigns', { data: { name: 'UX-C1', directory: root } })
  ).json();
  const base = `/api/campaigns/${campaign.id}`;
  await request.post(`${base}/sources/refresh`);
  const one = await (
    await request.post(`${base}/sessions`, { data: { title: 'First destination', objective: '' } })
  ).json();
  const two = await (
    await request.post(`${base}/sessions`, { data: { title: 'Second destination', objective: '' } })
  ).json();
  return { root, campaign, base, one, two };
}

test('Prepare has one complete-card journey, explicit session selection and retained notes context', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  try {
    await page.goto(`/?campaign=${f.campaign.id}&view=prepare`);
    await expect(page.getByRole('button', { name: 'Add material', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Add material', exact: true }).focus();
    await page.getByRole('button', { name: 'Add material', exact: true }).press('Enter');
    const sessions = page.getByRole('region', { name: 'Campaign sessions' });
    await expect(sessions).toBeVisible();
    await sessions.getByRole('button', { name: 'Close session chooser' }).click();
    await expect(page.getByRole('region', { name: 'Session Library', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    await sessions.getByRole('button', { name: 'First destination', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Session Library', exact: true });
    await expect(picker).toContainText('First destination');
    await picker.getByRole('button', { name: 'Harbour Scene · scene', exact: true }).click();
    await picker
      .getByRole('button', { name: 'Add selected card to session', exact: true })
      .press('Enter');
    await expect(page.getByLabel('Session outline')).toContainText('Harbour Scene');
    await expect(picker.getByText('Already in session', { exact: true })).toBeVisible();
    await picker.getByRole('button', { name: 'Close session Library' }).click();
    await page
      .getByLabel('Session outline')
      .getByRole('button', { name: 'Harbour Scene', exact: true })
      .click();
    await page.getByLabel('Session Markdown notes').fill('Retain session note scope.');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    await picker.getByRole('button', { name: 'Search all', exact: true }).click();
    await picker.getByRole('button', { name: 'Harbour Scene · scene', exact: true }).click();
    await picker.getByRole('button', { name: 'View prepared card', exact: true }).click();
    await expect(page.getByLabel('Session Markdown notes')).toHaveValue(
      'Retain session note scope.',
    );
    await expect(page.getByRole('article', { name: 'Prepared source', exact: true })).toContainText(
      'Whole Scene details.',
    );
    await expect(page.locator('campaign-library,session-draft-chooser,.material-tabs')).toHaveCount(
      0,
    );
    await expect(page.getByRole('button', { name: /^Add section:/ })).toHaveCount(0);
    const saved = await (await request.get(`${f.base}/sessions/${f.one.id}`)).json();
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0].provenance.authored).toBeTruthy();
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.getByRole('button', { name: 'Add material', exact: true }).click();
      await expect(picker).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`ux-c1-${width}.png`), fullPage: true });
      await picker.getByRole('button', { name: 'Close session Library' }).click();
    }
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('late Library Add stays in its original session and cannot reopen it after a destination switch', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  try {
    await page.goto(`/?campaign=${f.campaign.id}&session=${f.one.id}&view=prepare`);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Session Library', exact: true });
    await picker.getByRole('button', { name: 'Harbour Scene · scene', exact: true }).click();
    await page.route(`**/sessions/${f.one.id}/library`, async (route) => {
      if (route.request().method() === 'POST') await gate;
      await route.continue();
    });
    const dispatched = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith(`/sessions/${f.one.id}/library`),
    );
    await picker.getByRole('button', { name: 'Add selected card to session', exact: true }).click();
    await dispatched;
    await page.getByLabel('Current session', { exact: true }).selectOption(f.two.id);
    await expect(
      page.getByRole('heading', { name: 'Second destination', exact: true }),
    ).toBeVisible();
    const finished = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith(`/sessions/${f.one.id}/library`),
    );
    release();
    expect((await finished).ok()).toBe(true);
    await expect(picker).toHaveCount(0);
    await expect(page.getByLabel('Current session', { exact: true })).toHaveValue(f.two.id);
    expect((await (await request.get(`${f.base}/sessions/${f.one.id}`)).json()).items).toHaveLength(
      1,
    );
    expect((await (await request.get(`${f.base}/sessions/${f.two.id}`)).json()).items).toHaveLength(
      0,
    );
  } finally {
    release();
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Add material resumes in unified Library after explicit session creation', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  try {
    await page.goto(`/?campaign=${f.campaign.id}&view=prepare`);
    await page.getByRole('button', { name: 'Add material', exact: true }).click();
    await page.getByLabel('New session title', { exact: true }).fill('Created destination');
    await page.getByRole('button', { name: 'Create session', exact: true }).click();
    const picker = page.getByRole('region', { name: 'Session Library', exact: true });
    await expect(picker).toContainText('Created destination');
    await expect(
      picker.getByRole('button', { name: 'Harbour Scene · scene', exact: true }),
    ).toBeVisible();
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
