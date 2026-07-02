import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  inject,
} from "@angular/core";
import { Router, RouterOutlet } from "@angular/router";

import { ShellApiService } from "./core/shell-api-service";
import { PortInventoryService } from "./ports/port-inventory-service";
import { LanguageService } from "./settings/language-service";
import { ThemeService } from "./settings/theme-service";
import { AppUpdaterService } from "./update/app-updater-service";
import { UpdateBanner } from "./update/update-banner/update-banner";
import { UpdateOverlay } from "./update/update-overlay/update-overlay";

@Component({
  selector: "app-root",
  imports: [UpdateBanner, UpdateOverlay, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App implements OnInit {
  private readonly shell = inject(ShellApiService);
  private readonly updater = inject(AppUpdaterService);
  // Инъекция в корне инициализирует сервис темы на старте: его effect
  // проставляет data-theme до отрисовки экранов.
  private readonly theme = inject(ThemeService);
  // Аналогично для языка: effect проставляет lang на <html> на старте.
  private readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly inventory = inject(PortInventoryService);

  async ngOnInit(): Promise<void> {
    await this.inventory.refresh();
    // Тихая проверка обновлений при старте: «всё актуально» и сетевые ошибки
    // не мешают. При ВКЛ автообновлении найденный апдейт ставится не сразу, а
    // при первом показе поповера (runArmedInstall) — чтобы оверлей был виден.
    void this.updater.checkOnStartup();
    // При каждом показе поповера возвращаемся к списку и обновляем данные;
    // заодно запускаем отложенную авто-установку, если апдейт «взведён».
    await this.shell.onPopoverShown(() => {
      void this.router.navigateByUrl("/");
      this.inventory.setQuery("");
      void this.inventory.refresh();
      this.updater.runArmedInstall();
    });
  }
}
