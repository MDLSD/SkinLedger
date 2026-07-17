import { chromium } from "playwright";
const base = "http://localhost:3789";
const SP = process.env.SHOT_DIR ?? "/tmp";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 950 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto(base + "/login");
await page.fill("#email", "test@example.com");
await page.fill("#password", "password123");
await page.click("button[type=submit]");
await page.waitForURL("**/app");
await page.goto(base + "/app/deals");
await page.waitForSelector("tbody tr");

const rowCount = () => page.locator("tbody tr").count();
const summary = () => page.locator("text=/Показаны .* из .*/").first().textContent();

// --- пагинация: 50 на страницу ---
console.log("STEP страница 1:", await rowCount(), "строк |", (await summary())?.trim());
console.log("STEP пагинатор:", (await page.locator("text=/Стр\\. \\d+ из \\d+/").textContent())?.trim());

// Вперёд
await page.click("button:has-text('Вперёд')");
await page.waitForFunction(() => location.search.includes("page=2"));
await page.waitForTimeout(300);
console.log("STEP страница 2:", await rowCount(), "строк |", (await summary())?.trim(), "| url:", new URL(page.url()).search);
await page.click("button:has-text('Назад')");
await page.waitForTimeout(300);

// --- фильтр статуса = holding ---
await page.selectOption("select >> nth=1", "holding").catch(async () => {
  // подстрахуемся: найдём select со статусом по опции
});
// точнее — по видимой опции
await page.getByRole("combobox").nth(1).selectOption("holding").catch(()=>{});
await page.waitForTimeout(400);
const badges = await page.locator("tbody tr td:nth-child(7)").allTextContents();
const allHolding = badges.every((t) => t.includes("холде"));
console.log("STEP фильтр статус=В холде:", badges.length, "строк, все 'В холде':", allHolding ? "OK" : "FAIL ("+[...new Set(badges)].join(",")+")");

// сброс
await page.click("button:has-text('Сбросить')");
await page.waitForTimeout(400);
console.log("STEP после сброса:", await rowCount(), "строк");

// --- поиск ---
const firstName = (await page.locator("tbody tr td:nth-child(1)").first().textContent())?.trim().split("\n")[0] ?? "";
const token = firstName.split(" ")[0]; // напр. "AK-47"
await page.fill("input[placeholder='Название скина']", token);
await page.waitForTimeout(600);
const names = await page.locator("tbody tr td:nth-child(1)").allTextContents();
const allMatch = names.every((n) => n.toLowerCase().includes(token.toLowerCase()));
console.log(`STEP поиск '${token}':`, names.length, "строк, все содержат токен:", allMatch ? "OK" : "FAIL");
await page.click("button:has-text('Сбросить')");
await page.waitForTimeout(400);

// --- сортировка по прибыли ---
await page.click("th button:has-text('Прибыль')"); // desc
await page.waitForTimeout(400);
const profitsDesc = (await page.locator("tbody tr td:nth-child(4)").allTextContents())
  .map((t) => parseFloat(t.replace(/[^\d.,\-−]/g, "").replace(",", ".").replace("−","-"))).filter((x)=>!Number.isNaN(x));
const isDesc = profitsDesc.every((v, i) => i === 0 || profitsDesc[i - 1] >= v);
console.log("STEP сортировка прибыль ↓:", profitsDesc.slice(0, 5).join(", "), "| убывает:", isDesc ? "OK" : "FAIL");
await page.click("th button:has-text('Прибыль')"); // asc
await page.waitForTimeout(400);
console.log("STEP url при сортировке:", new URL(page.url()).search);

await page.screenshot({ path: SP + "/shot-list.png" });
await b.close();
console.log("DONE");
