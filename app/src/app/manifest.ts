import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JejuNow — 한적한 제주를 찾아서",
    short_name: "JejuNow",
    description: "제주 관광지 혼잡도 예측과 대안 코스 추천",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
