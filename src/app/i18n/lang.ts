import { localStorageAdapter } from "../core/persisted-signal";
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
 * Политика «сырая строка → язык», общая для старта и для валидации: явный
 * валидный выбор («ru»/«en») уважается, иначе — язык системы
 * (`navigator.language`), иначе фолбек. Единственное место, где живёт правило.
 */
export function parseLang(raw: string | null): Lang {
  if (raw === "ru" || raw === "en") return raw;
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : FALLBACK_LANG;
}

/**
 * Начальный язык до загрузки Angular-DI: сохранённый выбор из хранилища через
 * {@link parseLang}. Чистая привязка к `defaultLang` Transloco без гонок
 * инициализации; пока пользователь не выбрал язык явно, следуем за системой.
 */
export function resolveInitialLang(): Lang {
  return parseLang(localStorageAdapter.read(LANG_STORAGE_KEY));
}
