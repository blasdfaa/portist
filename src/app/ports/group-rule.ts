import { InjectionToken } from "@angular/core";

/**
 * Правило группировки портов. Чистый предикат от номера порта — факты о
 * конкретных номерах правило берёт из Port Catalog, политику диапазонов
 * (`port < 1024`, fallback) держит само.
 *
 * Чтобы добавить новую группу, не трогая существующий код, зарегистрируйте
 * ещё один провайдер токена {@link PORT_GROUP_RULES} (multi: true).
 */
export interface GroupRule {
  /** Стабильный идентификатор группы. */
  id: string;
  /** Заголовок группы в UI. */
  label: string;
  /** Порядок проверки и отображения (меньше — раньше). */
  order: number;
  /** Подходит ли порт под эту группу. Первое сработавшее правило выигрывает. */
  match: (port: number) => boolean;
  /** Стоит ли предлагать «открыть в браузере» (вероятно-HTTP). */
  canOpenInBrowser?: (port: number) => boolean;
}

/** Мульти-провайдерный токен со всеми правилами группировки. */
export const PORT_GROUP_RULES = new InjectionToken<GroupRule[]>(
  "PORT_GROUP_RULES",
);
