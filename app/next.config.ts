import type { NextConfig } from "next";
import pkg from "./package.json";

// 버전 단일 출처 = package.json. iOS 빌드(MARKETING_VERSION)도 여기서 읽어 쓴다.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tong.visitkorea.or.kr",
      },
    ],
  },
};

export default nextConfig;
