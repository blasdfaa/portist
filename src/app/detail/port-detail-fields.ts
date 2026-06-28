import type { PortDetails, PortInfo } from "../core/models";
import { formatBytes, formatDateTime, formatDuration } from "./formatters";

/** Данные, из которых поле вычисляет своё значение. */
export interface PortDetailContext {
  port: PortInfo;
  /** Детали процесса; null, пока грузятся или недоступны (нет прав/PID). */
  details: PortDetails | null;
  /** Имя сервиса по номеру порта (IANA), если известно. */
  serviceName: string | null;
  /** Похоже ли, что порт говорит по HTTP (есть смысл показывать URL). */
  canOpen: boolean;
}

/** Описание одной строки в карточке порта. */
export interface DetailField {
  id: string;
  label: string;
  /** Значение для показа; верните null, чтобы скрыть поле целиком. */
  value: (ctx: PortDetailContext) => string | null;
  /** Что копировать по клику (по умолчанию — показанное значение). */
  copy?: (ctx: PortDetailContext) => string | null;
  /** Длинное значение во всю ширину (путь, командная строка). */
  wide?: boolean;
}

/**
 * Реестр полей карточки порта.
 *
 * Чтобы ДОБАВИТЬ значение — впишите один объект `DetailField`.
 * Чтобы УБРАТЬ — удалите строку. Поля, чьё `value` вернуло null, не рисуются.
 * Порядок в массиве = порядок на экране. Любое значение копируется по клику;
 * `copy` переопределяет, что именно кладётся в буфер.
 */
export const PORT_DETAIL_FIELDS: DetailField[] = [
  {
    id: "service",
    label: "Сервис",
    value: (c) => c.serviceName,
  },
  {
    id: "url",
    label: "URL",
    value: (c) => (c.canOpen ? `localhost:${c.port.port}` : null),
    copy: (c) => (c.canOpen ? `http://localhost:${c.port.port}` : null),
  },
  {
    id: "address",
    label: "Адрес",
    value: (c) => c.port.address,
  },
  {
    id: "protocol",
    label: "Протокол",
    value: (c) => c.port.protocol.toUpperCase(),
  },
  {
    id: "exposure",
    label: "Доступ",
    value: (c) =>
      c.port.address === "0.0.0.0" || c.port.address === "::"
        ? "виден в сети"
        : "только localhost",
  },
  {
    id: "pid",
    label: "PID",
    value: (c) =>
      c.details?.pid != null
        ? String(c.details.pid)
        : c.port.pid != null
          ? String(c.port.pid)
          : null,
  },
  {
    id: "project",
    label: "Проект",
    value: (c) => c.details?.project ?? null,
  },
  {
    id: "user",
    label: "Владелец",
    value: (c) => c.details?.user ?? null,
  },
  {
    id: "status",
    label: "Статус",
    value: (c) => c.details?.status ?? null,
  },
  {
    id: "cpu",
    label: "CPU",
    value: (c) =>
      c.details && c.details.cpuUsage > 0
        ? `${c.details.cpuUsage.toFixed(1)} %`
        : null,
  },
  {
    id: "memory",
    label: "Память",
    value: (c) => formatBytes(c.details?.memory),
  },
  {
    id: "uptime",
    label: "Работает",
    value: (c) => formatDuration(c.details?.runTime),
  },
  {
    id: "started",
    label: "Запущен",
    value: (c) => formatDateTime(c.details?.startTime),
  },
  {
    id: "parent",
    label: "Родитель",
    value: (c) => {
      const d = c.details;
      if (!d?.parentPid) return null;
      return d.parentName ? `${d.parentName} (#${d.parentPid})` : `#${d.parentPid}`;
    },
  },
  {
    id: "killcmd",
    label: "Команда kill",
    value: (c) => {
      const pid = c.details?.pid ?? c.port.pid;
      return pid != null ? `kill -9 ${pid}` : null;
    },
  },
  {
    id: "exec",
    label: "Путь",
    wide: true,
    value: (c) => c.details?.execPath ?? null,
  },
  {
    id: "cmd",
    label: "Командная строка",
    wide: true,
    value: (c) => (c.details?.cmd?.length ? c.details.cmd.join(" ") : null),
  },
  {
    id: "cwd",
    label: "Рабочая папка",
    wide: true,
    value: (c) => c.details?.cwd ?? null,
  },
];
