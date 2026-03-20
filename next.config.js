/** @type {import('next').NextConfig} */
// Static export for Capacitor APK build
const isCapacitor = process.env.NEXT_PUBLIC_STATIC === 'true'

const nextConfig = {
  ...(isCapacitor && { output: 'export' }),
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: ['pollinations.ai', 'image.pollinations.ai', 'via.placeholder.com'],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
