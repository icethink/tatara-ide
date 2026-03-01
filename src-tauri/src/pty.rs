// ⚒️ Tatara IDE — PTY Module
//
// Real pseudo-terminal for interactive shell sessions.
// Uses portable-pty for cross-platform support (Windows ConPTY / Unix PTY).
//
// Architecture:
// - pty_spawn: Create a new PTY session (shell process)
// - pty_write: Send keystrokes/data to PTY
// - pty_resize: Resize terminal dimensions
// - pty_kill: Terminate PTY session
// - Background reader thread pushes output via Tauri events

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

/// Unique session identifier
pub type SessionId = u32;

/// PTY session state
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    _child: Box<dyn portable_pty::Child + Send>,
    alive: Arc<std::sync::atomic::AtomicBool>,
}

/// Thread-safe PTY session manager
pub struct PtyManager {
    sessions: Mutex<HashMap<SessionId, PtySession>>,
    next_id: Mutex<SessionId>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }

    /// Spawn a new PTY shell session.
    /// Returns session ID. Starts a background reader thread that emits "pty-output" events.
    pub fn spawn(
        &self,
        cwd: Option<String>,
        rows: u16,
        cols: u16,
        app_handle: tauri::AppHandle,
    ) -> Result<SessionId, String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("PTY作成エラー: {}", e))?;

        // Build shell command
        let mut cmd = CommandBuilder::new_default_prog();
        if let Some(dir) = &cwd {
            cmd.cwd(dir);
        }

        // Set common env vars
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("シェル起動エラー: {}", e))?;

        // Get writer for sending input
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Writer取得エラー: {}", e))?;

        // Assign session ID
        let id = {
            let mut next = self.next_id.lock().unwrap();
            let id = *next;
            *next += 1;
            id
        };

        let alive = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let alive_clone = alive.clone();

        // Start background reader thread
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Reader取得エラー: {}", e))?;

        let session_id = id;
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                if !alive_clone.load(std::sync::atomic::Ordering::Relaxed) {
                    break;
                }
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF — process exited
                        let _ = app_handle.emit("pty-output", PtyOutput {
                            session_id,
                            data: String::new(),
                            exited: true,
                        });
                        break;
                    }
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle.emit("pty-output", PtyOutput {
                            session_id,
                            data,
                            exited: false,
                        });
                    }
                    Err(e) => {
                        // Read error — likely process died
                        let _ = app_handle.emit("pty-output", PtyOutput {
                            session_id,
                            data: format!("\r\n[PTY エラー: {}]\r\n", e),
                            exited: true,
                        });
                        break;
                    }
                }
            }
            alive_clone.store(false, std::sync::atomic::Ordering::Relaxed);
        });

        // Store session
        let session = PtySession {
            master: pair.master,
            writer,
            _child: child,
            alive,
        };
        self.sessions.lock().unwrap().insert(id, session);

        Ok(id)
    }

    /// Write data (keystrokes) to PTY
    pub fn write(&self, id: SessionId, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(&id)
            .ok_or_else(|| format!("セッション {} が見つかりません", id))?;

        session
            .writer
            .write_all(data)
            .map_err(|e| format!("書き込みエラー: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("フラッシュエラー: {}", e))?;

        Ok(())
    }

    /// Resize PTY
    pub fn resize(&self, id: SessionId, rows: u16, cols: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(&id)
            .ok_or_else(|| format!("セッション {} が見つかりません", id))?;

        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("リサイズエラー: {}", e))?;

        Ok(())
    }

    /// Kill a PTY session
    pub fn kill(&self, id: SessionId) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.remove(&id) {
            session
                .alive
                .store(false, std::sync::atomic::Ordering::Relaxed);
            // Drop will clean up the PTY
            drop(session);
            Ok(())
        } else {
            Err(format!("セッション {} が見つかりません", id))
        }
    }

    /// List active session IDs
    pub fn list_sessions(&self) -> Vec<SessionId> {
        self.sessions.lock().unwrap().keys().cloned().collect()
    }
}

/// PTY output event payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyOutput {
    pub session_id: SessionId,
    pub data: String,
    pub exited: bool,
}
