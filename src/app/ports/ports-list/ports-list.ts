import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { TranslocoPipe } from "@jsverse/transloco";

import type { PortInfo } from "../../core/models";
import { ShellApiService } from "../../core/shell-api-service";
import { DetailSessionService } from "../../detail/detail-session-service";
import { type GroupedPort, groupSize } from "../grouped-port";
import { PortInventoryService } from "../port-inventory-service";
import { PortRow } from "../port-row/port-row";

/** Экран списка слушающих портов: поиск, группировка, переход к карточке. */
@Component({
  selector: "app-ports-list",
  imports: [PortRow, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./ports-list.html",
  styleUrl: "./ports-list.css",
})
export class PortsList {
  private readonly shell = inject(ShellApiService);
  private readonly router = inject(Router);
  private readonly detail = inject(DetailSessionService);
  protected readonly inventory = inject(PortInventoryService);

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

  /** Открыть localhost:PORT в браузере (политику отказа держит ShellApiService). */
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

  /** Число портов в группе — общий помощник модели. */
  protected readonly groupSize = groupSize;

  /** Раскрыт ли docker-проект. При активном поиске раскрыты все — чтобы видеть совпадения. */
  isExpanded(subId: string): boolean {
    if (this.inventory.query().trim()) return true;
    return !this.inventory.collapsed().has(subId);
  }

  toggleProject(subId: string): void {
    this.inventory.toggleProject(subId);
  }

  // --- Клавиатурная навигация (roving tabindex) ---

  /** Ключ строки для roving/трека — совпадает с track в шаблоне. */
  private rowKey(row: GroupedPort): string {
    return row.port.protocol + row.port.port;
  }

  /** Последняя строка под курсором roving (ключ). */
  private readonly roving = signal<string | null>(null);

  /** Ключи всех отрисованных строк в DOM-порядке (свёрнутые проекты выпадают). */
  private readonly orderedKeys = computed<string[]>(() => {
    const keys: string[] = [];
    for (const group of this.inventory.groups()) {
      if (group.subGroups) {
        for (const sub of group.subGroups) {
          if (!this.isExpanded(sub.id)) continue;
          for (const row of sub.rows) keys.push(this.rowKey(row));
        }
      } else {
        for (const row of group.rows) keys.push(this.rowKey(row));
      }
    }
    return keys;
  });

  /** Активная строка roving; если прежняя исчезла после фильтра — первая. */
  protected readonly activeKey = computed<string | null>(() => {
    const keys = this.orderedKeys();
    const current = this.roving();
    return current && keys.includes(current) ? current : (keys[0] ?? null);
  });

  protected isActive(row: GroupedPort): boolean {
    return this.rowKey(row) === this.activeKey();
  }

  /** Фокус зашёл в строку — запоминаем её как активную для roving. */
  onListFocusin(event: FocusEvent): void {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-key]");
    const key = row?.dataset["key"];
    if (key) this.roving.set(key);
  }

  /** ↑/↓/Home/End двигают DOM-фокус между строками (края не зациклены). */
  onListKeydown(event: KeyboardEvent): void {
    const keys = this.orderedKeys();
    if (keys.length === 0) return;
    const current = keys.indexOf(this.activeKey() ?? "");

    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = current < 0 ? 0 : Math.min(current + 1, keys.length - 1);
        break;
      case "ArrowUp":
        next = current < 0 ? 0 : Math.max(current - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = keys.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const list = event.currentTarget as HTMLElement;
    list
      .querySelector<HTMLElement>(`[data-key="${keys[next]}"]`)
      ?.focus();
  }
}
