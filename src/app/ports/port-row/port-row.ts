import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { GroupedPort } from "../grouped-port";

/** Одна «терминальная запись» порта: статус, :порт, процесс, PID и действия. */
@Component({
  selector: "app-port-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./port-row.html",
  styleUrl: "./port-row.css",
})
export class PortRow {
  /** Обогащённая строка списка — все производные факты уже посчитаны. */
  readonly row = input.required<GroupedPort>();
  readonly select = output<void>();
  readonly open = output<void>();
  readonly kill = output<void>();
}
