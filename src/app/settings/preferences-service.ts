import { Injectable, effect, signal } from "@angular/core";

const STORAGE_KEY = "portist.hideSystemPorts";

/**
 * Пользовательские настройки списка портов. По образцу {@link ThemeService}: сигнал +
 * `effect`, пишущий в localStorage. Заведён отдельно от темы, чтобы сюда же
 * складывать будущие тумблеры отображения (живой авто-рефреш, фильтр «виден в
 * сети» и т.п.), не раздувая сервис темы.
 */
@Injectable({ providedIn: "root" })
export class PreferencesService {
  private readonly _hideSystemPorts = signal<boolean>(this.read());
  /** Скрывать ли системные порты (группа `port < 1024`) из списка, счётчика и поиска. */
  readonly hideSystemPorts = this._hideSystemPorts.asReadonly();

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, this._hideSystemPorts() ? "1" : "0");
    });
  }

  toggleHideSystemPorts(): void {
    this._hideSystemPorts.update((v) => !v);
  }

  /** Прочитать сохранённое значение; дефолт — показывать всё (выкл). */
  private read(): boolean {
    return localStorage.getItem(STORAGE_KEY) === "1";
  }
}
