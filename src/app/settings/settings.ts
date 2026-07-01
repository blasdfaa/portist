import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";

import { ShellApiService } from "../core/shell-api-service";
import { PreferencesService } from "./preferences-service";
import { SettingRow } from "./setting-row/setting-row";
import { ThemeService, type ThemeMode } from "./theme-service";

/** Опция переключателя темы: значение, подпись (a11y/тултип) и глиф. */
interface ThemeOption {
  value: ThemeMode;
  label: string;
  glyph: string;
}

/** Экран настроек. Каждая настройка — строка <app-setting-row> с контролом. */
@Component({
  selector: "app-settings",
  imports: [SettingRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./settings.html",
  styleUrl: "./settings.css",
})
export class Settings {
  private readonly shell = inject(ShellApiService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);
  protected readonly prefs = inject(PreferencesService);

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
    { value: "auto", label: "Авто", glyph: "◐" },
    { value: "light", label: "Светлая", glyph: "☀" },
    { value: "dark", label: "Тёмная", glyph: "☾" },
  ];

  /** Индекс активного режима — позиция «бегунка» переключателя. */
  protected readonly activeIndex = computed(() =>
    this.themeOptions.findIndex((o) => o.value === this.theme.mode()),
  );
}
