import { Injectable, inject, signal } from "@angular/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

import { PreferencesService } from "../settings/preferences-service";

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
 * Как и `ShellApiService`, оборачивает плагины напрямую — интерфейса/фейка нет.
 * Но владеет состоянием, которое показывает баннер, поэтому это signal-store.
 */
@Injectable({ providedIn: "root" })
export class AppUpdaterService {
  private readonly prefs = inject(PreferencesService);

  private readonly _state = signal<UpdateState>({ kind: "idle" });
  /** Текущее положение машины состояний для UI. */
  readonly state = this._state.asReadonly();

  /** Готовый к установке апдейт; держим инстанс между check() и install(). */
  private pending: Update | null = null;

  /**
   * Найденный на старте апдейт ждёт авто-установки (автообновление ВКЛ).
   * Ставим не сразу, а при первом показе поповера — иначе оверлей «приложение
   * обновляется» проходил бы в скрытом окне и был бы не виден.
   */
  private armed = false;

  /**
   * Тихая проверка при старте. Если апдейт найден и автообновление ВКЛ —
   * запоминаем его к авто-установке ({@link runArmedInstall}), баннер не трогаем.
   * Если ВЫКЛ — показываем баннер «доступно обновление» (ручная установка).
   * «Всё актуально» и ошибки сети остаются немыми.
   */
  async checkOnStartup(): Promise<void> {
    if (this._state().kind === "downloading") return;
    try {
      const update = await check();
      if (!update) {
        this.pending = null;
        return;
      }
      this.pending = update;
      if (this.prefs.autoUpdate()) {
        this.armed = true;
      } else {
        this._state.set({
          kind: "available",
          version: update.version,
          notes: update.body ?? "",
        });
      }
    } catch {
      this.pending = null;
    }
  }

  /**
   * Запустить отложенную авто-установку (зовётся при показе поповера). No-op,
   * если ничего не «взведено». Сбрасываем флаг до install(), чтобы повторные
   * показы поповера не перезапускали установку.
   */
  runArmedInstall(): void {
    if (!this.armed || !this.pending) return;
    this.armed = false;
    void this.install();
  }

  /**
   * Явная проверка (ручная кнопка в настройках, retry в ошибке): показываем
   * ход через баннер — «проверяю» → «актуально»/«доступно»/«ошибка».
   */
  async check(): Promise<void> {
    if (this._state().kind === "downloading") return;
    this._state.set({ kind: "checking" });
    try {
      const update = await check();
      if (!update) {
        this.pending = null;
        this._state.set({ kind: "uptodate" });
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
      this._state.set({ kind: "error", message: String(err) });
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
