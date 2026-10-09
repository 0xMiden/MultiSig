import path from 'path';
import { fileURLToPath } from 'url';
import { staticSecurityHeaders } from './security-headers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    // Expose VITE_PARA_API_KEY as NEXT_PUBLIC_PARA_API_KEY for browser access
    NEXT_PUBLIC_PARA_API_KEY: process.env.VITE_PARA_API_KEY || process.env.NEXT_PUBLIC_PARA_API_KEY || '',
  },
  experimental: {},
  generateBuildId: async () => {
    return 'build-id'
  },
  // Content-Security-Policy is set per request in src/middleware.ts (it needs a nonce).
  async headers() {
    return [{ source: '/:path*', headers: staticSecurityHeaders(process.env.NODE_ENV === 'production') }]
  },
  webpack: (config, { webpack }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    })

    // Ensure WASM files are properly resolved
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    }

    // Force @miden-sdk/miden-sdk to resolve to its /lazy entry point so the
    // "node" export condition (which lacks WASM Array types) is never picked
    // up during SSR bundling.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@miden-sdk/miden-sdk$': path.join(__dirname, 'node_modules/@miden-sdk/miden-sdk/dist/st/index.js'),
    }

    // Stub out optional Para wallet connector modules that aren't used
    // These are optionally required by @getpara/react-sdk-lite
    const emptyStub = path.join(__dirname, 'src/stubs/empty.js');
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^@getpara\/evm-wallet-connectors$/,
        emptyStub
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@getpara\/solana-wallet-connectors$/,
        emptyStub
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@getpara\/cosmos-wallet-connectors$/,
        emptyStub
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@farcaster\/miniapp-sdk$/,
        emptyStub
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@getpara\/aa-safe$/,
        emptyStub
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@getpara\/aa-thirdweb$/,
        emptyStub
      ),
      new webpack.NormalModuleReplacementPlugin(
        /^@getpara\/(?:aa-alchemy|aa-biconomy|aa-cdp|aa-gelato|aa-pimlico|aa-porto|aa-rhinestone|aa-zerodev)$/,
        emptyStub
      ),
      // Para's telemetry (enabled per API key, server-side) loads this OpenTelemetry
      // context manager, which installs zone.js. zone.js replaces the global
      // Promise, and IndexedDB transactions in the Miden SDK's store (Dexie) then
      // commit before their reads finish: PrematureCommitError on every
      // transaction. Para catches the failed import and runs telemetry without it.
      new webpack.NormalModuleReplacementPlugin(
        /^(?:@opentelemetry\/context-zone(?:-peer-dep)?|zone\.js)$/,
        emptyStub
      ),
    )

    return config
  },
}

export default nextConfig
