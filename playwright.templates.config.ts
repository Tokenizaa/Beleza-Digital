import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/templates',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:3000/demo',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
