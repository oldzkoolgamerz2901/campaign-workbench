import { Page, Locator } from '@playwright/test';
export async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + 80);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 15, from.y + 85, { steps: 4 });
  await target.scrollIntoViewIfNeeded();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}
