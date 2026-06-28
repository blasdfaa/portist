//! Сбор слушающих портов через крейт `listeners`.
//!
//! Отдаём фронту «сырые факты» о каждом порте; группировку и решение
//! «можно ли открыть в браузере» делает Angular. Бэкенд остаётся тонким.

use std::collections::BTreeMap;

use listeners::{Protocol, SocketState};
use serde::Serialize;

/// Информация об одном слушающем порте.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    /// Номер порта.
    pub port: u16,
    /// Протокол: "tcp" | "udp".
    pub protocol: String,
    /// PID процесса. `None`, если ОС не отдала его (чужой/системный процесс без прав).
    pub pid: Option<u32>,
    /// Имя процесса. `None`, если недоступно.
    pub process_name: Option<String>,
    /// Можно ли убить процесс без повышения прав (процесс текущего пользователя).
    pub is_current_user: bool,
    /// Адрес привязки сокета (127.0.0.1 / 0.0.0.0 / ::).
    pub address: String,
}

/// Собирает список слушающих портов.
///
/// Фильтрация: TCP оставляем только в состоянии `LISTEN`; у UDP нет состояния
/// `LISTEN`, поэтому берём сокеты с ненулевым (привязанным) портом. Дубли
/// IPv4/IPv6 одного и того же порта схлопываем, предпочитая конкретный адрес.
pub fn collect_ports() -> Result<Vec<PortInfo>, String> {
    let listeners = listeners::get_all().map_err(|e| e.to_string())?;

    let mut by_port: BTreeMap<(u16, &'static str), PortInfo> = BTreeMap::new();

    for l in listeners {
        let port = l.socket.port();
        let keep = match l.protocol {
            Protocol::TCP => l.state == SocketState::Listen,
            Protocol::UDP => port != 0,
        };
        if !keep {
            continue;
        }

        let protocol = match l.protocol {
            Protocol::TCP => "tcp",
            Protocol::UDP => "udp",
        };
        let pid = l.process.pid;
        let name = l.process.name;

        let info = PortInfo {
            port,
            protocol: protocol.to_string(),
            pid: (pid != 0).then_some(pid),
            process_name: (!name.is_empty()).then_some(name),
            is_current_user: can_signal(pid),
            address: l.socket.ip().to_string(),
        };

        by_port
            .entry((port, protocol))
            .and_modify(|existing| {
                // Предпочитаем конкретный адрес «звёздочкам» 0.0.0.0 / ::
                if existing.address == "0.0.0.0" || existing.address == "::" {
                    *existing = info.clone();
                }
            })
            .or_insert(info);
    }

    let mut ports: Vec<PortInfo> = by_port.into_values().collect();
    ports.sort_by_key(|p| p.port);
    Ok(ports)
}

/// Может ли текущий процесс послать сигнал процессу `pid` — то есть владеем ли
/// мы им. На Unix это честная проверка сигналом 0 (права/существование).
#[cfg(unix)]
fn can_signal(pid: u32) -> bool {
    use nix::sys::signal::kill;
    use nix::unistd::Pid;

    if pid == 0 {
        return false;
    }
    // Сигнал 0 ничего не отправляет, лишь проверяет права и существование PID.
    kill(Pid::from_raw(pid as i32), None).is_ok()
}

/// На не-Unix системах честной дешёвой проверки нет: считаем процесс «своим»,
/// если PID известен, а реальную невозможность убийства покажет ошибка `kill`.
#[cfg(not(unix))]
fn can_signal(pid: u32) -> bool {
    pid != 0
}

/// Tauri-команда: вернуть список слушающих портов.
#[tauri::command]
pub fn list_ports() -> Result<Vec<PortInfo>, String> {
    collect_ports()
}
