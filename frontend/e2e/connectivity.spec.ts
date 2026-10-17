import { test, expect } from '@playwright/test';
test('Angular reaches the real local backend through its generated client', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Campaign Workbench' })).toBeVisible();
  await page.getByRole('button', { name: 'Check connection' }).click();
  await expect(page.getByRole('status')).toHaveText('Connected');
});
