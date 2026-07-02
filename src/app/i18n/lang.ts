import { en } from "./en";
import { type Translation, ru } from "./ru";

/** Поддерживаемые языки интерфейса. */
export type Lang = "ru" | "en";

export const AVAILABLE_LANGS: Lang[] = ["ru", "en"];
/** Фолбек, если системный язык не поддержан. */
export const FALLBACK_LANG: Lang = "en";

/** Ключ localStorage с явным выбором пользователя. */
export const LANG_STORAGE_KEY = "portist.lang";

/** Каталоги по языкам — для инлайн-лоадера Transloco. */
export const TRANSLATIONS: Record<Lang, Translation> = { ru, en };

/**
 * Начальный язык до загрузки Angular-DI: явный выбор из localStorage, иначе —
 * язык системы (`navigator.language`), иначе фолбек. Чистая функция без DI,
 * чтобы задать `defaultLang` в конфиге Transloco без гонок инициализации.
 * Пока пользователь не выбрал язык явно, приложение следует за системой.
 */
export function resolveInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {
    // localStorage может быть недоступен — падаем на определение по системе.
  }
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : FALLBACK_LANG;
}
