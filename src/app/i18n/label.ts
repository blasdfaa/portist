/**
 * Подпись элемента UI: либо ключ каталога переводов, либо готовый литерал
 * (имя процесса, «📦 project»). Дискриминированный тип вместо `label: string` +
 * соседнего флага `translate`: «ключ vs литерал» ловится типом, а не конвенцией,
 * и решается в одном месте — {@link resolveLabel} / `LabelPipe`.
 */
export type Label = { readonly key: string } | { readonly text: string };

/** Подпись-ключ каталога переводов. */
export const labelKey = (key: string): Label => ({ key });

/** Подпись-литерал (переводу не подлежит). */
export const labelText = (text: string): Label => ({ text });

/**
 * Разрешает подпись в строку: ключ — через переданный `t`, литерал — как есть.
 * Чистое ядро рендера подписи (пайп добавляет лишь Transloco и реактивность).
 */
export function resolveLabel(label: Label, t: (key: string) => string): string {
  return "key" in label ? t(label.key) : label.text;
}
