//! Docker-осведомлённость: маппинг опубликованных портов на контейнеры.
//!
//! Ходим в Docker Engine API напрямую по unix-сокету рукописным мини-HTTP —
//! синхронно и без тяжёлых зависимостей, в духе тонкого бэкенда. Отдаём фронту
//! «сырые факты» о контейнерах; джойн порт↔контейнер и группировку делает
//! Angular, как и с обычными портами.
//!
//! Любая проблема — сокет не найден, таймаут, ошибка демона — деградирует в
//! «контейнеров нет»: список портов на фронте от этого не страдает (там
//! `Promise.allSettled`).

use std::io::{Read, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

/// Таймаут на чтение/запись сокета. Короткий: запрос идёт параллельно
/// `list_ports`, и медленный Docker не должен задерживать первую отрисовку.
const IO_TIMEOUT: Duration = Duration::from_millis(600);

/// Один опубликованный на хост порт контейнера. По `public_port` + `protocol`
/// фронт джойнит контейнер со слушающим портом.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ContainerPort {
    /// Порт на стороне хоста. `None` — порт не опубликован (нам неинтересен).
    pub public_port: Option<u16>,
    /// Протокол: "tcp" | "udp".
    pub protocol: String,
}

/// Контейнер и его опубликованные порты — сырые факты для фронта.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInfo {
    /// Полный id контейнера (по нему шлём stop).
    pub id: String,
    /// Имя контейнера (ведущий `/` убран).
    pub name: String,
    /// Образ, например "postgres:16".
    pub image: String,
    /// Лейбл `com.docker.compose.project`, если поднят из compose.
    pub compose_project: Option<String>,
    /// Лейбл `com.docker.compose.service`.
    pub compose_service: Option<String>,
    pub ports: Vec<ContainerPort>,
}

/// Ищет docker-совместимый сокет: `DOCKER_HOST` → известные пути. `None` —
/// Docker не найден, фича молча выключается.
fn docker_socket() -> Option<PathBuf> {
    if let Ok(host) = std::env::var("DOCKER_HOST") {
        if let Some(path) = host.strip_prefix("unix://") {
            let pb = PathBuf::from(path);
            if pb.exists() {
                return Some(pb);
            }
        }
    }

    let home = std::env::var("HOME").ok();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(h) = &home {
        candidates.push(PathBuf::from(format!("{h}/.docker/run/docker.sock")));
    }
    candidates.push(PathBuf::from("/var/run/docker.sock"));
    if let Some(h) = &home {
        candidates.push(PathBuf::from(format!("{h}/.orbstack/run/docker.sock")));
        candidates.push(PathBuf::from(format!("{h}/.colima/default/docker.sock")));
    }
    candidates.into_iter().find(|p| p.exists())
}

/// Выполняет один HTTP/1.1-запрос к демону и возвращает `(код статуса, тело)`.
///
/// Версия API в пути не указывается — демон берёт максимально поддерживаемую
/// (совместимо с Docker Desktop / OrbStack / Colima / Podman). `Connection:
/// close` заставляет сервер закрыть соединение после ответа — читаем до EOF.
fn request(method: &str, path: &str) -> Result<(u16, Vec<u8>), String> {
    let socket = docker_socket().ok_or("Docker-сокет не найден")?;
    let mut stream = UnixStream::connect(&socket).map_err(|e| e.to_string())?;
    stream.set_read_timeout(Some(IO_TIMEOUT)).ok();
    stream.set_write_timeout(Some(IO_TIMEOUT)).ok();

    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: docker\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes()).map_err(|e| e.to_string())?;

    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).map_err(|e| e.to_string())?;

    parse_response(&raw)
}

/// Разбирает сырой HTTP-ответ: код статуса и декодированное тело.
fn parse_response(raw: &[u8]) -> Result<(u16, Vec<u8>), String> {
    let split = raw
        .windows(4)
        .position(|w| w == b"\r\n\r\n")
        .ok_or("Некорректный HTTP-ответ Docker")?;
    let head = String::from_utf8_lossy(&raw[..split]);
    let body = &raw[split + 4..];

    let mut lines = head.split("\r\n");
    // Строка статуса: "HTTP/1.1 200 OK".
    let status = lines
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or("Нет кода статуса в ответе Docker")?;

    let chunked = lines.any(|line| {
        let line = line.to_ascii_lowercase();
        line.starts_with("transfer-encoding:") && line.contains("chunked")
    });

    let body = if chunked {
        dechunk(body)?
    } else {
        body.to_vec()
    };
    Ok((status, body))
}

/// Декодирует тело chunked transfer-encoding в непрерывные байты.
fn dechunk(mut body: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    loop {
        let nl = body
            .windows(2)
            .position(|w| w == b"\r\n")
            .ok_or("Обрыв chunked-тела Docker")?;
        // Размер может нести расширения после ';' — берём часть до него.
        let size_line = std::str::from_utf8(&body[..nl]).map_err(|e| e.to_string())?;
        let size_hex = size_line.split(';').next().unwrap_or("").trim();
        let size = usize::from_str_radix(size_hex, 16).map_err(|e| e.to_string())?;
        body = &body[nl + 2..];
        if size == 0 {
            break;
        }
        if body.len() < size + 2 {
            return Err("Неполный chunk в ответе Docker".into());
        }
        out.extend_from_slice(&body[..size]);
        // Пропускаем данные и завершающий CRLF.
        body = &body[size + 2..];
    }
    Ok(out)
}

/// Достаёт строковый лейбл контейнера по ключу.
fn label(container: &Value, key: &str) -> Option<String> {
    container
        .get("Labels")
        .and_then(|labels| labels.get(key))
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Разбирает ответ `/containers/json` в список контейнеров.
fn parse_containers(body: &[u8]) -> Result<Vec<ContainerInfo>, String> {
    let value: Value = serde_json::from_slice(body).map_err(|e| e.to_string())?;
    let array = value.as_array().ok_or("Ожидался массив контейнеров")?;

    let containers = array
        .iter()
        .map(|c| {
            let name = c
                .get("Names")
                .and_then(Value::as_array)
                .and_then(|names| names.first())
                .and_then(Value::as_str)
                .map(|s| s.trim_start_matches('/').to_string())
                .unwrap_or_default();

            let ports = c
                .get("Ports")
                .and_then(Value::as_array)
                .map(|ports| {
                    ports
                        .iter()
                        .map(|p| ContainerPort {
                            public_port: p
                                .get("PublicPort")
                                .and_then(Value::as_u64)
                                .map(|n| n as u16),
                            protocol: p
                                .get("Type")
                                .and_then(Value::as_str)
                                .unwrap_or("tcp")
                                .to_string(),
                        })
                        .collect()
                })
                .unwrap_or_default();

            ContainerInfo {
                id: c
                    .get("Id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                name,
                image: c
                    .get("Image")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                compose_project: label(c, "com.docker.compose.project"),
                compose_service: label(c, "com.docker.compose.service"),
                ports,
            }
        })
        .collect();

    Ok(containers)
}

/// Tauri-команда: список запущенных контейнеров с опубликованными портами.
///
/// Docker не найден — не ошибка: контейнеров просто нет.
#[tauri::command]
pub fn list_containers() -> Result<Vec<ContainerInfo>, String> {
    if docker_socket().is_none() {
        return Ok(Vec::new());
    }
    let (status, body) = request("GET", "/containers/json")?;
    if status != 200 {
        return Err(format!("Docker вернул статус {status}"));
    }
    parse_containers(&body)
}

/// Tauri-команда: остановить контейнер по id (мягко: SIGTERM → таймаут → SIGKILL
/// на стороне демона).
#[tauri::command]
pub fn stop_container(id: String) -> Result<(), String> {
    // id всегда приходит как hex от фронта; проверяем, чтобы он не мог сломать
    // путь запроса непредвиденными символами.
    let valid = !id.is_empty()
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'));
    if !valid {
        return Err("Некорректный идентификатор контейнера".into());
    }

    let (status, _) = request("POST", &format!("/containers/{id}/stop"))?;
    match status {
        // 204 — остановлен, 304 — уже был остановлен.
        204 | 304 => Ok(()),
        404 => Err("Контейнер не найден".into()),
        _ => Err(format!("Docker вернул статус {status}")),
    }
}
