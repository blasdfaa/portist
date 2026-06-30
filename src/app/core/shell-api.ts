import { Injectable } from "@angular/core";
import { getVersion } from "@tauri-apps/api/app";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Краевые shell/window-эффекты ОС: открыть URL, буфер обмена, событие поповера.
 * Fire-and-forget, инжектится прямо на краю-представлении. Интерфейса не имеет —
 * в тестах не подменяется (фейкать эти эффекты нечего проверять).
 */
@Injectable({ providedIn: "root" })
export class ShellApi {
  /** Открыть localhost:PORT в браузере по умолчанию. */
  openInBrowser(port: number): Promise<void> {
    return openUrl(`http://localhost:${port}`);
  }

  /** Скопировать текст в буфер обмена. */
  copyText(text: string): Promise<void> {
    return writeText(text);
  }

  /** Текущая версия приложения (из tauri.conf.json). */
  appVersion(): Promise<string> {
    return getVersion();
  }

  /** Подписка на событие «поповер показан» (Rust шлёт его при открытии окна). */
  onPopoverShown(handler: () => void): Promise<UnlistenFn> {
    return listen("popover-shown", () => handler());
  }

  /** Подписка на «Проверить обновления» из трей-меню (Rust шлёт при клике). */
  onCheckUpdates(handler: () => void): Promise<UnlistenFn> {
    return listen("check-updates", () => handler());
  }
}
