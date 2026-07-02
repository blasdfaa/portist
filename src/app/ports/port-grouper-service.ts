import { Injectable } from "@angular/core";

import type { ContainerInfo, PortInfo } from "../core/models";
import { isLikelyHttp, serviceName } from "../core/port-catalog";
import {
  DOCKER_GROUP,
  type GroupedPort,
  OTHER_GROUP,
  type PortGroup,
  type PortSubGroup,
  indexContainersByPort,
  portKey,
} from "./grouped-port";

/** Проект внутри группы «Docker» + признак compose (для порядка вывода). */
interface Project {
  compose: boolean;
  name: string;
  sub: PortSubGroup;
}

/**
 * Раскладывает порты по группам-источникам в два уровня.
 *
 * Docker-порты собираются в одну группу «Docker», а внутри неё — по
 * сворачиваемым проектам (compose-проект или отдельный контейнер). Остальные
 * порты группируются по точному имени процесса (`processName`): один процесс —
 * одна группа. Порты без имени процесса уходят в остаточную группу «Прочее».
 *
 * Порядок групп на выходе — служебный (docker → процессы в порядке появления →
 * «Прочее»); пользовательский порядок отображения (пины + авто-хвост)
 * накладывается выше, см. {@link ./group-order}.
 */
@Injectable({ providedIn: "root" })
export class PortGrouperService {
  /**
   * Группирует порты в обогащённые строки. Совпадение (контейнер или имя
   * процесса) ищется один раз на порт; из него рождаются производные факты
   * строки (`canOpen`, `killable`, `serviceName`, `container`).
   */
  group(ports: PortInfo[], containers: ContainerInfo[] = []): PortGroup[] {
    const byPort = indexContainersByPort(containers);

    // Проекты группы «Docker» (ключ = compose-проект либо имя контейнера).
    const projects = new Map<string, Project>();
    // Группы по имени процесса (ключ = processName); порядок = первое появление.
    const byProcess = new Map<string, PortGroup>();
    // Остаточная группа для портов без имени процесса.
    const other: PortGroup = {
      id: OTHER_GROUP.id,
      label: OTHER_GROUP.label,
      translate: true,
      rows: [],
    };

    for (const port of ports) {
      const container = byPort.get(portKey(port.protocol, port.port)) ?? null;

      if (container) {
        this.project(projects, container).sub.rows.push(
          this.dockerRow(port, container),
        );
        continue;
      }

      const row = this.localRow(port);
      const name = port.processName;
      if (name === null) {
        other.rows.push(row);
        continue;
      }
      let group = byProcess.get(name);
      if (!group) {
        group = { id: name, label: name, rows: [] };
        byProcess.set(name, group);
      }
      group.rows.push(row);
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
      // label — ключ каталога (переводится в шаблоне); подгруппы-проекты ниже
      // остаются динамическими подписями «📦 имя» и не переводятся.
      groups.push({
        id: DOCKER_GROUP.id,
        label: DOCKER_GROUP.label,
        translate: true,
        rows: [],
        subGroups,
      });
    }
    groups.push(...byProcess.values());
    if (other.rows.length > 0) groups.push(other);
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

  private localRow(port: PortInfo): GroupedPort {
    return {
      port,
      // «Открыть в браузере» — по вероятности HTTP, независимо от группы-источника.
      canOpen: isLikelyHttp(port.port),
      killable: port.isCurrentUser && port.pid !== null,
      serviceName: serviceName(port.port),
      container: null,
    };
  }
}
