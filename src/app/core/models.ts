/** Протокол сокета. */
export type Protocol = "tcp" | "udp";

/** Информация об одном слушающем порте (приходит из Rust как есть). */
export interface PortInfo {
  port: number;
  protocol: Protocol;
  /** PID процесса; null, если ОС не отдала его (чужой/системный процесс). */
  pid: number | null;
  /** Имя процесса; null, если недоступно. */
  processName: string | null;
  /** Можно ли завершить процесс без повышения прав. */
  isCurrentUser: boolean;
  /** Адрес привязки сокета. */
  address: string;
}

/** Расширенные сведения о процессе (грузятся по запросу при раскрытии порта). */
export interface PortDetails {
  pid: number;
  name: string | null;
  execPath: string | null;
  cmd: string[];
  cwd: string | null;
  project: string | null;
  user: string | null;
  parentPid: number | null;
  parentName: string | null;
  status: string | null;
  /** epoch-секунды; 0 — неизвестно. */
  startTime: number;
  /** секунды работы. */
  runTime: number;
  /** загрузка CPU, %. */
  cpuUsage: number;
  /** RSS, байты. */
  memory: number;
  /** виртуальная память, байты. */
  virtualMemory: number;
}
