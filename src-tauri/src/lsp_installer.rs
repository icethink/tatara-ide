// ⚒️ Tatara IDE — LSP Server Auto-Installer
//
// Automatically downloads and manages LSP servers.
// Servers are cached in the app's data directory.
// No user action needed — "just works" for Laravel beginners.
//
// Supported servers:
// - intelephense (PHP/Laravel) — the critical one
// - typescript-language-server (JS/TS)
// - @vue/language-server (Vue/Volar)
// - vscode-langservers-extracted (CSS/HTML/JSON)
//
// Strategy:
// 1. Check if server exists in cache dir
// 2. If not, run `npm install` into cache dir
// 3. Return path to server binary
// 4. Update check on startup (weekly)

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

/// LSP server definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerDef {
    pub id: String,
    pub name: String,
    pub npm_package: String,
    pub version: String,
    pub bin_path: String,       // Relative path inside node_modules
    pub languages: Vec<String>,
    pub args: Vec<String>,      // Additional args when launching
}

/// All bundled server definitions
pub fn builtin_servers() -> Vec<LspServerDef> {
    vec![
        LspServerDef {
            id: "intelephense".into(),
            name: "Intelephense (PHP)".into(),
            npm_package: "intelephense".into(),
            version: "1.12.6".into(),
            bin_path: "node_modules/intelephense/lib/intelephense.js".into(),
            languages: vec!["php".into(), "blade".into()],
            args: vec!["--stdio".into()],
        },
        LspServerDef {
            id: "typescript".into(),
            name: "TypeScript Language Server".into(),
            npm_package: "typescript-language-server".into(),
            version: "4.3.3".into(),
            bin_path: "node_modules/typescript-language-server/lib/cli.mjs".into(),
            languages: vec![
                "javascript".into(), "typescript".into(),
                "javascriptreact".into(), "typescriptreact".into(),
            ],
            args: vec!["--stdio".into()],
        },
        LspServerDef {
            id: "volar".into(),
            name: "Vue Language Server (Volar)".into(),
            npm_package: "@vue/language-server".into(),
            version: "2.2.0".into(),
            bin_path: "node_modules/@vue/language-server/bin/vue-language-server.js".into(),
            languages: vec!["vue".into()],
            args: vec!["--stdio".into()],
        },
        LspServerDef {
            id: "css".into(),
            name: "CSS/HTML/JSON Language Server".into(),
            npm_package: "vscode-langservers-extracted".into(),
            version: "4.10.0".into(),
            bin_path: "node_modules/vscode-langservers-extracted/bin/vscode-css-language-server".into(),
            languages: vec!["css".into(), "scss".into(), "less".into()],
            args: vec!["--stdio".into()],
        },
    ]
}

/// Get the cache directory for LSP servers
pub fn lsp_cache_dir() -> PathBuf {
    // Use app data dir: %LOCALAPPDATA%/Tatara IDE/lsp-servers/ (Windows)
    // or ~/.local/share/tatara-ide/lsp-servers/ (Linux/Mac)
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local).join("Tatara IDE").join("lsp-servers")
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".local").join("share").join("tatara-ide").join("lsp-servers")
    } else {
        PathBuf::from("lsp-servers")
    }
}

/// Check if a server is installed
pub fn is_installed(server: &LspServerDef) -> bool {
    let cache = lsp_cache_dir();
    let bin = cache.join(&server.bin_path);
    bin.exists()
}

/// Get the full command to run a server (node path + args)
pub fn server_command(server: &LspServerDef) -> Option<(String, Vec<String>)> {
    if !is_installed(server) {
        return None;
    }

    let cache = lsp_cache_dir();
    let bin = cache.join(&server.bin_path);

    // Find node executable
    let node = find_node()?;

    let mut args = vec![bin.to_string_lossy().to_string()];
    args.extend(server.args.clone());

    Some((node, args))
}

/// Install a server via npm
pub fn install_server(server: &LspServerDef) -> Result<String, String> {
    let cache = lsp_cache_dir();
    std::fs::create_dir_all(&cache)
        .map_err(|e| format!("キャッシュディレクトリ作成エラー: {}", e))?;

    // Check if npm is available
    let npm = find_npm().ok_or_else(|| {
        "npm が見つかりません。Node.js をインストールしてください。\nhttps://nodejs.org/".to_string()
    })?;

    let package_spec = format!("{}@{}", server.npm_package, server.version);

    log_install(&format!("Installing {} ...", package_spec));

    let output = Command::new(&npm)
        .args(["install", "--save", &package_spec])
        .current_dir(&cache)
        .output()
        .map_err(|e| format!("npm install 実行エラー: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("npm install 失敗: {}", stderr));
    }

    // Also install typescript as peer dependency for ts-language-server
    if server.id == "typescript" {
        let _ = Command::new(&npm)
            .args(["install", "--save", "typescript"])
            .current_dir(&cache)
            .output();
    }

    // Verify installation
    if is_installed(server) {
        let msg = format!("{} をインストールしました", server.name);
        log_install(&msg);
        Ok(msg)
    } else {
        Err(format!("{} のインストールに失敗しました（バイナリが見つかりません）", server.name))
    }
}

/// Install all servers needed for a project
pub fn install_for_project(project_path: &Path) -> Vec<(String, Result<String, String>)> {
    let needed = detect_needed_servers(project_path);
    let mut results = vec![];

    for server in needed {
        if is_installed(&server) {
            results.push((server.id.clone(), Ok(format!("{} は既にインストール済み", server.name))));
        } else {
            let result = install_server(&server);
            results.push((server.id.clone(), result));
        }
    }

    results
}

/// Detect which servers are needed based on project files
pub fn detect_needed_servers(project_path: &Path) -> Vec<LspServerDef> {
    let all = builtin_servers();
    let mut needed = vec![];

    // Always include PHP for Laravel projects
    if project_path.join("composer.json").exists()
        || project_path.join("artisan").exists()
    {
        if let Some(s) = all.iter().find(|s| s.id == "intelephense") {
            needed.push(s.clone());
        }
    }

    // Check for JS/TS
    if project_path.join("package.json").exists()
        || has_files_with_ext(project_path, &["js", "ts", "jsx", "tsx"])
    {
        if let Some(s) = all.iter().find(|s| s.id == "typescript") {
            needed.push(s.clone());
        }
    }

    // Check for Vue
    if has_files_with_ext(project_path, &["vue"]) {
        if let Some(s) = all.iter().find(|s| s.id == "volar") {
            needed.push(s.clone());
        }
    }

    // CSS is almost always needed
    if has_files_with_ext(project_path, &["css", "scss", "less"]) {
        if let Some(s) = all.iter().find(|s| s.id == "css") {
            needed.push(s.clone());
        }
    }

    needed
}

/// Get installation status of all servers
pub fn get_status() -> Vec<ServerStatus> {
    builtin_servers()
        .iter()
        .map(|s| ServerStatus {
            id: s.id.clone(),
            name: s.name.clone(),
            installed: is_installed(s),
            version: s.version.clone(),
        })
        .collect()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub version: String,
}

// ── Helpers ──

fn find_node() -> Option<String> {
    // Try common locations
    for cmd in &["node", "node.exe"] {
        if Command::new(cmd).arg("--version").output().is_ok() {
            return Some(cmd.to_string());
        }
    }

    // Windows-specific paths
    #[cfg(target_os = "windows")]
    {
        let program_files = std::env::var("ProgramFiles").unwrap_or_default();
        let paths = [
            format!("{}/nodejs/node.exe", program_files),
            format!("{}/nodejs/node.exe", std::env::var("ProgramFiles(x86)").unwrap_or_default()),
        ];
        for p in &paths {
            if Path::new(p).exists() {
                return Some(p.clone());
            }
        }
    }

    None
}

fn find_npm() -> Option<String> {
    for cmd in &["npm", "npm.cmd"] {
        if Command::new(cmd).arg("--version").output().is_ok() {
            return Some(cmd.to_string());
        }
    }
    None
}

fn has_files_with_ext(dir: &Path, exts: &[&str]) -> bool {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Some(ext) = entry.path().extension() {
                if exts.iter().any(|e| ext == *e) {
                    return true;
                }
            }
        }
    }
    // Also check common subdirs
    for subdir in &["src", "resources", "app"] {
        let sub = dir.join(subdir);
        if sub.exists() {
            if let Ok(entries) = std::fs::read_dir(&sub) {
                for entry in entries.flatten() {
                    if let Some(ext) = entry.path().extension() {
                        if exts.iter().any(|e| ext == *e) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    false
}

fn log_install(msg: &str) {
    // Use the existing log_msg from lib.rs if available, otherwise eprintln
    eprintln!("[LSP Installer] {}", msg);
}
