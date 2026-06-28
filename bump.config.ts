import { defineConfig } from "bumpp";

/**
 * `pnpm release` поднимает версию синхронно во всех трёх местах, где она живёт,
 * затем коммитит, ставит тег vX.Y.Z и пушит — это и запускает workflow релиза.
 * Значение `version` в tauri.conf.json должно совпадать с тегом, иначе updater
 * не увидит новую версию.
 */
export default defineConfig({
  files: ["package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"],
});
