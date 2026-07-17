import { chromium } from "playwright";
const base = "http://localhost:3789";
const SP = process.env.SHOT_DIR ?? "/tmp";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 900, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(base + "/login");
await page.fill("#email", "test@example.com");
await page.fill("#password", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/app");

// индекс: размер и состав
const idx = await page.evaluate(async () => {
  const r = await fetch("/api/skins");
  const j = await r.json();
  return {
    count: j.length,
    skins: j.filter((x) => x.kind === "skin").length,
    stickers: j.filter((x) => x.kind === "sticker").length,
    bytes: JSON.stringify(j).length,
  };
});
console.log("STEP index:", idx.count, "семейств (скинов", idx.skins, "стикеров", idx.stickers + ")", (idx.bytes / 1024).toFixed(0) + "КБ");

await page.goto(base + "/app/deals");
await page.click("text=Добавить сделку");
await page.waitForSelector("[role=combobox]");
const combo = page.locator("[role=combobox]");

// --- регрессия скинов: ak red ---
await combo.click();
await combo.fill("ak red");
await page.waitForSelector("ul li button");
console.log("STEP [ak red] top:", JSON.stringify((await page.locator("ul li button").first().textContent())?.trim()));

// --- стикер: поиск s1mple ---
await combo.fill("");
await combo.fill("s1mple");
await page.waitForSelector("ul li button:has-text('s1mple')");
const stickerBtn = page.locator("ul li button:has-text('s1mple')").first();
console.log("STEP [s1mple] result:", JSON.stringify((await stickerBtn.textContent())?.trim()));
await page.screenshot({ path: SP + "/shot-sticker-search.png" });
await stickerBtn.click();

// финиш-селектор вместо износа/чекбоксов
const hasFinish = await page.locator("#finish").count();
const hasWear = await page.locator("#wear").count();
const finishes = await page.locator("#finish option").allTextContents();
console.log("STEP sticker controls: finish select =", hasFinish, "| wear select =", hasWear, "| финиши:", finishes.join(", "));
const preview = (await page.locator("text=В справочнике:").textContent())?.trim();
console.log("STEP sticker preview:", JSON.stringify(preview));

// выбрать Foil, заполнить покупку, сохранить
if (finishes.includes("Foil")) await page.selectOption("#finish", "Foil");
await page.locator("fieldset", { hasText: "Покупка" }).locator("select").first().selectOption({ index: 1 });
await page.fill("#buyPrice", "1500");
await page.fill("#buyDate", "2026-07-10");
await page.screenshot({ path: SP + "/shot-sticker-form.png" });
await page.click("[data-slot=dialog-content] button[type=submit]");
await page.waitForSelector("tbody tr:has-text('s1mple')");
console.log("STEP sticker deal saved: OK");

await b.close();
console.log("DONE");
