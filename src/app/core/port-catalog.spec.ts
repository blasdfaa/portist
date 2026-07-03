import { describe, expect, it } from "vitest";

import { isLikelyHttp, serviceName } from "./port-catalog";

describe("serviceName", () => {
  it("возвращает каноничное имя известного порта", () => {
    expect(serviceName(5432)).toBe("postgresql");
    expect(serviceName(443)).toBe("https");
  });
  it("null для неизвестного порта", () => {
    expect(serviceName(12345)).toBeNull();
  });
  it("null для http-записи без имени сервиса", () => {
    expect(serviceName(1420)).toBeNull();
  });
});

describe("isLikelyHttp", () => {
  it("true для dev/http-портов", () => {
    expect(isLikelyHttp(4200)).toBe(true);
    expect(isLikelyHttp(80)).toBe(true);
    expect(isLikelyHttp(8080)).toBe(true);
  });
  it("false для портов баз данных", () => {
    expect(isLikelyHttp(5432)).toBe(false);
    expect(isLikelyHttp(6379)).toBe(false);
  });
  it("false для неизвестного порта", () => {
    expect(isLikelyHttp(12345)).toBe(false);
  });
});
