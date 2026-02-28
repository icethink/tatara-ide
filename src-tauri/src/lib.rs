// Tatara IDE — Rust backend
// ⚒️ コードを、鍛える。

mod editor;
mod filesystem;
mod i18n;
mod profile;
mod search;
mod settings;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tatara IDE");
}
