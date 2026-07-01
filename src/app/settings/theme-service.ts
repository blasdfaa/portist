import { Injectable, effect, signal } from "@angular/core";

export type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "portist.theme";
const MODES: ThemeMode[] = ["auto", "light", "dark"];

/**
 * Выбор темы оформления. Режим хранится в localStorage и проставляется
 * атрибутом `data-theme` на <html>; «auto» решается на стороне CSS через
 * `@media (prefers-color-scheme)`, поэтому смена системной темы подхватывается
 * живьём без слушателей в коде.
 */
@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly _mode = signal<ThemeMode>(this.read());
  /** Текущий режим темы для UI настроек. */
  readonly mode = this._mode.asReadonly();

  constructor() {
    // Единственный side-effect: атрибут на <html> + запоминание выбора.
    effect(() => {
      const mode = this._mode();
      document.documentElement.setAttribute("data-theme", mode);
      localStorage.setItem(STORAGE_KEY, mode);
    });
  }

  /** Переключить тему. */
  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
  }

  /** Прочитать сохранённый режим; дефолт — «авто» (по системе). */
  private read(): ThemeMode {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return saved && MODES.includes(saved) ? saved : "auto";
  }
}
