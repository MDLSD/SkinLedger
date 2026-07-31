import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Локале-aware замена `next/link` и `next/navigation`. Обычный `Link` увёл бы
 * англоязычного пользователя с `/en/app` на русский `/app`: префикс проставляют
 * именно эти обёртки.
 */
const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = navigation;

// Явная аннотация типа обязательна: сужение по возвращаемому `never` TypeScript
// применяет только к идентификаторам с указанным типом, а у значения,
// вынутого деструктуризацией, он лишь выведенный. Без неё после
// `if (!session) redirect(...)` компилятор продолжал считать session нулевым.
export const redirect: typeof navigation.redirect = navigation.redirect;
