import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import { SkinPriceChart } from "@/components/skin-price-chart";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPct } from "@/lib/deal-math";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { loadItemPage, type ItemPageData } from "@/lib/prices/item-page";

// Публичная зона (ТЗ 5): страница индексируется, поэтому рендер серверный, а
// не клиентский — бот должен видеть цены в HTML. Ревалидация по времени
// (ТЗ 7.1, ориентир 15–60 минут): цены всё равно обновляет крон.
export const revalidate = 1800;

// Публичная страница считает в рублях: аудитория русскоязычная, а
// авторизованного пользователя с его валютой здесь может и не быть.
const PUBLIC_CURRENCY = "RUB";

type Params = Promise<{ slug: string }>;

const SITE = process.env.AUTH_URL ?? "http://localhost:3000";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadItemPage(slug);
  if (!data) return { title: "Предмет не найден — SkinLedger" };

  const name = data.item.marketHashName;
  const url = `${SITE}/skins/${data.item.slug}`;
  const priceLine =
    data.market.low != null
      ? `от ${formatMoney(data.market.low, "USD")} на ${data.offers.length} площадках`
      : "цены пока не загружены";

  return {
    title: `${name} — цена ${priceLine} | SkinLedger`,
    description:
      `${name}: актуальные цены на ${data.offers.length} торговых площадках, ` +
      `история цен и лучшая связка для перепродажи с учётом комиссий.`,
    alternates: { canonical: url },
    // Тонкие страницы не индексируем (ТЗ 7.6): цена меньше чем на двух
    // площадках — это пустая страница, а массив таких вредит всему домену.
    robots: data.thin ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${name} — цены и история`,
      description: `Цены на ${data.offers.length} площадках, график и расчёт прибыли.`,
      url,
      type: "website",
      images: data.item.image ? [{ url: data.item.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — цены и история`,
      images: data.item.image ? [data.item.image] : undefined,
    },
  };
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Change({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${up ? "text-primary" : "text-destructive"}`}
    >
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {formatPct(pct)}
    </span>
  );
}

/** Разметка Schema.org: Product + AggregateOffer и хлебные крошки (ТЗ 7.3). */
function JsonLd({ data }: { data: ItemPageData }) {
  const url = `${SITE}/skins/${data.item.slug}`;
  const prices = data.offers.map((o) => o.price);
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.item.marketHashName,
    image: data.item.image ?? undefined,
    category: data.item.collection ?? undefined,
    ...(prices.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: data.offers.length,
            offers: data.offers.map((o) => ({
              "@type": "Offer",
              price: o.price,
              priceCurrency: "USD",
              seller: { "@type": "Organization", name: o.title },
              availability: "https://schema.org/InStock",
            })),
          },
        }
      : {}),
  };
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: SITE },
      { "@type": "ListItem", position: 2, name: "Скины", item: `${SITE}/skins` },
      ...(data.item.weapon
        ? [{ "@type": "ListItem", position: 3, name: data.item.weapon, item: `${SITE}/skins` }]
        : []),
      {
        "@type": "ListItem",
        position: data.item.weapon ? 4 : 3,
        name: data.item.marketHashName,
        item: url,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([product, crumbs]) }}
    />
  );
}

export default async function SkinPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, ratesResult] = await Promise.all([loadItemPage(slug), getRates()]);
  if (!data) notFound();

  const cur = PUBLIC_CURRENCY;
  const fx = fxFactor("USD", cur, ratesResult.rates);
  const money = (usd: number) => (fx == null ? formatMoney(usd, "USD") : formatMoney(usd * fx, cur));
  const usd = (v: number) => formatMoney(v, "USD");

  const { item, offers, market, totals, changes, best, variants, chart } = data;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <JsonLd data={data} />

      {/* Шапка публичной зоны: без неё страница выглядит выпавшей из сайта */}
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold">
          Skin<span className="text-primary">Ledger</span>
        </Link>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/app/prices" />}>
          Таблица сравнения
        </Button>
      </header>

      {/* Хлебные крошки (ТЗ 7.3) */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Главная
        </Link>
        <span>/</span>
        <span>Скины</span>
        {item.weapon && (
          <>
            <span>/</span>
            <span>{item.weapon}</span>
          </>
        )}
        {item.collection && (
          <>
            <span>/</span>
            <span>{item.collection}</span>
          </>
        )}
      </nav>

      <div className="flex flex-wrap items-start gap-4">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.marketHashName}
            className="h-28 w-40 shrink-0 rounded-lg border border-border bg-card object-contain p-2"
          />
        ) : (
          <div className="h-28 w-40 shrink-0 rounded-lg border border-border bg-card" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{item.titleTop}</span>
            {item.stattrak && (
              <span className="rounded bg-[#cf6a32]/20 px-1.5 py-0.5 text-xs font-medium text-[#cf6a32]">
                StatTrak™
              </span>
            )}
            {item.souvenir && (
              <span className="rounded bg-[#ffd700]/20 px-1.5 py-0.5 text-xs font-medium text-[#e0b400]">
                Souvenir
              </span>
            )}
            {item.rarity && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.rarity}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold">{item.titleMain}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.marketHashName}
            {item.collection && <> · коллекция «{item.collection}»</>}
          </p>
        </div>
      </div>

      {/* Карточки цен (ТЗ 3.4) */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Рыночная цена"
          value={market.median != null ? money(market.median) : "—"}
          hint={market.median != null ? `медиана по ${offers.length} площадкам` : undefined}
        />
        <Card
          label="Самая низкая цена"
          value={market.low != null ? money(market.low) : "—"}
          hint={offers[0]?.title}
        />
        <Card
          label="Средняя за 7 дней"
          value={market.avg7 != null ? money(market.avg7) : "—"}
          hint={
            <span className="flex flex-wrap gap-x-3">
              <span>24ч <Change pct={changes.d1} /></span>
              <span>7д <Change pct={changes.d7} /></span>
              <span>30д <Change pct={changes.d30} /></span>
            </span>
          }
        />
        <Card
          label="Предложений / продаж"
          value={
            <>
              {totals.offers?.toLocaleString("ru-RU") ?? "—"}
              <span className="text-muted-foreground"> / </span>
              {totals.sales30d?.toLocaleString("ru-RU") ?? "—"}
            </>
          }
          hint="всего предложений · продаж за 30 дней"
        />
      </div>

      {/* Лучшая связка по профиту — отличие SkinLedger (ТЗ 3.4) */}
      {best && (
        <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">
            Лучшая связка по профиту
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="flex items-center gap-2">
              Купить на
              <SourceIcon slug={best.buy.slug} title={best.buy.title} className="size-5 text-[9px]" />
              <span className="font-medium">{best.buy.title}</span>
              <span className="tabular-nums">{money(best.buy.price)}</span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
            <span className="flex items-center gap-2">
              продать на
              <SourceIcon
                slug={best.sell.slug}
                title={best.sell.title}
                className="size-5 text-[9px]"
              />
              <span className="font-medium">{best.sell.title}</span>
              <span className="tabular-nums">{money(best.sell.price)}</span>
            </span>
            <span
              className={`ml-auto text-base font-semibold tabular-nums ${
                best.profit > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {fx == null
                ? formatMoney(best.profit, "USD", true)
                : formatMoney(best.profit * fx, cur, true)}{" "}
              ({formatPct(best.profitPct)})
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Прибыль после комиссий покупки, продажи и вывода. Подобрать такие связки по всему
            каталогу можно в{" "}
            <Link href="/app/prices" className="text-primary hover:underline">
              таблице сравнения
            </Link>
            .
          </p>
        </div>
      )}

      {/* Варианты предмета (ТЗ 3.4) */}
      {variants.length > 1 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">Варианты</h2>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const inner = (
                <>
                  <span>{v.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {v.price != null ? money(v.price) : "—"}
                  </span>
                </>
              );
              return v.current ? (
                <span
                  key={v.slug}
                  className="flex items-center gap-2 rounded-lg border border-primary/60 bg-primary/10 px-2.5 py-1.5 text-xs"
                >
                  {inner}
                </span>
              ) : (
                <Link
                  key={v.slug}
                  href={`/skins/${v.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-primary/60"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* График истории (ТЗ 3.4) */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">История цен</h2>
          <SkinPriceChart
            points={chart.points}
            sources={chart.sources}
            cur={cur}
            fx={fx}
            now={data.now}
          />
        </section>

        {/* Предложения на сайтах (ТЗ 3.4) */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Предложения на площадках</h2>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Цены по этому предмету пока не загружены.</p>
          ) : (
            <ul className="space-y-2">
              {offers.map((o) => (
                <li
                  key={o.slug}
                  className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <SourceIcon slug={o.slug} title={o.title} className="size-7 text-[11px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{o.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {o.offers != null ? `${o.offers.toLocaleString("ru-RU")} предложений` : "—"}
                      {o.sales30d != null && ` · ${o.sales30d.toLocaleString("ru-RU")} продаж/30д`}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block text-sm font-medium">{money(o.price)}</span>
                    <span className="block text-xs text-muted-foreground">{usd(o.price)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Цены обновляются по расписанию и хранятся в нашей базе; последнее обновление —{" "}
            {offers[0]
              ? offers[0].fetchedAt.toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
            .
          </p>
        </section>
      </div>

      {data.thin && (
        <p className="mt-6 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
          По этому предмету есть цена меньше чем на двух площадках, поэтому страница закрыта от
          индексации до появления данных.
        </p>
      )}
    </div>
  );
}
