import { type WritableSignal, effect, signal } from "@angular/core";

/**
 * Узкий порт хранилища: read/write сырых строк по ключу. Прод-адаптер —
 * {@link localStorageAdapter}; в тестах подставляется in-memory. Единственное
 * место, где живёт `try/catch` доступа к хранилищу.
 */
export interface StoragePort {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

/**
 * Кодек «значение ↔ строка хранилища». `parse` впитывает и валидацию, и дефолт:
 * `raw === null` (ключа нет) или мусор → дефолтное значение, никогда не бросает.
 */
export interface Codec<T> {
  parse(raw: string | null): T;
  serialize(value: T): string;
}

/**
 * Прод-адаптер поверх `localStorage`. Ошибки проглатываются: в приватном режиме
 * или при отключённом хранилище персист необязателен — приложение работает,
 * просто выбор не переживёт перезапуск.
 */
export const localStorageAdapter: StoragePort = {
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Персист необязателен — молча продолжаем.
    }
  },
};

/**
 * `WritableSignal<T>`, засеянный из хранилища и пишущий себя обратно при каждом
 * изменении. Единственный дом персистентности: чтение, запись, валидация и
 * `try/catch` — здесь, а не размазаны по сторам. Drop-in замена связки
 * `signal(read())` + persist-`effect`; DOM-эффекты остаются в сторах.
 *
 * Вызывать в injection-контексте (инициализатор поля `@Injectable`-сервиса) —
 * внутренний `effect` привязывается к его инжектору и гаснет с сервисом.
 */
export function persistedSignal<T>(
  key: string,
  codec: Codec<T>,
  storage: StoragePort = localStorageAdapter,
): WritableSignal<T> {
  const state = signal(codec.parse(storage.read(key)));
  effect(() => storage.write(key, codec.serialize(state())));
  return state;
}
