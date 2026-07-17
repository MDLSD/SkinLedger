import { chromium } from "playwright";
const base = "http://localhost:3789";
const SP = process.env.SHOT_DIR ?? "/tmp";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 960, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(base + "/login");
await page.fill("#email", "test@example.com");
await page.fill("#password", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/app");
await page.goto(base + "/app/deals");
await page.click("text=Добавить сделку");
await page.waitForSelector("[role=combobox]");
const combo = page.locator("[role=combobox]");

// --- max 10 результатов ---
await combo.click();
await combo.fill("case");
await page.waitForSelector("ul li", { timeout: 4000 }).catch(() => {});
await page.waitForTimeout(350);
const count = await page.locator("ul li").count();
console.log("STEP max results for 'case':", count, count <= 10 ? "(<=10 OK)" : "(FAIL >10)");

// --- картинки грузятся ---
await combo.fill("");
await combo.fill("ak red");
await page.waitForSelector("ul li button img");
await page.waitForTimeout(400);
const imgInfo = await page.locator("ul li button img").first().evaluate((el) => ({
  src: el.getAttribute("src")?.slice(0, 40),
  loaded: el.complete && el.naturalWidth > 0,
}));
console.log("STEP first result image:", imgInfo.loaded ? "загружена OK" : "НЕ загружена", "|", imgInfo.src);
const firstLabel = (await page.locator("ul li button").first().textContent())?.trim();
console.log("STEP 'ak red' top:", JSON.stringify(firstLabel));
await page.screenshot({ path: SP + "/shot-ac-dropdown.png" });

// --- только существующие комбинации: Dragon Lore (нет StatTrak, есть Souvenir) ---
await combo.fill("");
await combo.fill("awp dragon lore");
await page.waitForSelector("ul li button:has-text('Dragon Lore')");
await page.locator("ul li button:has-text('Dragon Lore')").first().click();
const stDisabled = await page.locator("input[type=checkbox]").nth(0).isDisabled();
const svDisabled = await page.locator("input[type=checkbox]").nth(1).isDisabled();
const normalWears = await page.locator("#wear option").allTextContents();
console.log("STEP Dragon Lore: StatTrak disabled =", stDisabled, "(ожид. true) | Souvenir disabled =", svDisabled, "(ожид. false)");
console.log("STEP Dragon Lore normal wears:", normalWears.join(", "));
// включим Souvenir → износы должны остаться (у DL Souvenir во всех износах)
await page.locator("input[type=checkbox]").nth(1).check();
const svWears = await page.locator("#wear option").allTextContents();
console.log("STEP Dragon Lore souvenir wears:", svWears.join(", "));
const preview = (await page.locator("text=В справочнике:").textContent())?.trim();
console.log("STEP preview:", JSON.stringify(preview));

await b.close();
console.log("DONE");
