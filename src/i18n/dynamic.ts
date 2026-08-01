import type { ErrorValues } from "@/lib/error-keys";

/**
 * Переводчик с ключом, который известен только в рантайме: износ, редкость
 * и вид предмета приходят строками из каталога, период графика — из данных.
 * Типизация ключей next-intl такие обращения не покрывает: сузить
 * `string` до литерала статически нельзя.
 *
 * `has` обязателен — по нему решаем, есть ли перевод, или показать
 * исходное значение как есть.
 */
export type DynamicTranslator = {
  (key: string, values?: ErrorValues): string;
  has: (key: string) => boolean;
};

/**
 * Снимает статическую проверку ключей ровно там, где она невозможна.
 * Отдельная функция, а не `as any` по месту: так видно каждое такое место
 * и понятно, почему проверка снята.
 */
export function withDynamicKeys(t: unknown): DynamicTranslator {
  return t as DynamicTranslator;
}
