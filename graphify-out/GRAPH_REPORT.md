# Graph Report - .  (2026-07-26)

## Corpus Check
- 143 files · ~69,190 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 960 nodes · 1886 edges · 55 communities (48 shown, 7 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 104 edges (avg confidence: 0.85)
- Token cost: 219,481 input · 0 output

## Community Hubs (Navigation)
- Дашборд и список сделок
- Импорт таблиц сделок
- Аутентификация и роуты
- Настройки аккаунта
- Runtime-зависимости
- Dev-зависимости и тулинг
- Скилл verify (E2E-протокол)
- Импорт каталога предметов
- Загрузка и бэкфилл цен
- Автокомплит каталога
- Конфигурация TypeScript
- UI: выпадающее меню
- Фикстуры импорта и статика
- Конфиг shadcn
- Страница цен и фильтры
- Панель настроек таблицы
- Модели данных из ТЗ
- API истории цен
- Справочник площадок
- Строка таблицы и график
- Аудит: деньги и валюты
- UI: базовые контролы
- UI: диалог подтверждения
- Расчёт прибыли и сравнение
- Параметры таблицы цен
- Выбор диапазона дат
- Аудит: сессии и rate-limit
- UI: модальные окна
- Аудит: границы входных данных
- Аудит: CSP и инфраструктура
- UI: карточки и форма входа
- Аудит: агрегаты и пагинация
- UI: поля ввода
- SEO-требования модуля цен
- Аудит: гигиена доступа
- Аудит: 500-е импорта и экспорта
- Регламент аудита и структура
- E2E-тест списка сделок
- Страницы ошибок
- Аудит: исторические курсы
- Сид базы данных
- Корневой layout и шрифты
- Прокси и CSP-заголовки
- Аудит: отображение расчётов
- E2E-тест каталога
- Конфиг Next.js
- UI: бейдж
- Бэклог и границы MVP
- ТЗ: обзор MVP
- Конфиг ESLint
- Конфиг PostCSS
- NextAuth-хендлеры
- Настройки пользователя (ТЗ)

## God Nodes (most connected - your core abstractions)
1. `cn()` - 77 edges
2. `Button()` - 22 edges
3. `formatMoney()` - 16 edges
4. `compilerOptions` - 16 edges
5. `loadUserDeals()` - 15 edges
6. `fxFactor()` - 14 edges
7. `rowToFields()` - 14 edges
8. `profit()` - 14 edges
9. `getRates()` - 14 edges
10. `DealForm()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Finding: Nonexistent Dates Silently Coerced (30.02.2026 to 2 Mar)` --rationale_for--> `parseDate()`  [EXTRACTED]
  test-imports/README.md → src/lib/deal-import.ts
- `Deploy on Vercel (template guidance)` --semantically_similar_to--> `SkinLedger deploy checklist`  [INFERRED] [semantically similar]
  README.md → DEPLOY.md
- `Расчёт чистой прибыли с комиссиями (net_buy/net_sell)` --semantically_similar_to--> `Расчётные поля сделки (buy_cost_base, profit, margin_pct)`  [INFERRED] [semantically similar]
  tz-price-comparison.md → tz-mvp-skins-arbitrage-tracker.md
- `E-1 — дашборд по sellDate, список по buyDate` --semantically_similar_to--> `H1 — список и дашборд фильтруют период по разным датам`  [INFERRED] [semantically similar]
  bugs.md → SECURITY_AUDIT.md
- `C-3 — /api/skins как усилитель нагрузки (синхронный gzip 3 МБ)` --semantically_similar_to--> `L5 — rate limiter: рост памяти и отсутствие лимитов на дорогих операциях`  [INFERRED] [semantically similar]
  bugs.md → SECURITY_AUDIT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Auth/session hardening across dev verification and prod deploy** — deploy_auth_secret, deploy_auth_url, deploy_trust_proxy, deploy_authjs_dependency_risk, _claude_skills_verify_skill_secure_cookies_gotcha, _claude_skills_verify_skill_test_user [INFERRED 0.85]
- **Item catalog ingest and serving pipeline** — deploy_import_catalog, deploy_catalog_autoupdate, deploy_getskinfamilies_cache, _claude_skills_verify_skill_import_catalog, _claude_skills_verify_skill_marketitem_model, _claude_skills_verify_skill_skins_api_index, _claude_skills_verify_skill_autocomplete_selectors [EXTRACTED 1.00]
- **Pre-release supply-chain and scaling debt** — deploy_rate_limit_shared_store, deploy_npm_audit_findings, deploy_xlsx_cdn_sheetjs, deploy_authjs_dependency_risk, deploy_security_headers [INFERRED 0.85]
- **Ценовая модель данных этапа 2 (MarketSource ⋈ MarketItem ⋈ PriceQuote ⋈ PriceHistory)** — tz_price_comparison_marketsource, tz_price_comparison_marketitem, tz_price_comparison_pricequote, tz_price_comparison_pricehistory, tz_price_comparison_cron_price_loading [EXTRACTED 1.00]
- **SEO-архитектура публичной зоны (роутинг, slug, разметка, sitemap, перелинковка, тонкие страницы)** — tz_price_comparison_public_private_split, tz_price_comparison_slug_url, tz_price_comparison_ssr_isr_rendering, tz_price_comparison_schema_markup, tz_price_comparison_sitemap, tz_price_comparison_internal_linking, tz_price_comparison_thin_pages_rule, tz_price_comparison_cloaking_decision [EXTRACTED 1.00]
- **Класс находок «финансовая корректность» (период, курс, отображение, float)** — security_audit_h1, security_audit_h2, security_audit_m2, security_audit_m3, security_audit_m4, security_audit_l9, security_audit_l11 [EXTRACTED 1.00]
- **Deal Import Normalization Pipeline (delimiters, numbers, wear, dates, status)** — src_lib_deal_import_parsecsv, src_lib_deal_import_parsedate, test_imports_readme_locale_number_normalization, test_imports_readme_wear_canonicalization, test_imports_readme_column_mapping_heuristics, test_imports_readme_holding_vs_sold_status [INFERRED 0.85]
- **Defects Surfaced by the Fixture Run** — test_imports_readme_freeform_text_unsupported, test_imports_readme_invalid_date_silent_coercion, test_imports_readme_custom_marketplace_side_effect, test_imports_readme_deal_import_test_corpus [EXTRACTED 1.00]
- **Unmodified create-next-app Public Asset Set** — public_file_document_icon, public_globe_globe_icon, public_window_window_icon, public_next_nextjs_wordmark, public_vercel_vercel_logo [INFERRED 0.95]

## Communities (55 total, 7 thin omitted)

### Community 0 - "Дашборд и список сделок"
Cohesion: 0.06
Nodes (78): DealsPage(), metadata, SearchParams, DASH_SELECT, DashboardPage(), SearchParams, TopList(), DashboardCharts() (+70 more)

### Community 1 - "Импорт таблиц сделок"
Cohesion: 0.07
Nodes (59): metadata, ImportDeals(), PreviewTable(), REQUIRED, analyzeImportAction(), commitImportAction(), decodeBuffer(), importLimit() (+51 more)

### Community 2 - "Аутентификация и роуты"
Cohesion: 0.06
Nodes (39): GET(), GET(), nav, metadata, metadata, FEATURES, @auth/core/jwt, { handlers, auth, signIn, signOut } (+31 more)

### Community 3 - "Настройки аккаунта"
Cohesion: 0.07
Nodes (40): metadata, SettingsPage(), CurrencySettings(), DeleteAllButton(), DeleteButton(), DeleteAccount(), GoalSettings(), PasswordSettings() (+32 more)

### Community 4 - "Runtime-зависимости"
Cohesion: 0.05
Nodes (43): @base-ui/react, bcryptjs, class-variance-authority, clsx, date-fns, fuzzysort, lucide-react, next (+35 more)

### Community 5 - "Dev-зависимости и тулинг"
Cohesion: 0.05
Nodes (39): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, playwright (+31 more)

### Community 6 - "Скилл verify (E2E-протокол)"
Cohesion: 0.08
Nodes (38): Gotchas: action IDs change per build, Catalog autocomplete selectors and variant controls, Build and launch on port 3789, Gotcha: scope selectors to [data-slot=dialog-content], Direct DB inspection via tsx + PrismaBetterSqlite3, .claude/skills/verify/e2e-catalog.mjs, Catalog import (ByMykel/CSGO-API + ru localization), prisma.marketItem model (kind: skin|sticker) (+30 more)

### Community 7 - "Импорт каталога предметов"
Cohesion: 0.10
Nodes (33): @prisma/client, @prisma/client, loadJson(), main(), SOURCES, Agent, agentRow(), buildPatternRuMap() (+25 more)

### Community 8 - "Загрузка и бэкфилл цен"
Cohesion: 0.10
Nodes (21): days, main(), main(), backfillHistory(), BackfillResult, todayStart(), basePrice(), fakeSource() (+13 more)

### Community 9 - "Автокомплит каталога"
Cohesion: 0.12
Nodes (25): GET(), familyLabel(), familySubtitle(), KIND_LABELS, PLACEHOLDER_SKINS, Props, SkinCombobox(), FINISH_ORDER (+17 more)

### Community 10 - "Конфигурация TypeScript"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 11 - "UI: выпадающее меню"
Cohesion: 0.13
Nodes (19): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+11 more)

### Community 12 - "Фикстуры импорта и статика"
Cohesion: 0.10
Nodes (25): Document/File Glyph Icon (16x16, #666), Globe / Web Glyph Icon (16x16, #666), create-next-app Boilerplate Asset Set (unused branding), Next.js Wordmark Logo (394x80 vector), Vercel Triangle Logo (white on transparent), Browser Window Glyph Icon (16x16, #666), parseCsv, Fixture 02: Google Sheets Tab-Delimited Paste (RUB) (+17 more)

### Community 13 - "Конфиг shadcn"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 14 - "Страница цен и фильтры"
Cohesion: 0.16
Nodes (17): metadata, SearchParams, SortLink(), PricesFilterBar(), Props, PricesSearch(), Go, Table() (+9 more)

### Community 15 - "Панель настроек таблицы"
Cohesion: 0.18
Nodes (13): PricesSidebar(), Profile, Props, SourceOption, SourceSelect(), titleOf(), deletePriceProfile(), profileSchema (+5 more)

### Community 16 - "Модели данных из ТЗ"
Cohesion: 0.15
Nodes (18): Модель Deal (сделка), Модель Platform (справочник площадок с комиссиями), Модель User, Карточка «Лучшая связка по профиту», Таблица сравнения цен (пара площадок), Загрузка цен по расписанию в собственную БД, Переоценка холда по рынку (holding ⋈ PriceQuote), Фильтр по ликвидности (продажи за период) (+10 more)

### Community 17 - "API истории цен"
Cohesion: 0.24
Nodes (11): GET(), BookLevel, HistoryPoint, isPeriod(), ItemDetail, Period, periodDays(), PERIODS (+3 more)

### Community 18 - "Справочник площадок"
Cohesion: 0.24
Nodes (13): AddPlatformForm(), DeletePlatform(), PlatformDTO, PlatformRow(), createPlatformAction(), deletePlatformAction(), feePct, nameTaken() (+5 more)

### Community 19 - "Строка таблицы и график"
Cohesion: 0.15
Nodes (10): ago(), PriceCell(), PriceRow(), Props, SourcePanel(), FALLBACK, short(), SourceIcon() (+2 more)

### Community 20 - "Аудит: деньги и валюты"
Cohesion: 0.17
Nodes (15): E-1 — дашборд по sellDate, список по buyDate, E-2 — fxFactor молча возвращает 1 при отсутствии курса, E-6 — деньги во float, а не Decimal, H1 — список и дашборд фильтруют период по разным датам, H2 — отсутствующий курс валюты молча становится 1:1, L11 — запасные курсы захардкожены и не индицируются, L9 — Decimal фиктивен, округления до копеек нет, roundMoney() — единственная точка округления денег (+7 more)

### Community 21 - "UI: базовые контролы"
Cohesion: 0.22
Nodes (7): Props, NativeSelect(), Button(), buttonVariants, Calendar(), CalendarDayButton(), Textarea()

### Community 22 - "UI: диалог подтверждения"
Cohesion: 0.21
Nodes (12): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogMedia() (+4 more)

### Community 23 - "Расчёт прибыли и сравнение"
Cohesion: 0.20
Nodes (13): ComparisonResult, ComparisonRow, KIND_LABEL, loadComparison(), numOrNull(), SourceRow, toFees(), PRICE_FIELD (+5 more)

### Community 24 - "Параметры таблицы цен"
Cohesion: 0.16
Nodes (12): PricesPage(), EMPTY_RANGES, parsePriceFilters(), parseType(), PRICE_TYPES, PriceField, PriceType, RANGE_KEYS (+4 more)

### Community 25 - "Выбор диапазона дат"
Cohesion: 0.22
Nodes (12): DateRangePicker(), fromISO(), parseRu(), Props, toISO(), toRu(), Popover(), PopoverContent() (+4 more)

### Community 26 - "Аудит: сессии и rate-limit"
Cohesion: 0.18
Nodes (13): C-3 — /api/skins как усилитель нагрузки (синхронный gzip 3 МБ), D-1 — secure у cookie выводится, а не задан явно, D-2 — rate-limiter in-memory без вытеснения, D-3 — мутации без rate-limit (импорт/экспорт/skins), Рекомендуемая схема PasswordResetToken (хэш, TTL, одноразовость), Двухосевой rate-limit входа (IP + email) без lockout-DoS, H3 — нет восстановления, смены пароля и отзыва сессии, L12 — bcrypt cost 10 вместо рекомендованных 12 (+5 more)

### Community 27 - "UI: модальные окна"
Cohesion: 0.18
Nodes (7): Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 28 - "Аудит: границы входных данных"
Cohesion: 0.20
Nodes (10): B-2 — поисковая строка q без ограничения длины, B-3 — нет верхних границ у цен и quantity, B-4 — payload импорта не валидируется схемой, B-5 — resolvePlatform без лимита создаваемых площадок, B-6 — дата покупки в будущем не ограничена, L6 — строка поиска q без ограничения длины, M10 — цены и количество без верхней границы, M11 — даты сделок без диапазона (+2 more)

### Community 29 - "Аудит: CSP и инфраструктура"
Cohesion: 0.22
Nodes (10): D-4 — script-src 'unsafe-inline', M6 — CSP с 'unsafe-inline' в script-src, M7 — next-auth beta на критичном пути и уязвимости зависимостей, N1 — нет middleware.ts, защита держится на явном auth(), N2 — нет error.tsx, N3 — парсер импорта уезжает в клиентский бандл, N5 — MAX_BYTES 5 МБ недостижим за лимитом server action, Nonce-based CSP из proxy.ts (+2 more)

### Community 30 - "UI: карточки и форма входа"
Cohesion: 0.33
Nodes (8): Props, Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 31 - "Аудит: агрегаты и пагинация"
Cohesion: 0.28
Nodes (9): B-1 — параметр platform не валидируется, E-3 — take: 5000 без orderBy, тихое усечение, E-4 — NaN-компараторы и отсутствие tie-breaker, M1 — агрегаты на произвольном подмножестве при take без orderBy, N4 — over-fetch в выборке сделок (include вместо select), Проверено — проблем не найдено (IDOR, SQL-инъекция, CSRF, секреты), Агрегаты в SQL заблокированы: нужен $queryRaw и регистронезависимый поиск, Этап 8 — агрегаты и пагинация, курсорный обход (M1, N4) (+1 more)

### Community 32 - "UI: поля ввода"
Cohesion: 0.33
Nodes (5): NumberInput(), Props, sanitizeNumeric(), Input(), Label()

### Community 33 - "SEO-требования модуля цен"
Cohesion: 0.25
Nodes (9): Публичное vs платное: запрет клоакинга, монетизация инструмента, Внутренняя перелинковка и хабы по оружию/коллекциям, Префикс локали в URL и hreflang, Метатеги и микроразметка Schema.org (Product/Offer/BreadcrumbList), SEO-требования модуля цен, Sitemap index и robots.txt, SSR/ISR рендеринг публичных страниц, Тарифная модель (бесплатный тир vs подписка) (+1 more)

### Community 34 - "Аудит: гигиена доступа"
Cohesion: 0.25
Nodes (8): A-1 — check-then-act без транзакции, A-2 — /api/deals/template без auth, C-1 — findUniqueOrThrow без select тянет passwordHash, L1 — неатомарные пары «проверка владения → мутация», L2 — findUniqueOrThrow без select тянет password_hash, L4 — приватные заметки сделок попадают в логи, L8 — /api/deals/template без проверки сессии, Этап 9 — гигиена и DoS-поверхность (L7, L5, L4, L2, L1, L8)

### Community 35 - "Аудит: 500-е импорта и экспорта"
Cohesion: 0.29
Nodes (8): C-2 — CSV formula injection в экспорте, H4 — откат импорта ≥998 сделок падает (P2029), H5 — параметр to= с граничной датой роняет список и экспорт, L7 — CSV formula injection в экспорте, M9 — ids в откате импорта не типизируется → 500, Этап 1 — подтверждённые 500-е (H5, H4, M9), Импорт и экспорт CSV, План разработки по этапам 1–7

### Community 36 - "Регламент аудита и структура"
Cohesion: 0.29
Nodes (7): Матрица «роут → операции с БД → фильтр по userId», SkinLedger — отчёт по аудиту (bugs.md, коммит 2c3ac8d), Аудит SkinLedger — реестр находок (ревизия 2026-07-22), План устранения находок аудита, Регламент: один этап = один коммит, остановка после отчёта, Структура страниц MVP (/app, /app/deals, /app/import, /app/settings), Разделение публичной и приватной зоны роутинга

### Community 37 - "E2E-тест списка сделок"
Cohesion: 0.29
Nodes (4): allHolding, allMatch, isDesc, profitsDesc

### Community 39 - "Аудит: исторические курсы"
Cohesion: 0.50
Nodes (5): E-5 — мёртвые fx-столбцы, история P&L плывёт, L10 — withdrawal_discount_pct пишется и не читается, M4 — историческая прибыль переписывается, снимок курса мёртв, Этап 6 — исторические курсы, dealFxRate (M4, L10), Учёт выводных скинов (withdrawn_via_skin) — исключён из MVP

### Community 40 - "Сид базы данных"
Cohesion: 0.40
Nodes (3): adapter, platforms, prisma

### Community 41 - "Корневой layout и шрифты"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 42 - "Прокси и CSP-заголовки"
Cohesion: 0.60
Nodes (4): buildCsp(), config, PROTECTED, proxy()

### Community 43 - "Аудит: отображение расчётов"
Cohesion: 0.50
Nodes (4): E-7 — список считает profit для выводных, дашборд — нет, M2 — колонки списка не сводятся между собой, M3 — «средняя маржа» на деле ROI портфеля, Этап 5 — отображение расчётов: затраты/выручка, ROI (M2, M3)

### Community 44 - "E2E-тест каталога"
Cohesion: 0.50
Nodes (3): combo, preview, stickerBtn

### Community 47 - "Бэклог и границы MVP"
Cohesion: 0.67
Nodes (3): Бэклог второго этапа (Steam OpenID, цены, спреды, алерты, тариф), Что осознанно НЕ входит в MVP, Модуль сравнения цен между площадками (этап 2)

### Community 48 - "ТЗ: обзор MVP"
Cohesion: 0.67
Nodes (3): SkinLedger MVP (ТЗ), Метрики успеха MVP, Технологический стек MVP (Next.js + Prisma + Tailwind/shadcn)

## Ambiguous Edges - Review These
- `xlsx sourced from SheetJS CDN, not npm` → `Security headers in next.config.ts (CSP/HSTS)`  [AMBIGUOUS]
  DEPLOY.md · relation: conceptually_related_to
- `Add a real support contact before release` → `Gotcha: scope selectors to [data-slot=dialog-content]`  [AMBIGUOUS]
  DEPLOY.md · relation: conceptually_related_to
- `Проверено — проблем не найдено (IDOR, SQL-инъекция, CSRF, секреты)` → `B-1 — параметр platform не валидируется`  [AMBIGUOUS]
  bugs.md · relation: conceptually_related_to
- `Deal Import Test Corpus (10 fixtures)` → `Document/File Glyph Icon (16x16, #666)`  [AMBIGUOUS]
  public/file.svg · relation: conceptually_related_to

## Knowledge Gaps
- **256 isolated node(s):** `combo`, `stickerBtn`, `preview`, `allHolding`, `allMatch` (+251 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `xlsx sourced from SheetJS CDN, not npm` and `Security headers in next.config.ts (CSP/HSTS)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Add a real support contact before release` and `Gotcha: scope selectors to [data-slot=dialog-content]`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Проверено — проблем не найдено (IDOR, SQL-инъекция, CSRF, секреты)` and `B-1 — параметр platform не валидируется`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Deal Import Test Corpus (10 fixtures)` and `Document/File Glyph Icon (16x16, #666)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `dependencies` connect `Runtime-зависимости` to `Dev-зависимости и тулинг`, `Импорт каталога предметов`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Why does `cn()` connect `UI: выпадающее меню` to `UI: поля ввода`, `UI: бейдж`, `Страница цен и фильтры`, `Строка таблицы и график`, `UI: базовые контролы`, `UI: диалог подтверждения`, `Выбор диапазона дат`, `UI: модальные окна`, `UI: карточки и форма входа`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `readMatrix()` connect `Импорт таблиц сделок` to `Runtime-зависимости`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._