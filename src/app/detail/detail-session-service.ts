import { Injectable, inject, resource, signal } from "@angular/core";

import type { GroupedPort } from "../ports/grouped-port";
import { PORT_BRIDGE } from "../core/port-bridge";

/**
 * Сессия раскрытого порта: выбранная строка и её детали.
 *
 * Через шов проходит готовый {@link GroupedPort} — производные факты
 * (`canOpen`, `killable`, `serviceName`) уже посчитаны группировкой, карточка
 * их не выводит заново. Детали — `resource()`, ключуемый на PID; смена выбора
 * сама перезапускает загрузку, `pid === null` → ресурс idle.
 *
 * Модуль владеет всем жизненным циклом раскрытия: `open` и `close`. Закрытие
 * сбрасывает выбор, поэтому `selected()` достоверно отражает «открыта ли
 * карточка» — на это опираются guard маршрута и `selected()!` в карточке.
 */
@Injectable({ providedIn: "root" })
export class DetailSessionService {
  private readonly bridge = inject(PORT_BRIDGE);

  private readonly _selected = signal<GroupedPort | null>(null);
  readonly selected = this._selected.asReadonly();

  /** Детали выбранного порта; idle, пока pid неизвестен. */
  readonly details = resource({
    params: () => this._selected()?.port.pid ?? undefined,
    loader: ({ params }) => this.bridge.portDetails(params),
  });

  /** Раскрыть строку (детали подгрузятся сами, если есть PID). */
  open(row: GroupedPort): void {
    this._selected.set(row);
  }

  /** Закрыть карточку — выбор сбрасывается, ресурс гаснет. */
  close(): void {
    this._selected.set(null);
  }
}
