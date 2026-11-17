import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('CD5 optional stats author alongside back text, freeze, remain private, reveal and read completely on touch', async ({ page, request, browser }, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(10000);
  const root = await mkdtemp(join(tmpdir(), 'stats-ui-'));
  const tabletContext = await browser.newContext({ viewport: { width: 800, height: 1100 }, hasTouch: true });
  try {
    const campaign = await (await request.post('/api/campaigns', { data: { name: 'Stats', directory: root } })).json();
    let draft = await (await request.post(`/api/campaigns/${campaign.id}/drafts`, { data: { type: 'npc', template: false } })).json();
    draft = await (await request.put(`/api/campaigns/${campaign.id}/drafts/${draft.id}`, { data: { revision: draft.revision, fields: {
      ...draft.fields, title: 'Stat keeper', path: 'keeper.md', backText: 'Keeper information.', body: '# Private source',
    } } })).json();
    await page.goto(`/writing?campaign=${campaign.id}&draft=${draft.id}`);
    await page.getByRole('navigation', { name: 'Editing tabs' }).getByRole('button', { name: 'Card', exact: true }).click();
    const editor = page.locator('stats-editor');
    await editor.locator('summary').click();
    await editor.getByRole('button', { name: 'Add stats', exact: true }).click();
    await editor.getByLabel('AC', { exact: true }).fill('17');
    await editor.getByLabel('HP', { exact: true }).fill('59 (8d8 + 23)');
    await editor.getByLabel('STR score', { exact: true }).fill('8');
    await editor.getByLabel('STR modifier', { exact: true }).fill('-1');
    await editor.getByLabel('STR save', { exact: true }).fill('+2');
    await editor.getByRole('button', { name: 'Add stat section', exact: true }).click();
    await editor.getByLabel('Section title', { exact: true }).fill('Actions');
    await editor.getByRole('button', { name: 'Add entry', exact: true }).click();
    await editor.getByLabel('Entry name (optional)', { exact: true }).fill('Watchful');
    const fullText = 'CD5_SECRET_TRAIT ' + 'A complete detailed description. '.repeat(70);
    await editor.getByLabel('Entry text', { exact: true }).fill(fullText);
    await editor.getByRole('button', { name: 'Add spellcasting', exact: true }).click();
    await editor.getByLabel('Spellcasting ability', { exact: true }).fill('Wisdom');
    await editor.getByLabel('Spell save DC (optional)', { exact: true }).fill('17');
    const saved = page.waitForResponse(async r => {
      if (!r.url().endsWith(`/drafts/${draft.id}`) || r.request().method() !== 'PUT' || !r.ok()) return false;
      const d = await r.json(); return d.fields.stats?.sections?.[0]?.entries?.[1]?.spellcasting?.spells === 'At will: Light';
    });
    await editor.getByLabel('Spells', { exact: true }).fill('At will: Light');
    draft = await (await saved).json();
    expect(draft.fields.backText).toBe('Keeper information.');
    await page.reload();
    const card = page.locator('writing-workspace playing-card');
    await card.getByRole('button', { name: 'Flip to back' }).click();
    await expect(card.locator('article')).toHaveAttribute('data-side', 'back');
    await expect(card.locator('svg text[data-field="stats.key"]').first()).toContainText('AC: 17');
    await expect(card.locator('svg text[data-field="continuation"]')).toHaveText('…');
    await expect(card.locator('svg text[data-field="stats.entry"]')).toHaveCount(0);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(card.locator('svg')).toBeVisible();
      expect(await card.locator('article').evaluate(el => [...el.querySelectorAll('*')].some(child => ['auto','scroll'].includes(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight))).toBe(false);
      await card.screenshot({ path: info.outputPath(`stats-back-${width}.png`) });
    }
    await card.getByRole('button', { name: 'Details', exact: true }).click();
    let details = page.getByRole('dialog', { name: 'Card details', exact: true });
    await expect(details).toContainText(fullText.trim());
    await expect(details).toContainText('At will: Light');
    await details.getByRole('button', { name: 'Close details' }).press('Escape');
    await expect(details).toBeHidden();
    await expect(card.getByRole('button', { name: 'Details', exact: true })).toBeFocused();
    let session = await (await request.post(`/api/campaigns/${campaign.id}/sessions`, { data: { title: 'Stats session', objective: '' } })).json();
    const entry = (await (await request.get(`/api/campaigns/${campaign.id}/cards`)).json()).entries.find((v: any) => v.draft === draft.id);
    const added = await request.post(`/api/campaigns/${campaign.id}/sessions/${session.id}/library`, { data: { revision: session.revision, key: entry.key, capture: null, draft: draft.id, draftRevision: draft.revision } });
    expect(added.ok(), await added.text()).toBe(true); session = (await added.json()).session;
    expect(session.items[0].stats.ac).toBe('17');
    const prefix = `/api/campaigns/${campaign.id}/sharing`;
    const preview = await (await request.post(`${prefix}/preview`, { data: { session: session.id, item: session.items[0].id } })).json();
    const distribution = await request.post(`${prefix}/cards`, { data: { operation: crypto.randomUUID(), session: session.id, item: session.items[0].id, fingerprint: preview.fingerprint, mode: 'INVENTORY', recipient: null } });
    expect(distribution.ok(), await distribution.text()).toBe(true);
    const shared = await distribution.json();
    const player = await (await request.post(`${prefix}/players`, { data: { displayName: 'Stats reader' } })).json();
    const gateway = await (await request.post('/api/gateway/enable', { data: {} })).json();
    const invite = await (await request.post(`${prefix}/players/${player.id}/pairing`, { data: {} })).json();
    const tablet = await tabletContext.newPage();
    await tablet.goto(`http://127.0.0.1:${gateway.port}/player/pair#token=${invite.token}`);
    const playerCard = tablet.locator('shared-card-tray .entry playing-card');
    await playerCard.getByRole('button', { name: 'Flip to back' }).tap();
    await expect(playerCard.locator('svg')).toContainText('Back not revealed');
    await expect(tablet.locator('body')).not.toContainText('CD5_SECRET_TRAIT');
    await expect(playerCard.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0);
    const revealed = await request.post(`${prefix}/cards/${shared.id}/reveal-back`, { data: {} });
    expect(revealed.ok(), await revealed.text()).toBe(true);
    await tablet.reload();
    await playerCard.getByRole('button', { name: 'Details', exact: true }).tap();
    details = tablet.getByRole('dialog', { name: 'Card details', exact: true });
    await expect(details).toContainText(fullText.trim());
    await expect(details).toContainText('Wisdom');
    await expect(details).not.toContainText('Private source');
    await tablet.screenshot({ path: info.outputPath('stats-touch-details.png'), fullPage: true });
    await details.getByRole('button', { name: 'Close details', exact: true }).tap();
    // Explicitly clearing optional stats preserves the independently authored back text.
    const cleared = await request.put(`/api/campaigns/${campaign.id}/drafts/${draft.id}`, { data: { revision: draft.revision, fields: { ...draft.fields, stats: null } } });
    expect(cleared.ok(), await cleared.text()).toBe(true);
    expect((await cleared.json()).fields.backText).toBe('Keeper information.');
    expect((await (await request.get(`/api/campaigns/${campaign.id}/sessions/${session.id}`)).json()).items[0].stats.ac).toBe('17');
  } finally { await tabletContext.close(); await rm(root, { recursive: true, force: true }); }
});
