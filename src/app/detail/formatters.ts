/** Утилиты форматирования значений для карточки порта. */

import type { Lang } from "../i18n/lang";

/** Единицы размера по языку (степени 1024). */
const BYTE_UNITS: Record<Lang, string[]> = {
  ru: ["Б", "КБ", "МБ", "ГБ", "ТБ"],
  en: ["B", "KB", "MB", "GB", "TB"],
};

/** Суффиксы длительности: дни / часы / минуты / секунды. */
const DURATION_UNITS: Record<Lang, { d: string; h: string; m: string; s: string }> =
  {
    ru: { d: "д", h: "ч", m: "м", s: "с" },
    en: { d: "d", h: "h", m: "m", s: "s" },
  };

/** Локаль для форматирования даты/времени. */
const DATE_LOCALE: Record<Lang, string> = {
  ru: "ru-RU",
  en: "en-US",
};

/** Байты → человекочитаемо. null, если значение пустое (0/undefined). */
export function formatBytes(
  bytes: number | null | undefined,
  lang: Lang,
): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = BYTE_UNITS[lang];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

/** Секунды работы → «3д 4ч» / «4ч 12м» / «12м 30с». null, если пусто. */
export function formatDuration(
  seconds: number | null | undefined,
  lang: Lang,
): string | null {
  if (!seconds || seconds <= 0) return null;
  const u = DURATION_UNITS[lang];
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}${u.d} ${h}${u.h}`;
  if (h > 0) return `${h}${u.h} ${m}${u.m}`;
  if (m > 0) return `${m}${u.m} ${s}${u.s}`;
  return `${s}${u.s}`;
}

/** epoch-секунды → локальные дата/время в выбранном языке. null, если 0/пусто. */
export function formatDateTime(
  epochSeconds: number | null | undefined,
  lang: Lang,
): string | null {
  if (!epochSeconds || epochSeconds <= 0) return null;
  return new Date(epochSeconds * 1000).toLocaleString(DATE_LOCALE[lang]);
}
