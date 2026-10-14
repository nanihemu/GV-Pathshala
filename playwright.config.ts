import { defineConfig } from '@playwright/test';

// Start the database, API and client first (see README), then run: npx playwright test
export default defineConfig({
  testDir: '.',
  use: { baseURL: process.env.E2E_URL ?? 'http://localhost:5173' },
});
