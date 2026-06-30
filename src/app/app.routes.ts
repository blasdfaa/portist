import { inject } from "@angular/core";
import { type CanActivateFn, Router, type Routes } from "@angular/router";

import { DetailSession } from "./detail/detail-session";
import { PortDetail } from "./detail/port-detail/port-detail";
import { PortsList } from "./ports/ports-list/ports-list";
import { Settings } from "./settings/settings";

/** Карточку открываем только при выбранном порте, иначе — назад к списку. */
const detailGuard: CanActivateFn = () =>
  inject(DetailSession).selected() ? true : inject(Router).createUrlTree(["/"]);

/**
 * Экраны приложения. `data.depth` задаёт глубину — из неё роутер выводит
 * направление перехода для view-transition (см. app.config.ts). Новый экран =
 * ещё одна запись здесь; анимация подключается автоматически по глубине.
 */
export const routes: Routes = [
  { path: "", component: PortsList, data: { depth: 0 } },
  { path: "settings", component: Settings, data: { depth: 1 } },
  {
    path: "detail",
    component: PortDetail,
    canActivate: [detailGuard],
    data: { depth: 1 },
  },
  { path: "**", redirectTo: "" },
];
