import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against the real stack: Django (fresh seeded SQLite) on :8001 and the
 * Vite dev server on :5174 proxying /api to it. Run with `npm run test:e2e`.
 */
const BACKEND_PORT = '8001';
const FRONTEND_PORT = '5174';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      env: { E2E_BACKEND_PORT: BACKEND_PORT },
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health/`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      env: { VITE_DEV_API_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
      url: `http://localhost:${FRONTEND_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
