import { test, expect, APIRequestContext } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function fixture(request: APIRequestContext) {
  const root = await mkdtemp(join(tmpdir(), 'workbench-ux-c7-'));
  const json = async (method: 'get' | 'post' | 'put', url: string, data?: unknown) => {
    const response = await request[method](url, { data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await writeFile(
    join(root, 'target.md'),
    `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: Target\n  type: scene\n  purpose: session\n  status: current\n  tags: []\n---\n# Source heading\nOriginal Source evidence.`,
  );
  await writeFile(
    join(root, 'witness.md'),
    '# Witness\nWitness source text.\n[Effective repeat](target.md#repeat-1) [Only target](only.md#only) [Old heading](target.md#source-heading)',
  );
  const campaign = await json('post', '/api/campaigns', { name: 'UX-C7 links', directory: root });
  const base = `/api/campaigns/${campaign.id}`;
  const capture = (await json('post', `${base}/sources/refresh`)).capture;
  const associated = await json('post', `${base}/cards/edit-source`, {
    capture,
    path: 'target.md',
  });
  const target = await json('put', `${base}/drafts/${associated.id}`, {
    revision: associated.revision,
    fields: {
      ...associated.fields,
      title: 'Effective target',
      path: 'working/target.md',
      body: 'Introduction before the first heading.\n# Effective\n## Repeat\nFirst effective evidence.\n## Repeat\nSecond effective evidence.',
    },
  });
  const only = await json('post', `${base}/drafts`, { type: 'npc', template: false });
  await json('put', `${base}/drafts/${only.id}`, {
    revision: only.revision,
    fields: {
      ...only.fields,
      title: 'Only target',
      path: 'only.md',
      body: '# Only\nOnly target evidence.',
    },
  });
  const draft = await json('post', `${base}/drafts`, { type: 'scene', template: false });
  const origin = await json('put', `${base}/drafts/${draft.id}`, {
    revision: draft.revision,
    fields: {
      ...draft.fields,
      title: 'Origin',
      path: 'origin.md',
      body: '# Origin\nOrigin reading context.\n[Associated heading](target.md#repeat-1) [Placement heading](working/target.md#repeat-1) [Draft-only heading](only.md#only) [Self](origin.md#origin)',
    },
  });
  return { root, campaign, base, capture, target, origin, json };
}

test('Source and Write readers follow effective Draft headings and preserve research return while rejecting stale revisions', async ({
  page,
  request,
}, info) => {
  const f = await fixture(request);
  const reader = page.getByRole('article', { name: 'Selected Library document', exact: true });
  try {
    await page.goto(`/library?campaign=${f.campaign.id}`);
    await page
      .locator('.catalogue')
      .getByRole('button', { name: /witness.md/ })
      .click();
    await reader.getByRole('link', { name: 'Effective repeat', exact: true }).click();
    await expect(reader.locator('[data-section]:has(h2:focus)')).toContainText(
      'Second effective evidence.',
    );
    await expect(reader).not.toContainText('Original Source evidence.');
    await page
      .locator('.catalogue')
      .getByRole('button', { name: /witness.md/ })
      .click();
    await reader.getByRole('link', { name: 'Old heading', exact: true }).click();
    await expect(page.getByText(/Missing heading source-heading/)).toBeVisible();
    await expect(reader).toContainText('Witness source text.');
    await reader.getByRole('link', { name: 'Only target', exact: true }).click();
    await expect(reader).toContainText('Only target evidence.');

    await page.goto(`/writing?campaign=${f.campaign.id}&draft=${f.origin.id}`);
    await page.getByRole('button', { name: 'Full document', exact: true }).click();
    const preview = page.getByRole('region', { name: 'Draft preview', exact: true });
    await preview.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect(page).toHaveURL(/\/library\?/);
    await expect(reader.locator('[data-section]:has(h2:focus)')).toContainText(
      'Second effective evidence.',
    );
    await page.getByRole('button', { name: 'Return to Write', exact: true }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Origin');
    await expect(page.getByRole('button', { name: 'Full document', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.waitForLoadState('networkidle');
    const report = await f.json('post', `${f.base}/drafts/${f.origin.id}/export-inspection`, {
      revision: f.origin.revision,
      capture: f.capture,
    });
    expect(report.links[0].kind).toBe('draft');
    expect(report.targetRevisions[f.target.id]).toBe(f.target.revision);
    expect(report.warnings.join(' ')).toContain('captured campaign file differs');
    await f.json('put', `${f.base}/drafts/${f.target.id}`, {
      revision: f.target.revision,
      fields: { ...f.target.fields, body: `${f.target.fields.body}\nNew target revision.` },
    });
    await preview.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect(page.getByText(/Link target changed/)).toBeVisible();
    await expect(page).toHaveURL(/\/writing\?/);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Origin');
    const stale = await request.post(`${f.base}/drafts/${f.origin.id}/exports`, {
      data: {
        revision: f.origin.revision,
        capture: f.capture,
        fingerprint: report.fingerprint,
        acknowledgeWarnings: true,
      },
    });
    expect(stale.status()).toBe(409);
    await page.reload();
    await page.getByRole('button', { name: 'Full document', exact: true }).click();
    await preview.getByRole('link', { name: 'Placement heading', exact: true }).click();
    await expect(reader).toContainText('New target revision.');
    await page.screenshot({ path: info.outputPath('effective-alias-heading.png') });
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('Library retains the origin on stale or genuinely conflicting links and reloads deliberately', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  const reader = page.getByRole('article', { name: 'Selected Library document', exact: true });
  try {
    await page.goto(`/library?campaign=${f.campaign.id}`);
    await page
      .locator('.catalogue')
      .getByRole('button', { name: /^Origin / })
      .click();
    await expect(reader).toContainText('Origin reading context.');
    await f.json('put', `${f.base}/drafts/${f.target.id}`, {
      revision: f.target.revision,
      fields: { ...f.target.fields, body: `${f.target.fields.body}\nLater evidence.` },
    });
    await reader.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect(page.getByText(/Link target changed/)).toBeVisible();
    await expect(reader).toContainText('Origin reading context.');
    await reader.getByRole('button', { name: 'Reload selected document', exact: true }).click();
    await reader.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect(reader).toContainText('Later evidence.');
    await page
      .locator('.catalogue')
      .getByRole('button', { name: /^Origin / })
      .click();
    await expect(reader).toContainText('Origin reading context.');
    const competing = await f.json('post', `${f.base}/drafts`, { type: 'scene', template: false });
    await f.json('put', `${f.base}/drafts/${competing.id}`, {
      revision: competing.revision,
      fields: {
        ...competing.fields,
        title: 'Independent claimant',
        path: 'target.md',
        body: '# Repeat',
      },
    });
    await reader.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('conflicting');
    await expect(reader).toContainText('Origin reading context.');
    await page
      .locator('.catalogue')
      .getByRole('button', { name: /^Origin / })
      .click();
    await reader.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect(reader.getByText(/Target unavailable.*identit/)).toBeVisible();
    await expect(reader).toContainText('Origin reading context.');
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test('a delayed Write link lookup cannot navigate after selecting a different Draft', async ({
  page,
  request,
}) => {
  const f = await fixture(request);
  let release = () => {};
  try {
    await page.goto(`/writing?campaign=${f.campaign.id}&draft=${f.origin.id}`);
    await page.getByRole('button', { name: 'Full document', exact: true }).click();
    const preview = page.getByRole('region', { name: 'Draft preview', exact: true });
    await expect(
      preview.getByRole('link', { name: 'Associated heading', exact: true }),
    ).toBeVisible();
    let held = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**${f.base}/cards?**`, async (route) => {
      if (!held) {
        held = true;
        await gate;
      }
      await route.continue();
    });
    await preview.getByRole('link', { name: 'Associated heading', exact: true }).click();
    await expect.poll(() => held).toBe(true);
    await page
      .getByRole('complementary', { name: 'Writing library', exact: true })
      .getByRole('button', { name: /Only target/ })
      .click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Only target');
    const completed = page.waitForResponse((response) =>
      response.url().includes(`${f.base}/cards?`),
    );
    release();
    await completed;
    await page.waitForLoadState('networkidle');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Only target');
    await expect(page).toHaveURL(/\/writing\?/);
    await expect(
      page.getByRole('article', { name: 'Selected Library document', exact: true }),
    ).toHaveCount(0);
  } finally {
    release();
    await rm(f.root, { recursive: true, force: true });
  }
});
