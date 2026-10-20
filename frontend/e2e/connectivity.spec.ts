import { test, expect } from '@playwright/test';
test('checks availability automatically, hides healthy status and offers recovery on failure', async ({
  page,
}) => {
  await page.route('**/api/status', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Campaign Workbench' })).toBeVisible();
  await expect(page.getByRole('alert', { name: 'Connection status' })).toContainText(
    'Backend unavailable',
  );
  await page.unroute('**/api/status');
  const checked = page.waitForResponse(
    (response) => response.url().endsWith('/api/status') && response.ok(),
  );
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await checked;
  await expect(page.getByRole('alert', { name: 'Connection status' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check connection' })).toHaveCount(0);
});
