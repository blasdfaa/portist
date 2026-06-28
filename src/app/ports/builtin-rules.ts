import type { Provider } from "@angular/core";

import { isLikelyHttp, kindOf } from "../core/port-catalog";
import { type GroupRule, PORT_GROUP_RULES } from "./group-rule";

/**
 * Встроенные правила группировки. Факты о конкретных портах берутся из
 * {@link ../core/port-catalog}; здесь — только политика: порядок, заголовки и
 * диапазонные/fallback-предикаты.
 */

const databaseRule: GroupRule = {
  id: "database",
  label: "Базы данных",
  order: 10,
  match: (ctx) => kindOf(ctx.port) === "database",
  canOpenInBrowser: () => false,
};

const devRule: GroupRule = {
  id: "dev",
  label: "Разработка",
  order: 20,
  match: (ctx) => kindOf(ctx.port) === "dev",
  canOpenInBrowser: () => true,
};

const systemRule: GroupRule = {
  id: "system",
  label: "Системные",
  order: 30,
  match: (ctx) => ctx.port < 1024,
  canOpenInBrowser: (ctx) => isLikelyHttp(ctx.port),
};

const otherRule: GroupRule = {
  id: "other",
  label: "Прочее",
  order: 40,
  match: () => true, // fallback — должен идти последним
  canOpenInBrowser: (ctx) => isLikelyHttp(ctx.port),
};

/** Встроенные правила, готовые к подключению в провайдеры приложения. */
export const BUILTIN_GROUP_RULES: Provider[] = [
  databaseRule,
  devRule,
  systemRule,
  otherRule,
].map((rule) => ({ provide: PORT_GROUP_RULES, useValue: rule, multi: true }));
