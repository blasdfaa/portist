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

/** Один опубликованный на хост порт контейнера (приходит из Rust как есть). */
export interface ContainerPort {
  /** Порт на стороне хоста; null — порт не опубликован. */
  publicPort: number | null;
  protocol: Protocol;
}

/** Docker-контейнер и его опубликованные порты. Джойн с портом делает фронт. */
export interface ContainerInfo {
  /** Полный id контейнера (по нему шлём stop). */
  id: string;
  /** Имя контейнера (ведущий `/` уже убран). */
  name: string;
  /** Образ, например "postgres:16". */
  image: string;
  /** Имя compose-проекта, если контейнер поднят из compose; иначе null. */
  composeProject: string | null;
  /** Имя compose-сервиса; иначе null. */
  composeService: string | null;
  ports: ContainerPort[];
}
