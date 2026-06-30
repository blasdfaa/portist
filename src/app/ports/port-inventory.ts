import { Injectable, computed, inject, signal } from "@angular/core";

import type { PortInfo } from "../core/models";
import { PORT_BRIDGE } from "../core/port-bridge";
import { PortGrouper } from "./port-grouper";

/**
 * Состояние списка портов: загрузка, поиск-фильтр, группировка, kill.
 * Интерфейс модуля — тестовая поверхность списка: дёргаешь действия, читаешь
 * сигналы; DOM и рантайм Tauri не нужны (зависит от {@link PORT_BRIDGE}).
 */
@Injectable({ providedIn: "root" })
export class PortInventory {
  private readonly bridge = inject(PORT_BRIDGE);
  private readonly grouper = inject(PortGrouper);

  private readonly ports = signal<PortInfo[]>([]);
  private readonly _query = signal("");

  readonly query = this._query.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Порты после поискового запроса (по номеру или имени процесса). */
  private readonly filtered = computed(() => {
    const q = this._query().trim().toLowerCase();
    const ports = this.ports();
    if (!q) return ports;
    return ports.filter(
      (p) =>
        String(p.port).includes(q) ||
        (p.processName?.toLowerCase().includes(q) ?? false),
    );
  });

  readonly groups = computed(() => this.grouper.group(this.filtered()));
  readonly total = computed(() => this.ports().length);
  readonly filteredTotal = computed(() => this.filtered().length);

  setQuery(value: string): void {
    this._query.set(value);
  }

  /** Перечитать список портов с бэкенда. */
  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.ports.set(await this.bridge.listPorts());
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  /** Завершить процесс и обновить список. `false` — kill не удался (ошибка в `error`). */
  async kill(pid: number): Promise<boolean> {
    this.error.set(null);
    try {
      await this.bridge.killProcess(pid);
    } catch (err) {
      this.error.set(String(err));
      return false;
    }
    await this.refresh();
    return true;
  }
}
