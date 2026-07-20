import { exampleCsv } from "@/lib/deal-csv";

// Файл-пример для импорта: заголовок + демонстрационные строки.
export function GET() {
  return new Response(exampleCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="skinledger-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
