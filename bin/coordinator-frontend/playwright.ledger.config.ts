import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ledger/browser', testMatch: process.env.LEDGER_SERVICE_TEST === '1' ? 'services.spec.ts' : 'session.spec.ts',
  workers: 1, use: {baseURL: 'http://127.0.0.1:4173', headless: true,
    launchOptions: process.env.LEDGER_TEST_BROWSER ? {executablePath: process.env.LEDGER_TEST_BROWSER} : {},
  },
  webServer: {command: 'npx vite --config vite.ledger.config.ts', url: 'http://127.0.0.1:4173', reuseExistingServer: false},
});
