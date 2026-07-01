import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from "@angular/core";

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
  /** Активная строка roving-навигации: получает tabindex=0 (остальные -1). */
  readonly active = input<boolean>(false);
  readonly select = output<void>();
  readonly open = output<void>();
  readonly kill = output<void>();
  /** Запрос на остановку контейнера (только для docker-строк). */
  readonly stop = output<void>();

  /** Показывать ли инлайн-подтверждение остановки контейнера. */
  protected readonly confirming = signal(false);

  protected askStop(): void {
    this.confirming.set(true);
  }

  protected cancelStop(): void {
    this.confirming.set(false);
  }

  protected confirmStop(): void {
    this.confirming.set(false);
    this.stop.emit();
  }
}
