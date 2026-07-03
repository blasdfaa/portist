# Доменный словарь — portist

Трей-утилита для слежения за слушающими портами. Бэкенд (Rust/Tauri) отдаёт
«сырые факты», фронт (Angular) их классифицирует и показывает. Термины ниже —
имена хороших швов; используйте их в коде и обсуждениях.

## Сущности

- **Listening Port (PortInfo)** — один слушающий сокет: порт, протокол, PID,
  имя процесса, адрес, «своё ли» (`isCurrentUser`). Приходит из Rust как есть.
- **Port Details** — расширенные сведения о процессе порта (cmd, cwd, проект,
  CPU, память…). Грузятся по запросу при раскрытии порта.
- **Port Grouper** — раскладка портов по группам за один проход. Ключ группы:
  docker-контейнер (джойн по опубликованному порту) → группа «Docker» с
  под-группами по compose-проекту/контейнеру; иначе точное имя процесса
  (`processName`) — одна группа на процесс; порты без имени процесса → остаточная
  «Прочее». Номер порта на группу не влияет — Port Catalog даёт строке только имя
  сервиса и http-вероятность, а не группу. Реестра правил «номер → группа» и
  DI-токена нет (см. `docs/adr/0002`).
- **Port Group** — корзина строк одной группы, заполняется за один проход. Особые
  группы «Docker» (несёт `subGroups`-проекты вместо плоских `rows`) и «Прочее»
  несут подпись-ключ каталога (`labelKey`), динамические группы по имени процесса —
  подпись-литерал (`labelText`). Различие «ключ vs литерал» несёт тип **Label**,
  рендерит `LabelPipe` (`i18n/`) — не соседний булев флаг.
- **Grouped Port** — view-model строки списка: `{ port, canOpen, killable, serviceName }`.
  Все три производных факта рождаются из единственного совпадения группировки
  (контейнер / имя процесса) + Port Catalog — без повторного match на каждый рендер. Один и тот же `GroupedPort`
  пересекает селекционный шов в карточку деталей, поэтому факты считаются один
  раз для списка и для деталей. Рисуется компонентом `PortRow` (данные —
  `GroupedPort`, UI — `PortRow`).
- **Detail Field** — одна строка карточки деталей. Реестр полей расширяется
  через массив `PORT_DETAIL_FIELDS`. Поле «Сервис» читает имя из Port Catalog.
- **Port Catalog** — единственный источник правды о конкретном порте: имя
  сервиса (`serviceName`) и http-вероятность (`isLikelyHttp`, флаг `http`). Одна
  таблица `Record<number, PortFact>` вместо четырёх (`DATABASE_PORTS`, `DEV_PORTS`,
  `EXTRA_HTTP_PORTS`, `WELL_KNOWN_PORTS`). Чистые функции в `core/`, под тестом.

## Модули фронта (deep modules)

- **Port Inventory** — модуль состояния списка портов: загрузка, поиск-фильтр,
  группировка, `refresh`/`kill`. Интерфейс модуля = тестовая поверхность списка.
- **Detail Session** — модуль раскрытого порта: выбранная строка (`GroupedPort`
  с уже посчитанными `canOpen`/`killable`/`serviceName`), её детали как
  `resource()` по PID, а также `kill` и единый `error`. `open`/`close`/`kill` —
  модуль владеет всем циклом раскрытия; карточка говорит только с ним: kill не
  идёт в обход в `PortInventory`, а `error` не склеивается в компоненте из двух
  владельцев (отказ деталей ⊕ отказ kill сводит сама сессия). Закрытие сбрасывает
  выбор, поэтому `selected()` достоверно отражает «открыта ли карточка» (на это
  опираются guard маршрута и `selected()!` в карточке). Тестовая поверхность деталей.

- **Port Bridge** — узкий интерфейс-шов к бэкенду: `listPorts`, `killProcess`,
  `portDetails`. Прод-адаптер `TauriPortBridge` поверх Tauri, `FakePortBridge`
  для тестов. Два адаптера делают шов настоящим. Краевые shell/window-эффекты
  (`openInBrowser`, `copyText`, `onPopoverShown`) живут отдельно в `ShellApi` —
  интерфейса не имеют, в тестах не подменяются.

- **Persisted Signal** — `WritableSignal<T>`, засеянный из хранилища и пишущий
  себя обратно при каждом изменении: единственный дом персистентности настроек
  (`core/persisted-signal`). Кодек `{ parse, serialize }` держит валидацию и
  дефолт (`parse(null)` → дефолт, никогда не бросает); `StoragePort` — узкий шов
  хранилища, прод-адаптер `localStorageAdapter` централизует `try/catch`,
  in-memory подставляется в тестах. `ThemeService` и `PreferencesService`
  строятся на нём (drop-in замена `signal(read())` + persist-`effect`).
  `LanguageService` фиксирует явный выбор через тот же адаптер, но активный язык
  остаётся за Transloco. DOM-эффекты (`data-theme`, `<html lang>`) — не в шве,
  живут в сторах. Тестовая поверхность: чистые кодеки + сам `persistedSignal`
  через in-memory адаптер (vitest, `@angular/build:unit-test`).

Экраны — роут-компоненты (`PortsList`, `PortDetail`, `Settings`) в
`<router-outlet>`; роутер переключает их с нативными view transitions
(`withViewTransitions`, направление — из `data.depth`). `App` — тонкая
оболочка: баннер обновлений + аутлет.

Координация распределена по роли, а не собрана в `App`:
- выбор строки и навигация на карточку — `PortsList.openDetail` (`DetailSession.open` + `router`);
- загрузка деталей — `DetailSession` (`resource` по PID);
- закрытие сессии — `DetailSession.close()` по уходу с карточки (`PortDetail.ngOnDestroy`);
- инвариант «карточка только при выбранной строке» — `detailGuard` в `app.routes`;
- kill из карточки — `DetailSession.kill` (делегирует в `PortInventory.kill`:
  kill → откат → refresh), возврат к списку — `PortDetail`; из списка — напрямую `PortInventory.kill`;
- показ поповера / «проверить обновления» → `router.navigateByUrl("/")` в `App`.

Глубокие модули (`PortInventory`, `DetailSession`) зависят от `Port Bridge`,
не от Tauri напрямую.

## Конвенция нейминга и структуры

Опираемся на style guide Angular и дефолт CLI 22 — **без type-суффиксов**:

- Классы по роли, без `Service`/`Component`/`Store`: `PortInventory`, `PortRow`,
  `PortGrouper`. Инъектируемость показывает декоратор (`@Injectable`/`@Service`)
  и место `inject()`, а не имя.
- Файлы — kebab-case без `.service`/`.component`: `port-inventory.ts`, `port-row.ts`.
- Интерфейсы/типы — существительные без суффиксов: `PortBridge`, `GroupedPort`.
- **Компонент — в своей папке (имя папки = имя компонента), разнесён на три
  файла** `.ts`/`.html`/`.css`. Никаких инлайновых `template`/`styles`.
  Исключение (LIFT-Flat): корневой `App` и корневой экран фичи, чьё имя совпало
  бы с именем фиче-папки, кладутся плоско — без избыточного дубля
  (`settings/settings.ts`, не `settings/settings/`; `app/app.ts` — дефолт CLI).
- `app.config.ts` (провайдеры, в т.ч. `provideRouter`) и `app.routes.ts`
  (экраны) — плоско в корне `src/app/`.
- Группировка по фиче, не по типу (нет общей папки `components/`):

```
src/app/
  app.ts · app.html · app.css            (корневой компонент, плоско)
  app.config.ts · app.routes.ts          (провайдеры + маршруты)
  core/      models · port-bridge · tauri-port-bridge · shell-api · port-catalog
             persisted-signal (StoragePort + Codec + persistedSignal)
  ports/     port-inventory · port-grouper · group-order · grouped-port
             port-row/    (port-row.ts · .html · .css)
             ports-list/  (экран списка)
  detail/    detail-session · port-detail-fields · formatters
             port-detail/ (port-detail.ts · .html · .css)
  settings/  theme · settings.ts · .html · .css   (экран — плоско в фиче)
             setting-row/ (setting-row.ts · .html · .css)
  update/    app-updater
             update-banner/ (update-banner.ts · .html · .css)
  testing/   fake-port-bridge
```

Переименования существующего кода под конвенцию: `AppComponent`→`App`,
`PortGrouperService`→`PortGrouper`, `PortRowComponent`→`PortRow`,
`PortDetailComponent`→`PortDetail`, `TauriApiService` распадается на
`TauriPortBridge` + `ShellApi`. Файлы `.component.ts`/`.service.ts` → `.ts`.
