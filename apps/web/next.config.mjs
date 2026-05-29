/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ['@mywatch/core', '@mywatch/tmdb', '@mywatch/sync'],
  output: 'standalone',
}

export default config
