// 앱 아이콘 생성 — public/icon.svg(브랜드 마크 SSOT)를 PNG로 렌더한다.
// 실행: npx tsx scripts/gen-app-icon.mts
//
// iOS 아이콘 요건: 1024x1024, 알파 채널 없음, 모서리 라운딩 없음(OS가 마스크를 씌운다).
// icon.svg는 웹·PWA용이라 rx=112 라운딩이 박혀 있어 렌더 전에 제거한다.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SRC = resolve(root, "public/icon.svg");
// 배경 rect의 fill — 알파를 없앨 때 깔 바탕색
const BG = "#0b1220";

const TARGETS = [
  // iOS 마케팅·앱 아이콘 (Xcode 에셋 카탈로그가 이 한 장에서 전 사이즈를 파생)
  { out: resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), size: 1024 },
  // 앱 헤더 로고 락업 · PWA 폴백 (표시 32px, 레티나 여유분)
  { out: resolve(root, "public/app-icon.png"), size: 256 },
];

const svg = await readFile(SRC, "utf8");
// 라운딩 제거 — iOS는 자체 마스크를 씌우고, 헤더는 CSS rounded-lg로 깎는다
const square = svg.replace(/\s+rx="\d+"/, "");
if (square === svg) throw new Error("icon.svg에서 rx 속성을 찾지 못했습니다 — 소스 확인 필요");

for (const { out, size } of TARGETS) {
  await writeFile(
    out,
    await sharp(Buffer.from(square), { density: 384 })
      .resize(size, size)
      .flatten({ background: BG }) // 알파 제거 (App Store는 알파 채널 아이콘을 거부)
      .png()
      .toBuffer(),
  );
  console.log(`${out} (${size}x${size})`);
}
