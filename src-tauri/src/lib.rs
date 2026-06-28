//! portist — трей-утилита для отслеживания слушающих портов.
//!
//! Приложение живёт только в трее. Поповер-окно создаётся один раз скрытым и
//! далее только показывается/прячется (show/hide), чтобы открываться мгновенно.

mod details;
mod killer;
mod ports;

use std::sync::Mutex;
use std::time::Instant;

use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{ManagerExt, MacosLauncher};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_positioner::{Position, WindowExt};

/// Метка единственного окна-поповера.
const POPOVER_LABEL: &str = "popover";

/// Глобальный хоткей открытия поповера.
const TOGGLE_SHORTCUT: &str = "CmdOrCtrl+Shift+P";

/// Окно прячется при потере фокуса. Чтобы клик по иконке трея при открытом окне
/// не приводил к «спрятать-и-сразу-показать», запоминаем момент последнего hide
/// и игнорируем клик, пришедший сразу за ним.
#[derive(Default)]
struct PopoverState {
    last_hidden: Mutex<Option<Instant>>,
}

/// Показать поповер у иконки трея и попросить фронт обновить список портов.
fn show_popover(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(POPOVER_LABEL) {
        // На Linux/GNOME трей может не отдавать координаты — откатываемся в угол.
        if window.move_window(Position::TrayCenter).is_err() {
            let _ = window.move_window(Position::BottomRight);
        }
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("popover-shown", ());
    }
}

/// Спрятать поповер и запомнить время — для подавления дребезга клика по трею.
fn hide_popover(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(POPOVER_LABEL) {
        let _ = window.hide();
    }
    if let Some(state) = app.try_state::<PopoverState>() {
        *state.last_hidden.lock().unwrap() = Some(Instant::now());
    }
}

/// Был ли поповер спрятан только что (в пределах окна дребезга).
fn was_just_hidden(app: &tauri::AppHandle) -> bool {
    app.try_state::<PopoverState>()
        .and_then(|s| *s.last_hidden.lock().unwrap())
        .map(|t| t.elapsed().as_millis() < 250)
        .unwrap_or(false)
}

/// Переключить видимость поповера (клик по трею / глобальный хоткей).
fn toggle_popover(app: &tauri::AppHandle) {
    // Клик сразу после авто-hide трактуем как «закрыть».
    if was_just_hidden(app) {
        return;
    }
    let visible = app
        .get_webview_window(POPOVER_LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible {
        hide_popover(app);
    } else {
        show_popover(app);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(TOGGLE_SHORTCUT)
                .expect("некорректный глобальный хоткей")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_popover(app);
                    }
                })
                .build(),
        )
        .manage(PopoverState::default())
        .invoke_handler(tauri::generate_handler![
            ports::list_ports,
            killer::kill_process,
            details::get_port_details
        ])
        .setup(|app| {
            // Автообновление подключаем только на десктопе (плагина нет на mobile).
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // На macOS убираем приложение из дока и Cmd-Tab — остаётся только трей.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Создаём поповер скрытым: Angular успевает забутстрапиться в фоне.
            let window = WebviewWindowBuilder::new(
                app,
                POPOVER_LABEL,
                WebviewUrl::App("index.html".into()),
            )
            .title("portist")
            .inner_size(420.0, 560.0)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .build()?;

            // Прячем окно при потере фокуса (клик вне поповера).
            let app_handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    hide_popover(&app_handle);
                }
            });

            // Контекстное меню трея (правый клик).
            let refresh = MenuItemBuilder::with_id("refresh", "Обновить").build(app)?;
            let autostart = CheckMenuItemBuilder::with_id("autostart", "Запускать при входе")
                .checked(app.autolaunch().is_enabled().unwrap_or(false))
                .build(app)?;
            let check_updates =
                MenuItemBuilder::with_id("check-updates", "Проверить обновления").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Выйти из portist").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&refresh)
                .item(&autostart)
                .item(&check_updates)
                .separator()
                .item(&quit)
                .build()?;

            let autostart_item = autostart.clone();
            TrayIconBuilder::with_id("main")
                // Монохромная template-иконка: macOS сама красит её под светлую/тёмную панель.
                .icon(tauri::include_image!("icons/tray.png"))
                .icon_as_template(true)
                .tooltip("portist — открытые порты")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "refresh" => show_popover(app),
                    // Показываем поповер и просим фронт запустить ручную проверку.
                    "check-updates" => {
                        show_popover(app);
                        let _ = app.emit("check-updates", ());
                    }
                    "autostart" => {
                        let manager = app.autolaunch();
                        let enabled = manager.is_enabled().unwrap_or(false);
                        let _ = if enabled {
                            manager.disable()
                        } else {
                            manager.enable()
                        };
                        let _ = autostart_item
                            .set_checked(manager.is_enabled().unwrap_or(!enabled));
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    // Обязательно: без этого positioner не знает координат иконки.
                    tauri_plugin_positioner::on_tray_event(app, &event);

                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popover(app);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
