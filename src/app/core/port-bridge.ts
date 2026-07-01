import { InjectionToken } from "@angular/core";

import type { ContainerInfo, PortDetails, PortInfo } from "./models";

/**
 * Узкий шов к бэкенду — ровно те data-команды, от которых зависят глубокие
 * модули списка и деталей. Прод-адаптер {@link TauriPortBridge} ходит в Tauri,
 * {@link FakePortBridge} (testing/) подставляется в тестах. Два адаптера делают
 * шов настоящим.
 *
 * Краевые shell/window-эффекты (открыть в браузере, буфер, событие поповера)
 * сюда НЕ входят — они живут в `ShellApi`, их не подменяют в тестах.
 */
export interface PortBridge {
  /** Список слушающих портов. */
  listPorts(): Promise<PortInfo[]>;
  /** Завершить процесс по PID. */
  killProcess(pid: number): Promise<void>;
  /** Детали процесса по PID (грузятся при раскрытии порта). */
  portDetails(pid: number): Promise<PortDetails>;
  /** Запущенные Docker-контейнеры с опубликованными портами (best-effort). */
  listContainers(): Promise<ContainerInfo[]>;
  /** Остановить контейнер по id. */
  stopContainer(id: string): Promise<void>;
}

/** DI-токен шва. В проде — `TauriPortBridge`, в тестах — `FakePortBridge`. */
export const PORT_BRIDGE = new InjectionToken<PortBridge>("PORT_BRIDGE");
