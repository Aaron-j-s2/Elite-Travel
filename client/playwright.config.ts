import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a running app (API + client), e.g. `npm run dev` from the repo root.
 * They create real bookings, so point them at a development database — never production.
 *   E2E_BASE_URL (default http://localhost:5173), E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
