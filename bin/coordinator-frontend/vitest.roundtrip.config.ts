import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Round-trip guard (Task 8 of the 0.17 port): loads the vendored `usdcx-admin-notes` wasm
// (a `--target web` build) inside node/vitest, and the frontend's own `@miden-sdk` build, to prove
// the two are cross-compatible. See `tests/roundtrip/deserialize.test.ts`.
export default defineConfig({
  resolve: { alias: [
    { find: /^@miden-sdk\/miden-sdk$/, replacement: fileURLToPath(new URL('./node_modules/@miden-sdk/miden-sdk/dist/st/index.js', import.meta.url)) },
    { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
  ] },
  test: {
    include: ['tests/roundtrip/**/*.test.ts'],
    setupFiles: ['tests/ledger/setup.ts'],
    server: { deps: { inline: [/@miden-sdk\//] } },
  },
});
