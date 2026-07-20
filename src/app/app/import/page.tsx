import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportDeals } from "@/components/import-deals";
import { CSV_COLUMNS } from "@/lib/deal-csv";

export const metadata: Metadata = { title: "Импорт CSV — SkinLedger" };

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Импорт из CSV</h1>

      <section className="space-y-3 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">Загрузите свою таблицу как есть</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Подойдёт файл <b>Excel (.xlsx)</b> или <b>CSV</b> — можно ничего не
            переименовывать, колонки распознаются по заголовкам автоматически.
          </li>
          <li>
            Качество можно писать прямо в названии:{" "}
            <b>AWP | Corticera (Minimal Wear)</b> — износ извлечём сам.
          </li>
          <li>
            Обязательны только <b>название</b> и <b>цена покупки</b>. Нет даты —
            подставим сегодняшнюю, нет площадки — «{`Не указана`}». Курс к вашей
            основной валюте считается автоматически.
          </li>
        </ul>
        <a
          href="/api/deals/template"
          download
          className="inline-block font-medium text-primary underline underline-offset-4"
        >
          Не с чего начать? Скачать шаблон-пример (CSV)
        </a>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Какие колонки понимаем</h2>
        <p className="text-xs text-muted-foreground">
          Заголовки можно называть по-своему — распознаём синонимы (например
          «Скин», «Предмет», «Item» → название; «Куплено за», «Закуп», «Buy» →
          цена покупки).
        </p>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <tbody>
              {CSV_COLUMNS.map((c) => (
                <tr key={c.key} className="border-b last:border-0">
                  <td className="py-1 pr-6 font-medium">{c.header}</td>
                  <td className="py-1 text-muted-foreground">
                    {HINTS[c.key] ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Разделитель CSV/текста — таб, «;» или «,» (определяется автоматически).
          Дробные — через запятую или точку, валютные знаки можно оставить. Даты:
          ГГГГ-ММ-ДД или ДД.ММ.ГГГГ. Площадки, которых ещё нет, создадутся сами.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Загрузить файл</h2>
        <ImportDeals />
      </section>
    </div>
  );
}

const HINTS: Partial<Record<string, string>> = {
  itemName: "обязательно",
  itemQuality: "например Field-Tested (можно пусто)",
  quantity: "по умолчанию 1",
  buyPlatform: "название площадки покупки",
  buyPrice: "обязательно, за штуку",
  buyCurrency: "RUB / USD / EUR / CNY (по умолчанию RUB)",
  buyFeePct: "комиссия покупки, % (можно пусто)",
  buyDate: "обязательно, ГГГГ-ММ-ДД",
  status: "в холде / продано / вывод (можно пусто — определим по цене продажи)",
  sellPlatform: "заполняется для продажи/вывода",
  sellPrice: "для вывода — фактически полученная сумма",
  sellCurrency: "по умолчанию как валюта покупки",
  sellFeePct: "комиссия продажи, %",
  sellDate: "ГГГГ-ММ-ДД",
  note: "комментарий (можно пусто)",
};
