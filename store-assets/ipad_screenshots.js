// 13" iPad 스크린샷 (2064x2752) — ASC 요구 규격. webkit 엔진(iOS 렌더 정합).
const path = require("path");
const PW = "C:\\Users\\windg\\AppData\\Local\\npm-cache\\_npx\\361ceb562f3b3235\\node_modules\\playwright";
const { webkit } = require(PW);

const BASE = "https://jejunow.vercel.app";
const OUT = "C:\\Users\\windg\\Desktop\\PROJECT\\JejuNow\\store-assets\\screenshots-ipad-13";

const PLAN = {
  v: 3,
  plans: [
    {
      id: "p_shot_ipad",
      name: "바다 따라 하루 코스",
      date: "2026-08-20",
      slots: [
        { hour: 10, spotId: 367 }, // 함덕해수욕장
        { hour: 13, spotId: 591 }, // 김녕해수욕장
        { hour: 16, spotId: 178 }, // 성산일출봉
      ],
      journey: null,
    },
  ],
  currentId: "p_shot_ipad",
};

// 스토어 스크린샷용 — 밤 캡처는 대시보드 하단 공백·지도 단색(전부 여유)이라 낮 시각으로 고정
const FAKE_CLOCK = `
  (function () {
    const RealDate = Date;
    const offset = new RealDate("2026-08-20T13:30:00+09:00").getTime() - RealDate.now();
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
    viewport: { width: 1032, height: 1376 },
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  await ctx.addInitScript(FAKE_CLOCK);
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();

  const shots = [
    { url: "/dashboard", file: "1-dashboard.png", extraWait: 2500 },
    { url: "/map", file: "2-map.png", extraWait: 6000 },
    { url: "/schedule", file: "3-schedule.png", extraWait: 2500 },
    { url: "/spots/178", file: "4-detail.png", extraWait: 3000 },
  ];
  for (const s of shots) {
    await page.goto(BASE + s.url, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(s.extraWait);
    if (s.url === "/map") {
      // 밤 캡처는 전 마커 여유(단색) — 슬라이더를 13시로 옮겨 4색 분포를 보여준다
      const slider = page.locator('input[type="range"]').first();
      await slider.focus();
      await page.keyboard.press("Home");
      for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: path.join(OUT, s.file) });
    console.log("saved", s.file);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
