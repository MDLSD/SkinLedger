import { chromium } from "playwright";
const base = "http://localhost:3789";
const SP = process.env.SHOT_DIR ?? "/tmp";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(base + "/login");
await page.fill("#email", "test@example.com");
await page.fill("#password", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/app");

await page.goto(base + "/app/deals");
await page.click("text=Добавить сделку");
await page.waitForSelector('[role=combobox]');

// --- Критерий 4: замер скорости поиска в браузере ---
await page.waitForFunction(async () => {
  const r = await fetch("/api/skins");
  return r.ok;
});
// --- Критерий 1 в UI: ak red ---
const combo = page.locator('[role=combobox]');
await combo.click();
const t0 = Date.now();
await combo.fill("ak red");
await page.waitForSelector("ul li button");
const firstAkRed = (await page.locator("ul li button").first().textContent())?.trim();
const searchMs = Date.now() - t0;
console.log("STEP [ak red] top:", JSON.stringify(firstAkRed), "| ~" + searchMs + "ms до первого результата");

// --- Критерий 2 в UI: awp дракон ---
await combo.fill("");
await combo.fill("awp дракон");
await page.waitForSelector("ul li button");
const dl = (await page.locator("ul li button").first().textContent())?.trim();
console.log("STEP [awp дракон] top:", JSON.stringify(dl));

// --- Критерий 3: AWP Asiimov + FT + StatTrak ---
await combo.fill("");
await combo.fill("awp asiimov");
await page.waitForSelector("ul li button:has-text('Asiimov')");
await page.locator("ul li button:has-text('Asiimov')").first().click();
// износ FT
await page.selectOption("#wear", "Field-Tested");
// StatTrak
await page.check('input[type=checkbox] >> nth=0'); // первый чекбокс = StatTrak (в блоке износа)
// проверим live-превью market_hash_name
const preview = (await page.locator("text=В справочнике:").textContent())?.trim();
console.log("STEP live preview:", JSON.stringify(preview));

// заполнить покупку и сохранить
await page.locator("fieldset", { hasText: "Покупка" }).locator("select").first().selectOption({ index: 1 });
await page.fill("#buyPrice", "3000");
await page.fill("#buyDate", "2026-07-01");
await page.click("[data-slot=dialog-content] button[type=submit]");
await page.waitForSelector("tbody tr:has-text('Asiimov')");
console.log("STEP deal saved with Asiimov row: OK");

await page.screenshot({ path: SP + "/shot-skin-form.png", fullPage: true });
await browser.close();
console.log("DONE");
