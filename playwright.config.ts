import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: 'test',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results',
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  forbidOnly: Boolean(process.env['CI']),
  use: { baseURL: `http://127.0.0.1:${String(port)}` },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
  ],
  webServer: {
    command: `node scripts/build.ts --serve --port=${String(port)}`,
    url: `http://127.0.0.1:${String(port)}/index.html`,
    reuseExistingServer: !process.env['CI'],
  },
});
