import { defineConfig } from '@playwright/test';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Angular assets must be inside its workspace. Stage actual engine output, never hand-made layouts.
mkdirSync(resolve('.angular/card-layout-fixture'), { recursive: true });
const source = resolve('../backend/build/card-layout/layouts.json');
const target = resolve('.angular/card-layout-fixture/layouts.json');
if (!existsSync(target) || !readFileSync(source).equals(readFileSync(target))) {
  copyFileSync(source, target);
}

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4202' },
  webServer: {
    command: 'npm start -- --configuration card-layout --port 4202',
    url: 'http://127.0.0.1:4202',
    reuseExistingServer: false,
  },
});
