import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {},
  webpack: (config) => config, // explicit webpack, no Turbopack
}

export default nextConfig
