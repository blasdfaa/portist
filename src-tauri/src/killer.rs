//! Завершение процессов.
//!
//! Пока поддерживается только завершение процессов текущего пользователя без
//! повышения прав. Elevated kill (macOS `osascript … with administrator
//! privileges`, Windows `runas`/UAC, Linux `pkexec`) — возможное будущее; шов
//! под него вводится, когда дойдёт до реализации (см. `docs/adr/0001-*`).

/// Ошибки завершения процесса.
#[derive(Debug)]
pub enum KillError {
    NotFound,
    PermissionDenied,
    Other(String),
}

impl std::fmt::Display for KillError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            KillError::NotFound => write!(f, "Процесс не найден"),
            KillError::PermissionDenied => write!(f, "Недостаточно прав для завершения процесса"),
            KillError::Other(msg) => write!(f, "{msg}"),
        }
    }
}

/// Unix: сначала мягкий SIGTERM, затем, если процесс ещё жив, — SIGKILL.
#[cfg(unix)]
fn kill_normal(pid: u32) -> Result<(), KillError> {
    use nix::errno::Errno;
    use nix::sys::signal::{kill, Signal};
    use nix::unistd::Pid;

    let target = Pid::from_raw(pid as i32);

    match kill(target, Signal::SIGTERM) {
        Ok(()) => {}
        Err(Errno::ESRCH) => return Err(KillError::NotFound),
        Err(Errno::EPERM) => return Err(KillError::PermissionDenied),
        Err(e) => return Err(KillError::Other(e.to_string())),
    }

    // Даём процессу шанс завершиться корректно, затем добиваем.
    std::thread::sleep(std::time::Duration::from_millis(400));
    match kill(target, None) {
        Ok(()) => {
            let _ = kill(target, Signal::SIGKILL);
            Ok(())
        }
        // Уже завершился — это успех.
        Err(_) => Ok(()),
    }
}

/// Не-Unix (Windows): завершаем через sysinfo (TerminateProcess под капотом).
#[cfg(not(unix))]
fn kill_normal(pid: u32) -> Result<(), KillError> {
    use sysinfo::{Pid, ProcessesToUpdate, System};

    let spid = Pid::from_u32(pid);
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::Some(&[spid]), true);

    match sys.process(spid) {
        Some(process) => {
            if process.kill() {
                Ok(())
            } else {
                Err(KillError::PermissionDenied)
            }
        }
        None => Err(KillError::NotFound),
    }
}

/// Tauri-команда: завершить процесс по PID.
#[tauri::command]
pub fn kill_process(pid: u32) -> Result<(), String> {
    kill_normal(pid).map_err(|e| e.to_string())
}
