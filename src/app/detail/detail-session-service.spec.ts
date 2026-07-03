import { TestBed } from "@angular/core/testing";
import { describe, beforeEach, expect, it } from "vitest";

import type { PortInfo } from "../core/models";
import { PORT_BRIDGE } from "../core/port-bridge";
import type { GroupedPort } from "../ports/grouped-port";
import { FakePortBridge } from "../testing/fake-port-bridge";
import { DetailSessionService } from "./detail-session-service";

function row(pid: number | null): GroupedPort {
  const port: PortInfo = {
    port: 8080,
    protocol: "tcp",
    pid,
    processName: "node",
    isCurrentUser: true,
    address: "127.0.0.1",
  };
  return {
    port,
    canOpen: true,
    killable: pid !== null,
    serviceName: null,
    container: null,
  };
}

describe("DetailSessionService.kill", () => {
  let bridge: FakePortBridge;
  let session: DetailSessionService;

  beforeEach(() => {
    bridge = new FakePortBridge();
    TestBed.configureTestingModule({
      providers: [{ provide: PORT_BRIDGE, useValue: bridge }],
    });
    session = TestBed.inject(DetailSessionService);
  });

  it("без выбранной строки возвращает false и не зовёт bridge", async () => {
    expect(await session.kill()).toBe(false);
    expect(bridge.killed).toEqual([]);
  });

  it("делегирует kill в bridge по PID выбранной строки", async () => {
    session.open(row(4242));
    expect(await session.kill()).toBe(true);
    expect(bridge.killed).toEqual([4242]);
  });

  it("не killable-строка (pid = null) → false, без вызова bridge", async () => {
    session.open(row(null));
    expect(await session.kill()).toBe(false);
    expect(bridge.killed).toEqual([]);
  });

  it("отказ kill → false, ошибка видна через единый session.error", async () => {
    bridge.rejectKill = "нет прав";
    session.open(row(4242));
    expect(await session.kill()).toBe(false);
    expect(session.error()).toContain("нет прав");
  });
});
