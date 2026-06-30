import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import type { PortInfo } from "../../core/models";
import { ShellApi } from "../../core/shell-api";
import { DetailSession } from "../../detail/detail-session";
import { PortInventory } from "../port-inventory";
import { PortRow } from "../port-row/port-row";

/** Экран списка слушающих портов: поиск, группировка, переход к карточке. */
@Component({
  selector: "app-ports-list",
  imports: [PortRow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./ports-list.html",
  styleUrl: "./ports-list.css",
})
export class PortsList {
  private readonly shell = inject(ShellApi);
  private readonly router = inject(Router);
  private readonly detail = inject(DetailSession);
  protected readonly inventory = inject(PortInventory);

  onSearch(event: Event): void {
    this.inventory.setQuery((event.target as HTMLInputElement).value);
  }

  /** Открыть настройки. */
  openSettings(): void {
    void this.router.navigate(["/settings"]);
  }

  /** Раскрыть порт: выбираем его и переходим на карточку деталей. */
  openDetail(port: PortInfo): void {
    this.detail.select(port);
    void this.router.navigate(["/detail"]);
  }

  async open(port: PortInfo): Promise<void> {
    try {
      await this.shell.openInBrowser(port.port);
    } catch (err) {
      console.error(err);
    }
  }

  async kill(port: PortInfo): Promise<void> {
    if (port.pid === null) return;
    await this.inventory.kill(port.pid);
  }
}
