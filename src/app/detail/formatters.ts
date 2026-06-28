/** Утилиты форматирования значений для карточки порта. */

/** Байты → человекочитаемо. null, если значение пустое (0/undefined). */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
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
export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

/** epoch-секунды → локальные дата/время. null, если 0/пусто. */
export function formatDateTime(epochSeconds: number | null | undefined): string | null {
  if (!epochSeconds || epochSeconds <= 0) return null;
  return new Date(epochSeconds * 1000).toLocaleString();
}
