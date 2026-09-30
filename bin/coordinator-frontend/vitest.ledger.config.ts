import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: [
    { find: /^@miden-sdk\/miden-sdk$/, replacement: fileURLToPath(new URL('./node_modules/@miden-sdk/miden-sdk/dist/st/index.js', import.meta.url)) },
    { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  ] },
  test: {
    include: ['tests/ledger/**/*.test.ts'],
    setupFiles: ['tests/ledger/setup.ts'],
    server: { deps: { inline: [/@openzeppelin\//, /@miden-sdk\//] } },
  },
});
