import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import type { PortInfo } from "../../core/models";

/** Одна «терминальная запись» порта: статус, :порт, процесс, PID и действия. */
@Component({
  selector: "app-port-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./port-row.html",
  styleUrl: "./port-row.css",
})
export class PortRow {
  readonly port = input.required<PortInfo>();
  readonly canOpen = input<boolean>(false);
  readonly select = output<void>();
  readonly open = output<void>();
  readonly kill = output<void>();
}
