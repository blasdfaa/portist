import type { PortDetails, PortInfo } from "../core/models";
import type { Lang } from "../i18n/lang";
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
  /** Перевод ключа каталога — для значений-«хрома» (например, exposure). */
  t: (key: string) => string;
  /** Активный язык — для локали форматтеров (байты/длительность/дата). */
  lang: Lang;
}

/** Описание одной строки в карточке порта. */
export interface DetailField {
  id: string;
  /** Ключ каталога переводов для подписи поля (переводится в компоненте). */
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
    label: "detail.fields.service",
    value: (c) => c.serviceName,
  },
  {
    id: "url",
    label: "detail.fields.url",
    value: (c) => (c.canOpen ? `localhost:${c.port.port}` : null),
    copy: (c) => (c.canOpen ? `http://localhost:${c.port.port}` : null),
  },
  {
    id: "address",
    label: "detail.fields.address",
    value: (c) => c.port.address,
  },
  {
    id: "protocol",
    label: "detail.fields.protocol",
    value: (c) => c.port.protocol.toUpperCase(),
  },
  {
    id: "exposure",
    label: "detail.fields.exposure",
    value: (c) =>
      c.t(
        c.port.address === "0.0.0.0" || c.port.address === "::"
          ? "detail.exposure.network"
          : "detail.exposure.local",
      ),
  },
  {
    id: "pid",
    label: "detail.fields.pid",
    value: (c) =>
      c.details?.pid != null
        ? String(c.details.pid)
        : c.port.pid != null
          ? String(c.port.pid)
          : null,
  },
  {
    id: "project",
    label: "detail.fields.project",
    value: (c) => c.details?.project ?? null,
  },
  {
    id: "user",
    label: "detail.fields.user",
    value: (c) => c.details?.user ?? null,
  },
  {
    id: "status",
    label: "detail.fields.status",
    value: (c) => c.details?.status ?? null,
  },
  {
    id: "cpu",
    label: "detail.fields.cpu",
    value: (c) =>
      c.details && c.details.cpuUsage > 0
        ? `${c.details.cpuUsage.toFixed(1)} %`
        : null,
  },
  {
    id: "memory",
    label: "detail.fields.memory",
    value: (c) => formatBytes(c.details?.memory, c.lang),
  },
  {
    id: "uptime",
    label: "detail.fields.uptime",
    value: (c) => formatDuration(c.details?.runTime, c.lang),
  },
  {
    id: "started",
    label: "detail.fields.started",
    value: (c) => formatDateTime(c.details?.startTime, c.lang),
  },
  {
    id: "parent",
    label: "detail.fields.parent",
    value: (c) => {
      const d = c.details;
      if (!d?.parentPid) return null;
      return d.parentName ? `${d.parentName} (#${d.parentPid})` : `#${d.parentPid}`;
    },
  },
  {
    id: "killcmd",
    label: "detail.fields.killcmd",
    value: (c) => {
      const pid = c.details?.pid ?? c.port.pid;
      return pid != null ? `kill -9 ${pid}` : null;
    },
  },
  {
    id: "exec",
    label: "detail.fields.exec",
    wide: true,
    value: (c) => c.details?.execPath ?? null,
  },
  {
    id: "cmd",
    label: "detail.fields.cmd",
    wide: true,
    value: (c) => (c.details?.cmd?.length ? c.details.cmd.join(" ") : null),
  },
  {
    id: "cwd",
    label: "detail.fields.cwd",
    wide: true,
    value: (c) => c.details?.cwd ?? null,
  },
];
