/**
 * Каталог портов — единственный источник правды о конкретном порте.
 *
 * Свернул четыре прежние таблицы (`DATABASE_PORTS`, `DEV_PORTS`,
 * `EXTRA_HTTP_PORTS`, `WELL_KNOWN_PORTS`) в одну запись на порт. Чтобы научить
 * приложение новому порту — одна строка здесь, а не правка нескольких файлов.
 *
 * Политику диапазонов (`port < 1024`, fallback) держат правила группировки;
 * каталог отвечает только за факты о конкретных номерах.
 */

/** Вид порта: подсказка группы и http-вероятность одновременно. */
export type PortKind = "database" | "dev" | "http";

/** Факт об одном порте. Оба поля опциональны (union прежних четырёх таблиц). */
export interface PortFact {
  /** Каноничное имя сервиса (IANA + типичные dev). */
  service?: string;
  /** Вид порта; отсутствует — просто именованный сервис без группы/http. */
  kind?: PortKind;
}

/** Известные порты: имя сервиса и/или вид. Одна строка = один порт. */
const PORT_CATALOG: Record<number, PortFact> = {
  22: { service: "ssh" },
  25: { service: "smtp" },
  53: { service: "dns" },
  80: { service: "http", kind: "http" },
  110: { service: "pop3" },
  143: { service: "imap" },
  443: { service: "https", kind: "http" },
  587: { service: "smtp (submission)" },
  993: { service: "imaps" },
  1420: { kind: "dev" },
  1521: { service: "oracle", kind: "database" },
  3000: { service: "node / dev-server", kind: "dev" },
  3001: { kind: "dev" },
  3306: { service: "mysql", kind: "database" },
  4000: { kind: "dev" },
  4173: { kind: "dev" },
  4200: { service: "angular dev-server", kind: "dev" },
  5000: { kind: "dev" },
  5173: { service: "vite", kind: "dev" },
  5174: { kind: "dev" },
  5432: { service: "postgresql", kind: "database" },
  5984: { service: "couchdb", kind: "database" },
  6379: { service: "redis", kind: "database" },
  7000: { kind: "database" },
  7687: { service: "neo4j (bolt)", kind: "database" },
  8000: { service: "http (dev)", kind: "dev" },
  8080: { service: "http-alt", kind: "dev" },
  8081: { kind: "dev" },
  8443: { service: "https-alt", kind: "http" },
  8529: { kind: "database" },
  8888: { kind: "dev" },
  9000: { kind: "dev" },
  9042: { service: "cassandra", kind: "database" },
  9090: { kind: "dev" },
  9200: { service: "elasticsearch", kind: "database" },
  11211: { service: "memcached", kind: "database" },
  27017: { service: "mongodb", kind: "database" },
  28015: { kind: "database" },
  50000: { kind: "database" },
};

/** Имя сервиса для порта или null, если неизвестно. */
export function serviceName(port: number): string | null {
  return PORT_CATALOG[port]?.service ?? null;
}

/** Вид порта или null, если порт не в каталоге. */
export function kindOf(port: number): PortKind | null {
  return PORT_CATALOG[port]?.kind ?? null;
}

/** Похоже ли, что на порту говорит HTTP (можно открыть в браузере). */
export function isLikelyHttp(port: number): boolean {
  const kind = kindOf(port);
  return kind === "dev" || kind === "http";
}
