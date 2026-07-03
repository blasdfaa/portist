import { describe, expect, it } from "vitest";

import { parseLang } from "../i18n/lang";
import {
  autoUpdateCodec,
  groupSortCodec,
  pinnedCodec,
} from "./preferences-service";
import { themeCodec } from "./theme-service";

describe("themeCodec", () => {
  it("принимает валидные режимы", () => {
    expect(themeCodec.parse("dark")).toBe("dark");
    expect(themeCodec.parse("light")).toBe("light");
    expect(themeCodec.parse("auto")).toBe("auto");
  });
  it("падает на auto для мусора и отсутствия", () => {
    expect(themeCodec.parse("bogus")).toBe("auto");
    expect(themeCodec.parse(null)).toBe("auto");
  });
  it("сериализует как есть", () => {
    expect(themeCodec.serialize("dark")).toBe("dark");
  });
});

describe("pinnedCodec", () => {
  it("парсит JSON-массив строк", () => {
    expect(pinnedCodec.parse('["a","b"]')).toEqual(["a", "b"]);
  });
  it("пусто для отсутствия, битого JSON, не-массива и не-строк", () => {
    expect(pinnedCodec.parse(null)).toEqual([]);
    expect(pinnedCodec.parse("{")).toEqual([]);
    expect(pinnedCodec.parse('{"x":1}')).toEqual([]);
    expect(pinnedCodec.parse("[1,2]")).toEqual([]);
  });
  it("round-trip через serialize", () => {
    expect(pinnedCodec.parse(pinnedCodec.serialize(["x", "y"]))).toEqual([
      "x",
      "y",
    ]);
  });
});

describe("groupSortCodec", () => {
  it("«ports» только при точном совпадении, иначе «alpha»", () => {
    expect(groupSortCodec.parse("ports")).toBe("ports");
    expect(groupSortCodec.parse("alpha")).toBe("alpha");
    expect(groupSortCodec.parse(null)).toBe("alpha");
    expect(groupSortCodec.parse("xxx")).toBe("alpha");
  });
});

describe("autoUpdateCodec", () => {
  it("выключено только при явном «0»", () => {
    expect(autoUpdateCodec.parse("0")).toBe(false);
    expect(autoUpdateCodec.parse("1")).toBe(true);
    expect(autoUpdateCodec.parse(null)).toBe(true);
  });
  it("round-trip через serialize", () => {
    expect(autoUpdateCodec.parse(autoUpdateCodec.serialize(false))).toBe(false);
    expect(autoUpdateCodec.parse(autoUpdateCodec.serialize(true))).toBe(true);
  });
});

describe("parseLang", () => {
  it("уважает явный валидный выбор", () => {
    expect(parseLang("ru")).toBe("ru");
    expect(parseLang("en")).toBe("en");
  });
  it("для мусора/отсутствия возвращает поддерживаемый язык", () => {
    expect(["ru", "en"]).toContain(parseLang(null));
    expect(["ru", "en"]).toContain(parseLang("de-DE"));
  });
});
