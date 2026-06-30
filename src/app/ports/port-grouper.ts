import { Injectable, inject } from "@angular/core";

import type { PortInfo } from "../core/models";
import { serviceName } from "../core/port-catalog";
import type { GroupedPort, PortGroup } from "./grouped-port";
import { type GroupRule, PORT_GROUP_RULES } from "./group-rule";

/**
 * Раскладывает порты по корзинам согласно реестру правил.
 * Первое сработавшее правило (по возрастанию `order`) выигрывает.
 */
@Injectable({ providedIn: "root" })
export class PortGrouper {
  private readonly rules = [...inject(PORT_GROUP_RULES)].sort(
    (a, b) => a.order - b.order,
  );

  /**
   * Группирует порты в обогащённые строки. Правило сопоставляется один раз на
   * порт; из того же совпадения рождаются все производные факты строки
   * (`canOpen`, `killable`, `serviceName`) — без повторного match на рендер.
   */
  group(ports: PortInfo[]): PortGroup[] {
    const buckets = new Map<string, PortGroup>(
      this.rules.map((rule) => [
        rule.id,
        { id: rule.id, label: rule.label, rows: [] },
      ]),
    );

    for (const port of ports) {
      const rule = this.matchRule(port.port);
      if (!rule) continue;
      buckets.get(rule.id)?.rows.push(this.toRow(port, rule));
    }

    return [...buckets.values()].filter((group) => group.rows.length > 0);
  }

  private toRow(port: PortInfo, rule: GroupRule): GroupedPort {
    return {
      port,
      canOpen: rule.canOpenInBrowser?.(port.port) ?? false,
      killable: port.isCurrentUser && port.pid !== null,
      serviceName: serviceName(port.port),
    };
  }

  private matchRule(port: number): GroupRule | undefined {
    return this.rules.find((rule) => rule.match(port));
  }
}
