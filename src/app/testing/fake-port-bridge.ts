import type { PortDetails, PortInfo } from "../core/models";
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
  /** PID, по которым был вызван `killProcess`, в порядке вызова. */
  readonly killed: number[] = [];

  /** Если задано — соответствующая команда отклоняется этой ошибкой. */
  rejectListPorts?: unknown;
  rejectKill?: unknown;
  rejectDetails?: unknown;

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
}
