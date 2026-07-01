import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  inject,
} from "@angular/core";
import { Router, RouterOutlet } from "@angular/router";

import { ShellApiService } from "./core/shell-api-service";
import { PortInventoryService } from "./ports/port-inventory-service";
import { ThemeService } from "./settings/theme-service";
import { AppUpdaterService } from "./update/app-updater-service";
import { UpdateBanner } from "./update/update-banner/update-banner";

@Component({
  selector: "app-root",
  imports: [UpdateBanner, RouterOutlet],
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
  private readonly router = inject(Router);
  private readonly inventory = inject(PortInventoryService);

  async ngOnInit(): Promise<void> {
    await this.inventory.refresh();
    // Тихая проверка обновлений при старте: «всё актуально» и сетевые ошибки
    // не мешают — баннер всплывёт, только если апдейт реально есть.
    void this.updater.check(true);
    // При каждом показе поповера возвращаемся к списку и обновляем данные.
    await this.shell.onPopoverShown(() => {
      void this.router.navigateByUrl("/");
      this.inventory.setQuery("");
      void this.inventory.refresh();
    });
    // «Проверить обновления» из трей-меню — явная проверка с показом статуса.
    await this.shell.onCheckUpdates(() => {
      void this.router.navigateByUrl("/");
      void this.updater.check();
    });
  }
}
