// Мост между двумя справочниками площадок: Platform (комиссии пользователя,
// выбирается в сделке) и MarketSource (источник цен). Прямой связи в БД нет —
// сводим по каноническому имени из platform-aliases, потому что оно уже
// приводит «стим/steam/стимка» к одному написанию.
//
// Пары, где имена расходятся, перечислены явно: «Market.CSGO (TM)» в списке
// площадок против «Market.CSGO» в источниках.
import { canonicalPlatform, normalizePlatform } from "@/lib/platform-aliases";

/** Каноническое имя площадки → slug источника цен. */
const EXPLICIT: Record<string, string> = {
  "market.csgo (tm)": "market_csgo",
};

/**
 * Slug источника цен для площадки сделки. `sourceTitles` — то, что лежит
 * в MarketSource (slug → title). null означает «цен по этой площадке нет»:
 * пользователь мог завести свою («Обмен с другом»), и это нормально.
 */
export function sourceSlugForPlatform(
  platformName: string,
  sourceTitles: { slug: string; title: string }[],
): string | null {
  const canonical = canonicalPlatform(platformName) ?? platformName;
  const key = normalizePlatform(canonical);

  const explicit = EXPLICIT[canonical.toLowerCase()];
  if (explicit && sourceTitles.some((s) => s.slug === explicit)) return explicit;

  const hit = sourceTitles.find((s) => normalizePlatform(s.title) === key);
  return hit?.slug ?? null;
}

/** Обратное направление: заголовок источника → каноническое имя площадки. */
export function platformNameForSource(title: string): string {
  return canonicalPlatform(title) ?? title;
}
