import { connection } from "next/server";
import {
  BarChart3,
  Boxes,
  Coins,
  FileSpreadsheet,
  ListFilter,
  Wallet,
} from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { withDynamicKeys } from "@/i18n/dynamic";
import { toLocale } from "@/i18n/routing";
import { WaitlistForm } from "@/components/waitlist-form";

// Порядок карточек — здесь, тексты — в messages (landing.feature.*).
const FEATURES = [
  { key: "profit", icon: Wallet },
  { key: "dashboard", icon: BarChart3 },
  { key: "import", icon: FileSpreadsheet },
  { key: "currency", icon: Coins },
  { key: "catalog", icon: Boxes },
  { key: "list", icon: ListFilter },
] as const;

// Демо-цифры превью. Валюта фиксированная (это витрина, а не данные
// пользователя), но формат и символ всё равно из Intl, а не из строки.
const DEMO_CURRENCY = "RUB";
const DEMO = {
  netProfit: 18420,
  turnover: 212300,
  roiPct: 14.2,
  holding: 52000,
  rows: [
    { name: "AK-47 | Redline (FT)", buy: 1500, sell: 2100, profit: 490 },
    { name: "AWP | Asiimov (WW)", buy: 4050, sell: 3700, profit: -560 },
    { name: "★ Karambit | Doppler (FN)", buy: 52000, sell: null, profit: null },
  ],
} as const;

const CTA_PRIMARY =
  "inline-flex h-11 items-center justify-center rounded-xl bg-[#58e2b0] px-6 text-sm font-semibold text-slate-950 transition hover:bg-[#7fecc4]";
const CTA_GHOST =
  "inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-6 text-sm font-medium text-white transition hover:bg-white/10";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = toLocale(rawLocale);
  setRequestLocale(locale);

  // CSP с nonce требует динамического рендера: nonce проставляется при SSR
  // из заголовка запроса, а у страницы, собранной на билде, запроса нет.
  await connection();
  const t = await getTranslations("landing");
  const td = withDynamicKeys(t);
  const format = await getFormatter();
  const money = (value: number, signed = false) =>
    (signed && value > 0 ? "+" : "") +
    format.number(value, {
      style: "currency",
      currency: DEMO_CURRENCY,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    });

  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#080b12] text-slate-200">
      {/* Фоновые свечения */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14rem] size-[44rem] -translate-x-1/2 rounded-full bg-[#14b179]/20 blur-[130px]" />
        <div className="absolute right-[8%] top-[6rem] size-[26rem] rounded-full bg-violet-500/15 blur-[130px]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>

      {/* Навбар */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-lg font-semibold text-white">
          Skin<span className="text-[#58e2b0]">Ledger</span>
        </span>
        {loggedIn ? (
          <Link href="/app" className={CTA_GHOST + " h-9 px-4"}>
            {t("openApp")}
          </Link>
        ) : (
          <Link href="/login" className="text-sm text-slate-300 hover:text-white">
            {t("signIn")}
          </Link>
        )}
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-24 px-4 pb-24 pt-10 sm:pt-16">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#58e2b0]/30 bg-[#58e2b0]/10 px-3 py-1 text-xs font-medium text-[#7fecc4]">
            <span className="size-1.5 rounded-full bg-[#58e2b0]" />
            {t("badge")}
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            {t.rich("headline", {
              accent: (chunks) => (
                <span className="bg-gradient-to-r from-[#7fecc4] to-[#9fead2] bg-clip-text text-transparent">
                  {chunks}
                </span>
              ),
            })}
          </h1>
          <p className="max-w-xl text-lg text-slate-400">
            {t("subtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {loggedIn ? (
              <Link href="/app" className={CTA_PRIMARY}>
                {t("openApp")}
              </Link>
            ) : (
              <>
                <Link href="/register" className={CTA_PRIMARY}>
                  {t("startFree")}
                </Link>
                <Link href="/login" className={CTA_GHOST}>
                  {t("signIn")}
                </Link>
              </>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span>{t("statCatalog")}</span>
            <span className="hidden sm:inline">·</span>
            <span>{t("statCurrencies")}</span>
            <span className="hidden sm:inline">·</span>
            <span>{t("statImport")}</span>
          </div>
        </section>

        {/* Превью интерфейса */}
        <section aria-hidden className="relative">
          <div className="absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[2rem] bg-gradient-to-b from-[#14b179]/10 to-transparent blur-2xl" />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl shadow-black/40 backdrop-blur-sm sm:p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <PreviewStat label={t("demoNetProfit")} value={money(DEMO.netProfit, true)} tone="pos" />
              <PreviewStat label={t("demoTurnover")} value={money(DEMO.turnover)} />
              <PreviewStat label={t("demoRoi")} value={format.number(DEMO.roiPct / 100, "percent")} tone="pos" />
              <PreviewStat label={t("demoHolding")} value={money(DEMO.holding)} />
            </div>

            {/* Мини-график */}
            <div className="mt-3 flex h-24 items-end gap-1.5 rounded-xl border border-white/10 bg-black/20 p-3">
              {[38, 52, 44, 63, 71, 58, 80, 68, 90, 76, 96, 84].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="flex-1 rounded-t bg-gradient-to-t from-[#14b179]/40 to-[#58e2b0]"
                />
              ))}
            </div>

            {/* Мини-таблица сделок */}
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="text-slate-500">
                  <tr className="border-b border-white/10">
                    <th className="p-2.5 font-normal">{t("demoColItem")}</th>
                    <th className="p-2.5 font-normal">{t("demoColBuy")}</th>
                    <th className="p-2.5 font-normal">{t("demoColSell")}</th>
                    <th className="p-2.5 text-right font-normal">{t("demoColProfit")}</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {DEMO.rows.map((row) => (
                    <PreviewRow
                      key={row.name}
                      name={row.name}
                      buy={money(row.buy)}
                      sell={row.sell == null ? "—" : money(row.sell)}
                      profit={row.profit == null ? t("demoHold") : money(row.profit, true)}
                      tone={row.profit == null ? undefined : row.profit >= 0 ? "pos" : "neg"}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Возможности */}
        <section className="flex flex-col gap-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-white">{t("featuresTitle")}</h2>
            <p className="mt-2 text-slate-400">
              {t("featuresSubtitle")}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.key}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#58e2b0]/40 hover:bg-white/[0.05]"
              >
                <div className="flex size-11 items-center justify-center rounded-xl border border-[#58e2b0]/20 bg-[#58e2b0]/10 text-[#7fecc4] transition group-hover:bg-[#58e2b0]/20">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-white">{td(`feature.${f.key}.title`)}</h3>
                <p className="mt-1.5 text-sm text-slate-400">{td(`feature.${f.key}.text`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Планируется */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-0.5 text-xs font-medium text-violet-300">
              {t("soon")}
            </span>
            <h2 className="text-2xl font-semibold text-white">{t("planned")}</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {t("plannedNote")}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-medium text-white">{t("plannedAutoImport")}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {t("plannedAutoImportNote")}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="font-medium text-white">{t("plannedAlerts")}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {t("plannedAlertsNote")}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <WaitlistForm feature="planned" />
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-center text-sm text-slate-500">
          {t("footer")}
        </footer>
      </div>
    </main>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function PreviewRow({
  name,
  buy,
  sell,
  profit,
  tone,
}: {
  name: string;
  buy: string;
  sell: string;
  profit: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-slate-500";
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="p-2.5 text-slate-200">{name}</td>
      <td className="p-2.5">{buy}</td>
      <td className="p-2.5">{sell}</td>
      <td className={`p-2.5 text-right font-medium ${color}`}>{profit}</td>
    </tr>
  );
}
