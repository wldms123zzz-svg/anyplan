/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.TOSS_BUNDLE === 'true' ? 'export' : undefined,
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
