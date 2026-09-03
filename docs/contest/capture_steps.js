// 기능설명서 「기능 흐름도」용 단계 캡처 (핵심 기능 5개 × 2~4단계). capture_screens.js와 같은 세팅.
const path = require("path");
const PW = "C:/Users/windg/AppData/Local/npm-cache/_npx/361ceb562f3b3235/node_modules/playwright";
const { webkit } = require(PW);

const BASE = "https://jejunow.vercel.app";
const OUT = path.join(__dirname, "captures");
const DAY = "2026-09-12";
const PLAN = {
  v: 3,
  plans: [{ id: "p_contest", name: "바다 따라 하루 코스", date: DAY,
    slots: [{ hour: 10, spotId: 367 }, { hour: 13, spotId: 178 }, { hour: 16, spotId: 591 }], journey: null }],
  currentId: "p_contest",
};
const SEED = `
  localStorage.setItem("jejunow:travelerType", "spontaneous");
  for (const id of ["map", "dashboard", "spot", "schedule"]) localStorage.setItem("jejunow:coach:" + id, "done");
  localStorage.setItem("jejunow:schedule", ${JSON.stringify(JSON.stringify(PLAN))});
`;

async function main() {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    locale: "ko-KR", timezoneId: "Asia/Seoul",
  });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(`${DAY}T13:30:00+09:00`));
  const shot = async (f) => { await page.screenshot({ path: path.join(OUT, f) }); console.log("saved", f); };
  const tryStep = async (label, fn) => { try { await fn(); } catch (e) { console.log("skip", label, String(e).split("\n")[0]); } };

  // F1 지도
  await page.goto(BASE + "/map", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(6000);
  const slider = page.locator('input[type="range"]').first();
  await slider.focus(); await page.keyboard.press("Home");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(2500);
  await shot("f1-1-map13.png");
  await tryStep("filter", async () => {
    await page.getByRole("button", { name: "한적한 곳만" }).click(); await page.waitForTimeout(2000); await shot("f1-2-quiet-only.png");
    await page.getByRole("button", { name: "한적한 곳만" }).click(); await page.waitForTimeout(1500);
  });
  await tryStep("slider18", async () => {
    await slider.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(2500); await shot("f1-4-map18.png");
  });
  await tryStep("marker", async () => {
    // 상세 → 지도 포커스 경로(/map?spot=)로 선택 마커 시트를 연다
    await page.goto(BASE + "/map?spot=178", { waitUntil: "load", timeout: 60000 }); await page.waitForTimeout(7000);
    await shot("f1-3-marker-sheet.png");
  });

  // F2 대안 · F3 시뮬레이션
  await page.goto(BASE + "/schedule", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(9000);
  await shot("f3-1-schedule.png");
  await tryStep("route", async () => {
    await page.getByRole("button", { name: /경로 보기/ }).first().click(); await page.waitForTimeout(5000); await shot("f3-2-route.png");
    await page.getByRole("button", { name: "닫기" }).first().click(); await page.waitForTimeout(800);
  });
  await tryStep("replace", async () => {
    await page.getByRole("button", { name: "교체" }).first().click(); await page.waitForTimeout(7000); await shot("f2-2-replaced.png");
  });

  // F4 오토플랜
  await tryStep("autoplan", async () => {
    await page.getByRole("button", { name: /자동으로 짜기/ }).first().click(); await page.waitForTimeout(2000);
    for (const name of [/^보통/, "자동차", "한적해야 해요", "정하지 않음"]) {
      await page.getByRole("button", { name }).first().click(); await page.waitForTimeout(400);
    }
    await shot("f4-1-autoplan-form.png");
    await page.getByRole("button", { name: "시작하기" }).click(); await page.waitForTimeout(2500);
    const region = page.getByRole("button", { name: "제주시" }).first();
    if (await region.count()) { await region.click(); await page.waitForTimeout(8000); }
    await shot("f4-2-autoplan-choice.png");
  });

  // F5 상세
  await page.goto(BASE + "/spots/178", { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(4000);
  await shot("f5-1-detail.png");
  await tryStep("chart", async () => {
    await page.locator('[data-coach="spot-chart"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(1500); await shot("f5-2-detail-chart.png");
  });
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
