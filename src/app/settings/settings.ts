import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";

import { ShellApiService } from "../core/shell-api-service";
import type { Lang } from "../i18n/lang";
import { AppUpdaterService } from "../update/app-updater-service";
import { GroupOrderOverlay } from "./group-order-overlay/group-order-overlay";
import { LanguageService } from "./language-service";
import { PreferencesService } from "./preferences-service";
import { SettingRow } from "./setting-row/setting-row";
import { ThemeService, type ThemeMode } from "./theme-service";

/** Опция переключателя темы: значение, ключ подписи (a11y/тултип) и глиф. */
interface ThemeOption {
  value: ThemeMode;
  label: string;
  glyph: string;
}

/** Опция переключателя языка: значение и автоним (не переводится). */
interface LangOption {
  value: Lang;
  label: string;
}

/** Экран настроек. Каждая настройка — строка <app-setting-row> с контролом. */
@Component({
  selector: "app-settings",
  imports: [SettingRow, TranslocoPipe, GroupOrderOverlay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings.html",
  styleUrl: "./settings.css",
})
export class Settings {
  private readonly shell = inject(ShellApiService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly updater = inject(AppUpdaterService);

  /** Открыта ли модалка порядка групп (владелец состояния — этот экран). */
  protected readonly orderModalOpen = signal(false);

  /** Идёт ли сейчас проверка/установка — блокирует кнопку «Проверить». */
  protected readonly updateBusy = computed(() => {
    const kind = this.updater.state().kind;
    return kind === "checking" || kind === "downloading";
  });

  /** Версия приложения; пусто, пока не загрузилась. */
  protected readonly version = signal("");

  constructor() {
    void this.shell.appVersion().then((v) => this.version.set(v));
  }

  /** Назад к списку портов. */
  back(): void {
    void this.router.navigate(["/"]);
  }

  protected readonly themeOptions: ThemeOption[] = [
    { value: "auto", label: "settings.themeAuto", glyph: "◐" },
    { value: "light", label: "settings.themeLight", glyph: "☀" },
    { value: "dark", label: "settings.themeDark", glyph: "☾" },
  ];

  /** Индекс активного режима — позиция «бегунка» переключателя темы. */
  protected readonly activeIndex = computed(() =>
    this.themeOptions.findIndex((o) => o.value === this.theme.mode()),
  );

  /** Языки — автонимы, одинаковы в обоих переводах. */
  protected readonly langOptions: LangOption[] = [
    { value: "ru", label: "Русский" },
    { value: "en", label: "English" },
  ];

  /** Смена языка из <select>: значение опции — это код языка (Lang). */
  protected onLangChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as Lang;
    this.language.setLang(value);
  }
}
