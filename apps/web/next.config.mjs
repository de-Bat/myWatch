import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
  output: 'standalone',
  // Required for pnpm monorepo: tells nft to trace files from the workspace root
  // so root node_modules (where pnpm stores packages) are included in standalone output.
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default config
