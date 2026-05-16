import type { NextConfig } from "next";

const isTossBundle = process.env.TOSS_BUNDLE === "true";

const nextConfig: NextConfig = {
  // 토스 번들 빌드 시에만 static export 모드 사용
  output: isTossBundle ? "export" : undefined,
  assetPrefix: isTossBundle ? process.env.PUBLIC_URL : undefined,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
