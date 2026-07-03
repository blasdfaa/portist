# 0001 — Убрать преждевременный шов elevated-kill

- Статус: Принято
- Дата: 2026-07-03

## Контекст

`src-tauri/src/killer.rs` нёс `trait ProcessKiller` + `NativeKiller`, `enum
KillMode { Normal, Elevated }` и параметр `mode: Option<KillMode>` в команде
`kill_process`. Заложено это было как точка расширения под завершение процессов
с повышением прав (elevated kill).

Реальность на момент решения:

- реализация одна — `NativeKiller` для процессов текущего пользователя;
- ветка `KillMode::Elevated` возвращала `KillError::Unsupported` (стаб);
- фронт никогда не передавал `mode` — `TauriPortBridge` зовёт
  `invoke("kill_process", { pid })`, типа `KillMode` на стороне TS не существует.

По принципу дизайна «один адаптер = гипотетический шов, два = настоящий» это
неоплаченная абстракция: ни второго адаптера, ни теста. Trait, enum и параметр
концентрировали ноль поведения — deletion test не проходили.

## Решение

Удалить `trait ProcessKiller`, `NativeKiller`, `enum KillMode`, ветку `Elevated`
и параметр `mode`. Команда упрощается до `kill_process(pid: u32) -> Result<(),
String>`, зовущей `kill_normal(pid)` напрямую. `KillError` остаётся (без
варианта `Unsupported`).

## Последствия

- Минус преждевременная абстракция; `killer.rs` — плоский, читается сверху вниз.
- **Elevated kill не выкинут как идея, а отложен.** Когда он реально понадобится
  (macOS `osascript … with administrator privileges`, Windows `runas`/UAC, Linux
  `pkexec`), шов вводится тогда же — вероятно, как отдельная команда или
  восстановленный параметр `mode` вместе с TS-типом по обе стороны шва.
- Этот ADR существует, чтобы будущий architecture review **не пере-предлагал**
  «добавить точку расширения под elevated kill»: её отсутствие — сознательный
  выбор, а не упущение.
