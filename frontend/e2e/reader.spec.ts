import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const typed = (title: string, body: string) =>
  `---\nworkbench:\n  schema: 1\n  id: ${randomUUID()}\n  title: ${title}\n  type: reference\n  purpose: session\n  status: current\n  summary: Authored reader summary.\n---\n${body}`;

test('reads exact live and frozen subtrees with disclosure, outline and current portable material and rejects legacy archives', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  const root = await mkdtemp(join(tmpdir(), 'workbench-reader-'));
  const markdown = typed(
    'Long reader',
    `# Long reader
[Hidden local](#repeat-1)
[Section-only target](target.md#background)
[Missing](missing.md)
[External](https://example.test/reader)
## Quick reference
Visible quick facts.
## Read aloud
The exact words remain unchanged.
## Mechanics
Roll 2d6 and retain every exception.
## Background
Secret opening.
### Repeat
First hidden clue.
### Repeat
Second hidden needle.

${'Long hidden background paragraph. '.repeat(100)}
## Design notes
Authored design commentary.
## DM Notes
Unfamiliar commentary stays visible.
## Wide table
| A | B |
| - | - |
| ${'longtoken'.repeat(100)} | value |

\`\`\`text
${'code-token'.repeat(160)}
\`\`\`
![remote](https://example.invalid/image.png)
<script>window.readerInjected = true</script>
`,
  );
  await writeFile(join(root, 'long.md'), markdown);
  await writeFile(
    join(root, 'target.md'),
    typed(
      'Target card',
      '# Target\n## Quick reference\nOutside selected subtree.\n## Background\nCaptured target evidence.\n### Nested target\nNested captured text.\n## Other\nOutside selected end.',
    ),
  );
  await writeFile(
    join(root, 'legacy.md'),
    '# Legacy reader\n## Background\nLegacy background visible.\n## DM Notes\nLegacy unfamiliar.',
  );
  const errors: string[] = [],
    remote: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().includes('example.invalid')) remote.push(r.url());
  });
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Reader handover', directory: root } })
    ).json();
    const library = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    const sourceDocument = async (path: string) =>
      (
        await request.get(`/api/campaigns/${campaign.id}/sources/document`, {
          params: { capture: library.capture, path },
        })
      ).json();
    const doc = await sourceDocument('long.md'),
      target = await sourceDocument('target.md');
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Reader handover', objective: 'Preserve frozen references.' },
      })
    ).json();
    const add = async (path: string, section: string | null) => {
      const response = await request.post(
        `/api/campaigns/${campaign.id}/sessions/${session.id}/sources`,
        { data: { revision: session.revision, capture: library.capture, path, section } },
      );
      expect(response.ok()).toBe(true);
      session = await response.json();
    };
    for (let index = 0; index < 38; index++)
      await add('long.md', doc.sections.find((s: any) => s.heading === 'Mechanics').id);
    await add('long.md', null);
    const whole = session.items.at(-1);
    await add('target.md', target.sections.find((s: any) => s.heading === 'Background').id);
    const sectionOnly = session.items.at(-1);
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=library`);
    const shelf = page.getByRole('navigation', { name: 'Sources', exact: true });
    const live = page.getByRole('article', { name: 'Source reader', exact: true });
    await shelf.getByRole('button', { name: 'long.md', exact: true }).click();
    await expect(live.getByText('Secret opening.', { exact: true })).toBeHidden();
    await expect(
      live.getByText('Unfamiliar commentary stays visible.', { exact: true }),
    ).toBeVisible();
    await live.getByRole('button', { name: 'Quick reference', exact: true }).click();
    await expect(live.locator('h2:focus')).toHaveText('Quick reference');
    await live.getByText('Document outline', { exact: true }).click();
    const outline = live.getByRole('navigation', { name: 'Document outline', exact: true });
    await outline
      .getByRole('button', { name: 'Focus section: Mechanics', exact: true })
      .press('Enter');
    await expect(
      live.getByText('Roll 2d6 and retain every exception.', { exact: true }),
    ).toBeVisible();
    await expect(live.getByText('Visible quick facts.', { exact: true })).toBeHidden();
    await live.getByRole('button', { name: 'Show full document', exact: true }).click();
    await page.getByLabel('Search sources', { exact: true }).fill('Second hidden needle');
    await shelf.locator('.results button').click();
    await expect(live.locator('div:focus')).toContainText('Second hidden needle');
    await expect(live.getByText('Secret opening.', { exact: true })).toBeVisible();
    await live.getByRole('button', { name: 'Expand all', exact: true }).click();
    await expect(live.getByText('Authored design commentary.', { exact: true })).toBeVisible();
    await expect(live.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => 'readerInjected' in window)).toBe(false);
    expect(remote).toEqual([]);
    const setPanel = async (name: string, show: boolean) => {
      if (name === 'notes') {
        const button = page.getByRole('button', { name: /^(Hide|Show) notes$/ });
        if (((await button.getAttribute('aria-expanded')) === 'true') !== show)
          await button.click();
        await expect(button).toHaveAttribute('aria-expanded', String(show));
        return;
      }
      await page.getByRole('button', { name: 'View ▾', exact: true }).click();
      const action = page.getByRole('menuitem', { name: new RegExp(`^(Hide|Show) ${name}$`) });
      if ((await action.innerText()).startsWith('Hide') !== show) await action.click();
      else await page.keyboard.press('Escape');
    };
    const contents = page.getByLabel('Session outline');
    await contents.getByLabel('Find in session', { exact: true }).fill('Long reader');
    await contents.getByRole('button', { name: 'Long reader', exact: true }).click();
    const frozen = page.getByRole('article', { name: 'Prepared source', exact: true });
    await expect(frozen.getByText('Secret opening.', { exact: true })).toBeHidden();
    const relationships = frozen.getByLabel('Captured relationships');
    await expect(relationships.getByRole('button', { name: /missing.md/ })).toBeDisabled();
    await expect(relationships.getByRole('button', { name: /Target card/ })).toBeEnabled();
    await frozen.getByRole('link', { name: 'Hidden local', exact: true }).click();
    await expect(frozen.locator('h3:focus')).toHaveText('Repeat');
    await expect(frozen.getByText('Second hidden needle.', { exact: true })).toBeVisible();
    await frozen.getByRole('link', { name: 'Section-only target', exact: true }).click();
    await expect(frozen.locator('h2:focus')).toHaveText('Background');
    await expect(frozen.getByText('Captured target evidence.', { exact: true })).toBeVisible();
    await expect(frozen).not.toContainText('Outside selected subtree.');
    await expect(frozen.getByRole('button', { name: 'Quick reference', exact: true })).toHaveCount(
      0,
    );
    await contents.getByLabel('Find in session', { exact: true }).fill('Long reader');
    await contents.getByRole('button', { name: 'Long reader', exact: true }).click();
    await frozen.getByRole('link', { name: 'Missing', exact: true }).click();
    await expect(frozen.getByRole('status')).toContainText('outside the captured');
    await page.getByLabel('Item Markdown notes').fill('Durable **reader** reminder.');
    await expect(page.getByLabel('Session save status')).toHaveText('Saved');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByLabel('Item Markdown notes')).toHaveCount(0);
    await expect(page.locator('.notes-page')).toContainText('reader reminder');
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      // Read hides the library; exercise both remaining panel switches.
      for (const showContents of [true, false])
        for (const showNotes of [true, false]) {
          await setPanel('session contents', showContents);
          await setPanel('notes', showNotes);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await expect(frozen).toBeVisible();
        }
      await page.screenshot({ path: testInfo.outputPath(`reader-${width}.png`) });
    }
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(page.locator('.read-toolbar')).toHaveCount(0);
    await setPanel('session contents', true);
    await setPanel('notes', true);
    await contents.getByLabel('Find in session', { exact: true }).fill('');
    await page.getByRole('button', { name: 'View ▾', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Focus source', exact: true }).click();
    await expect(contents).toBeHidden();
    await expect(page.locator('.notes-page')).toBeHidden();
    await page.getByRole('button', { name: 'View ▾', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Restore panels', exact: true }).click();
    await expect(contents).toBeVisible();
    // Focus the live reader as well: hiding its browsing shelf must keep its text mounted.
    await page.getByRole('button', { name: 'Add source material', exact: true }).click();
    await page.getByRole('button', { name: 'View ▾', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Focus source', exact: true }).click();
    await expect(shelf).toBeHidden();
    await expect(live).toBeVisible();
    await expect(live.getByText('Visible quick facts.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View ▾', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Restore panels', exact: true }).click();
    await contents.getByRole('button', { name: 'Long reader', exact: true }).click();
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      for (const showLibrary of [false, true])
        for (const showContents of [false, true])
          for (const showNotes of [false, true]) {
            for (const [name, show] of [
              ['library', showLibrary],
              ['session contents', showContents],
              ['notes', showNotes],
            ] as const) {
              await setPanel(name, show);
            }
            await expect(frozen).toBeVisible();
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
          }
      await page.screenshot({ path: testInfo.outputPath(`prepare-reader-${width}.png`) });
    }
    // Refresh, rename, and deletion affect the live library while frozen text/metadata stay exact.
    await rename(join(root, 'long.md'), join(root, 'renamed.md'));
    await writeFile(join(root, 'renamed.md'), typed('Changed card', '# Changed\nNew facts.'));
    await request.post(`/api/campaigns/${campaign.id}/sources/refresh`);
    await rm(join(root, 'renamed.md'));
    await rm(join(root, 'target.md'));
    await request.post(`/api/campaigns/${campaign.id}/sources/refresh`);
    await page.reload();
    await contents.getByLabel('Find in session', { exact: true }).fill('Long reader');
    await contents.getByRole('button', { name: 'Long reader', exact: true }).click();
    await frozen.getByRole('button', { name: 'Expand all', exact: true }).click();
    await expect(frozen).toContainText('Secret opening.');
    await expect(frozen).toContainText('Authored reader summary.');
    const persisted = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)
    ).json();
    expect(persisted.items.find((i: any) => i.id === whole.id).markdown).toBe(markdown);
    expect(persisted.items.find((i: any) => i.id === sectionOnly.id).markdown).not.toContain(
      'Outside selected',
    );
    const archive = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions/export`, {
        data: { sessions: [session.id] },
      })
    ).json();
    const importedResponse = await request.post(`/api/campaigns/${campaign.id}/sessions/import`, {
      data: archive,
    });
    expect(importedResponse.ok()).toBe(true);
    const imported = (await importedResponse.json()).sessions[0];
    await page.goto(`/?campaign=${campaign.id}&session=${imported.id}&mode=read&view=prepare`);
    await page
      .locator('.read-toolbar')
      .getByLabel('Find in session', { exact: true })
      .fill('Long reader');
    await page
      .locator('read-card-table')
      .getByRole('article', { name: 'Read: Long reader', exact: true })
      .click();
    await frozen.getByRole('button', { name: 'Expand all', exact: true }).click();
    await expect(frozen).toContainText('Second hidden needle.');
    await expect(page.locator('.notes-page')).toContainText('reader reminder');
    const expected = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${imported.id}`)
    ).json();
    const rendered = await (
      await request.get(`/api/campaigns/${campaign.id}/sessions/${imported.id}/rendered`)
    ).json();
    await writeFile(
      testInfo.outputPath('handover.json'),
      JSON.stringify({ campaign: campaign.id, session: imported.id, expected, rendered }),
    );
    const legacyArchive = {
      ...archive,
      version: 1,
      sessions: archive.sessions.map(({ table, ...s }: any) => ({
        ...s,
        title: 'Legacy import',
        items: s.items.map(({ capturedSource, ...item }: any) => {
          const { kind, authored, ...provenance } = item.provenance;
          return { ...item, provenance };
        }),
      })),
    };
    const legacy = await request.post(`/api/campaigns/${campaign.id}/sessions/import`, {
      data: legacyArchive,
    });
    expect(legacy.status()).toBe(400);
    expect(errors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
