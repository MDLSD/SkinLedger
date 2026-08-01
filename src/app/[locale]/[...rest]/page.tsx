import { notFound } from "next/navigation";

/**
 * Ловушка несопоставленных путей внутри локали.
 *
 * `not-found.tsx` в сегменте срабатывает только на явный `notFound()` из его
 * поддерева; URL, не подошедший ни одному маршруту, уходит в КОРНЕВОЙ
 * not-found. После переезда страниц под `[locale]` из-за этого вместо своей
 * страницы 404 показывалась встроенная — без nonce и без перевода.
 * Этот catch-all возвращает такие адреса в локализованный `not-found.tsx`.
 */
export default function CatchAllNotFound() {
  notFound();
}
