# Задача: добавить интернационализацию (RU/EN) в SkinLedger

Ты работаешь в проекте на Next.js (App Router) + Prisma + NextAuth v5. Нужно внедрить полноценную i18n на базе `next-intl`. Русский — язык по умолчанию, английский — второй. Действуй по шагам ниже. **Не спрашивай подтверждения по уже принятым решениям** — они зафиксированы в разделе «Ограничения».

## Ограничения и уже принятые решения

- Библиотека: `next-intl` (последняя стабильная, совместимая с текущей версией Next.js в проекте).
- Локали: `ru` (default) и `en`.
- Стратегия префикса: `as-needed` — русский БЕЗ префикса в URL (`/dashboard`), английский с префиксом (`/en/dashboard`). Существующие русские URL ломать нельзя.
- Все компоненты уезжают под сегмент `app/[locale]/`.
- Доменные термины CS2 (float, wear, pattern, StatTrak, Souvenir, Field-Tested, Battle-Scarred, Minimal Wear, Factory New, Well-Worn) в `en.json` НЕ переводятся — оставляй латиницей. В `ru.json` для этих терминов тоже оставляй латиницу (сообщество так привыкло), русскими делай только подписи полей вокруг них.
- Валюту НЕ хардкодить в строках перевода. Символ и формат валюты идут через `useFormatter`/`Intl.NumberFormat`, а не через json. Выбор валюты не привязывать к языку интерфейса — оставь текущую логику валюты как есть, только замени ручные символы `₽`/`$` на форматтер.

## Шаг 0 — сначала изучи код, потом меняй

Перед любыми правками прочитай и покажи мне, что нашёл:

1. Текущий `middleware.ts` (если есть) — особенно как он взаимодействует с NextAuth. **Это самое опасное место.** next-intl тоже требует middleware. Их надо СКОМПОНОВАТЬ, а не перезаписать один другим. `/api/auth/*` и остальные `/api/*` не должны попадать под локализацию.
2. `next.config.*` — чтобы обернуть в плагин, не потеряв текущую конфигурацию.
3. Корневой `app/layout.tsx` и структуру `app/` — чтобы понять, что переносить под `[locale]`.
4. Где сейчас лежит конфиг NextAuth и как подключён middleware для защиты роутов.
5. Пройдись по компонентам и собери список всех захардкоженных пользовательских строк (кнопки, лейблы, тосты/ошибки, метатеги, тексты писем/уведомлений если есть).

Покажи мне план стыковки middleware ДО того, как его писать.

## Шаг 1 — установка

```bash
npm install next-intl
```

## Шаг 2 — конфиги i18n

Создай `src/i18n/routing.ts`:
```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en'],
  defaultLocale: 'ru',
  localePrefix: 'as-needed',
});
```

Создай `src/i18n/navigation.ts`:
```ts
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

Создай `src/i18n/request.ts`:
```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

## Шаг 3 — next.config

Оберни существующий конфиг, ничего из него не удаляя:
```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

export default withNextIntl({
  // ВЕСЬ текущий конфиг сюда без изменений
});
```

## Шаг 4 — middleware (критично)

next-intl даёт `createMiddleware(routing)`. Если в проекте УЖЕ есть middleware (например для NextAuth), не перезаписывай его — скомбинируй. Общий паттерн: вызывать i18n-middleware внутри своей функции и пропускать `/api`, статику и файлы. Пример базового варианта, если своего middleware нет:

```ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

Если middleware для auth есть — покажи мне предлагаемую скомпонованную версию и объясни порядок вызовов, прежде чем применять. Убедись, что защита роутов NextAuth продолжает работать после добавления префикса `/en`.

## Шаг 5 — перенос под [locale]

Перенеси содержимое `app/` под `app/[locale]/`. Корневой layout переделай так:

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) notFound();

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Важно:** вызывай `setRequestLocale(locale)` в КАЖДОЙ странице и layout до любых функций next-intl, иначе статический рендер деградирует в динамический. Пройдись по всем страницам и добавь это.

## Шаг 6 — файлы переводов

Создай `messages/ru.json` и `messages/en.json` с одинаковой структурой ключей. Сгруппируй по фичам (`dashboard`, `auth`, `trades`, `common` и т.д.). Пример:

```json
{
  "common": {
    "save": "Сохранить",
    "cancel": "Отмена"
  },
  "dashboard": {
    "title": "Панель",
    "purchase": "Покупка",
    "sale": "Продажа",
    "netProfit": "Чистая прибыль"
  }
}
```

Замени ВСЕ собранные на шаге 0 захардкоженные строки на ключи. Английский перевод сделай сам, но отметь термины, где не уверен, — я вычитаю. Метатеги (`title`, `og:*`), тексты ошибок валидации и уведомлений тоже локализуй.

## Шаг 7 — использование в компонентах

Серверные и клиентские компоненты используют один хук:
```tsx
import { useTranslations } from 'next-intl';
const t = useTranslations('dashboard');
// t('title')
```

Замени все `next/link` → `Link` и `useRouter`/`usePathname` из `next/navigation` → из `@/i18n/navigation`, чтобы навигация была локале-aware.

Форматирование чисел/валюты:
```tsx
import { useFormatter } from 'next-intl';
const format = useFormatter();
format.number(price, { style: 'currency', currency: 'RUB' });
```

## Шаг 8 — переключатель языка

Добавь компонент-переключатель (RU/EN) в шапку/настройки:
```tsx
'use client';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value })}
    >
      <option value="ru">RU</option>
      <option value="en">EN</option>
    </select>
  );
}
```

## Шаг 9 — TypeScript типобезопасность (опционально, но желательно)

Настрой автодополнение ключей переводов через augmentation `next-intl`, чтобы `t('...')` проверялся компилятором. Используй `ru.json` как источник типов.

## Проверка перед завершением

- [ ] `/dashboard` открывается на русском без префикса, `/en/dashboard` — на английском.
- [ ] Защита роутов NextAuth работает на обеих локалях, `/api/auth/*` не сломан.
- [ ] Нет незамеченных захардкоженных строк (прогони поиск по кириллице в компонентах).
- [ ] Статический рендер не деградировал (нет пропущенного `setRequestLocale`).
- [ ] Символы валют идут через форматтер, не из json.
- [ ] `lang` в `<html>` меняется по локали.
- [ ] Метатеги локализованы (`generateMetadata` с переводами).
- [ ] Проект собирается: `npm run build` без ошибок.

В конце покажи список файлов, которые я должен вычитать вручную (переводы, где ты не был уверен в формулировках).
