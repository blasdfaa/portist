import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * Строка настройки: слева название и необязательное описание, справа —
 * управляющий контрол (проецируется через <ng-content>). Переиспользуемый
 * каркас для всех настроек: новый пункт = ещё один <app-setting-row>.
 */
@Component({
  selector: "app-setting-row",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./setting-row.html",
  styleUrl: "./setting-row.css",
})
export class SettingRow {
  /** Название настройки. */
  readonly label = input.required<string>();
  /** Необязательное пояснение под названием. */
  readonly description = input<string>("");
}
