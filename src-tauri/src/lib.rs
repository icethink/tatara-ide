// Tatara IDE — Rust backend
// ⚒️ コードを、鍛える。

mod editor;
mod i18n;
mod settings;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("⚒️ Tatara IDE へようこそ、{}さん！", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running Tatara IDE");
}
