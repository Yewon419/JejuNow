import type { CapacitorConfig } from "@capacitor/cli";

// iOS 셸은 Vercel 배포 URL을 로드한다 (Next.js SSR — 정적 export 아님).
// 배포 후 server.url을 실제 도메인으로 갱신할 것. (Phase 5)
const config: CapacitorConfig = {
  appId: "com.jejunow.app",
  appName: "JejuNow",
  webDir: "public",
  server: {
    url: "https://jejunow.vercel.app",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
