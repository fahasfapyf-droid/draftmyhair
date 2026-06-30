import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // React 19 / Next 15 optimizations enabled by default in this version
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // To be populated with production image hosts (e.g., AWS S3, Vercel Blob)
    ],
  },
};

export default nextConfig;