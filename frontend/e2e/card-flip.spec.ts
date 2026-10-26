import { test, expect, Locator } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function flip(card: Locator, text: string) {
  await card.getByRole('button', { name: 'Flip to back', exact: true }).click();
  await expect(card.locator('article')).toHaveAttribute('data-side', 'back');
  await expect(card.getByRole('img', { name: /^Card back:/ })).toBeVisible();
  await expect(card.locator('svg')).toContainText(text);
  await expect(card.getByRole('button', { name: 'Open full document' })).toHaveCount(0);
  await expect(card.locator('artwork-image')).toHaveCount(0);
}

test('flips in all six views, resets on changed views and preserves frozen recovery content', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'card-flip-'));
  try {
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Flip cards', directory: root } })
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
            backText: 'Secret <b>literal</b>\nProtect the harbour.',
            body: '# Mira\nFull background.',
            path: 'mira.md',
          },
        },
      })
    ).json();
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Flip session', objective: '' },
      })
    ).json();
    const entry = (
      await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json()
    ).entries.find((e: any) => e.draft === draft.id);
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
    session = (await added.json()).session;
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}&session=${session.id}`);
    let card = page.locator('writing-workspace playing-card');
    await flip(card, 'Secret <b>literal</b>');
    await expect(card.locator('script, b')).toHaveCount(0);
    await page.getByLabel('Card back text', { exact: true }).fill('Changed working back.');
    await expect(card.locator('article')).toHaveAttribute('data-side', 'front');
    await expect(page.getByLabel('Draft save status')).toHaveText('Saved');
    await flip(card, 'Changed working back.');
    for (const width of [1280, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.screenshot({ path: info.outputPath(`flip-back-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/library?campaign=${campaign.id}&session=${session.id}`);
    await page
      .getByRole('button', { name: /Mira.*npc/ })
      .first()
      .click();
    card = page.locator('unified-library playing-card');
    await page
      .getByRole('navigation', { name: 'Library reading mode' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await flip(card, 'Changed working back.');
    await card.getByRole('button', { name: 'Flip to front' }).click();
    await expect(card.locator('article')).toHaveAttribute('data-side', 'front');
    await card.getByRole('button', { name: 'Open full document' }).click();
    await page
      .getByRole('navigation', { name: 'Library reading mode' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await expect(card.locator('article')).toHaveAttribute('data-side', 'front');
    // Contextual reference panel is shared by Write/Prepare/Play.
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}&session=${session.id}`);
    await page
      .getByRole('navigation', { name: 'Supporting panel modes' })
      .getByRole('button', { name: 'Library', exact: true })
      .click();
    await page
      .locator('library-references')
      .getByRole('button', { name: /Mira.*npc/ })
      .click();
    await flip(page.locator('library-references playing-card'), 'Changed working back.');
    // Frozen Prepare uses the earlier revision.
    await page.goto(`/?campaign=${campaign.id}&session=${session.id}&view=prepare`);
    await page
      .getByRole('navigation', { name: 'Prepared presentation' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    card = page.locator('.source-page playing-card');
    await flip(card, 'Secret <b>literal</b>');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    card = page.locator('play-tabletop .shelf playing-card');
    await flip(card, 'Secret <b>literal</b>');
    await expect(page.locator('play-tabletop playing-card.selected')).toHaveCount(0);
    await expect(page.locator('play-tabletop .shelf playing-card article')).toHaveAttribute(
      'data-side',
      'back',
    );
    await page.reload();
    await expect(page.locator('play-tabletop .shelf playing-card article')).toHaveAttribute(
      'data-side',
      'front',
    );
    // Detached recovery keeps its own snapshot even after the source directory is absent.
    const backup = await request.get(`/api/writing-recovery/campaigns/${campaign.id}/archive`);
    const archive = await backup.json();
    await page.goto('/writing/recovery');
    await page
      .getByLabel('Restore Writing archive', { exact: true })
      .setInputFiles({
        name: 'flip.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(archive)),
      });
    await page
      .getByRole('region', { name: 'Recovered records' })
      .getByRole('button', { name: /Mira · npc · revision/ })
      .click();
    await flip(page.locator('writing-recovery playing-card'), 'Changed working back.');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('captured Source backs, failed layouts and missing fonts remain readable', async ({
  page,
  request,
}) => {
  const root = await mkdtemp(join(tmpdir(), 'card-flip-source-'));
  try {
    await writeFile(
      join(root, 'source.md'),
      `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: Source card\n  type: npc\n  purpose: session\n  status: current\n  summary: Keeper\n  tags: []\n  backText: |\n    Secret source back.\n---\n# Source\nBody`,
    );
    const campaign = await (
      await request.post('/api/campaigns', { data: { name: 'Source flip', directory: root } })
    ).json();
    await request.post(`/api/campaigns/${campaign.id}/sources/refresh`);
    await page.goto(`/library?campaign=${campaign.id}`);
    await page
      .getByRole('button', { name: /Source card.*npc/ })
      .first()
      .click();
    const card = page.locator('unified-library playing-card');
    await page
      .getByRole('navigation', { name: 'Library reading mode' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await flip(card, 'Secret source back.');
    expect(await card.locator('article').evaluate((el) => getComputedStyle(el).animationName)).toBe(
      'none',
    );
    await page.route('**/api/card-layout', (route) => route.abort());
    await page.reload();
    await page
      .getByRole('button', { name: /Source card.*npc/ })
      .first()
      .click();
    await page
      .getByRole('navigation', { name: 'Library reading mode' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await expect(card).toContainText('Card layout unavailable.');
    await card.getByRole('button', { name: 'Read all front text' }).click();
    await expect(page.getByRole('dialog', { name: 'Complete card side text' })).toContainText(
      'Source card',
    );
    await page.getByRole('button', { name: 'Close card text' }).click();
    await card.getByRole('button', { name: 'Flip to back' }).press('Enter');
    await card.getByRole('button', { name: 'Read all back text' }).click();
    await expect(page.getByRole('dialog', { name: 'Complete card side text' })).toContainText(
      'Secret source back.',
    );
    await page.keyboard.press('Escape');
    await expect(card.getByRole('button', { name: 'Read all back text' })).toBeFocused();
    await page.unroute('**/api/card-layout');
    await page.route('**/fonts/*.ttf', (route) => route.abort());
    await page.reload();
    await page
      .getByRole('button', { name: /Source card.*npc/ })
      .first()
      .click();
    await page
      .getByRole('navigation', { name: 'Library reading mode' })
      .getByRole('button', { name: 'Card', exact: true })
      .click();
    await expect(card).toContainText('Card layout unavailable.');
    await card.getByRole('button', { name: 'Read all front text' }).click();
    await expect(page.getByRole('dialog', { name: 'Complete card side text' })).toContainText(
      'Source card',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
