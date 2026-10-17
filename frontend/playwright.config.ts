import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', use: { baseURL: 'http://127.0.0.1:4200' },
  webServer: { command: 'npm start -- --port 4200 --proxy-config proxy.smoke.conf.json', url: 'http://127.0.0.1:4200', reuseExistingServer: false },
});
