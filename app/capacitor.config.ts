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
    // never = contentInsetAdjustmentBehavior.never (Capacitor 기본값).
    // automatic이면 UIKit이 스크롤뷰에 세이프에어리어 인셋을 넣는데, viewport-fit=cover로
    // CSS가 이미 env()로 같은 일을 하므로 이중 처리가 되어 상단에 스크롤뷰 배경(검정)이 드러난다.
    contentInset: "never",
    backgroundColor: "#f4f6f9",
  },
};

export default config;
