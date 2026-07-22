# Деплой SkinLedger (чек-лист)

## Переменные окружения (прод)

- [ ] `AUTH_SECRET` — сгенерировать: `openssl rand -base64 32`.
- [ ] `DATABASE_URL` — Postgres (Neon/Supabase), не SQLite.
- [ ] **`AUTH_URL`** — публичный адрес приложения, например `https://skinledger.app`.
      Без него при `trustHost: true` базовый URL для callback/redirect собирается из
      заголовка `Host`, то есть `Host: evil.com` его подменяет. Заодно фиксирует
      протокол независимо от того, выставляет ли прокси `x-forwarded-proto`.
- [ ] **`TRUST_PROXY=true`** — ⚠️ **обязательно за доверенным прокси (Vercel/nginx).**
      Без него все клиенты делят один ключ rate-limit `"unknown"`: подделку IP это
      не пропускает (fail-closed), но один атакующий 5 запросами блокирует
      **регистрацию всем** на час, ~30/мин — вход (см. `src/lib/client-ip.ts`).
      За прокси, который перезаписывает `x-forwarded-for` реальным IP, лимит снова
      работает per-IP.

## База данных

- [ ] Сменить `provider` в `prisma/schema.prisma` на `postgresql`, поправить адаптер
      (`@prisma/adapter-*`) под Postgres.
- [ ] `npx prisma migrate deploy`.
- [ ] `npm run import:catalog` — наполнить каталог (~33k): скины, стикеры, агенты,
      кейсы/капсулы/контейнеры, брелки, патчи, граффити, музкиты, коллекционные.
- [ ] Включить автобэкапы БД (в Neon/Supabase из коробки).

## Rate-limit

- [ ] **Перед горизонтальным масштабированием** заменить in-memory лимитер
      (`src/lib/rate-limit.ts`) на общее хранилище (таблица в Postgres или Upstash
      Redis): сейчас счётчики живут в памяти процесса и не разделяются между
      инстансами serverless.

## Зависимости

- [ ] `xlsx` подключён из официального CDN SheetJS (`https://cdn.sheetjs.com/...tgz`,
      см. `package.json`), а не из npm — там `xlsx` завис на 0.18.5 с непофикшенной
      high-severity prototype-pollution. На сборке нужен доступ к `cdn.sheetjs.com`
      при `npm install`. При обновлении — брать новую версию тоже с CDN SheetJS.

## Прочее

- [ ] Security-заголовки (`next.config.ts`) — уже настроены (CSP/HSTS/…);
      проверить, что CSP `img-src` покрывает актуальные домены CDN Steam.
- [ ] Автообновление каталога: недельный GitHub Action, дёргающий `import:catalog`
      против прод-БД + сброс кэша индекса (`getSkinFamilies` TTL 1 ч).
