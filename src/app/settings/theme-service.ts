import { Injectable, effect } from "@angular/core";

import { type Codec, persistedSignal } from "../core/persisted-signal";

export type ThemeMode = "auto" | "light" | "dark";

const STORAGE_KEY = "portist.theme";
const MODES: ThemeMode[] = ["auto", "light", "dark"];

/** Кодек режима темы: валидный из списка либо дефолт «auto». */
export const themeCodec: Codec<ThemeMode> = {
  parse: (raw) =>
    raw !== null && MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : "auto",
  serialize: (mode) => mode,
};

/**
 * Выбор темы оформления. Режим персистится через {@link persistedSignal} и
 * проставляется атрибутом `data-theme` на <html>; «auto» решается на стороне CSS
 * через `@media (prefers-color-scheme)`, поэтому смена системной темы
 * подхватывается живьём без слушателей в коде.
 */
@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly _mode = persistedSignal(STORAGE_KEY, themeCodec);
  /** Текущий режим темы для UI настроек. */
  readonly mode = this._mode.asReadonly();

  constructor() {
    // DOM-side-effect (не персист — тот в persistedSignal): атрибут на <html>.
    effect(() => {
      document.documentElement.setAttribute("data-theme", this._mode());
    });
  }

  /** Переключить тему. */
  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
  }
}
