import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.TOSS_BUNDLE === 'true' ? 'export' : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
