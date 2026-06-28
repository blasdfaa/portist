# Автообновление portist

Приложение само проверяет GitHub Releases на новую версию и умеет скачать-
установить-перезапуститься. Подпись бинарей обязательна — без валидной подписи
updater откажется ставить.

## Как это работает

1. При старте `App.ngOnInit` запускает **тихую** проверку (`AppUpdater.check(true)`):
   если апдейта нет — ничего не показывается. Пункт трея
   **«Проверить обновления»** запускает явную проверку (показывает статус).
2. `tauri-plugin-updater` тянет `latest.json` из последнего релиза на GitHub,
   сравнивает `version` с текущей, проверяет minisign-подпись артефакта
   публичным ключом из `tauri.conf.json` → `plugins.updater.pubkey`.
3. Если версия новее — баннер «Доступна версия X». Клик «Обновить» скачивает
   артефакт (с прогрессом), ставит и перезапускает приложение.

`latest.json` и подписанные бандлы публикует GitHub Action — вручную ничего
собирать и подписывать не нужно.

## ⚠️ Разовая настройка перед первым релизом

1. **Endpoint** уже настроен на репозиторий
   [`blasdfaa/portist`](https://github.com/blasdfaa/portist):

   ```json
   "endpoints": ["https://github.com/blasdfaa/portist/releases/latest/download/latest.json"]
   ```

   `endpoints`/`pubkey` зашиты в бинарь — менять можно только пересборкой.

2. **Секреты репозитория** (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — содержимое `~/.tauri/portist_updater.key`
     (`cat ~/.tauri/portist_updater.key`, вставить целиком).
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль ключа (у нас пустой, можно
     создать секрет с пустым значением или убрать строку из workflow).

   `GITHUB_TOKEN` создаётся автоматически — добавлять не нужно.

> Потеря приватного ключа = невозможность подписать апдейты. Храните бэкап.

## Релиз новой версии

Предусловие: проект — git-репозиторий с remote на GitHub (`git init`,
`git remote add origin …`, первый push). `pnpm release` ставит тег и пушит —
без remote шаг не пройдёт.

```fish
pnpm release
```

`bumpp` (`bump.config.ts`) спросит новую версию, синхронно поднимет её в
`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, закоммитит,
поставит тег `vX.Y.Z` и запушит. Пуш тега запускает workflow `release`:

- `.github/workflows/release.yml` собирает бандлы на macOS (Apple Silicon +
  Intel), Windows и Linux;
- подписывает их ключом из секретов;
- создаёт **черновик** релиза `vX.Y.Z` и заливает в него бандлы + `latest.json`.

После прогона: открыть черновик релиза на GitHub и **опубликовать** его.
Эндпоинт `releases/latest/download/...` указывает на последний опубликованный
(не draft, не prerelease) релиз — пока черновик не опубликован, клиенты апдейт
не увидят. После публикации запущенные приложения подхватят его при следующей
проверке.

## Платформенные бандлы

| ОС               | Артефакт обновления          |
| ---------------- | ---------------------------- |
| macOS (arm/x64)  | `*.app.tar.gz` (+ `.sig`)    |
| Windows          | `*-setup.exe` (NSIS, + `.sig`) |
| Linux            | `*.AppImage` (+ `.sig`)      |

`createUpdaterArtifacts: true` в `tauri.conf.json` уже включён, поэтому эти
артефакты и `latest.json` генерируются автоматически.
