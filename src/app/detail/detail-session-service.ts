import { Injectable, computed, inject, resource, signal } from "@angular/core";

import { PORT_BRIDGE } from "../core/port-bridge";
import type { GroupedPort } from "../ports/grouped-port";
import { PortInventoryService } from "../ports/port-inventory-service";

/**
 * Сессия раскрытого порта: выбранная строка, её детали и завершение процесса.
 *
 * Через шов проходит готовый {@link GroupedPort} — производные факты
 * (`canOpen`, `killable`, `serviceName`) уже посчитаны группировкой, карточка
 * их не выводит заново. Детали — `resource()`, ключуемый на PID; смена выбора
 * сама перезапускает загрузку, `pid === null` → ресурс idle.
 *
 * Модуль владеет всем жизненным циклом раскрытия: `open`, `close`, `kill` и
 * единый {@link error}. Карточка говорит только с этим модулем — kill не идёт в
 * обход в `PortInventory`, ошибка не склеивается из двух владельцев в компоненте.
 * Закрытие сбрасывает выбор, поэтому `selected()` достоверно отражает «открыта
 * ли карточка» — на это опираются guard маршрута и `selected()!` в карточке.
 */
@Injectable({ providedIn: "root" })
export class DetailSessionService {
  private readonly bridge = inject(PORT_BRIDGE);
  private readonly inventory = inject(PortInventoryService);

  private readonly _selected = signal<GroupedPort | null>(null);
  readonly selected = this._selected.asReadonly();

  /** Детали выбранного порта; idle, пока pid неизвестен. */
  readonly details = resource({
    params: () => this._selected()?.port.pid ?? undefined,
    loader: ({ params }) => this.bridge.portDetails(params),
  });

  /** Ошибка карточки — один владелец: отказ загрузки деталей или неудавшийся kill. */
  readonly error = computed<string | null>(() => {
    const err = this.details.error();
    return err ? String(err) : this.inventory.error();
  });

  /** Раскрыть строку (детали подгрузятся сами, если есть PID). */
  open(row: GroupedPort): void {
    this._selected.set(row);
  }

  /** Закрыть карточку — выбор сбрасывается, ресурс гаснет. */
  close(): void {
    this._selected.set(null);
  }

  /**
   * Завершить процесс выбранной строки. Делегирует в {@link PortInventoryService}
   * (kill → откат → refresh); ошибка ложится в общий {@link error}. Возвращает
   * успех — навигацию решает карточка. Сессию НЕ закрывает: закрытие — по уходу
   * с карточки (её `ngOnDestroy`), чтобы `selected()` не обнулился до перехода.
   */
  async kill(): Promise<boolean> {
    const pid = this._selected()?.port.pid;
    if (pid == null) return false;
    return this.inventory.kill(pid);
  }
}
