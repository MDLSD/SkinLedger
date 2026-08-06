// Тарифы (ТЗ 6 и 7.7). Монетизируется не знание цены, а инструмент: цены на
// публичной странице предмета открыты всем, а таблица сравнения на бесплатном
// тарифе ограничена.
//
// Всё платное живёт на одной странице — «Таблица» (/app/prices): потолок цены
// предмета, число площадок и графики, раскрывающиеся по клику на цену.
//
// Чистый модуль без prisma: лимиты нужны и на сервере, и в интерфейсе.

export type Plan = "free" | "pro";

export type PlanLimits = {
  /** Потолок цены покупки в таблице, USD. null — без потолка. */
  maxItemPrice: number | null;
  /** Сколько площадок-источников доступно. null — все. */
  maxSources: number | null;
  /** Графики и стакан по клику на цену. */
  charts: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    // Как у конкурента: бесплатно видно только дешёвый сегмент.
    maxItemPrice: 2,
    maxSources: 3,
    charts: false,
  },
  pro: {
    maxItemPrice: null,
    maxSources: null,
    charts: true,
  },
};

export type PlanUser = { plan: string; planUntil: Date | null };

/**
 * Действующий тариф. Просроченный pro автоматически считается free — иначе
 * доступ пришлось бы отбирать отдельным заданием, и любой сбой крона раздавал
 * бы платные функции бесплатно.
 */
export function effectivePlan(user: PlanUser | null | undefined, now = Date.now()): Plan {
  if (!user || user.plan !== "pro") return "free";
  if (user.planUntil && user.planUntil.getTime() < now) return "free";
  return "pro";
}

export function limitsFor(user: PlanUser | null | undefined, now = Date.now()): PlanLimits {
  return PLAN_LIMITS[effectivePlan(user, now)];
}

/**
 * Площадки бесплатного тарифа, в порядке предпочтения. Список явный, а не
 * «первые N по алфавиту»: иначе Steam — эталонный рынок, с которым все
 * сверяются, — в бесплатный набор не попадал бы.
 */
export const FREE_SOURCE_ORDER = ["steam", "buff163", "market_csgo"];

/** Площадки, доступные тарифу. Порядок вывода сохраняется исходный. */
export function allowedSources<T extends { slug: string }>(
  sources: T[],
  limits: PlanLimits,
): T[] {
  if (limits.maxSources == null) return sources;
  const preferred = new Set(FREE_SOURCE_ORDER.slice(0, limits.maxSources));
  const picked = sources.filter((s) => preferred.has(s.slug));
  if (picked.length >= limits.maxSources) return picked;
  // Если справочник переименовали и слаги разошлись — добираем чем есть,
  // чтобы инструмент не оказался пустым.
  const rest = sources.filter((s) => !preferred.has(s.slug));
  return [...picked, ...rest].slice(0, limits.maxSources);
}
