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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-dvh">
        {/* 폰 프레임 — 데스크톱에서도 모바일 비율(max-w-md)로 중앙 고정 */}
        <div className="mx-auto min-h-dvh w-full max-w-md sm:border-x sm:border-line">
          {children}
        </div>
      </body>
    </html>
  );
}
