import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from "@angular/core";

import { PORT_BRIDGE } from "./core/port-bridge";
import { TauriPortBridge } from "./core/tauri-port-bridge";
import { BUILTIN_GROUP_RULES } from "./ports/builtin-rules";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Прод-адаптер шва к бэкенду. В тестах — useValue: new FakePortBridge().
    { provide: PORT_BRIDGE, useClass: TauriPortBridge },
    // Расширяемый реестр правил группировки портов.
    // Новая группа = ещё один провайдер PORT_GROUP_RULES (multi).
    ...BUILTIN_GROUP_RULES,
  ],
};
