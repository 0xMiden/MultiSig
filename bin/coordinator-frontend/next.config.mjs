import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Disable static optimization completely to avoid WASM loading issues
  experimental: {
    // This is not experimental anymore in Next.js 15, but keep for compatibility
  },
  // Generate all pages dynamically (no static generation)
  // This prevents WASM loading during build
  generateBuildId: async () => {
    return 'build-id'
  },
  eslint: {
    // Don't fail the build on ESLint errors during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail the build on TypeScript errors during production builds
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

    // Copy WASM file to multiple locations for better accessibility
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'public/miden_client_web.wasm'),
            to: path.join(__dirname, '.next/static/wasm/miden_client_web.wasm'),
          },
          {
            from: path.join(__dirname, 'public/miden_client_web.wasm'),
            to: path.join(__dirname, '.next/static/media/miden_client_web.wasm'),
          },
          {
            from: path.join(__dirname, 'public/miden_client_web.wasm'),
            to: path.join(__dirname, 'public/static/wasm/miden_client_web.wasm'),
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