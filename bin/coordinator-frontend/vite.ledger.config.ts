import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  define: {
    'process.env.NEXT_PUBLIC_MIDEN_RPC_URL': JSON.stringify(process.env.LEDGER_TEST_RPC_URL ?? 'http://localhost:57291'),
    'process.env.NEXT_PUBLIC_MIDEN_NOTE_TRANSPORT_URL': JSON.stringify(process.env.LEDGER_TEST_TRANSPORT_URL ?? ''),
    'process.env.NEXT_PUBLIC_MIDEN_PROVER_URL': JSON.stringify(process.env.LEDGER_TEST_PROVER_URL ?? 'local'),
    'process.env.NEXT_PUBLIC_MIDEN_REGISTRATION_CODE': JSON.stringify(process.env.LEDGER_TEST_INVITATION_CODE ?? 'guardian'),
    'process.env.NEXT_PUBLIC_GUARDIAN_ENDPOINT': JSON.stringify(process.env.LEDGER_TEST_GUARDIAN_URL ?? ''),
    'process.env.NEXT_PUBLIC_PARA_API_KEY': '""',
    'process.env.NEXT_PUBLIC_PARA_ENVIRONMENT': '"development"',
  },
  root: local('./tests/ledger/browser'),
  esbuild: {jsx: 'automatic'},
  optimizeDeps: {exclude: ['@miden-sdk/miden-sdk', '@openzeppelin/miden-multisig-client', '@openzeppelin/guardian-client']},
  resolve: {alias: [
    {find: '@/lib/ledger/device', replacement: local('./tests/ledger/browser/device.ts')},
    {find: /^@miden-sdk\/miden-sdk$/, replacement: local('./node_modules/@miden-sdk/miden-sdk/dist/st/index.js')},
    {find: '@', replacement: local('./src')},
  ]},
  server: {host: '127.0.0.1', port: 4173, strictPort: true, fs: {allow: [local('./')] }},
});
