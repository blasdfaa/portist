import { Injectable, signal } from "@angular/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

/**
 * Состояние процесса автообновления. Узкая машина состояний для баннера:
 * пользователь видит ровно одно из этих положений за раз.
 */
export type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "uptodate" }
  | { kind: "available"; version: string; notes: string }
  | { kind: "downloading"; version: string; progress: number }
  | { kind: "error"; message: string };

/**
 * Edge-эффект ОС: проверка/скачивание/установка обновления через
 * `tauri-plugin-updater` и перезапуск через `tauri-plugin-process`.
 * Как и `ShellApi`, оборачивает плагины напрямую — интерфейса/фейка нет.
 * Но владеет состоянием, которое показывает баннер, поэтому это signal-store.
 */
@Injectable({ providedIn: "root" })
export class AppUpdater {
  private readonly _state = signal<UpdateState>({ kind: "idle" });
  /** Текущее положение машины состояний для UI. */
  readonly state = this._state.asReadonly();

  /** Готовый к установке апдейт; держим инстанс между check() и install(). */
  private pending: Update | null = null;

  /**
   * Спросить CDN о новой версии. `silent` — для авто-проверки при старте:
   * «всё актуально» и ошибки сети не показываем, баннер молчит.
   */
  async check(silent = false): Promise<void> {
    if (this._state().kind === "downloading") return;
    this._state.set({ kind: "checking" });
    try {
      const update = await check();
      if (!update) {
        this.pending = null;
        this._state.set(silent ? { kind: "idle" } : { kind: "uptodate" });
        return;
      }
      this.pending = update;
      this._state.set({
        kind: "available",
        version: update.version,
        notes: update.body ?? "",
      });
    } catch (err) {
      this.pending = null;
      if (silent) {
        this._state.set({ kind: "idle" });
      } else {
        this._state.set({ kind: "error", message: String(err) });
      }
    }
  }

  /**
   * Скачать и установить найденный апдейт, показывая прогресс, затем
   * перезапустить приложение в новой версии. Без апдейта — no-op.
   */
  async install(): Promise<void> {
    const update = this.pending;
    if (!update) return;

    let downloaded = 0;
    let total = 0;
    this._state.set({ kind: "downloading", version: update.version, progress: 0 });

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            this._state.set({
              kind: "downloading",
              version: update.version,
              progress: total > 0 ? downloaded / total : 0,
            });
            break;
          case "Finished":
            this._state.set({
              kind: "downloading",
              version: update.version,
              progress: 1,
            });
            break;
        }
      });
      // Бинарь установлен — перезапускаемся в новую версию.
      await relaunch();
    } catch (err) {
      this._state.set({ kind: "error", message: String(err) });
    }
  }

  /** Скрыть баннер (закрыть «доступно обновление» / «актуально» / ошибку). */
  dismiss(): void {
    if (this._state().kind === "downloading") return;
    this._state.set({ kind: "idle" });
  }
}
