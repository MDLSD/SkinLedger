import type { routing } from "@/i18n/routing";
import type messages from "../messages/ru.json";

/**
 * Типобезопасность next-intl: `t("...")` проверяется компилятором по ключам
 * ru.json (он источник истины — переводы пишутся сначала на нём),
 * а `locale` сужается до объявленных локалей.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
