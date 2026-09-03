// 앱 아이콘 생성 — store-assets/app-icon-master.png(원본) 한 장에서 전 산출물을 뽑는다.
// 실행: npx tsx scripts/gen-app-icon.mts
//
// iOS 아이콘 요건: 1024x1024, 알파 채널 없음, 모서리 라운딩 없음(OS가 자체 마스크를 씌운다).
// 원본은 이 조건을 이미 만족하는 흰 바탕 정사각이다.

import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const SRC = resolve(root, "store-assets/app-icon-master.png");
// 알파를 없앨 때 깔 바탕색 — 원본 아이콘 바탕과 같아야 한다
const BG = "#ffffff";

const TARGETS = [
  // iOS 마케팅·앱 아이콘 (Xcode 에셋 카탈로그가 이 한 장에서 전 사이즈를 파생)
  { out: resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), size: 1024 },
  // 앱 헤더 로고 락업 (표시 32px, 레티나 여유분)
  { out: resolve(root, "public/app-icon.png"), size: 256 },
  // PWA 매니페스트
  { out: resolve(root, "public/icon-192.png"), size: 192 },
  { out: resolve(root, "public/icon-512.png"), size: 512 },
  // 웹에서 홈 화면에 추가할 때 쓰는 아이콘 (Next.js app router 규약)
  { out: resolve(root, "src/app/apple-icon.png"), size: 180 },
];

const meta = await sharp(SRC).metadata();
if (meta.width !== 1024 || meta.height !== 1024) {
  throw new Error(`원본이 1024x1024가 아닙니다: ${meta.width}x${meta.height}`);
}

const render = (size: number): Promise<Buffer> =>
  sharp(SRC).resize(size, size).flatten({ background: BG }).png().toBuffer();

for (const { out, size } of TARGETS) {
  await writeFile(out, await render(size));
  console.log(`${out} (${size}x${size})`);
}

// favicon.ico — sharp는 ico를 못 쓰므로 PNG를 ICO 컨테이너에 그대로 담는다(Vista 이후 포맷).
// 헤더 6바이트 + 엔트리 16바이트 뒤에 PNG가 통째로 들어간다.
// ⚠ Next.js 빌드가 ico 안의 PNG를 RGBA로 요구한다 — 알파를 반드시 남긴다.
//   (알파 금지는 App Store 앱 아이콘에만 걸리는 제약이고 favicon은 무관하다)
const png = await sharp(SRC).resize(256, 256).flatten({ background: BG }).ensureAlpha().png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // 이미지 1장
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // width 256은 0으로 표기
entry.writeUInt8(0, 1); // height 256은 0으로 표기
entry.writeUInt8(0, 2); // 팔레트 없음
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // 데이터 시작 위치 = 6 + 16
const ico = resolve(root, "src/app/favicon.ico");
await writeFile(ico, Buffer.concat([header, entry, png]));
console.log(`${ico} (256x256, ico)`);
