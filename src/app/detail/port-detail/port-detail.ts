import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

import type { PortDetails, PortInfo } from "../../core/models";
import { serviceName } from "../../core/port-catalog";
import { ShellApi } from "../../core/shell-api";
import {
  PORT_DETAIL_FIELDS,
  type PortDetailContext,
} from "../port-detail-fields";

/** Карточка деталей одного порта. Поля берутся из реестра PORT_DETAIL_FIELDS. */
@Component({
  selector: "app-port-detail",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./port-detail.html",
  styleUrl: "./port-detail.css",
})
export class PortDetail {
  private readonly shell = inject(ShellApi);

  readonly port = input.required<PortInfo>();
  readonly details = input<PortDetails | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly canOpen = input<boolean>(false);

  readonly back = output<void>();
  readonly open = output<void>();
  readonly kill = output<void>();

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
