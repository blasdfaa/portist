//! Детальная информация о процессе, владеющем портом.
//!
//! Собирается «по запросу» при раскрытии строки порта — отдельной командой,
//! чтобы основной `list_ports` оставался лёгким. Все поля, которые ОС может не
//! отдать без прав, — `Option`/нули, фронт прячет пустые значения.

use std::ffi::OsStr;

use serde::Serialize;
use sysinfo::{Pid, ProcessesToUpdate, System, Users, MINIMUM_CPU_UPDATE_INTERVAL};

/// Расширенные сведения о процессе.
#[derive(Serialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct PortDetails {
    pub pid: u32,
    pub name: Option<String>,
    /// Полный путь к исполняемому файлу.
    pub exec_path: Option<String>,
    /// Командная строка с аргументами.
    pub cmd: Vec<String>,
    /// Рабочая директория процесса.
    pub cwd: Option<String>,
    /// Имя проекта (каталог ближайшего git-репозитория над cwd).
    pub project: Option<String>,
    /// Имя владельца (пользователя).
    pub user: Option<String>,
    pub parent_pid: Option<u32>,
    pub parent_name: Option<String>,
    /// Статус процесса (running/sleeping/…).
    pub status: Option<String>,
    /// Время старта, epoch-секунды (0 — неизвестно).
    pub start_time: u64,
    /// Время работы в секундах.
    pub run_time: u64,
    /// Загрузка CPU процессом, %.
    pub cpu_usage: f32,
    /// Резидентная память (RSS), байты.
    pub memory: u64,
    /// Виртуальная память, байты.
    pub virtual_memory: u64,
}

fn os_string(value: &OsStr) -> String {
    value.to_string_lossy().into_owned()
}

/// Имя проекта = каталог ближайшего git-репозитория вверх от рабочей папки.
fn detect_project(cwd: Option<&std::path::Path>) -> Option<String> {
    let mut dir = cwd?;
    loop {
        if dir.join(".git").exists() {
            return dir.file_name().map(|n| n.to_string_lossy().into_owned());
        }
        dir = dir.parent()?;
    }
}

/// Собирает детали по PID. Для корректного CPU делаем две выборки с паузой.
pub fn collect_details(pid: u32) -> Result<PortDetails, String> {
    let target = Pid::from_u32(pid);

    let mut sys = System::new();
    // Первая выборка — все процессы (нужно, чтобы знать имя родителя).
    sys.refresh_processes(ProcessesToUpdate::All, true);
    std::thread::sleep(MINIMUM_CPU_UPDATE_INTERVAL);
    // Вторая выборка нашего процесса — даёт ненулевой cpu_usage.
    sys.refresh_processes(ProcessesToUpdate::Some(&[target]), true);

    let process = sys
        .process(target)
        .ok_or_else(|| "Процесс не найден".to_string())?;

    let parent_pid = process.parent();
    let parent_name = parent_pid
        .and_then(|pp| sys.process(pp))
        .map(|p| os_string(p.name()));

    let users = Users::new_with_refreshed_list();
    let user = process
        .user_id()
        .and_then(|uid| users.get_user_by_id(uid))
        .map(|u| u.name().to_string());

    Ok(PortDetails {
        pid,
        name: Some(os_string(process.name())),
        exec_path: process.exe().map(|p| p.display().to_string()),
        cmd: process
            .cmd()
            .iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect(),
        cwd: process.cwd().map(|p| p.display().to_string()),
        project: detect_project(process.cwd()),
        user,
        parent_pid: parent_pid.map(|p| p.as_u32()),
        parent_name,
        status: Some(process.status().to_string()),
        start_time: process.start_time(),
        run_time: process.run_time(),
        cpu_usage: process.cpu_usage(),
        memory: process.memory(),
        virtual_memory: process.virtual_memory(),
    })
}

/// Tauri-команда: детали процесса по PID.
#[tauri::command]
pub fn get_port_details(pid: u32) -> Result<PortDetails, String> {
    collect_details(pid)
}
