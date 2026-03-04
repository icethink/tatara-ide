// Tatara IDE — Rust backend
// ⚒️ コードを、鍛える。

#![allow(dead_code, unused_imports, unused_variables)]

mod dotenv;
mod editor;
mod encoding;
mod filesystem;
mod git;
mod i18n;
mod profile;
mod lsp;
mod pty;
mod search;
mod settings;
mod terminal;
mod theme;

use std::path::Path;
use std::sync::Arc;

// Global PTY manager (shared across IPC commands)
static PTY_MANAGER: std::sync::LazyLock<pty::PtyManager> =
    std::sync::LazyLock::new(pty::PtyManager::new);

static LSP_MANAGER: std::sync::LazyLock<lsp::LspManager> =
    std::sync::LazyLock::new(lsp::LspManager::new);

// ── Tauri IPC Commands ──

/// Read directory tree for file explorer
#[tauri::command]
fn read_directory(path: String, max_depth: Option<usize>) -> Result<filesystem::FileNode, String> {
    let depth = max_depth.unwrap_or(10);
    let resolved = filesystem::resolve_project_path(&path);
    filesystem::read_directory_tree(Path::new(&resolved), depth)
        .ok_or_else(|| format!("ディレクトリを読み込めませんでした: {}", resolved))
}

/// Read file content with encoding detection
#[tauri::command]
fn read_file(path: String) -> Result<filesystem::FileContent, String> {
    let resolved = filesystem::resolve_project_path(&path);
    filesystem::read_file_content(Path::new(&resolved))
}

/// Write file content
#[tauri::command]
fn write_file(path: String, content: String, line_ending: Option<String>) -> Result<(), String> {
    let le = line_ending.as_deref().unwrap_or("lf");
    let resolved = filesystem::resolve_project_path(&path);
    filesystem::write_file_content(Path::new(&resolved), &content, le)
}

/// Search in project files
#[tauri::command]
fn search_files(root: String, query: String, case_sensitive: Option<bool>, include_pattern: Option<String>) -> Result<search::SearchResults, String> {
    let options = search::SearchOptions {
        query,
        case_sensitive: case_sensitive.unwrap_or(false),
        include_pattern,
        ..Default::default()
    };
    Ok(search::search_in_files(Path::new(&root), &options))
}

/// Detect framework in project directory
#[tauri::command]
fn detect_framework(path: String) -> Option<filesystem::FrameworkInfo> {
    filesystem::detect_framework(Path::new(&path))
}

/// Check if project path is on slow Windows filesystem
#[tauri::command]
fn check_wsl_warning(path: String) -> Option<String> {
    filesystem::check_wsl_path_warning(&path)
}

/// Get artisan commands for command palette
#[tauri::command]
fn get_artisan_commands() -> Vec<profile::ArtisanCommand> {
    profile::get_artisan_commands()
}

/// Get Laravel snippets
#[tauri::command]
fn get_snippets() -> Vec<profile::Snippet> {
    profile::get_laravel_snippets()
}

/// Get default settings
#[tauri::command]
fn get_default_settings() -> settings::Settings {
    settings::Settings::default()
}

/// Analyze command for danger
#[tauri::command]
fn analyze_command(command: String) -> terminal::CommandAnalysis {
    terminal::analyze_command(&command)
}

/// Analyze paste content
#[tauri::command]
fn analyze_paste(content: String) -> terminal::PasteAnalysis {
    terminal::analyze_paste(&content)
}

/// Check if command should trigger RAW mode
#[tauri::command]
fn should_use_raw_mode(command: String) -> bool {
    terminal::should_use_raw_mode(&command)
}

/// Get git status for a project
#[tauri::command]
fn git_status(path: String) -> Result<git::GitStatus, String> {
    git::status(Path::new(&path))
}

/// Get git log
#[tauri::command]
fn git_log(path: String, count: Option<usize>) -> Result<Vec<git::GitLogEntry>, String> {
    git::log(Path::new(&path), count.unwrap_or(20))
}

/// Get git diff for a file
#[tauri::command]
fn git_diff(path: String, file: String) -> Result<git::GitDiff, String> {
    git::diff_file(Path::new(&path), &file)
}

/// Stage a file
#[tauri::command]
fn git_stage(path: String, file: String) -> Result<(), String> {
    git::stage_file(Path::new(&path), &file)
}

/// Unstage a file
#[tauri::command]
fn git_unstage(path: String, file: String) -> Result<(), String> {
    git::unstage_file(Path::new(&path), &file)
}

/// Commit staged changes
#[tauri::command]
fn git_commit(path: String, message: String) -> Result<String, String> {
    git::commit(Path::new(&path), &message)
}

/// Discard changes in a file
#[tauri::command]
fn git_discard(path: String, file: String) -> Result<(), String> {
    git::discard_changes(Path::new(&path), &file)
}

/// Get git gutter decorations for a file
#[tauri::command]
fn git_gutter(path: String, file: String) -> Result<Vec<git::GutterDecoration>, String> {
    git::gutter_decorations(Path::new(&path), &file)
}

/// Read file as raw bytes (for images, binary files)
#[tauri::command]
fn read_file_raw(path: String) -> Result<serde_json::Value, String> {
    let resolved = filesystem::resolve_project_path(&path);
    let bytes = std::fs::read(&resolved)
        .map_err(|e| format!("ファイル読み込みエラー: {}", e))?;

    // Return as base64 for efficient transfer
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    // Determine MIME type
    let ext = resolved.rsplit('.').next().unwrap_or("").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        _ => "application/octet-stream",
    };

    Ok(serde_json::json!({
        "base64": b64,
        "mime": mime,
        "size": bytes.len(),
    }))
}

/// Normalize a path (WSL \\wsl$ → /home/...)
#[tauri::command]
fn normalize_path(path: String) -> String {
    filesystem::normalize_path(&path)
}

/// Execute a shell command (non-interactive, one-shot)
#[tauri::command]
fn exec_command(cmd: String, cwd: Option<String>) -> terminal::ExecResult {
    terminal::exec_command(&cmd, cwd.as_deref())
}

/// Spawn a new PTY session (interactive shell)
#[tauri::command]
fn pty_spawn(
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
    app_handle: tauri::AppHandle,
) -> Result<u32, String> {
    PTY_MANAGER.spawn(cwd, rows.unwrap_or(24), cols.unwrap_or(80), app_handle)
}

/// Write data to PTY (keystrokes, text)
#[tauri::command]
fn pty_write(session_id: u32, data: String) -> Result<(), String> {
    PTY_MANAGER.write(session_id, data.as_bytes())
}

/// Resize PTY terminal
#[tauri::command]
fn pty_resize(session_id: u32, rows: u16, cols: u16) -> Result<(), String> {
    PTY_MANAGER.resize(session_id, rows, cols)
}

/// Kill a PTY session
#[tauri::command]
fn pty_kill(session_id: u32) -> Result<(), String> {
    PTY_MANAGER.kill(session_id)
}

/// List active PTY sessions
#[tauri::command]
fn pty_list() -> Vec<u32> {
    PTY_MANAGER.list_sessions()
}

// ── LSP Commands ──

/// Start an LSP server
#[tauri::command]
fn lsp_start(
    server_id: String,
    command: String,
    args: Vec<String>,
    languages: Vec<String>,
    root_path: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let root_uri = lsp::path_to_uri(&root_path);
    LSP_MANAGER.start_server(
        lsp::LspServerConfig { id: server_id, command, args, languages, root_uri },
        app_handle,
    )
}

/// Stop an LSP server
#[tauri::command]
fn lsp_stop(server_id: String) -> Result<(), String> {
    LSP_MANAGER.stop_server(&server_id)
}

/// List active LSP servers
#[tauri::command]
fn lsp_list() -> Vec<String> {
    LSP_MANAGER.list_servers()
}

/// Notify LSP that a file was opened
#[tauri::command]
fn lsp_did_open(path: String, language: String, version: i32, text: String) -> Result<(), String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.did_open(&server_id, &uri, &language, version, &text)
}

/// Notify LSP that a file was changed
#[tauri::command]
fn lsp_did_change(path: String, language: String, version: i32, text: String) -> Result<(), String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.did_change(&server_id, &uri, version, &text)
}

/// Notify LSP that a file was saved
#[tauri::command]
fn lsp_did_save(path: String, language: String, text: String) -> Result<(), String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.did_save(&server_id, &uri, &text)
}

/// Request completions
#[tauri::command]
fn lsp_completion(path: String, language: String, line: u32, character: u32) -> Result<Vec<lsp::CompletionItem>, String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.completion(&server_id, &uri, line, character)
}

/// Request hover info
#[tauri::command]
fn lsp_hover(path: String, language: String, line: u32, character: u32) -> Result<Option<lsp::HoverResult>, String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.hover(&server_id, &uri, line, character)
}

/// Go to definition
#[tauri::command]
fn lsp_definition(path: String, language: String, line: u32, character: u32) -> Result<Vec<lsp::Location>, String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.definition(&server_id, &uri, line, character)
}

/// Find all references
#[tauri::command]
fn lsp_references(path: String, language: String, line: u32, character: u32) -> Result<Vec<lsp::Location>, String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.references(&server_id, &uri, line, character)
}

/// Format document
#[tauri::command]
fn lsp_format(path: String, language: String, tab_size: u32, insert_spaces: bool) -> Result<Vec<lsp::TextEdit>, String> {
    let server_id = LSP_MANAGER.server_for_language(&language)
        .ok_or_else(|| format!("{} 用のLSPサーバーがありません", language))?;
    let uri = lsp::path_to_uri(&path);
    LSP_MANAGER.format(&server_id, &uri, tab_size, insert_spaces)
}

/// Detect and auto-start appropriate LSP servers for a project
#[tauri::command]
fn lsp_auto_detect(root_path: String, app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    let root = std::path::Path::new(&root_path);
    let mut started = Vec::new();

    // Check for PHP (composer.json or .php files)
    if root.join("composer.json").exists() || root.join("artisan").exists() {
        let config = lsp::LspServerConfig {
            id: "intelephense".to_string(),
            command: "intelephense".to_string(),
            args: vec!["--stdio".to_string()],
            languages: vec!["php".to_string(), "blade".to_string()],
            root_uri: lsp::path_to_uri(&root_path),
        };
        if LSP_MANAGER.start_server(config, app_handle.clone()).is_ok() {
            started.push("intelephense".to_string());
        }
    }

    // Check for JS/TS (package.json or tsconfig.json)
    if root.join("package.json").exists() || root.join("tsconfig.json").exists() {
        let config = lsp::LspServerConfig {
            id: "typescript".to_string(),
            command: "typescript-language-server".to_string(),
            args: vec!["--stdio".to_string()],
            languages: vec!["javascript".to_string(), "typescript".to_string()],
            root_uri: lsp::path_to_uri(&root_path),
        };
        if LSP_MANAGER.start_server(config, app_handle.clone()).is_ok() {
            started.push("typescript".to_string());
        }
    }

    // Check for Vue
    if root.join("package.json").exists() {
        if let Ok(pkg) = std::fs::read_to_string(root.join("package.json")) {
            if pkg.contains("\"vue\"") {
                let config = lsp::LspServerConfig {
                    id: "volar".to_string(),
                    command: "vue-language-server".to_string(),
                    args: vec!["--stdio".to_string()],
                    languages: vec!["vue".to_string()],
                    root_uri: lsp::path_to_uri(&root_path),
                };
                if LSP_MANAGER.start_server(config, app_handle.clone()).is_ok() {
                    started.push("volar".to_string());
                }
            }
        }
    }

    Ok(started)
}

/// Detect file encoding
#[tauri::command]
fn detect_encoding(bytes: Vec<u8>) -> String {
    let enc = encoding::detect_encoding(&bytes);
    encoding::encoding_display_name(&enc).to_string()
}

/// Parse .env file and extract DB config
#[tauri::command]
fn parse_env(path: String) -> Result<dotenv::EnvFile, String> {
    dotenv::parse_env_file(Path::new(&path))
}

/// Extract database config from .env
#[tauri::command]
fn get_db_config(path: String) -> Result<Option<dotenv::DatabaseConfig>, String> {
    let env = dotenv::parse_env_file(Path::new(&path))?;
    Ok(dotenv::extract_db_config(&env))
}

/// List available themes
#[tauri::command]
fn list_themes(user_theme_dir: Option<String>) -> Vec<theme::ThemeInfo> {
    theme::list_themes(user_theme_dir.as_ref().map(|p| Path::new(p.as_str())))
}

/// Get translation text
#[tauri::command]
fn translate(key: String, locale: Option<String>) -> String {
    let mut i18n = i18n::I18n::new();
    if let Some(l) = locale {
        i18n.set_locale(&l);
    }
    i18n.t(&key)
}

fn get_log_path() -> std::path::PathBuf {
    // Write log next to the exe, or to LOCALAPPDATA, or to Desktop
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join("tatara-debug.log");
        }
    }
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return std::path::PathBuf::from(local).join("tatara-debug.log");
    }
    std::path::PathBuf::from("tatara-debug.log")
}

fn log_msg(msg: &str) {
    use std::io::Write;
    let path = get_log_path();
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = writeln!(f, "[{}] {}", now, msg);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Panic handler — write to log file
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("PANIC: {}", info);
        log_msg(&msg);
        // Also try a message box
        #[cfg(target_os = "windows")]
        {
            use std::ffi::CString;
            let text = CString::new(msg.clone()).unwrap_or_default();
            let title = CString::new("Tatara IDE - Crash").unwrap_or_default();
            unsafe {
                extern "system" {
                    fn MessageBoxA(hwnd: *mut std::ffi::c_void, text: *const i8, caption: *const i8, utype: u32) -> i32;
                }
                MessageBoxA(std::ptr::null_mut(), text.as_ptr(), title.as_ptr(), 0x10);
            }
        }
    }));

    log_msg("=== Tatara IDE starting ===");
    log_msg(&format!("exe: {:?}", std::env::current_exe()));
    log_msg(&format!("cwd: {:?}", std::env::current_dir()));
    log_msg(&format!("args: {:?}", std::env::args().collect::<Vec<_>>()));

    log_msg("Initializing Tauri builder...");

    let builder_result = std::panic::catch_unwind(|| {
        tauri::Builder::default()
            .plugin(tauri_plugin_shell::init())
            .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_directory,
            read_file,
            write_file,
            search_files,
            detect_framework,
            check_wsl_warning,
            get_artisan_commands,
            get_snippets,
            get_default_settings,
            translate,
            analyze_command,
            analyze_paste,
            should_use_raw_mode,
            parse_env,
            get_db_config,
            list_themes,
            git_status,
            git_log,
            git_diff,
            git_stage,
            git_unstage,
            git_commit,
            git_discard,
            git_gutter,
            detect_encoding,
            read_file_raw,
            normalize_path,
            exec_command,
            pty_spawn,
            pty_write,
            pty_resize,
            pty_kill,
            pty_list,
            lsp_start,
            lsp_stop,
            lsp_list,
            lsp_did_open,
            lsp_did_change,
            lsp_did_save,
            lsp_completion,
            lsp_hover,
            lsp_definition,
            lsp_references,
            lsp_format,
            lsp_auto_detect,
        ])
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running Tatara IDE");
    });

    match builder_result {
        Ok(_) => log_msg("Tauri exited normally"),
        Err(e) => {
            let msg = format!("Tauri panicked: {:?}", e);
            log_msg(&msg);
            #[cfg(target_os = "windows")]
            {
                use std::ffi::CString;
                let text = CString::new(msg).unwrap_or_default();
                let title = CString::new("Tatara IDE - Error").unwrap_or_default();
                unsafe {
                    extern "system" {
                        fn MessageBoxA(hwnd: *mut std::ffi::c_void, text: *const i8, caption: *const i8, utype: u32) -> i32;
                    }
                    MessageBoxA(std::ptr::null_mut(), text.as_ptr(), title.as_ptr(), 0x10);
                }
            }
        }
    }
}
