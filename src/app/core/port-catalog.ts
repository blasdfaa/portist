/**
 * Каталог портов — единственный источник правды о конкретном порте.
 *
 * Свернул четыре прежние таблицы (`DATABASE_PORTS`, `DEV_PORTS`,
 * `EXTRA_HTTP_PORTS`, `WELL_KNOWN_PORTS`) в одну запись на порт. Чтобы научить
 * приложение новому порту — одна строка здесь, а не правка нескольких файлов.
 *
 * Каталог отвечает только за факты о конкретных номерах: имя сервиса и
 * http-вероятность. Группировку (docker-контейнер + имя процесса) и порядок
 * делает фронт отдельно — по фактам каталога, без правил «номер → группа».
 */

/** Факт об одном порте. Оба поля опциональны (union прежних четырёх таблиц). */
export interface PortFact {
  /** Каноничное имя сервиса (IANA + типичные dev). */
  service?: string;
  /** Похоже ли, что на порту говорит HTTP (можно открыть в браузере). */
  http?: boolean;
}

/** Известные порты: имя сервиса и/или http-вероятность. Одна строка = один порт. */
const PORT_CATALOG: Record<number, PortFact> = {
  22: { service: "ssh" },
  25: { service: "smtp" },
  53: { service: "dns" },
  80: { service: "http", http: true },
  110: { service: "pop3" },
  143: { service: "imap" },
  443: { service: "https", http: true },
  587: { service: "smtp (submission)" },
  993: { service: "imaps" },
  1420: { http: true },
  1521: { service: "oracle" },
  3000: { service: "node / dev-server", http: true },
  3001: { http: true },
  3306: { service: "mysql" },
  4000: { http: true },
  4173: { http: true },
  4200: { service: "angular dev-server", http: true },
  5000: { http: true },
  5173: { service: "vite", http: true },
  5174: { http: true },
  5432: { service: "postgresql" },
  5984: { service: "couchdb" },
  6379: { service: "redis" },
  7687: { service: "neo4j (bolt)" },
  8000: { service: "http (dev)", http: true },
  8080: { service: "http-alt", http: true },
  8081: { http: true },
  8443: { service: "https-alt", http: true },
  8888: { http: true },
  9000: { http: true },
  9042: { service: "cassandra" },
  9090: { http: true },
  9200: { service: "elasticsearch" },
  11211: { service: "memcached" },
  27017: { service: "mongodb" },
};

/** Имя сервиса для порта или null, если неизвестно. */
export function serviceName(port: number): string | null {
  return PORT_CATALOG[port]?.service ?? null;
}

/** Похоже ли, что на порту говорит HTTP (можно открыть в браузере). */
export function isLikelyHttp(port: number): boolean {
  return PORT_CATALOG[port]?.http ?? false;
}
