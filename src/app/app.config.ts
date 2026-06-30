import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from "@angular/core";
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type ViewTransitionInfo,
  withHashLocation,
  withViewTransitions,
} from "@angular/router";

import { routes } from "./app.routes";
import { PORT_BRIDGE } from "./core/port-bridge";
import { TauriPortBridge } from "./core/tauri-port-bridge";
import { BUILTIN_GROUP_RULES } from "./ports/builtin-rules";

/** Глубина листового маршрута из data.depth. */
function routeDepth(snapshot: ActivatedRouteSnapshot): number {
  let node = snapshot;
  while (node.firstChild) node = node.firstChild;
  return (node.data["depth"] as number | undefined) ?? 0;
}

// Первый переход — это старт приложения: анимировать нечего (нет «старого»
// экрана), поэтому его пропускаем.
let initialNavigation = true;

/**
 * Помечаем <html> направлением перехода (vt-forward / vt-back) — CSS
 * view-transition выбирает по нему сторону выезда. Класс снимаем по окончании.
 */
function markDirection({ transition, from, to }: ViewTransitionInfo): void {
  if (initialNavigation) {
    initialNavigation = false;
    transition.skipTransition();
    return;
  }
  const forward = routeDepth(to) >= routeDepth(from);
  const root = document.documentElement;
  root.classList.add(forward ? "vt-forward" : "vt-back");
  transition.finished.finally(() =>
    root.classList.remove("vt-forward", "vt-back"),
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withViewTransitions({ onViewTransitionCreated: markDirection }),
      // Хэш-роутинг: надёжнее во встроенном webview Tauri (без base-href/
      // протокольных нюансов и проблем перезагрузки по глубокой ссылке).
      withHashLocation(),
    ),
    // Прод-адаптер шва к бэкенду. В тестах — useValue: new FakePortBridge().
    { provide: PORT_BRIDGE, useClass: TauriPortBridge },
    // Расширяемый реестр правил группировки портов.
    ...BUILTIN_GROUP_RULES,
  ],
};
