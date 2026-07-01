import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";

import type { ContainerInfo, PortDetails, PortInfo } from "./models";
import type { PortBridge } from "./port-bridge";

/** Прод-адаптер шва: команды Rust через мост Tauri. */
@Injectable()
export class TauriPortBridge implements PortBridge {
  listPorts(): Promise<PortInfo[]> {
    return invoke<PortInfo[]>("list_ports");
  }

  killProcess(pid: number): Promise<void> {
    return invoke<void>("kill_process", { pid });
  }

  portDetails(pid: number): Promise<PortDetails> {
    return invoke<PortDetails>("get_port_details", { pid });
  }

  listContainers(): Promise<ContainerInfo[]> {
    return invoke<ContainerInfo[]>("list_containers");
  }

  stopContainer(id: string): Promise<void> {
    return invoke<void>("stop_container", { id });
  }
}
