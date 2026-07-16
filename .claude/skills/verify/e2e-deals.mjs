import { chromium } from "playwright";

const base = "http://localhost:3789";
const SP = process.env.SHOT_DIR ?? "/tmp";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => log("PAGEERROR:", e.message));

// --- login ---
await page.goto(base + "/login");
await page.fill("#email", "test@example.com");
await page.fill("#password", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/app");
log("STEP login: OK");

// --- открыть форму, сценарий «купил и продал» ---
await page.goto(base + "/app/deals");
await page.click("text=Добавить сделку");
await page.waitForSelector("#itemName");
await page.click("button:has-text('Купил и продал')");

await page.fill("#itemName", "AK-47 | Redline");
await page.fill("#itemQuality", "Field-Tested");

const buySelect = page.locator("fieldset", { hasText: "Покупка" }).locator("select").first();
await buySelect.selectOption({ label: "Buff163" });
const buyFee = await page.inputValue("#buyFeePct");
log("STEP fee autofill (Buff163 buy):", buyFee === "0" ? "OK (0)" : "FAIL: " + buyFee);

await page.fill("#buyPrice", "1000");
await page.fill("#buyDate", "2026-07-01");

const sellSelect = page.locator("fieldset", { hasText: "Продажа" }).locator("select").first();
await sellSelect.selectOption({ label: "Steam Market" });
const sellFee = await page.inputValue("#sellFeePct");
log("STEP fee autofill (Steam sell):", sellFee === "13" ? "OK (13)" : "FAIL: " + sellFee);

await page.fill("#sellPrice", "1300");
await page.fill("#sellDate", "2026-07-10");

// живой расчёт: cost=1000, revenue=1300*0.87=1131, profit=+131, маржа 13.1%
const panel = await page.locator("[data-slot=dialog-content] div.bg-muted").textContent();
log("STEP live profit panel:", panel.replace(/ /g, " ").trim());
await page.screenshot({ path: SP + "/shot-form.png" });

await page.click("[data-slot=dialog-content] button[type=submit]");
await page.waitForSelector("table");
await page.waitForSelector("text=AK-47 | Redline");
const row = await page.locator("tbody tr", { hasText: "AK-47 | Redline" }).textContent();
log("STEP row after create:", row.replace(/ /g, " "));

// --- сценарий «купил» (холд) ---
await page.click("text=Добавить сделку");
await page.waitForSelector("#itemName");
await page.fill("#itemName", "Glock-18 | Fade");
await page.locator("fieldset", { hasText: "Покупка" }).locator("select").first().selectOption({ label: "Lis-Skins" });
await page.fill("#buyPrice", "5000");
await page.fill("#buyDate", "2026-07-14");
const panel2 = await page.locator("[data-slot=dialog-content] div.bg-muted").textContent();
log("STEP holding panel:", panel2.replace(/ /g, " ").trim());
await page.click("[data-slot=dialog-content] button[type=submit]");
await page.waitForSelector("tbody tr:has-text('Glock-18')");
log("STEP holding deal created: OK");

// --- закрытие сделки кнопкой «Продано» ---
await page.locator("tbody tr", { hasText: "Glock-18" }).locator("button", { hasText: "Продано" }).click();
await page.waitForSelector("#sellPrice");
await page.locator("fieldset", { hasText: "Продажа" }).locator("select").first().selectOption({ label: "Steam Market" });
await page.fill("#sellPrice", "5500");
await page.fill("#sellDate", "2026-07-15");
await page.click("[data-slot=dialog-content] button[type=submit]");
await page.waitForSelector("tbody tr:has-text('Glock-18'):has-text('Продано')");
log("STEP sell flow: OK");

// --- валидация: дата продажи раньше покупки ---
await page.locator("tbody tr", { hasText: "AK-47" }).locator("button", { hasText: "Изменить" }).click();
await page.waitForSelector("#sellDate");
await page.fill("#sellDate", "2026-06-01");
await page.click("[data-slot=dialog-content] button[type=submit]");
const err = await page.waitForSelector("[data-slot=dialog-content] p[role=alert]", { timeout: 5000 });
log("STEP validation sellDate<buyDate:", (await err.textContent()).trim());
await page.click("[data-slot=dialog-content] button:has-text('Отмена')");

// --- редактирование: меняем цену покупки ---
await page.locator("tbody tr", { hasText: "AK-47" }).locator("button", { hasText: "Изменить" }).click();
await page.waitForSelector("#buyPrice");
await page.fill("#buyPrice", "1200");
await page.click("[data-slot=dialog-content] button[type=submit]");
await page.waitForFunction(() =>
  document.body.innerText.replace(/ /g, " ").includes("1 200"),
);
log("STEP edit buyPrice→1200: OK");

// --- удаление с подтверждением ---
const rows = await page.locator("tbody tr").count();
await page.locator("tbody tr", { hasText: "Glock-18" }).locator("button", { hasText: "Удалить" }).click();
await page.waitForSelector("text=Удалить сделку?");
await page.locator("[role=alertdialog] button:has-text('Удалить')").last().click();
await page.waitForFunction(
  (n) => document.querySelectorAll("tbody tr").length === n - 1,
  rows,
);
log("STEP delete with confirm: OK");

await page.screenshot({ path: SP + "/shot-table.png", fullPage: true });
await browser.close();
log("DONE");
