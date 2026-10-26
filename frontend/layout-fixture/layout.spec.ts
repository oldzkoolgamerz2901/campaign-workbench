import { expect, test } from '@playwright/test';
import { CardLayout } from '../src/app/shared/card-layout/card-layout';

test('actual backend layout fits the browser at card widths without changing capacity', async ({
  page,
}, info) => {
  await page.goto('/');
  const fixtures: { name: string; layout: CardLayout }[] = await (
    await page.request.get('/fixtures/layouts.json')
  ).json();
  expect(fixtures.length).toBeGreaterThan(5);
  await expect(page.locator('section')).toHaveCount(fixtures.length);
  // Workspace typography must not silently change canonical capacity.
  await page.locator('section').evaluateAll((sections) =>
    sections.forEach((section) => {
      section.style.fontWeight = '700';
      section.style.fontStyle = 'italic';
      section.style.letterSpacing = '3px';
      section.style.wordSpacing = '6px';
    }),
  );
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const width of [320, 243, 200]) {
      await page
        .locator('article')
        .evaluateAll(
          (nodes, width) => nodes.forEach((node) => (node.style.width = `${width}px`)),
          width,
        );
      for (const fixture of fixtures)
        for (const side of ['front', 'back'] as const) {
          const renderer = page.locator(
            `[data-case="${fixture.name}"] [data-side="${side}"] card-layout-renderer`,
          );
          if (!fixture.layout[side].fits) {
            await expect(renderer.getByRole('status')).toHaveText(
              'Card layout unavailable: non-fitting',
            );
            await expect(renderer.locator('svg')).toBeHidden();
            continue;
          }
          await expect(renderer.getByRole('status')).toHaveCount(0);
          await expect(renderer.locator('svg')).toBeVisible();
          const box = (await renderer.boundingBox())!;
          expect(box.width / box.height).toBeCloseTo(243 / 420, 2);
          const measured = await renderer.locator('text').evaluateAll((nodes) =>
            nodes.map((node) => {
              const text = node as SVGTextElement,
                box = text.getBBox();
              return {
                text: text.textContent,
                length: text.getComputedTextLength(),
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
              };
            }),
          );
          expect(measured).toHaveLength(fixture.layout[side].lines.length);
          measured.forEach((line, i) => {
            const expected = fixture.layout[side].lines[i];
            expect(line.text).toBe(expected.text);
            expect(Math.abs(line.length - expected.width)).toBeLessThan(0.75);
            expect(line.x).toBeGreaterThanOrEqual(-0.25);
            expect(line.y).toBeGreaterThanOrEqual(-0.25);
            expect(line.x + line.width).toBeLessThanOrEqual(243.25);
            expect(line.y + line.height).toBeLessThanOrEqual(420.25);
          });
          expect(
            await renderer.evaluate((node) =>
              [...node.querySelectorAll('*')].some((child) =>
                ['auto', 'scroll'].includes(getComputedStyle(child).overflowY),
              ),
            ),
          ).toBe(false);
          await expect(renderer.locator('script,b')).toHaveCount(0);
        }
    }
    await page.screenshot({
      path: info.outputPath(`layout-${viewport.width}.png`),
      fullPage: true,
    });
  }
});

test('missing font fails visibly instead of accepting a system fallback', async ({ page }) => {
  await page.route('**/fonts/PTSans-Regular.ttf', (route) => route.abort());
  await page.goto('/');
  const renderer = page.locator('[data-case="short"] [data-side="front"] card-layout-renderer');
  await expect(renderer.getByRole('status')).toHaveText(
    'Card layout unavailable: font-unavailable',
  );
  await expect(renderer.locator('svg')).toBeHidden();
});

test('wrong font bytes fail identity validation', async ({ page }) => {
  await page.route('**/fonts/PTSans-Regular.ttf', (route) =>
    route.fulfill({ body: 'not the bundled font', contentType: 'font/ttf' }),
  );
  await page.goto('/');
  await expect(page.locator('[data-case="short"] [data-side="back"] [role="status"]')).toHaveText(
    'Card layout unavailable: font-unavailable',
  );
});

test('unexpected browser overflow hides the side and reports failure', async ({ page }) => {
  await page.route('**/fixtures/layouts.json', async (route) => {
    const response = await route.fetch();
    const fixtures = await response.json();
    fixtures[0].layout.front.lines[0].x = 240;
    await route.fulfill({ json: fixtures });
  });
  await page.goto('/');
  const renderer = page.locator('[data-case="short"] [data-side="front"] card-layout-renderer');
  await expect(renderer.getByRole('status')).toHaveText('Card layout unavailable: overflow');
  await expect(renderer.locator('svg')).toBeHidden();
});
