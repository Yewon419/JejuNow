import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JejuNow — 한적한 제주를 찾아서",
  description:
    "제주 관광지 혼잡도 예측과 대안 코스 추천. 데이터랩 수요 데이터 기반 — 지금 어디가 한적할까?",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iOS 셸에서 env(safe-area-inset-*)이 실제 값을 반환하려면 cover가 필요하다.
  // 없으면 0px으로 계산돼 하단바가 홈 인디케이터에 겹친다.
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      {/* HTML 파싱 시점에 바로 시작하도록 head로 올린다 (React 19가 호이스팅) */}
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
      <body className="min-h-dvh">
        {/* 폰 프레임 — 데스크톱에서도 모바일 비율(max-w-md)로 중앙 고정 */}
        <div className="mx-auto min-h-dvh w-full max-w-md sm:border-x sm:border-line">
          {children}
        </div>
      </body>
    </html>
  );
}
