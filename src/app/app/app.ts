import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";

import type { PortInfo } from "../core/models";
import { ShellApi } from "../core/shell-api";
import { DetailSession } from "../detail/detail-session";
import { PortDetail } from "../detail/port-detail/port-detail";
import { PortInventory } from "../ports/port-inventory";
import { PortRow } from "../ports/port-row/port-row";
import { Settings } from "../settings/settings/settings";
import { Theme } from "../settings/theme";
import { AppUpdater } from "../update/app-updater";
import { UpdateBanner } from "../update/update-banner/update-banner";

@Component({
  selector: "app-root",
  imports: [PortRow, PortDetail, UpdateBanner, Settings],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App implements OnInit {
  private readonly shell = inject(ShellApi);
  private readonly updater = inject(AppUpdater);
  // Инъекция в корне инициализирует сервис темы на старте: его effect
  // проставляет data-theme до отрисовки списка.
  private readonly theme = inject(Theme);
  protected readonly inventory = inject(PortInventory);
  protected readonly detail = inject(DetailSession);

  /** Показан ли экран настроек поверх списка. */
  protected readonly showSettings = signal(false);

  /** Детали из ресурса для карточки; null, пока значения нет (idle/загрузка). */
  protected readonly detailDetails = computed(() =>
    this.detail.details.hasValue() ? this.detail.details.value() : null,
  );

  /** Ошибка карточки = отказ загрузки деталей или неудавшийся kill. */
  protected readonly detailError = computed(() => {
    const err = this.detail.details.error();
    return err ? String(err) : this.inventory.error();
  });

  async ngOnInit(): Promise<void> {
    await this.inventory.refresh();
    // Тихая проверка обновлений при старте: «всё актуально» и сетевые ошибки
    // не мешают — баннер всплывёт, только если апдейт реально есть.
    void this.updater.check(true);
    // При каждом показе поповера возвращаемся к списку и обновляем данные.
    await this.shell.onPopoverShown(() => {
      this.detail.back();
      this.showSettings.set(false);
      this.inventory.setQuery("");
      void this.inventory.refresh();
    });
    // «Проверить обновления» из трей-меню — явная проверка с показом статуса.
    await this.shell.onCheckUpdates(() => {
      this.detail.back();
      void this.updater.check();
    });
  }

  onSearch(event: Event): void {
    this.inventory.setQuery((event.target as HTMLInputElement).value);
  }

  async open(port: PortInfo): Promise<void> {
    try {
      await this.shell.openInBrowser(port.port);
    } catch (err) {
      console.error(err);
    }
  }

  async kill(port: PortInfo): Promise<void> {
    if (port.pid === null) return;
    if (await this.inventory.kill(port.pid)) this.detail.back();
  }
}
