import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  computed,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { TranslocoPipe, TranslocoService } from "@jsverse/transloco";
import type { Observable } from "rxjs";

import { ShellApiService } from "../../core/shell-api-service";
import type { Lang } from "../../i18n/lang";
import { PortInventoryService } from "../../ports/port-inventory-service";
import { DetailSessionService } from "../detail-session-service";
import {
  PORT_DETAIL_FIELDS,
  type PortDetailContext,
} from "../port-detail-fields";

/** Карточка деталей выбранного порта. Поля берутся из реестра PORT_DETAIL_FIELDS. */
@Component({
  selector: "app-port-detail",
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./port-detail.html",
  styleUrl: "./port-detail.css",
})
export class PortDetail implements OnDestroy {
  private readonly shell = inject(ShellApiService);
  private readonly inventory = inject(PortInventoryService);
  private readonly session = inject(DetailSessionService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  /** Активный язык — источник реактивности для подписей и форматтеров. */
  private readonly activeLang = toSignal(
    this.transloco.langChanges$ as Observable<Lang>,
    { initialValue: this.transloco.getActiveLang() as Lang },
  );

  /** Раскрытая строка. Маршрут защищён guard'ом, поэтому здесь всегда задана. */
  private readonly row = computed(() => this.session.selected()!);

  readonly port = computed(() => this.row().port);
  /** Производные факты строки — посчитаны при группировке, не выводим заново. */
  readonly canOpen = computed(() => this.row().canOpen);
  readonly killable = computed(() => this.row().killable);

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

  /** id поля, чьё значение только что скопировали (для фидбэка). */
  readonly copiedId = signal<string | null>(null);

  protected readonly String = String;

  private readonly ctx = computed<PortDetailContext>(() => ({
    port: this.port(),
    details: this.details(),
    serviceName: this.row().serviceName,
    canOpen: this.canOpen(),
    // Читаем activeLang(), чтобы контекст (и поля ниже) пересчитывались при
    // живой смене языка: подписи и значения-хром переводятся заново.
    t: (key: string) => this.transloco.translate(key),
    lang: this.activeLang(),
  }));

  /** Поля из реестра, у которых есть значение; подписи уже переведены. */
  readonly visibleFields = computed(() => {
    const ctx = this.ctx();
    return PORT_DETAIL_FIELDS.map((field) => {
      const value = field.value(ctx);
      return {
        id: field.id,
        label: ctx.t(field.label),
        wide: field.wide ?? false,
        value,
        copyValue: field.copy?.(ctx) ?? value ?? "",
      };
    }).filter((item) => item.value !== null && item.value !== "");
  });

  /** Уход с карточки закрывает сессию — выбор сбрасывается у её владельца. */
  ngOnDestroy(): void {
    this.session.close();
  }

  /** Назад к списку портов. */
  back(): void {
    void this.router.navigate(["/"]);
  }

  /** Открыть localhost:PORT в браузере (политику отказа держит ShellApiService). */
  open(): void {
    void this.shell.openInBrowser(this.port().port);
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
