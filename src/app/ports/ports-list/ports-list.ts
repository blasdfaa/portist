import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import type { PortInfo } from "../../core/models";
import { ShellApi } from "../../core/shell-api";
import { DetailSession } from "../../detail/detail-session";
import type { GroupedPort, PortGroup } from "../grouped-port";
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

  /** Раскрыть строку: открываем сессию и переходим на карточку деталей. */
  openDetail(row: GroupedPort): void {
    this.detail.open(row);
    void this.router.navigate(["/detail"]);
  }

  /** Открыть localhost:PORT в браузере (политику отказа держит ShellApi). */
  open(port: PortInfo): void {
    void this.shell.openInBrowser(port.port);
  }

  async kill(port: PortInfo): Promise<void> {
    if (port.pid === null) return;
    await this.inventory.kill(port.pid);
  }

  /** Остановить контейнер docker-строки. */
  async stop(row: GroupedPort): Promise<void> {
    const id = row.container?.id;
    if (!id) return;
    await this.inventory.stopContainer(id);
  }

  /** Число портов в группе (для плоских — строки, для «Docker» — сумма проектов). */
  groupSize(group: PortGroup): number {
    if (!group.subGroups) return group.rows.length;
    return group.subGroups.reduce((n, sub) => n + sub.rows.length, 0);
  }

  /** Раскрыт ли docker-проект. При активном поиске раскрыты все — чтобы видеть совпадения. */
  isExpanded(subId: string): boolean {
    if (this.inventory.query().trim()) return true;
    return !this.inventory.collapsed().has(subId);
  }

  toggleProject(subId: string): void {
    this.inventory.toggleProject(subId);
  }
}
