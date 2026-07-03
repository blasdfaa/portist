//! Docker-осведомлённость: маппинг опубликованных портов на контейнеры.
//!
//! Ходим в Docker Engine API напрямую по unix-сокету (на Windows — по named
//! pipe) рукописным мини-HTTP — синхронно и без тяжёлых зависимостей, в духе
//! тонкого бэкенда. Отдаём фронту «сырые факты» о контейнерах; джойн
//! порт↔контейнер и группировку делает Angular, как и с обычными портами.
//!
//! Любая проблема — сокет не найден, таймаут, ошибка демона — деградирует в
//! «контейнеров нет»: список портов на фронте от этого не страдает (там
//! `Promise.allSettled`).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

#[cfg(unix)]
use std::time::Duration;

use serde::Serialize;
use serde_json::Value;

/// Таймаут на чтение/запись сокета. Короткий: запрос идёт параллельно
/// `list_ports`, и медленный Docker не должен задерживать первую отрисовку.
/// Только Unix: у Windows named pipe (`std::fs::File`) таймаут не выставить.
#[cfg(unix)]
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

/// Ищет адрес демона: unix-сокет (`DOCKER_HOST` → известные пути) на *nix,
/// именованный пайп на Windows. `None` — Docker не найден, фича молча
/// выключается.
#[cfg(unix)]
fn docker_endpoint() -> Option<PathBuf> {
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

/// Windows: Docker Desktop публикует Engine API именованным пайпом. Уважаем
/// `DOCKER_HOST=npipe://…`, иначе — путь по умолчанию. Существование пайпа
/// надёжно не проверить через `exists()`, поэтому путь отдаём всегда —
/// недоступность выяснится уже при подключении.
#[cfg(windows)]
fn docker_endpoint() -> Option<PathBuf> {
    if let Ok(host) = std::env::var("DOCKER_HOST") {
        if let Some(path) = host.strip_prefix("npipe://") {
            return Some(PathBuf::from(path.replace('/', "\\")));
        }
    }
    Some(PathBuf::from(r"\\.\pipe\docker_engine"))
}

/// Открывает соединение с демоном по его адресу. `Err` — подключиться не
/// удалось (Docker не запущен): фича молча деградирует в «контейнеров нет».
#[cfg(unix)]
fn connect(endpoint: &Path) -> Result<std::os::unix::net::UnixStream, String> {
    let stream = std::os::unix::net::UnixStream::connect(endpoint).map_err(|e| e.to_string())?;
    stream.set_read_timeout(Some(IO_TIMEOUT)).ok();
    stream.set_write_timeout(Some(IO_TIMEOUT)).ok();
    Ok(stream)
}

/// Windows: named pipe открывается как обычный файл в блокирующем режиме.
/// Таймаута нет (у `File` его не выставить), но `read_to_end` завершается по
/// закрытию пайпа сервером (`Connection: close`), а недоступный демон отвалится
/// уже на `open`.
#[cfg(windows)]
fn connect(endpoint: &Path) -> Result<std::fs::File, String> {
    std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(endpoint)
        .map_err(|e| e.to_string())
}

/// Выполняет один HTTP/1.1-запрос к демону и возвращает `(код статуса, тело)`.
///
/// Версия API в пути не указывается — демон берёт максимально поддерживаемую
/// (совместимо с Docker Desktop / OrbStack / Colima / Podman). `Connection:
/// close` заставляет сервер закрыть соединение после ответа — читаем до EOF.
fn request(method: &str, path: &str) -> Result<(u16, Vec<u8>), String> {
    let endpoint = docker_endpoint().ok_or("Docker-сокет не найден")?;
    let mut stream = connect(&endpoint)?;

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
    if docker_endpoint().is_none() {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_response_reads_status_and_plain_body() {
        let raw = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n[]";
        let (status, body) = parse_response(raw).unwrap();
        assert_eq!(status, 200);
        assert_eq!(body, b"[]");
    }

    #[test]
    fn parse_response_dechunks_chunked_body() {
        // "hi" + "!" двумя чанками.
        let raw =
            b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\nhi\r\n1\r\n!\r\n0\r\n\r\n";
        let (status, body) = parse_response(raw).unwrap();
        assert_eq!(status, 200);
        assert_eq!(body, b"hi!");
    }

    #[test]
    fn parse_response_errors_without_header_terminator() {
        assert!(parse_response(b"not an http response").is_err());
    }

    #[test]
    fn dechunk_handles_size_extensions() {
        // Размер чанка может нести расширение после ';'.
        let body = b"3;foo=bar\r\nabc\r\n0\r\n\r\n";
        assert_eq!(dechunk(body).unwrap(), b"abc");
    }

    #[test]
    fn dechunk_errors_on_incomplete_chunk() {
        // Заявлено 5 байт, а есть только 2.
        assert!(dechunk(b"5\r\nab\r\n").is_err());
    }

    #[test]
    fn parse_containers_maps_names_ports_and_labels() {
        let body = br#"[
          {
            "Id": "abc123",
            "Names": ["/web"],
            "Image": "nginx:latest",
            "Ports": [
              {"PublicPort": 8080, "Type": "tcp"},
              {"Type": "udp"}
            ],
            "Labels": {
              "com.docker.compose.project": "shop",
              "com.docker.compose.service": "web"
            }
          }
        ]"#;
        let containers = parse_containers(body).unwrap();
        assert_eq!(containers.len(), 1);
        let c = &containers[0];
        assert_eq!(c.id, "abc123");
        assert_eq!(c.name, "web"); // ведущий '/' убран
        assert_eq!(c.image, "nginx:latest");
        assert_eq!(c.compose_project.as_deref(), Some("shop"));
        assert_eq!(c.compose_service.as_deref(), Some("web"));
        assert_eq!(c.ports.len(), 2);
        assert_eq!(c.ports[0].public_port, Some(8080));
        assert_eq!(c.ports[0].protocol, "tcp");
        assert_eq!(c.ports[1].public_port, None);
        assert_eq!(c.ports[1].protocol, "udp");
    }

    #[test]
    fn parse_containers_defaults_missing_fields() {
        let containers = parse_containers(br#"[{}]"#).unwrap();
        assert_eq!(containers.len(), 1);
        let c = &containers[0];
        assert_eq!(c.name, "");
        assert_eq!(c.image, "");
        assert!(c.compose_project.is_none());
        assert!(c.ports.is_empty());
    }

    #[test]
    fn label_reads_nested_string_or_none() {
        let v: Value = serde_json::from_str(r#"{"Labels":{"k":"v"}}"#).unwrap();
        assert_eq!(label(&v, "k").as_deref(), Some("v"));
        assert_eq!(label(&v, "missing"), None);
    }
}
