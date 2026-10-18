import { defineConfig } from '@playwright/test';
const port = Number(process.env['WORKBENCH_CHECK_FRONTEND_PORT'] ?? 4200);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use a valid WORKBENCH_CHECK_FRONTEND_PORT.');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './e2e', workers: 1, use: { baseURL },
  webServer: { command: `npm start -- --port ${port} --proxy-config proxy.smoke.conf.json`, url: baseURL, reuseExistingServer: false },
});
