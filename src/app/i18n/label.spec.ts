import { describe, expect, it } from "vitest";

import { type Label, labelKey, labelText, resolveLabel } from "./label";

const upper = (key: string): string => key.toUpperCase();

describe("resolveLabel", () => {
  it("подпись-ключ прогоняется через t", () => {
    expect(resolveLabel(labelKey("groups.docker"), upper)).toBe("GROUPS.DOCKER");
  });
  it("подпись-литерал возвращается как есть, t не зовётся", () => {
    let called = false;
    const t = (k: string): string => {
      called = true;
      return k;
    };
    expect(resolveLabel(labelText("📦 shop"), t)).toBe("📦 shop");
    expect(called).toBe(false);
  });
});

describe("labelKey / labelText", () => {
  it("строят различимые по типу варианты", () => {
    const k: Label = labelKey("a");
    const t: Label = labelText("b");
    expect("key" in k).toBe(true);
    expect("text" in t).toBe(true);
  });
});
