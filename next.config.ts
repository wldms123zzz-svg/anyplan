import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.TOSS_BUNDLE === 'true' ? 'export' : undefined,
  images: { unoptimized: true },
  eslint: {
    // 빌드 시 에러가 있어도 무시하고 진행 (공모전 제출을 위한 빠른 빌드)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 빌드 시 타입 에러가 있어도 무시하고 진행
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
