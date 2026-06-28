# Доменный словарь — portist

Трей-утилита для слежения за слушающими портами. Бэкенд (Rust/Tauri) отдаёт
«сырые факты», фронт (Angular) их классифицирует и показывает. Термины ниже —
имена хороших швов; используйте их в коде и обсуждениях.

## Сущности

- **Listening Port (PortInfo)** — один слушающий сокет: порт, протокол, PID,
  имя процесса, адрес, «своё ли» (`isCurrentUser`). Приходит из Rust как есть.
- **Port Details** — расширенные сведения о процессе порта (cmd, cwd, проект,
  CPU, память…). Грузятся по запросу при раскрытии порта.
- **Group Rule** — чистый предикат «порт → группа» + признак «открыть в
  браузере». Реестр правил расширяется через DI-токен `PORT_GROUP_RULES`.
  Факты о конкретных портах берёт из **Port Catalog**, политику диапазонов
  (`port < 1024`, fallback) держит сам.
- **Port Group** — корзина строк одной группы (БД / Разработка / Системные / Прочее);
  несёт `rows: GroupedPort[]`, заполняется за один проход группировки.
- **Grouped Port** — view-model строки списка: `{ port, canOpen, serviceName }`.
  Оба производных факта (`canOpen`, `serviceName`) рождаются из единственного
  совпадения правила + Port Catalog — без повторного match на каждый рендер.
  Рисуется компонентом `PortRow` (не путать: данные — `GroupedPort`, UI — `PortRow`).
- **Detail Field** — одна строка карточки деталей. Реестр полей расширяется
  через массив `PORT_DETAIL_FIELDS`. Поле «Сервис» читает имя из Port Catalog.
- **Port Catalog** — единственный источник правды о конкретном порте: имя
  сервиса, вид (`database` / `dev` / `http`), http-вероятность. Одна таблица
  `Record<number, PortFact>` вместо четырёх (`DATABASE_PORTS`, `DEV_PORTS`,
  `EXTRA_HTTP_PORTS`, `WELL_KNOWN_PORTS`). Чистые функции в `core/`.

## Модули фронта (deep modules)

- **Port Inventory** — модуль состояния списка портов: загрузка, поиск-фильтр,
  группировка, `refresh`/`kill`. Интерфейс модуля = тестовая поверхность списка.
- **Detail Session** — модуль раскрытого порта: выбранный порт и его детали как
  `resource()`, ключуемый на PID. `select`/`back`. Тестовая поверхность деталей.

- **Port Bridge** — узкий интерфейс-шов к бэкенду: `listPorts`, `killProcess`,
  `portDetails`. Прод-адаптер `TauriPortBridge` поверх Tauri, `FakePortBridge`
  для тестов. Два адаптера делают шов настоящим. Краевые shell/window-эффекты
  (`openInBrowser`, `copyText`, `onPopoverShown`) живут отдельно в `ShellApi` —
  интерфейса не имеют, в тестах не подменяются.

Координацию двух модулей (выбор → загрузка деталей, kill → откат → refresh,
показ поповера → сброс) держит тонкий компонент-представление `App`.
Глубокие модули (`PortInventory`, `DetailSession`) зависят от `Port Bridge`,
не от Tauri напрямую.

## Конвенция нейминга и структуры

Опираемся на style guide Angular и дефолт CLI 22 — **без type-суффиксов**:

- Классы по роли, без `Service`/`Component`/`Store`: `PortInventory`, `PortRow`,
  `PortGrouper`. Инъектируемость показывает декоратор (`@Injectable`/`@Service`)
  и место `inject()`, а не имя.
- Файлы — kebab-case без `.service`/`.component`: `port-inventory.ts`, `port-row.ts`.
- Интерфейсы/типы — существительные без суффиксов: `PortBridge`, `GroupedPort`.
- **Каждый компонент — в своей папке, разнесён на три файла**: `.ts` (логика),
  `.html` (шаблон), `.css` (стили). Никаких инлайновых `template`/`styles`.
- Группировка по фиче, не по типу (нет общей папки `components/`):

```
src/app/
  app/       app.ts · app.html · app.css          (корневой компонент)
  app.config.ts
  core/      models · port-bridge · tauri-port-bridge · shell-api · port-catalog
  ports/     port-inventory · port-grouper · group-rule · builtin-rules · grouped-port
             port-row/   (port-row.ts · .html · .css)
  detail/    detail-session · port-detail-fields · formatters
             port-detail/ (port-detail.ts · .html · .css)
  testing/   fake-port-bridge
```

Переименования существующего кода под конвенцию: `AppComponent`→`App`,
`PortGrouperService`→`PortGrouper`, `PortRowComponent`→`PortRow`,
`PortDetailComponent`→`PortDetail`, `TauriApiService` распадается на
`TauriPortBridge` + `ShellApi`. Файлы `.component.ts`/`.service.ts` → `.ts`.
