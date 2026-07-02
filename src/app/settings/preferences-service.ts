import { Injectable, effect, signal } from "@angular/core";

import type { GroupSort } from "../ports/group-order";

const PINNED_KEY = "portist.pinnedGroups";
const GROUP_SORT_KEY = "portist.groupSort";
const AUTO_UPDATE_KEY = "portist.autoUpdate";

/**
 * Пользовательские настройки списка портов. По образцу {@link ThemeService}: сигнал +
 * `effect`, пишущий в localStorage. Заведён отдельно от темы, чтобы сюда же
 * складывать будущие тумблеры отображения (живой авто-рефреш, фильтр «виден в
 * сети» и т.п.), не раздувая сервис темы.
 */
@Injectable({ providedIn: "root" })
export class PreferencesService {
  /**
   * Закреплённые сверху группы (id в пользовательском порядке). Всё незакреплённое
   * сортируется автоматически по {@link groupSort}. См. {@link ../ports/group-order}.
   */
  private readonly _pinnedGroups = signal<string[]>(this.readPinned());
  readonly pinnedGroups = this._pinnedGroups.asReadonly();

  /** Ключ авто-сортировки незакреплённого «хвоста» групп. */
  private readonly _groupSort = signal<GroupSort>(this.readGroupSort());
  readonly groupSort = this._groupSort.asReadonly();

  private readonly _autoUpdate = signal<boolean>(this.readAutoUpdate());
  /** Ставить ли найденный апдейт автоматически (иначе — баннер с ручной кнопкой). */
  readonly autoUpdate = this._autoUpdate.asReadonly();

  constructor() {
    effect(() => {
      localStorage.setItem(PINNED_KEY, JSON.stringify(this._pinnedGroups()));
    });
    effect(() => {
      localStorage.setItem(GROUP_SORT_KEY, this._groupSort());
    });
    effect(() => {
      localStorage.setItem(AUTO_UPDATE_KEY, this._autoUpdate() ? "1" : "0");
    });
  }

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

  /** Прочитать закреплённые группы; дефолт — пусто (всё авто-сортируется). */
  private readPinned(): string[] {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    try {
      const value: unknown = JSON.parse(raw);
      return Array.isArray(value) && value.every((v) => typeof v === "string")
        ? (value as string[])
        : [];
    } catch {
      return [];
    }
  }

  /** Прочитать ключ сортировки хвоста; дефолт — по алфавиту. */
  private readGroupSort(): GroupSort {
    return localStorage.getItem(GROUP_SORT_KEY) === "ports" ? "ports" : "alpha";
  }

  /** Прочитать флаг автообновления; дефолт — включено (отсутствие значения = «1»). */
  private readAutoUpdate(): boolean {
    return localStorage.getItem(AUTO_UPDATE_KEY) !== "0";
  }
}
