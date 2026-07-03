import { TestBed } from "@angular/core/testing";
import { describe, expect, it } from "vitest";

import { type Codec, type StoragePort, persistedSignal } from "./persisted-signal";

/** In-memory адаптер — второй адаптер шва, задействованный только в тестах. */
function memoryStorage(seed: Record<string, string> = {}): StoragePort {
  const data = new Map(Object.entries(seed));
  return {
    read: (k) => data.get(k) ?? null,
    write: (k, v) => void data.set(k, v),
  };
}

const numberCodec: Codec<number> = {
  parse: (raw) => {
    const n = Number(raw);
    return raw !== null && Number.isFinite(n) ? n : 0;
  },
  serialize: (v) => String(v),
};

describe("persistedSignal", () => {
  it("засевается из хранилища через codec.parse", () => {
    const store = memoryStorage({ k: "42" });
    const sig = TestBed.runInInjectionContext(() =>
      persistedSignal("k", numberCodec, store),
    );
    expect(sig()).toBe(42);
  });

  it("падает на дефолт, если ключа нет или значение мусорное", () => {
    const store = memoryStorage({ k: "nonsense" });
    const sig = TestBed.runInInjectionContext(() =>
      persistedSignal("k", numberCodec, store),
    );
    expect(sig()).toBe(0);
  });

  it("пишет сериализованное значение обратно при изменении", () => {
    const store = memoryStorage();
    const sig = TestBed.runInInjectionContext(() =>
      persistedSignal("k", numberCodec, store),
    );
    sig.set(7);
    TestBed.tick();
    expect(store.read("k")).toBe("7");
  });
});
