import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Admin mode configuration tests: validates app mode detection and admin environment vars
// without affecting the default wallet build. See `tests/admin/appMode.test.ts`.
export default defineConfig({
  resolve: { alias: [
    { find: /^@miden-sdk\/miden-sdk$/, replacement: fileURLToPath(new URL('./node_modules/@miden-sdk/miden-sdk/dist/st/index.js', import.meta.url)) },
    // The wallet adapter ships only a `module` entry (no `main`/`exports`), which Vite's SSR resolver skips.
    { find: /^@miden-sdk\/miden-wallet-adapter-base$/, replacement: fileURLToPath(new URL('./node_modules/@miden-sdk/miden-wallet-adapter-base/dist/index.js', import.meta.url)) },
    { find: '@openzeppelin', replacement: fileURLToPath(new URL('./node_modules/@openzeppelin', import.meta.url)) },
    { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  ] },
  test: {
    include: ['tests/admin/**/*.test.ts'],
    setupFiles: ['tests/ledger/setup.ts'],
    server: { deps: { inline: [/@openzeppelin\//, /@miden-sdk\//] } },
  },
});
