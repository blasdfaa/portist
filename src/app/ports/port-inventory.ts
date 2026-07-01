import { Injectable, computed, inject, signal } from "@angular/core";

import type { ContainerInfo, PortInfo } from "../core/models";
import { PORT_BRIDGE } from "../core/port-bridge";
import { indexContainersByPort, portKey } from "./grouped-port";
import { PortGrouper } from "./port-grouper";

/**
 * Состояние списка портов: загрузка, поиск-фильтр, группировка, kill/stop.
 * Интерфейс модуля — тестовая поверхность списка: дёргаешь действия, читаешь
 * сигналы; DOM и рантайм Tauri не нужны (зависит от {@link PORT_BRIDGE}).
 */
@Injectable({ providedIn: "root" })
export class PortInventory {
  private readonly bridge = inject(PORT_BRIDGE);
  private readonly grouper = inject(PortGrouper);

  private readonly ports = signal<PortInfo[]>([]);
  private readonly containers = signal<ContainerInfo[]>([]);
  private readonly _query = signal("");

  readonly query = this._query.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Индекс контейнеров по опубликованному порту — для поиска и группировки. */
  private readonly containerByPort = computed(() =>
    indexContainersByPort(this.containers()),
  );

  /**
   * Порты после поиска: по номеру, имени процесса или полям контейнера
   * (имя/образ/compose-проект/сервис).
   */
  private readonly filtered = computed(() => {
    const q = this._query().trim().toLowerCase();
    const ports = this.ports();
    if (!q) return ports;
    const byPort = this.containerByPort();
    return ports.filter((p) => {
      if (String(p.port).includes(q)) return true;
      if (p.processName?.toLowerCase().includes(q) ?? false) return true;
      const c = byPort.get(portKey(p.protocol, p.port));
      if (!c) return false;
      return [c.name, c.image, c.composeProject, c.composeService].some(
        (v) => v?.toLowerCase().includes(q) ?? false,
      );
    });
  });

  readonly groups = computed(() =>
    this.grouper.group(this.filtered(), this.containers()),
  );
  readonly total = computed(() => this.ports().length);
  readonly filteredTotal = computed(() => this.filtered().length);

  /** id свёрнутых docker-проектов. По умолчанию все раскрыты (пустое). */
  private readonly _collapsed = signal<ReadonlySet<string>>(new Set());
  readonly collapsed = this._collapsed.asReadonly();

  setQuery(value: string): void {
    this._query.set(value);
  }

  /** Свернуть/развернуть docker-проект по id под-группы. */
  toggleProject(id: string): void {
    const next = new Set(this._collapsed());
    if (!next.delete(id)) next.add(id);
    this._collapsed.set(next);
  }

  /**
   * Перечитать порты и контейнеры. Контейнеры — best-effort: их ошибка/таймаут
   * (Docker выключен или недоступен) не мешает списку портов — просто нет
   * docker-групп. Оба запроса идут параллельно.
   */
  async refresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const [portsRes, containersRes] = await Promise.allSettled([
      this.bridge.listPorts(),
      this.bridge.listContainers(),
    ]);
    if (portsRes.status === "fulfilled") {
      this.ports.set(portsRes.value);
    } else {
      this.error.set(String(portsRes.reason));
    }
    this.containers.set(
      containersRes.status === "fulfilled" ? containersRes.value : [],
    );
    this.loading.set(false);
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

  /** Остановить контейнер и обновить список. `false` — не удалось (ошибка в `error`). */
  async stopContainer(id: string): Promise<boolean> {
    this.error.set(null);
    try {
      await this.bridge.stopContainer(id);
    } catch (err) {
      this.error.set(String(err));
      return false;
    }
    await this.refresh();
    return true;
  }
}
