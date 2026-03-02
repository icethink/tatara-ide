// Debug: keep console visible to see errors
// TODO: re-enable for production: #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    eprintln!("[Tatara IDE] Starting...");
    tatara_ide_lib::run();
    eprintln!("[Tatara IDE] Exited.");
}
