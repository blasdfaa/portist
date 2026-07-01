import type { ContainerInfo, PortDetails, PortInfo } from "../core/models";
import type { PortBridge } from "../core/port-bridge";

/**
 * In-memory адаптер шва для тестов. Задаёшь порты и карту деталей, считаешь
 * вызовы `killProcess`, можешь заставить любую команду отклониться.
 *
 * Второй адаптер `PortBridge` (рядом с `TauriPortBridge`) — именно он делает
 * шов настоящим: глубокие модули тестируются без рантайма Tauri.
 */
export class FakePortBridge implements PortBridge {
  /** Что вернёт `listPorts`. */
  ports: PortInfo[] = [];
  /** Детали по PID, которые вернёт `portDetails`. */
  detailsByPid = new Map<number, PortDetails>();
  /** Что вернёт `listContainers`. */
  containers: ContainerInfo[] = [];
  /** PID, по которым был вызван `killProcess`, в порядке вызова. */
  readonly killed: number[] = [];
  /** id контейнеров, по которым был вызван `stopContainer`, в порядке вызова. */
  readonly stopped: string[] = [];

  /** Если задано — соответствующая команда отклоняется этой ошибкой. */
  rejectListPorts?: unknown;
  rejectKill?: unknown;
  rejectDetails?: unknown;
  rejectListContainers?: unknown;
  rejectStop?: unknown;

  async listPorts(): Promise<PortInfo[]> {
    if (this.rejectListPorts !== undefined) throw this.rejectListPorts;
    return this.ports;
  }

  async killProcess(pid: number): Promise<void> {
    if (this.rejectKill !== undefined) throw this.rejectKill;
    this.killed.push(pid);
  }

  async portDetails(pid: number): Promise<PortDetails> {
    if (this.rejectDetails !== undefined) throw this.rejectDetails;
    const details = this.detailsByPid.get(pid);
    if (!details) throw new Error(`Нет деталей для PID ${pid}`);
    return details;
  }

  async listContainers(): Promise<ContainerInfo[]> {
    if (this.rejectListContainers !== undefined) throw this.rejectListContainers;
    return this.containers;
  }

  async stopContainer(id: string): Promise<void> {
    if (this.rejectStop !== undefined) throw this.rejectStop;
    this.stopped.push(id);
  }
}
