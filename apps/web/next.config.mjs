import path from 'path'
import { fileURLToPath } from 'url'
import withSerwistInit from '@serwist/next'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
  output: 'standalone',
  // Required for pnpm monorepo: tells nft to trace files from the workspace root
  // so root node_modules (where pnpm stores packages) are included in standalone output.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
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
