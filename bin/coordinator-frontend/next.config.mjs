import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
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
    )

    // Copy WASM file to multiple locations for better accessibility
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'public/miden_client_web.wasm'),
            to: path.join(__dirname, '.next/static/wasm/miden_client_web.wasm'),
            noErrorOnMissing: true,
          },
          {
            from: path.join(__dirname, 'public/miden_client_web.wasm'),
            to: path.join(__dirname, '.next/static/media/miden_client_web.wasm'),
            noErrorOnMissing: true,
          },
          {
            from: path.join(__dirname, 'public/miden_client_web.wasm'),
            to: path.join(__dirname, 'public/static/wasm/miden_client_web.wasm'),
            noErrorOnMissing: true,
          },
        ],
      })
    )

    return config
  },

  // Ensure WASM files are served correctly
  async headers() {
    return [
      {
        source: '/static/wasm/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
      {
        source: '/static/media/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Content-Type',
            value: 'application/wasm',
          },
        ],
      },
      {
        source: '/workers/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
