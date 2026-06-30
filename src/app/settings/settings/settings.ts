import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from "@angular/core";

import { ShellApi } from "../../core/shell-api";
import { SettingRow } from "../setting-row/setting-row";
import { Theme, type ThemeMode } from "../theme";

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
  private readonly shell = inject(ShellApi);
  protected readonly theme = inject(Theme);

  /** Назад к списку портов. */
  readonly back = output<void>();

  /** Версия приложения; пусто, пока не загрузилась. */
  protected readonly version = signal("");

  constructor() {
    void this.shell.appVersion().then((v) => this.version.set(v));
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
