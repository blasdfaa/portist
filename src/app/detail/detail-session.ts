import { Injectable, inject, resource, signal } from "@angular/core";

import type { PortInfo } from "../core/models";
import { PORT_BRIDGE } from "../core/port-bridge";

/**
 * Сессия раскрытого порта: выбранный порт и его детали.
 *
 * Детали — `resource()`, ключуемый на PID выбранного порта. Смена выбора сама
 * перезапускает загрузку; `pid === null` → ресурс idle (деталей не грузим,
 * показываем только данные порта). Декларативный автомат вместо ручных
 * сигналов loading/details/error.
 */
@Injectable({ providedIn: "root" })
export class DetailSession {
  private readonly bridge = inject(PORT_BRIDGE);

  private readonly _selected = signal<PortInfo | null>(null);
  readonly selected = this._selected.asReadonly();

  /** Детали выбранного порта; idle, пока pid неизвестен. */
  readonly details = resource({
    params: () => this._selected()?.pid ?? undefined,
    loader: ({ params }) => this.bridge.portDetails(params),
  });

  /** Раскрыть порт (детали подгрузятся сами, если есть PID). */
  select(port: PortInfo): void {
    this._selected.set(port);
  }
}
