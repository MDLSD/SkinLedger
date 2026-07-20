import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ImportDeals } from "@/components/import-deals";

export const metadata: Metadata = { title: "Импорт — SkinLedger" };

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Импорт сделок</h1>

      <section className="space-y-3 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">Загрузите свою таблицу как есть</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Excel (.xlsx), CSV или текст из заметок — переименовывать колонки не
            нужно, распознаём по заголовкам и по значениям. Баннеры/итоги сверху и
            снизу таблицы пропускаем сами.
          </li>
          <li>
            Качество можно писать прямо в названии:{" "}
            <b>AWP | Corticera (Minimal Wear)</b> — износ извлечём.
          </li>
          <li>
            После загрузки покажем <b>превью</b>: как распознаны колонки, валюта и
            формат даты — всё можно поправить до импорта, а импорт можно откатить.
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
        <ImportDeals />
      </section>
    </div>
  );
}
