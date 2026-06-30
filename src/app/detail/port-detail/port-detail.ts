import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";

import { serviceName } from "../../core/port-catalog";
import { ShellApi } from "../../core/shell-api";
import { PortInventory } from "../../ports/port-inventory";
import { DetailSession } from "../detail-session";
import {
  PORT_DETAIL_FIELDS,
  type PortDetailContext,
} from "../port-detail-fields";

/** Карточка деталей выбранного порта. Поля берутся из реестра PORT_DETAIL_FIELDS. */
@Component({
  selector: "app-port-detail",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./port-detail.html",
  styleUrl: "./port-detail.css",
})
export class PortDetail {
  private readonly shell = inject(ShellApi);
  private readonly inventory = inject(PortInventory);
  private readonly session = inject(DetailSession);
  private readonly router = inject(Router);

  /** Выбранный порт. Маршрут защищён guard'ом, поэтому здесь всегда задан. */
  readonly port = computed(() => this.session.selected()!);

  /** Детали из ресурса; null, пока значения нет (idle/загрузка). */
  readonly details = computed(() =>
    this.session.details.hasValue() ? this.session.details.value() : null,
  );
  readonly loading = computed(() => this.session.details.isLoading());

  /** Ошибка карточки = отказ загрузки деталей или неудавшийся kill. */
  readonly error = computed(() => {
    const err = this.session.details.error();
    return err ? String(err) : this.inventory.error();
  });
  readonly canOpen = computed(() => this.inventory.canOpenInBrowser(this.port()));

  /** id поля, чьё значение только что скопировали (для фидбэка). */
  readonly copiedId = signal<string | null>(null);

  protected readonly String = String;

  private readonly ctx = computed<PortDetailContext>(() => ({
    port: this.port(),
    details: this.details(),
    serviceName: serviceName(this.port().port),
    canOpen: this.canOpen(),
  }));

  /** Поля из реестра, у которых есть значение. */
  readonly visibleFields = computed(() => {
    const ctx = this.ctx();
    return PORT_DETAIL_FIELDS.map((field) => {
      const value = field.value(ctx);
      return {
        id: field.id,
        label: field.label,
        wide: field.wide ?? false,
        value,
        copyValue: field.copy?.(ctx) ?? value ?? "",
      };
    }).filter((item) => item.value !== null && item.value !== "");
  });

  /** Назад к списку портов. */
  back(): void {
    void this.router.navigate(["/"]);
  }

  /** Открыть localhost:PORT в браузере. */
  async open(): Promise<void> {
    try {
      await this.shell.openInBrowser(this.port().port);
    } catch (err) {
      console.error(err);
    }
  }

  /** Завершить процесс и, при успехе, вернуться к списку. */
  async kill(): Promise<void> {
    const pid = this.port().pid;
    if (pid === null) return;
    if (await this.inventory.kill(pid)) this.back();
  }

  async copy(id: string, text: string): Promise<void> {
    if (!text) return;
    try {
      await this.shell.copyText(text);
      this.copiedId.set(id);
      setTimeout(() => {
        if (this.copiedId() === id) this.copiedId.set(null);
      }, 1200);
    } catch (err) {
      console.error(err);
    }
  }
}
