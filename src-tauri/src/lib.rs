// Tatara IDE — Rust backend
// ⚒️ コードを、鍛える。

mod dotenv;
mod editor;
mod filesystem;
mod i18n;
mod profile;
mod search;
mod settings;
mod terminal;
mod theme;

use std::path::Path;

// ── Tauri IPC Commands ──

/// Read directory tree for file explorer
#[tauri::command]
fn read_directory(path: String, max_depth: Option<usize>) -> Result<filesystem::FileNode, String> {
    let depth = max_depth.unwrap_or(10);
    filesystem::read_directory_tree(Path::new(&path), depth)
        .ok_or_else(|| "ディレクトリを読み込めませんでした".to_string())
}

/// Read file content with encoding detection
#[tauri::command]
fn read_file(path: String) -> Result<filesystem::FileContent, String> {
    filesystem::read_file_content(Path::new(&path))
}

/// Write file content
#[tauri::command]
fn write_file(path: String, content: String, line_ending: Option<String>) -> Result<(), String> {
    let le = line_ending.as_deref().unwrap_or("lf");
    filesystem::write_file_content(Path::new(&path), &content, le)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tatara IDE");
}
