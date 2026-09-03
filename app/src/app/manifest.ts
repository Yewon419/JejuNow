import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "제주나우 — 한적한 제주를 찾아서",
    short_name: "제주나우",
    description: "제주 관광지 혼잡도 예측과 대안 코스 추천",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 핀이 안전 영역(가운데 80%) 안에 들어와 마스크를 씌워도 잘리지 않는다
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
