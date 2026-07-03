import { Pipe, type PipeTransform, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { TranslocoService } from "@jsverse/transloco";

import { type Label, resolveLabel } from "./label";

/**
 * Рендер {@link Label}: ключ — через Transloco, литерал — как есть. `pure: false`
 * и чтение сигнала активного языка делают подписи-ключи реактивными к живой смене
 * языка — тем же способом, что и штатный `TranslocoPipe`.
 */
@Pipe({ name: "label", pure: false })
export class LabelPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  transform(label: Label): string {
    this.activeLang(); // реактивная зависимость: перерисовка при смене языка
    return resolveLabel(label, (key) => this.transloco.translate(key));
  }
}
