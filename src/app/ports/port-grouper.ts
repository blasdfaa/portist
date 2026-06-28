import { Injectable, inject } from "@angular/core";

import type { PortContext, PortInfo } from "../core/models";
import { serviceName } from "../core/port-catalog";
import type { GroupedPort, PortGroup } from "./grouped-port";
import { PORT_GROUP_RULES } from "./group-rule";

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
   * порт; из того же совпадения берутся `canOpen` и (через каталог) `serviceName`.
   */
  group(ports: PortInfo[]): PortGroup[] {
    const buckets = new Map<string, PortGroup>(
      this.rules.map((rule) => [
        rule.id,
        { id: rule.id, label: rule.label, rows: [] },
      ]),
    );

    for (const port of ports) {
      const ctx = this.toContext(port);
      const rule = this.matchRule(ctx);
      if (!rule) continue;
      buckets.get(rule.id)?.rows.push(this.toRow(port, ctx, rule.canOpenInBrowser));
    }

    return [...buckets.values()].filter((group) => group.rows.length > 0);
  }

  /** Стоит ли показывать «открыть в браузере» для одиночного порта (экран деталей). */
  canOpenInBrowser(port: PortInfo): boolean {
    const ctx = this.toContext(port);
    return this.matchRule(ctx)?.canOpenInBrowser?.(ctx) ?? false;
  }

  private toRow(
    port: PortInfo,
    ctx: PortContext,
    canOpen: ((ctx: PortContext) => boolean) | undefined,
  ): GroupedPort {
    return {
      port,
      canOpen: canOpen?.(ctx) ?? false,
      serviceName: serviceName(port.port),
    };
  }

  private matchRule(ctx: PortContext) {
    return this.rules.find((rule) => rule.match(ctx));
  }

  private toContext(port: PortInfo): PortContext {
    return {
      port: port.port,
      protocol: port.protocol,
      processName: port.processName,
      address: port.address,
    };
  }
}
