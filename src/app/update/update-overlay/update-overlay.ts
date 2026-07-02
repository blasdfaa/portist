import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { TranslocoPipe } from "@jsverse/transloco";

import { AppUpdaterService } from "../app-updater-service";

/**
 * Полноэкранный блокирующий оверлей на время установки апдейта: лоадер, текст
 * «приложение обновляется» и процент. Показывается ровно в состоянии
 * `downloading` — и для авто-установки, и для ручной. Установку нельзя отменить,
 * поэтому оверлей непрерываемый; в `idle`/остальных состояниях не рисует ничего.
 */
@Component({
  selector: "app-update-overlay",
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./update-overlay.html",
  styleUrl: "./update-overlay.css",
})
export class UpdateOverlay {
  protected readonly updater = inject(AppUpdaterService);

  /** Прогресс загрузки в процентах для индикатора. */
  protected readonly percent = computed(() => {
    const state = this.updater.state();
    return state.kind === "downloading" ? Math.round(state.progress * 100) : 0;
  });
}
