import type { ContainerInfo, PortInfo } from "../core/models";

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
  /** Docker-контейнер, опубликовавший этот порт; null — обычный процесс. */
  container: ContainerInfo | null;
}

/** Ключ джойна порта и опубликованного порта контейнера. */
export function portKey(protocol: string, port: number): string {
  return `${protocol}:${port}`;
}

/**
 * Индексирует контейнеры по опубликованному (host) порту — общий источник
 * джойна для поиска ({@link ../ports/port-inventory}) и группировки
 * ({@link ../ports/port-grouper}), чтобы логика ключа не расходилась.
 */
export function indexContainersByPort(
  containers: ContainerInfo[],
): Map<string, ContainerInfo> {
  const byPort = new Map<string, ContainerInfo>();
  for (const container of containers) {
    for (const port of container.ports) {
      if (port.publicPort !== null) {
        byPort.set(portKey(port.protocol, port.publicPort), container);
      }
    }
  }
  return byPort;
}

/**
 * Сворачиваемая под-группа внутри группы «Docker» — один проект: compose-проект
 * или отдельный контейнер. Раскрытие показывает её порты.
 */
export interface PortSubGroup {
  id: string;
  label: string;
  rows: GroupedPort[];
}

/**
 * Корзина строк одной группы; заполняется за один проход группировки. Обычные
 * группы (по имени процесса) держат порты в `rows`; группа «Docker» вместо
 * этого раскладывает их по `subGroups` (проектам).
 */
export interface PortGroup {
  id: string;
  label: string;
  rows: GroupedPort[];
  /**
   * `label` — ключ каталога переводов (переводить в шаблоне), а не сырое имя.
   * true только у особых групп (Docker, «Прочее»); динамические группы по имени
   * процесса выводят `label` как есть.
   */
  translate?: boolean;
  /** Сворачиваемые проекты — только у группы «Docker». */
  subGroups?: PortSubGroup[];
}

/** Число портов в группе (для плоских — строки, для «Docker» — сумма проектов). */
export function groupSize(group: PortGroup): number {
  if (!group.subGroups) return group.rows.length;
  return group.subGroups.reduce((n, sub) => n + sub.rows.length, 0);
}

/**
 * Особая группа «Docker»: собирает все контейнерные порты (джойн по контейнеру,
 * а не по имени процесса). `label` — ключ перевода.
 */
export const DOCKER_GROUP = { id: "docker", label: "groups.docker" } as const;

/**
 * Остаточная группа «Прочее»: порты без имени процесса (`processName === null`).
 * `label` — ключ перевода.
 */
export const OTHER_GROUP = { id: "other", label: "groups.other" } as const;
