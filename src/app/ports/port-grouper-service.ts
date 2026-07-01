import { Injectable, inject } from "@angular/core";

import type { ContainerInfo, PortInfo } from "../core/models";
import { isLikelyHttp, serviceName } from "../core/port-catalog";
import {
  type GroupedPort,
  type PortGroup,
  type PortSubGroup,
  indexContainersByPort,
  portKey,
} from "./grouped-port";
import { type GroupRule, PORT_GROUP_RULES } from "./group-rule";

/** Проект внутри группы «Docker» + признак compose (для порядка вывода). */
interface Project {
  compose: boolean;
  name: string;
  sub: PortSubGroup;
}

/**
 * Раскладывает порты по корзинам в два уровня.
 *
 * Все docker-порты собираются в одну группу «Docker», а внутри неё — по
 * сворачиваемым проектам (compose-проект или отдельный контейнер). Локальные
 * порты — как раньше: первое сработавшее статическое правило по возрастанию
 * `order` выигрывает. Порядок вывода: «Docker» → статические категории; проекты
 * внутри «Docker» — сначала compose, затем одиночки, оба по алфавиту.
 */
@Injectable({ providedIn: "root" })
export class PortGrouperService {
  private readonly rules = [...inject(PORT_GROUP_RULES)].sort(
    (a, b) => a.order - b.order,
  );

  /**
   * Группирует порты в обогащённые строки. Совпадение (контейнер или правило)
   * ищется один раз на порт; из него рождаются все производные факты строки
   * (`canOpen`, `killable`, `serviceName`, `container`).
   */
  group(ports: PortInfo[], containers: ContainerInfo[] = []): PortGroup[] {
    const byPort = indexContainersByPort(containers);

    // Проекты группы «Docker» (ключ = compose-проект либо имя контейнера).
    const projects = new Map<string, Project>();
    // Статические корзины локальных портов — как прежде.
    const staticBuckets = new Map<string, PortGroup>(
      this.rules.map((rule) => [
        rule.id,
        { id: rule.id, label: rule.label, rows: [] },
      ]),
    );

    for (const port of ports) {
      const container = byPort.get(portKey(port.protocol, port.port)) ?? null;

      if (container) {
        this.project(projects, container).sub.rows.push(
          this.dockerRow(port, container),
        );
        continue;
      }

      const rule = this.matchRule(port.port);
      if (!rule) continue;
      staticBuckets.get(rule.id)?.rows.push(this.localRow(port, rule));
    }

    const groups: PortGroup[] = [];
    if (projects.size > 0) {
      const subGroups = [...projects.values()]
        .sort(
          (a, b) =>
            Number(!a.compose) - Number(!b.compose) ||
            a.name.localeCompare(b.name),
        )
        .map((p) => p.sub);
      groups.push({ id: "docker", label: "🐳 Docker", rows: [], subGroups });
    }
    for (const group of staticBuckets.values()) {
      if (group.rows.length > 0) groups.push(group);
    }
    return groups;
  }

  /** Находит или заводит проект контейнера внутри группы «Docker». */
  private project(projects: Map<string, Project>, c: ContainerInfo): Project {
    const compose = c.composeProject !== null;
    const name = c.composeProject ?? c.name;
    let project = projects.get(name);
    if (!project) {
      project = {
        compose,
        name,
        sub: {
          id: `docker:${name}`,
          label: `${compose ? "📦" : "🐳"} ${name}`,
          rows: [],
        },
      };
      projects.set(name, project);
    }
    return project;
  }

  /** Docker-строка: действие идёт через stop, сырой kill PID отключён. */
  private dockerRow(port: PortInfo, container: ContainerInfo): GroupedPort {
    return {
      port,
      // «Открыть в браузере» — по вероятности HTTP на этом номере порта.
      canOpen: isLikelyHttp(port.port),
      // PID здесь — прокси Docker-VM, а не контейнер; убивать его нельзя.
      killable: false,
      serviceName: serviceName(port.port),
      container,
    };
  }

  private localRow(port: PortInfo, rule: GroupRule): GroupedPort {
    return {
      port,
      canOpen: rule.canOpenInBrowser?.(port.port) ?? false,
      killable: port.isCurrentUser && port.pid !== null,
      serviceName: serviceName(port.port),
      container: null,
    };
  }

  private matchRule(port: number): GroupRule | undefined {
    return this.rules.find((rule) => rule.match(port));
  }

  /**
   * Попадает ли (не-docker) порт в системную группу — для тумблера «скрыть
   * системные». Политика («что системное») остаётся в правилах, не дублируется.
   */
  isSystemPort(port: number): boolean {
    return this.matchRule(port)?.id === "system";
  }
}
