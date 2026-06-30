import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  inject,
} from "@angular/core";
import { Router, RouterOutlet } from "@angular/router";

import { ShellApi } from "./core/shell-api";
import { PortInventory } from "./ports/port-inventory";
import { Theme } from "./settings/theme";
import { AppUpdater } from "./update/app-updater";
import { UpdateBanner } from "./update/update-banner/update-banner";

@Component({
  selector: "app-root",
  imports: [UpdateBanner, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App implements OnInit {
  private readonly shell = inject(ShellApi);
  private readonly updater = inject(AppUpdater);
  // Инъекция в корне инициализирует сервис темы на старте: его effect
  // проставляет data-theme до отрисовки экранов.
  private readonly theme = inject(Theme);
  private readonly router = inject(Router);
  private readonly inventory = inject(PortInventory);

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
