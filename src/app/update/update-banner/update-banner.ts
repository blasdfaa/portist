import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";

import { AppUpdaterService } from "../app-updater-service";

/**
 * Тонкая полоска поверх списка портов: уведомляет о доступном апдейте (кнопка
 * «Обновить») и об ошибке (кнопка «Повторить»). Логику держит AppUpdaterService —
 * здесь только представление. Статус проверки (`checking`/`uptodate`) живёт в
 * описании настройки «Автообновление», ход установки (`downloading`) — в
 * полноэкранном UpdateOverlay. В остальных состояниях не рисует ничего.
 */
@Component({
  selector: "app-update-banner",
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./update-banner.html",
  styleUrl: "./update-banner.css",
})
export class UpdateBanner {
  protected readonly updater = inject(AppUpdaterService);
}
