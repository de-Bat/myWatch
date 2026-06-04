import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import withSerwistInit from '@serwist/next'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Read discovered plugin package names for transpilation
let discoveredPlugins = []
try {
  const manifestPath = new URL('./src/plugins/.plugins-manifest.json', import.meta.url)
  discoveredPlugins = JSON.parse(readFileSync(manifestPath, 'utf8')).map((p) => p.name)
} catch {
  // no manifest yet — scanner hasn't run
}

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync', '@mywatch/plugin-sdk', ...discoveredPlugins],
  output: 'standalone',
  // Required for pnpm monorepo: tells nft to trace files from the workspace root
  // so root node_modules (where pnpm stores packages) are included in standalone output.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  webpack: (config) => {
    // Plugin .tsx source entries confuse webpack's scope hoisting → TDZ at runtime.
    if (discoveredPlugins.length > 0) {
      config.optimization.concatenateModules = false
    }
    return config
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(),
  },
}

export default withSerwist(config)
