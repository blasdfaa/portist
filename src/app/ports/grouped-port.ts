import type { PortInfo } from "../core/models";

/**
 * Строка списка: порт плюс производные факты, рождённые из единственного
 * совпадения правила группировки + Port Catalog. Рисуется компонентом
 * `PortRow` (данные — `GroupedPort`, UI — `PortRow`).
 */
export interface GroupedPort {
  port: PortInfo;
  /** Показывать ли «открыть в браузере». */
  canOpen: boolean;
  /** Можно ли завершить процесс (свой процесс с известным PID). */
  killable: boolean;
  /** Имя сервиса по номеру порта (IANA), если известно. */
  serviceName: string | null;
}

/** Корзина строк одной группы; заполняется за один проход группировки. */
export interface PortGroup {
  id: string;
  label: string;
  rows: GroupedPort[];
}
