import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import { SkinPriceChart } from "@/components/skin-price-chart";
import { SkinOffers } from "@/components/skin-offers";
import { SiteHeader } from "@/components/site-header";
import { displayCurrency } from "@/lib/display-currency";
import { formatMoney, formatPct } from "@/lib/deal-math";
import { fxFactor } from "@/lib/currency";
import { getRates } from "@/lib/rates";
import { netSellRevenue } from "@/lib/prices/profit";
import { loadItemPage, RARITY_RU, WEAR_RU, type ItemPageData } from "@/lib/prices/item-page";

// Публичная зона (ТЗ 5): страница индексируется, поэтому рендер серверный, а
// не клиентский — бот должен видеть цены в HTML (ТЗ 7.1 допускает SSR либо
// ISR). Кэш по времени пришлось снять: валюта отображения живёт в cookie
// переключателя в шапке, а cookie делает рендер динамическим.

type Params = Promise<{ slug: string }>;

const SITE = process.env.AUTH_URL ?? "http://localhost:3000";

const ruRarity = (r: string | null) => (r ? (RARITY_RU[r] ?? r) : null);
const ruWear = (w: string | null) => (w ? (WEAR_RU[w] ?? w) : null);

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
    title: `${name} — цены и предложения | SkinLedger`,
    description:
      `${name}: ${priceLine}. Сравнение цен по площадкам, история, ` +
      `лучшая связка для перепродажи с учётом комиссий.`,
    alternates: { canonical: url },
    // Тонкие страницы не индексируем (ТЗ 7.6): цена меньше чем на двух
    // площадках — это пустая страница, а массив таких вредит всему домену.
    robots: data.thin ? { index: false, follow: true } : undefined,
    openGraph: {
      title: `${name} — цены и предложения`,
      description: `Цены на ${data.offers.length} площадках, график и расчёт прибыли.`,
      url,
      type: "website",
      images: data.item.image ? [{ url: data.item.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — цены и предложения`,
      images: data.item.image ? [data.item.image] : undefined,
    },
  };
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

/** Только процент со стрелкой — для строки «Изменение цены». */
function Pct({ pct }: { pct: number | null }) {
  if (pct == null) return <span>—</span>;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${up ? "text-primary" : "text-destructive"}`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {formatPct(pct)}
    </span>
  );
}

function Delta({ abs, pct }: { abs: React.ReactNode; pct: number | null }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "text-primary" : "text-destructive"}>
      <span className="inline-flex items-center gap-1">
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {abs} ({formatPct(pct)})
      </span>
    </span>
  );
}

/** Schema.org: Product + AggregateOffer, крошки и FAQ (ТЗ 7.3). */
function JsonLd({ data, faq }: { data: ItemPageData; faq: { q: string; a: string }[] }) {
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
  const faqLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqLd ? [product, crumbs, faqLd] : [product, crumbs]),
      }}
    />
  );
}

export default async function SkinPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, ratesResult] = await Promise.all([loadItemPage(slug), getRates()]);
  if (!data) notFound();

  const cur = await displayCurrency();
  const fx = fxFactor("USD", cur, ratesResult.rates);
  const money = (usd: number) => (fx == null ? formatMoney(usd, "USD") : formatMoney(usd * fx, cur));
  const signed = (usd: number) =>
    fx == null ? formatMoney(usd, "USD", true) : formatMoney(usd * fx, cur, true);

  const { item, offers, market, totals, changes, best, variants, overview, periods, orders, similar, chart } =
    data;

  const week = periods.find((p) => p.days === 7);
  // «Разница цен» референса: между самой дорогой и самой дешёвой площадкой.
  const spread =
    offers.length > 1 ? offers[offers.length - 1].price - offers[0].price : null;
  const spreadPct = spread != null && offers[0].price ? (spread / offers[0].price) * 100 : null;

  // Вопросы собираются из тех же данных, что и страница: выдумывать нечего.
  const faq: { q: string; a: string }[] = [];
  if (market.low != null && offers.length) {
    faq.push({
      q: `Какая текущая цена на ${item.marketHashName}?`,
      a:
        `Самая низкая цена среди ${offers.length} отслеживаемых площадок — ${money(market.low)} ` +
        `(${offers[0].title}). Медианная цена по площадкам — ${money(market.median ?? market.low)}. ` +
        `Цены обновляются по расписанию и хранятся в нашей базе.`,
    });
  }
  if (variants.length > 1) {
    const withPrice = variants.filter((v) => v.price != null).slice(0, 5);
    if (withPrice.length) {
      faq.push({
        q: `Сколько стоят другие варианты ${overview.skinName ?? item.marketHashName}?`,
        a:
          `Минимальные цены по вариантам: ` +
          withPrice
            .map((v) => `${[v.prefix, v.label].filter(Boolean).join(" ")} — ${money(v.price!)}`)
            .join(", ") +
          ".",
      });
    }
  }
  if (best) {
    faq.push({
      q: `Можно ли заработать на перепродаже ${item.marketHashName}?`,
      a:
        `Сейчас лучшая связка: купить на ${best.buy.title} за ${money(best.buy.price)} ` +
        `и продать на ${best.sell.title} за ${money(best.sell.price)}. ` +
        `После комиссий покупки, продажи и вывода остаётся ${signed(best.profit)} (${formatPct(best.profitPct)}).`,
    });
  }
  if (totals.sales30d != null) {
    faq.push({
      q: `Насколько ликвиден ${item.marketHashName}?`,
      a: `За последние 30 дней на отслеживаемых площадках прошло ${totals.sales30d.toLocaleString("ru-RU")} продаж, сейчас выставлено ${totals.offers?.toLocaleString("ru-RU") ?? "—"} предложений.`,
    });
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <JsonLd data={data} faq={faq} />



      {/* Крошки (ТЗ 7.3) */}
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Главная
        </Link>
        <span>/</span>
        <span>CS2 Скины</span>
        {item.collection && (
          <>
            <span>/</span>
            <span>{item.collection}</span>
          </>
        )}
        {item.weapon && (
          <>
            <span>/</span>
            <span>{item.weapon}</span>
          </>
        )}
        {overview.rarity && (
          <>
            <span>/</span>
            <span>{ruRarity(overview.rarity)}</span>
          </>
        )}
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{item.marketHashName}</h1>
        {overview.rarity && (
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{ruRarity(overview.rarity)}</span>
        )}
        {item.stattrak && (
          <span className="rounded bg-[#cf6a32]/20 px-2 py-0.5 text-xs font-medium text-[#cf6a32]">
            StatTrak™
          </span>
        )}
        {item.souvenir && (
          <span className="rounded bg-[#ffd700]/20 px-2 py-0.5 text-xs font-medium text-[#e0b400]">
            Souvenir
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* ── Левая колонка: справочная часть ─────────────────────────── */}
        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.marketHashName}
                className="mx-auto h-36 w-full object-contain"
              />
            ) : (
              <div className="h-36 w-full rounded bg-muted/40" />
            )}
          </div>

          {variants.length > 1 && (
            <Panel
              title="Виды предмета"
              action={<span className="text-xs text-muted-foreground">{variants.length}</span>}
            >
              <div className="grid grid-cols-2 gap-2">
                {variants.map((v) => {
                  const body = (
                    <>
                      {v.prefix && (
                        <span className="block text-[10px] text-muted-foreground">{v.prefix}</span>
                      )}
                      <span className="block truncate text-xs">{v.label}</span>
                      <span className="block text-xs font-medium tabular-nums">
                        {v.price != null ? money(v.price) : "—"}
                      </span>
                    </>
                  );
                  return v.current ? (
                    <span
                      key={v.slug}
                      className="rounded-lg border border-primary/60 bg-primary/10 px-2 py-1.5"
                    >
                      {body}
                    </span>
                  ) : (
                    <Link
                      key={v.slug}
                      href={`/skins/${v.slug}`}
                      className="rounded-lg border border-border px-2 py-1.5 transition-colors hover:border-primary/60"
                    >
                      {body}
                    </Link>
                  );
                })}
              </div>
            </Panel>
          )}

          <Panel title="Обзор предмета">
            <Row label="Категория" value={overview.kindLabel} />
            {overview.weapon && <Row label="Оружие" value={overview.weapon} />}
            {overview.rarity && <Row label="Редкость" value={ruRarity(overview.rarity)} />}
            {overview.skinName && <Row label="Раскраска" value={overview.skinName} />}
            {overview.wear && <Row label="Износ" value={ruWear(overview.wear)} />}
            {item.collection && <Row label="Коллекция" value={item.collection} />}
            <Row
              label="Диапазон цен"
              value={
                overview.priceRange
                  ? `${money(overview.priceRange[0])} — ${money(overview.priceRange[1])}`
                  : "—"
              }
            />
            <Row
              label="Предложений продажи"
              value={totals.offers?.toLocaleString("ru-RU") ?? "—"}
            />
            <Row label="StatTrak™ доступен" value={overview.stattrakAvailable ? "Да" : "Нет"} />
            <Row label="Souvenir доступен" value={overview.souvenirAvailable ? "Да" : "Нет"} />
          </Panel>

          <Panel title="Изменение цен">
            <Row
              label="Текущая цена"
              value={market.median != null ? money(market.median) : "—"}
            />
            {periods.map((p) => (
              <Row
                key={p.label}
                label={`Мин. / макс. за ${p.label}`}
                value={
                  p.low != null && p.high != null ? `${money(p.low)} — ${money(p.high)}` : "—"
                }
              />
            ))}
            {periods
              .filter((p) => p.days != null)
              .map((p) => (
                <Row
                  key={`c-${p.label}`}
                  label={`Изменение за ${p.label}`}
                  value={
                    <Delta abs={p.change != null ? signed(p.change) : "—"} pct={p.changePct} />
                  }
                />
              ))}
          </Panel>

          <Panel title="Статистика продаж">
            <Row
              label="Продаж за 30 дней"
              value={totals.sales30d?.toLocaleString("ru-RU") ?? "—"}
            />
            {offers.slice(0, 5).map((o) => (
              <Row
                key={o.slug}
                label={o.title}
                value={o.sales30d?.toLocaleString("ru-RU") ?? "—"}
              />
            ))}
          </Panel>
        </aside>

        {/* ── Правая колонка: цены, график, заработок ──────────────────── */}
        <main className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Рыночная цена",
                value: market.median != null ? money(market.median) : "—",
                hint: `медиана по ${offers.length} площадкам`,
              },
              {
                label: "Самая низкая",
                value: market.low != null ? money(market.low) : "—",
                hint: offers[0]?.title,
              },
              {
                label: "Средняя за 7 дней",
                value: market.avg7 != null ? money(market.avg7) : "—",
                hint:
                  week?.low != null && week.high != null
                    ? `${money(week.low)} — ${money(week.high)}`
                    : undefined,
              },
              {
                label: "Разница цен",
                value: spread != null ? money(spread) : "—",
                hint:
                  spreadPct != null ? `${formatPct(spreadPct)} между площадками` : undefined,
              },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums">{c.value}</div>
                {c.hint && <div className="mt-1 text-xs text-muted-foreground">{c.hint}</div>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Изменение цены:</span>
            {([
              ["24ч", changes.d1],
              ["7д", changes.d7],
              ["30д", changes.d30],
            ] as const).map(([label, pct]) => (
              <span key={label} className="inline-flex items-center gap-1">
                <Pct pct={pct} />
                <span>{label}</span>
              </span>
            ))}
          </div>

          <Panel
            title="Предложения на площадках"
            action={
              <span className="text-xs text-muted-foreground">
                обновлено{" "}
                {offers[0]
                  ? offers[0].fetchedAt.toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            }
          >
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Цены по этому предмету пока не загружены.
              </p>
            ) : (
              <SkinOffers
                offers={offers.map((o) => ({
                  slug: o.slug,
                  title: o.title,
                  price: o.price,
                  offers: o.offers,
                  sales30d: o.sales30d,
                }))}
                cur={cur}
                fx={fx}
              />
            )}
          </Panel>

          <Panel title="История цен">
            <SkinPriceChart
              points={chart.points}
              sources={chart.sources}
              cur={cur}
              fx={fx}
              now={data.now}
            />
          </Panel>

          {/* «Как на этом заработать» — расчёт связки по-чековому (ТЗ 3.4) */}
          {best && (
            <Panel title="Как на этом заработать">
              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <span className="flex items-center gap-2">
                      Купить на
                      <SourceIcon
                        slug={best.buy.slug}
                        title={best.buy.title}
                        className="size-5 text-[9px]"
                      />
                      <span className="font-medium">{best.buy.title}</span>
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
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Считаем профит до покупки — как по чеку: цена покупки, цена продажи и все
                    комиссии площадок. Подобрать такие связки по всему каталогу можно в{" "}
                    <Link href="/app/prices" className="text-primary hover:underline">
                      таблице сравнения
                    </Link>
                    .
                  </p>
                </div>

                <div className="rounded-lg border border-border/60 p-3 text-xs">
                  <Row label="Покупка" value={money(best.buy.price)} />
                  <Row label="Продажа" value={money(best.sell.price)} />
                  <Row
                    label="Комиссии площадок"
                    value={
                      <span className="text-destructive">
                        {signed(
                          netSellRevenue(best.sell.price, best.sell.fees) -
                            best.sell.price -
                            (best.buy.price * best.buy.fees.buyFeePct) / 100,
                        )}
                      </span>
                    }
                  />
                  <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Профит</span>
                    <span
                      className={`text-base font-semibold tabular-nums ${
                        best.profit > 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {signed(best.profit)} ({formatPct(best.profitPct)})
                    </span>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {orders.length > 0 && (
            <Panel
              title="Лучшие ордера на покупку"
              action={<span className="text-xs text-muted-foreground">{orders.length}</span>}
            >
              <ul className="space-y-1.5">
                {orders.map((o) => (
                  <li
                    key={o.slug}
                    className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-1.5 text-xs"
                  >
                    <SourceIcon slug={o.slug} title={o.title} className="size-5 text-[9px]" />
                    <span className="flex-1 truncate">{o.title}</span>
                    <span className="tabular-nums" style={{ color: "#4a90d9" }}>
                      {money(o.price)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                По одному лучшему ордеру с площадки: глубину стакана источник цен не отдаёт.
              </p>
            </Panel>
          )}

          {similar.length > 0 && (
            <Panel
              title="Похожие предметы"
              action={<span className="text-xs text-muted-foreground">{similar.length}</span>}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {similar.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/skins/${s.slug}`}
                    className="rounded-lg border border-border p-2 transition-colors hover:border-primary/60"
                  >
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-16 w-full object-contain" loading="lazy" />
                    ) : (
                      <div className="h-16 w-full rounded bg-muted/40" />
                    )}
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{s.weapon}</div>
                    <div className="truncate text-xs">{s.name}</div>
                    <div className="text-xs font-medium tabular-nums">
                      {s.price != null ? money(s.price) : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            </Panel>
          )}

          {faq.length > 0 && (
            <Panel title="Частые вопросы">
              <div className="space-y-2">
                {faq.map((f) => (
                  <details
                    key={f.q}
                    className="rounded-lg border border-border/60 px-3 py-2 [&_summary]:cursor-pointer"
                  >
                    <summary className="text-sm font-medium">{f.q}</summary>
                    <p className="mt-2 text-xs text-muted-foreground">{f.a}</p>
                  </details>
                ))}
              </div>
            </Panel>
          )}

          {data.thin && (
            <p className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
              По этому предмету есть цена меньше чем на двух площадках, поэтому страница закрыта
              от индексации до появления данных.
            </p>
          )}
        </main>
      </div>
      </div>
    </>
  );
}
