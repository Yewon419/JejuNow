// 기능설명서용 iPhone 화면 캡처 (390x844 @3x). webkit 엔진(iOS 렌더 정합). 프로덕션 기준.
// 실행: node docs/contest/capture_screens.js
const path = require("path");
const PW = "C:/Users/windg/AppData/Local/npm-cache/_npx/361ceb562f3b3235/node_modules/playwright";
const { webkit } = require(PW);

const BASE = "https://jejunow.vercel.app";
const OUT = path.join(__dirname, "captures");
const DAY = "2026-09-12"; // 토요일, 예측 구간(08-31~10-14) 안

const PLAN = {
  v: 3,
  plans: [
    {
      id: "p_contest",
      name: "바다 따라 하루 코스",
      date: DAY,
      slots: [
        { hour: 10, spotId: 367 }, // 함덕해수욕장
        { hour: 13, spotId: 178 }, // 성산일출봉
        { hour: 16, spotId: 591 }, // 김녕해수욕장
      ],
      journey: null,
    },
  ],
  currentId: "p_contest",
};

const FAKE_CLOCK = `
  (function () {
    const RealDate = Date;
    const offset = new RealDate("${DAY}T13:30:00+09:00").getTime() - RealDate.now();
    class FakeDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(RealDate.now() + offset);
        else super(...args);
      }
      static now() { return RealDate.now() + offset; }
    }
    window.Date = FakeDate;
  })();
`;

const SEED = `
  localStorage.setItem("jejunow:travelerType", "spontaneous");
  for (const id of ["map", "dashboard", "spot", "schedule"])
    localStorage.setItem("jejunow:coach:" + id, "done");
  localStorage.setItem("jejunow:schedule", ${JSON.stringify(JSON.stringify(PLAN))});
`;

async function main() {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(`${DAY}T13:30:00+09:00`));
  const shot = async (file) => {
    await page.screenshot({ path: path.join(OUT, file) });
    console.log("saved", file);
  };

  // 1. 홈
  await page.goto(BASE + "/dashboard", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3000);
  await shot("1-home.png");

  // 2. 지도 — 슬라이더 13시
  await page.goto(BASE + "/map", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(6000);
  const slider = page.locator('input[type="range"]').first();
  await slider.focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(2500);
  await shot("2-map.png");

  // 3. 일정 시뮬레이션(붐비는 슬롯 대안 포함)
  await page.goto(BASE + "/schedule", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(9000); // /simulate 콜드 대비
  await shot("3-schedule.png");

  // 4. 경로 보기 (첫 구간)
  const routeBtn = page.getByRole("button", { name: /경로 보기/ }).first();
  if (await routeBtn.count()) {
    await routeBtn.click();
    await page.waitForTimeout(5000);
    await shot("4-route.png");
    const close = page.getByRole("button", { name: "닫기" }).first();
    if (await close.count()) await close.click();
    await page.waitForTimeout(800);
  }

  // 5. 오토플랜 첫 화면
  const auto = page.getByRole("button", { name: /자동으로 짜기/ }).first();
  await auto.click();
  await page.waitForTimeout(2500);
  await shot("5-autoplan.png");

  // 6. 상세 (성산일출봉)
  await page.goto(BASE + "/spots/178", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot("6-detail.png");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
