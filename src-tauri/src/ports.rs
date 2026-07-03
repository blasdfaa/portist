//! Сбор слушающих портов через крейт `listeners`.
//!
//! Отдаём фронту «сырые факты» о каждом порте; группировку и решение
//! «можно ли открыть в браузере» делает Angular. Бэкенд остаётся тонким.

use std::collections::BTreeMap;

use listeners::{Listener, Protocol, SocketState};
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

/// Чистое ядро: превращает сырые сокеты в `PortInfo`. Эффект «владеем ли мы
/// процессом» инъектится через `signalable`, поэтому весь трансформ —
/// фильтр, дедуп, сортировка — тестируется на фикстурах без syscall'ов.
///
/// Фильтрация: TCP оставляем только в состоянии `LISTEN`; у UDP нет состояния
/// `LISTEN`, поэтому берём сокеты с ненулевым (привязанным) портом. Дубли
/// IPv4/IPv6 одного и того же порта схлопываем, предпочитая конкретный адрес.
fn classify(
    listeners: impl IntoIterator<Item = Listener>,
    signalable: impl Fn(u32) -> bool,
) -> Vec<PortInfo> {
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
            is_current_user: signalable(pid),
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
    ports
}

/// Собирает список слушающих портов: тонкий край над {@link classify} —
/// системный вызов `get_all()` и проверка прав `can_signal`.
pub fn collect_ports() -> Result<Vec<PortInfo>, String> {
    let listeners = listeners::get_all().map_err(|e| e.to_string())?;
    Ok(classify(listeners, can_signal))
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

#[cfg(test)]
mod tests {
    use std::net::SocketAddr;

    use listeners::Process;

    use super::*;

    fn listener(
        port: u16,
        protocol: Protocol,
        state: SocketState,
        ip: &str,
        pid: u32,
    ) -> Listener {
        Listener {
            process: Process {
                pid,
                name: "proc".into(),
                path: String::new(),
            },
            socket: SocketAddr::new(ip.parse().unwrap(), port),
            protocol,
            state,
        }
    }

    fn ports_of(ports: &[PortInfo]) -> Vec<u16> {
        ports.iter().map(|p| p.port).collect()
    }

    #[test]
    fn keeps_only_tcp_in_listen_state() {
        let ls = vec![
            listener(8080, Protocol::TCP, SocketState::Listen, "127.0.0.1", 10),
            listener(9090, Protocol::TCP, SocketState::Established, "127.0.0.1", 11),
        ];
        assert_eq!(ports_of(&classify(ls, |_| true)), vec![8080]);
    }

    #[test]
    fn keeps_bound_udp_drops_port_zero() {
        let ls = vec![
            listener(53, Protocol::UDP, SocketState::Established, "0.0.0.0", 10),
            listener(0, Protocol::UDP, SocketState::Established, "0.0.0.0", 11),
        ];
        assert_eq!(ports_of(&classify(ls, |_| true)), vec![53]);
    }

    #[test]
    fn dedups_same_port_preferring_concrete_address() {
        // Одинаковый порт+протокол: сначала wildcard, затем конкретный — побеждает конкретный.
        let ls = vec![
            listener(3000, Protocol::TCP, SocketState::Listen, "0.0.0.0", 10),
            listener(3000, Protocol::TCP, SocketState::Listen, "127.0.0.1", 10),
        ];
        let ports = classify(ls, |_| true);
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].address, "127.0.0.1");
    }

    #[test]
    fn keeps_concrete_address_when_wildcard_comes_second() {
        let ls = vec![
            listener(3000, Protocol::TCP, SocketState::Listen, "127.0.0.1", 10),
            listener(3000, Protocol::TCP, SocketState::Listen, "0.0.0.0", 10),
        ];
        let ports = classify(ls, |_| true);
        assert_eq!(ports.len(), 1);
        assert_eq!(ports[0].address, "127.0.0.1");
    }

    #[test]
    fn sorts_by_port() {
        let ls = vec![
            listener(300, Protocol::TCP, SocketState::Listen, "127.0.0.1", 10),
            listener(100, Protocol::TCP, SocketState::Listen, "127.0.0.1", 11),
            listener(200, Protocol::TCP, SocketState::Listen, "127.0.0.1", 12),
        ];
        assert_eq!(ports_of(&classify(ls, |_| true)), vec![100, 200, 300]);
    }

    #[test]
    fn is_current_user_comes_from_injected_signalable() {
        let ls = vec![
            listener(8080, Protocol::TCP, SocketState::Listen, "127.0.0.1", 1000),
            listener(8081, Protocol::TCP, SocketState::Listen, "127.0.0.1", 2000),
        ];
        let ports = classify(ls, |pid| pid == 1000);
        let p8080 = ports.iter().find(|p| p.port == 8080).unwrap();
        let p8081 = ports.iter().find(|p| p.port == 8081).unwrap();
        assert!(p8080.is_current_user);
        assert!(!p8081.is_current_user);
    }

    #[test]
    fn pid_and_name_hidden_when_empty() {
        let mut l = listener(7000, Protocol::TCP, SocketState::Listen, "127.0.0.1", 0);
        l.process.name = String::new();
        let ports = classify(vec![l], |_| false);
        assert_eq!(ports[0].pid, None);
        assert_eq!(ports[0].process_name, None);
    }
}
