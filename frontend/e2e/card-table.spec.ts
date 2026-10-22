import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

test('Read keeps a durable table and used pile separate from preparation', async ({
  page,
  request,
}, info) => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-card-table-'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    for (const title of ['One', 'Two', 'Three', 'Four'])
      await writeFile(
        join(root, `${title}.md`),
        `---\nworkbench:\n  schema: 1\n  id: '${randomUUID()}'\n  title: ${title}\n  type: ${title === 'Two' ? 'npc' : title === 'Three' ? 'location' : 'scene'}\n  purpose: session\n  status: current\n  tags: [harbour]\n  summary: Summary for ${title}. ${title === 'Three' ? 'Every clue remains available. '.repeat(24) : ''}\n---\n# ${title}\nFull frozen text for ${title}.\n\n## Mechanics\nA useful detail.`,
      );
    const campaign = await (
      await request.post('/api/campaigns', {
        data: { name: 'Card table fixture', directory: root },
      })
    ).json();
    const library = await (
      await request.post(`/api/campaigns/${campaign.id}/sources/refresh`)
    ).json();
    let session = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions`, {
        data: { title: 'Table session', objective: '' },
      })
    ).json();
    const endpoint = `/api/campaigns/${campaign.id}/sessions/${session.id}`;
    for (const title of ['One', 'Two', 'Three'])
      session = await (
        await request.post(`${endpoint}/sources`, {
          data: {
            revision: session.revision,
            capture: library.capture,
            path: `${title}.md`,
            section: null,
          },
        })
      ).json();
    const [one, two, three] = session.items.map((i: { id: string }) => i.id);
    const url = `/?campaign=${campaign.id}&session=${session.id}&view=prepare&mode=play`;
    await page.goto(url);
    const table = page.locator('read-card-table');
    const entries = table.locator('.shelf > .entry');
    const entry = (id: string) => table.locator(`.shelf > [data-item-id="${id}"]`);
    const saved = async () => {
      await expect(page.getByLabel('Session save status')).toHaveText('Saved');
      return {
        ...(await (await request.get(endpoint)).json()),
        table: await (await request.get(`${endpoint}/workspace`)).json(),
      };
    };
    const drag = async (
      source: import('@playwright/test').Locator,
      target: import('@playwright/test').Locator,
    ) => {
      await source.scrollIntoViewIfNeeded();
      const from = (await source.boundingBox())!;
      const to = (await target.boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 3 });
      await expect(page.locator('.cdk-drag-preview')).toBeVisible();
      await page.mouse.move(to.x + to.width * 0.75, to.y + Math.min(to.height / 2, 180), {
        steps: 25,
      });
      await page.mouse.up();
    };
    await expect(entries).toHaveCount(3);
    await expect(entries.first()).toContainText('One');
    await expect(entry(one)).toContainText('Summary for One.');
    await expect(entry(one)).toContainText('harbour');
    expect(
      await entry(one)
        .locator('playing-card')
        .evaluate((node) => Math.round(node.getBoundingClientRect().width)),
    ).toBe(320);
    expect((await entry(one).boundingBox())!.y).toBeLessThan(180);
    await expect(
      page
        .getByRole('navigation', { name: 'Workspace mode' })
        .getByRole('button', { name: 'Play', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Source library status')).toHaveCount(0);
    await expect(table.locator('.tools, .pile-action')).toHaveCount(0);
    // Clicking artwork selects directly; selection is drawn on the card face.
    await entry(two).locator('img').click();
    await expect(page.locator('.source-page')).toContainText('Full frozen text for Two.');
    await expect(entry(two).locator('article')).toHaveAttribute('aria-current', 'true');
    expect(
      await entry(two)
        .locator('article')
        .evaluate((node) => getComputedStyle(node).borderColor),
    ).toBe('rgb(232, 191, 101)');
    // Drop the whole card into the always-visible pile; its text stays open.
    await drag(
      entry(two).locator('img'),
      table.getByLabel('Used cards drop target', { exact: true }),
    );
    await expect(entries).toHaveCount(2);
    await expect(page.locator('.source-page')).toContainText('Full frozen text for Two.');
    await entry(three)
      .getByRole('button', { name: 'Card actions: Three', exact: true })
      .press('Enter');
    expect(
      await page.getByRole('menu').evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toBe('rgb(32, 55, 42)');
    expect(
      await page
        .getByRole('menuitem', { name: 'Move left', exact: true })
        .evaluate((node) => getComputedStyle(node).color),
    ).toBe('rgb(238, 232, 215)');
    await page.getByRole('menuitem', { name: 'Move left', exact: true }).press('Enter');
    let state = await saved();
    expect(state.items.map((i: { id: string }) => i.id)).toEqual([one, two, three]);
    expect({ active: state.table.active, used: state.table.used }).toEqual({
      active: [three, one],
      used: [two],
    });
    await page.getByLabel('Card group', { exact: true }).selectOption('npc');
    await expect(entries).toHaveCount(0);
    await expect(page.locator('.source-page')).toContainText('Full frozen text for Two.');
    await table.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await expect(table.locator('.used-tray .entry')).toHaveCount(1);
    await page
      .locator('.read-toolbar')
      .getByRole('searchbox', { name: 'Find in session', exact: true })
      .fill('missing card');
    await expect(table.locator('.used-tray .entry')).toHaveCount(0);
    await page
      .locator('.read-toolbar')
      .getByRole('searchbox', { name: 'Find in session', exact: true })
      .fill('');
    await page.getByLabel('Card group', { exact: true }).selectOption('');
    await table.getByRole('button', { name: 'Close used cards', exact: true }).click();
    expect(await saved()).toMatchObject({ table: { active: [three, one], used: [two] } });
    await page.reload();
    await expect(entries.first()).toContainText('Three');
    await table.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    const used = table.getByRole('complementary', { name: 'Used cards tray', exact: true });
    await used.getByRole('article', { name: 'Read: Two', exact: true }).press('Enter');
    await expect(page.locator('.source-page')).toContainText('Full frozen text for Two.');
    // Drag back from the tray to restore at the front, irrespective of the drop position.
    await drag(used.locator('img'), entries.first());
    await expect(entries.first()).toContainText('Two');
    await table.getByRole('button', { name: 'Close used cards', exact: true }).click();
    await saved();
    // Reorder by dragging the artwork, with no handle or external controls.
    await drag(entry(two).locator('img'), entry(three));
    await expect(entries.first()).toContainText('Three');
    state = await saved();
    expect(state.table.active).toEqual([three, two, one]);
    // On-card menus provide keyboard alternatives for both piles.
    await entry(one).getByRole('button', { name: 'Card actions: One', exact: true }).press('Enter');
    await page.getByRole('menuitem', { name: 'Mark used', exact: true }).press('Enter');
    await table.getByRole('button', { name: 'Used cards (1)', exact: true }).click();
    await used.getByRole('button', { name: 'Card actions: One', exact: true }).press('Enter');
    await page.getByRole('menuitem', { name: 'Return to table', exact: true }).press('Enter');
    await table.getByRole('button', { name: 'Close used cards', exact: true }).click();
    await expect(entries.first()).toContainText('One');
    await saved();
    await entry(three).getByRole('article', { name: 'Read: Three', exact: true }).press('Space');
    await expect(page.locator('.source-page')).toContainText('Full frozen text for Three.');
    const summary = entry(three).locator('.card-text');
    await summary.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => summary.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    expect((await saved()).table.active).toEqual([one, three, two]);
    // Read keeps management actions available in compact menus.
    await page.getByRole('button', { name: 'More session actions', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Session details', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Session details', exact: true })).toContainText(
      'No session objective.',
    );
    await page.getByRole('button', { name: 'Close session details', exact: true }).click();
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width, height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: info.outputPath(`card-table-${width}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'Prepare', exact: true }).click();
    await expect(page.getByLabel('Session outline').locator('ol li').first()).toContainText('One');
    state = await saved();
    const currentLibrary = await (
      await request.get(`/api/campaigns/${campaign.id}/sources`)
    ).json();
    const addition = await request.post(`${endpoint}/sources`, {
      data: {
        revision: state.revision,
        capture: currentLibrary.capture,
        path: 'Four.md',
        section: null,
      },
    });
    expect(addition.ok(), await addition.text()).toBe(true);
    state = await addition.json();
    const four = state.items.at(-1).id;
    await page.goto(url);
    await expect(entries.first()).toContainText('Four');
    expect((await saved()).table.active).toEqual([four, one, three, two]);
    const archive = await (
      await request.post(`/api/campaigns/${campaign.id}/sessions/export`, {
        data: { sessions: [session.id] },
      })
    ).json();
    expect(archive.version).toBe(6);
    expect(archive.workspaces[0].workspace.active).toEqual([four, one, three, two]);
    expect(errors).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
