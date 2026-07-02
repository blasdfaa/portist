import { Injectable, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TranslocoService } from "@jsverse/transloco";
import type { Observable } from "rxjs";

import { type Lang, LANG_STORAGE_KEY } from "../i18n/lang";

/**
 * Выбор языка интерфейса. По образцу {@link ThemeService}: активный язык живёт в
 * Transloco (источник истины и живого свитча), здесь — обёртка для UI настроек и
 * персиста. `effect` проставляет `lang` на <html> (единственный DOM-side-effect,
 * как `data-theme` у темы). Начальный язык задан в конфиге Transloco через
 * `resolveInitialLang()`; пока пользователь не выбрал язык, приложение следует
 * за системой — явный `setLang` фиксирует выбор в localStorage.
 */
@Injectable({ providedIn: "root" })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  /** Текущий язык для UI настроек; обновляется при живой смене. */
  readonly lang = toSignal(this.transloco.langChanges$ as Observable<Lang>, {
    initialValue: this.transloco.getActiveLang() as Lang,
  });

  constructor() {
    effect(() => {
      document.documentElement.lang = this.lang();
    });
  }

  /** Сменить язык вживую и запомнить явный выбор. */
  setLang(lang: Lang): void {
    this.transloco.setActiveLang(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Персист необязателен: смена всё равно применится к текущей сессии.
    }
  }
}
