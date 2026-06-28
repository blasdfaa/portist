import { InjectionToken } from "@angular/core";

import type { PortContext } from "../core/models";

/**
 * Правило группировки портов. Чистый предикат от контекста порта.
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
  match: (ctx: PortContext) => boolean;
  /** Стоит ли предлагать «открыть в браузере» (вероятно-HTTP). */
  canOpenInBrowser?: (ctx: PortContext) => boolean;
}

/** Мульти-провайдерный токен со всеми правилами группировки. */
export const PORT_GROUP_RULES = new InjectionToken<GroupRule[]>(
  "PORT_GROUP_RULES",
);
