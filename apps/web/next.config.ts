import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
}

export default config
