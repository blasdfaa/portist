import { Injectable } from "@angular/core";
import {
  type Translation,
  type TranslocoLoader,
} from "@jsverse/transloco";
import { of } from "rxjs";

import { type Lang, TRANSLATIONS } from "./lang";

/**
 * Инлайн-лоадер каталогов: переводы уже в бандле, отдаём их синхронно через
 * `of(...)` — без HttpClient и без файлов в assets (надёжнее во встроенном
 * webview Tauri). Первый рендер сразу получает нужный язык.
 */
@Injectable({ providedIn: "root" })
export class InlineTranslocoLoader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(TRANSLATIONS[lang as Lang] as unknown as Translation);
  }
}
