import { Injectable } from "@angular/core";

import { type Codec, persistedSignal } from "../core/persisted-signal";
import type { GroupSort } from "../ports/group-order";

const PINNED_KEY = "portist.pinnedGroups";
const GROUP_SORT_KEY = "portist.groupSort";
const AUTO_UPDATE_KEY = "portist.autoUpdate";

/** Кодек закреплённых групп: JSON-массив строк, иначе пусто. */
export const pinnedCodec: Codec<string[]> = {
  parse: (raw) => {
    if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value) && value.every((v) => typeof v === "string")
        ? (value as string[])
        : [];
    } catch {
      return [];
    }
  },
  serialize: (ids) => JSON.stringify(ids),
};

/** Кодек ключа сортировки хвоста; дефолт — по алфавиту. */
export const groupSortCodec: Codec<GroupSort> = {
  parse: (raw) => (raw === "ports" ? "ports" : "alpha"),
  serialize: (sort) => sort,
};

/** Кодек автообновления: «1»/«0», отсутствие значения = включено. */
export const autoUpdateCodec: Codec<boolean> = {
  parse: (raw) => raw !== "0",
  serialize: (on) => (on ? "1" : "0"),
};

/**
 * Пользовательские настройки списка портов. Каждый ключ персистится через
 * {@link persistedSignal} — read/write/валидация живут в кодеке и шве, не здесь.
 * Заведён отдельно от темы, чтобы сюда же складывать будущие тумблеры
 * отображения (живой авто-рефреш, фильтр «виден в сети» и т.п.).
 */
@Injectable({ providedIn: "root" })
export class PreferencesService {
  /**
   * Закреплённые сверху группы (id в пользовательском порядке). Всё незакреплённое
   * сортируется автоматически по {@link groupSort}. См. {@link ../ports/group-order}.
   */
  private readonly _pinnedGroups = persistedSignal(PINNED_KEY, pinnedCodec);
  readonly pinnedGroups = this._pinnedGroups.asReadonly();

  /** Ключ авто-сортировки незакреплённого «хвоста» групп. */
  private readonly _groupSort = persistedSignal(GROUP_SORT_KEY, groupSortCodec);
  readonly groupSort = this._groupSort.asReadonly();

  private readonly _autoUpdate = persistedSignal(AUTO_UPDATE_KEY, autoUpdateCodec);
  /** Ставить ли найденный апдейт автоматически (иначе — баннер с ручной кнопкой). */
  readonly autoUpdate = this._autoUpdate.asReadonly();

  /** Задать порядок закреплённых групп (id в желаемом порядке). */
  setPinnedGroups(ids: string[]): void {
    this._pinnedGroups.set(ids);
  }

  /** Закрепить (в конец) либо открепить группу по id. */
  togglePin(id: string): void {
    const pinned = this._pinnedGroups();
    this._pinnedGroups.set(
      pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id],
    );
  }

  setGroupSort(sort: GroupSort): void {
    this._groupSort.set(sort);
  }

  toggleAutoUpdate(): void {
    this._autoUpdate.update((v) => !v);
  }
}
