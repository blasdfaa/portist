import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";

import { AppUpdater } from "../app-updater";

/**
 * Тонкая полоска поверх списка портов: показывает статус автообновления и
 * даёт кнопки «Обновить» / «Повторить». Логику держит AppUpdater — здесь
 * только представление. В состоянии `idle` не рисует ничего.
 */
@Component({
  selector: "app-update-banner",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./update-banner.html",
  styleUrl: "./update-banner.css",
})
export class UpdateBanner {
  protected readonly updater = inject(AppUpdater);

  /** Прогресс загрузки в процентах для индикатора. */
  protected readonly percent = computed(() => {
    const state = this.updater.state();
    return state.kind === "downloading" ? Math.round(state.progress * 100) : 0;
  });
}
