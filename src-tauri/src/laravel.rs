// ⚒️ Tatara IDE — Laravel Module
//
// Laravel-specific features:
// - Log viewer (storage/logs/*.log)
// - Artisan command runner
// - Queue monitor (via artisan queue:monitor)
// - Route list (via artisan route:list)
//
// All through CLI — same as what the developer would type in terminal.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// Laravel project info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaravelInfo {
    pub is_laravel: bool,
    pub version: Option<String>,
    pub env: Option<String>,
    pub debug: Option<bool>,
}

/// Log file entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64, // Unix timestamp
}

/// Parsed log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,      // ERROR, WARNING, INFO, DEBUG, etc
    pub message: String,
    pub context: Option<String>,  // Stack trace or extra info
}

/// Artisan command result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtisanResult {
    pub success: bool,
    pub output: String,
    pub error: String,
}

/// Route entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteEntry {
    pub method: String,
    pub uri: String,
    pub name: Option<String>,
    pub action: String,
    pub middleware: Vec<String>,
}

// ── Detection ──

/// Detect Laravel project
pub fn detect_laravel(project_path: &Path) -> LaravelInfo {
    let is_laravel = project_path.join("artisan").exists()
        && project_path.join("composer.json").exists();

    if !is_laravel {
        return LaravelInfo { is_laravel: false, version: None, env: None, debug: None };
    }

    // Try to get version from composer.lock
    let version = get_laravel_version(project_path);

    // Get env info
    let (env, debug) = if project_path.join(".env").exists() {
        let content = std::fs::read_to_string(project_path.join(".env")).unwrap_or_default();
        let e = extract_env_value(&content, "APP_ENV");
        let d = extract_env_value(&content, "APP_DEBUG").map(|v| v == "true");
        (e, d)
    } else {
        (None, None)
    };

    LaravelInfo { is_laravel: true, version, env, debug }
}

fn get_laravel_version(project_path: &Path) -> Option<String> {
    let lock_path = project_path.join("composer.lock");
    if let Ok(content) = std::fs::read_to_string(&lock_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(packages) = json["packages"].as_array() {
                for pkg in packages {
                    if pkg["name"].as_str() == Some("laravel/framework") {
                        return pkg["version"].as_str().map(|v| v.trim_start_matches('v').to_string());
                    }
                }
            }
        }
    }
    None
}

fn extract_env_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(key) {
            if let Some(eq) = trimmed.find('=') {
                let val = trimmed[eq + 1..].trim().trim_matches('"').trim_matches('\'');
                return Some(val.to_string());
            }
        }
    }
    None
}

// ── Log Viewer ──

/// List log files in storage/logs
pub fn list_logs(project_path: &Path) -> Result<Vec<LogFile>, String> {
    let logs_dir = project_path.join("storage/logs");
    if !logs_dir.exists() {
        return Ok(vec![]);
    }

    let mut files: Vec<LogFile> = std::fs::read_dir(&logs_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().extension()
                .map(|ext| ext == "log")
                .unwrap_or(false)
        })
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?
                .duration_since(std::time::UNIX_EPOCH).ok()?
                .as_secs();
            Some(LogFile {
                name: e.file_name().to_string_lossy().to_string(),
                path: e.path().to_string_lossy().to_string(),
                size: meta.len(),
                modified,
            })
        })
        .collect();

    // Sort by modified time (newest first)
    files.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(files)
}

/// Read and parse log file (last N lines)
pub fn read_log(path: &str, max_lines: usize) -> Result<Vec<LogEntry>, String> {
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();

    // Take last N lines
    let start = if lines.len() > max_lines { lines.len() - max_lines } else { 0 };
    let tail = &lines[start..];

    Ok(parse_laravel_log(tail))
}

fn parse_laravel_log(lines: &[&str]) -> Vec<LogEntry> {
    let mut entries = vec![];
    let mut current: Option<LogEntry> = None;

    for line in lines {
        // Laravel log format: [2026-03-06 10:30:00] production.ERROR: Message
        if line.starts_with('[') {
            // Save previous entry
            if let Some(entry) = current.take() {
                entries.push(entry);
            }

            // Parse new entry
            if let Some(entry) = parse_log_line(line) {
                current = Some(entry);
            } else {
                // Unparseable line — treat as standalone
                entries.push(LogEntry {
                    timestamp: String::new(),
                    level: "INFO".into(),
                    message: line.to_string(),
                    context: None,
                });
            }
        } else if let Some(ref mut entry) = current {
            // Continuation line (stack trace, etc)
            let ctx = entry.context.get_or_insert_with(String::new);
            if !ctx.is_empty() { ctx.push('\n'); }
            ctx.push_str(line);
        }
    }

    // Don't forget the last entry
    if let Some(entry) = current {
        entries.push(entry);
    }

    entries
}

fn parse_log_line(line: &str) -> Option<LogEntry> {
    // [2026-03-06 10:30:00] production.ERROR: Message here
    let close_bracket = line.find(']')?;
    let timestamp = line[1..close_bracket].to_string();
    let rest = line[close_bracket + 1..].trim();

    // Find level: production.ERROR:
    let colon = rest.find(':')?;
    let prefix = &rest[..colon];
    let level = if let Some(dot) = prefix.rfind('.') {
        prefix[dot + 1..].to_string()
    } else {
        prefix.to_string()
    };

    let message = rest[colon + 1..].trim().to_string();

    Some(LogEntry {
        timestamp,
        level,
        message,
        context: None,
    })
}

// ── Artisan ──

/// Run an artisan command
pub fn run_artisan(project_path: &Path, args: &[&str]) -> Result<ArtisanResult, String> {
    let php = find_php(project_path);

    let output = Command::new(&php)
        .arg("artisan")
        .args(args)
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("artisan 実行エラー: {}", e))?;

    Ok(ArtisanResult {
        success: output.status.success(),
        output: String::from_utf8_lossy(&output.stdout).to_string(),
        error: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

/// List artisan commands
pub fn list_artisan_commands(project_path: &Path) -> Result<Vec<String>, String> {
    let result = run_artisan(project_path, &["list", "--raw"])?;
    if !result.success {
        return Err(result.error);
    }

    Ok(result.output.lines()
        .filter(|l| !l.is_empty())
        .map(|l| {
            // Format: "command  description"
            l.split_whitespace().next().unwrap_or(l).to_string()
        })
        .collect())
}

/// Get route list
pub fn route_list(project_path: &Path) -> Result<Vec<RouteEntry>, String> {
    let result = run_artisan(project_path, &["route:list", "--json"])?;
    if !result.success {
        return Err(result.error);
    }

    let routes: Vec<serde_json::Value> = serde_json::from_str(&result.output)
        .map_err(|e| format!("ルート解析エラー: {}", e))?;

    Ok(routes.iter().map(|r| {
        RouteEntry {
            method: r["method"].as_str().unwrap_or("").to_string(),
            uri: r["uri"].as_str().unwrap_or("").to_string(),
            name: r["name"].as_str().map(|s| s.to_string()),
            action: r["action"].as_str().unwrap_or("").to_string(),
            middleware: r["middleware"].as_array()
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
        }
    }).collect())
}

/// Clear specific Laravel caches
pub fn clear_cache(project_path: &Path, cache_type: &str) -> Result<String, String> {
    let args: Vec<&str> = match cache_type {
        "all" => vec!["optimize:clear"],
        "config" => vec!["config:clear"],
        "cache" => vec!["cache:clear"],
        "route" => vec!["route:clear"],
        "view" => vec!["view:clear"],
        "event" => vec!["event:clear"],
        _ => return Err(format!("不明なキャッシュタイプ: {}", cache_type)),
    };

    let result = run_artisan(project_path, &args)?;
    if result.success {
        Ok(result.output.trim().to_string())
    } else {
        Err(result.error)
    }
}

// ── Helpers ──

fn find_php(project_path: &Path) -> String {
    // Check if using Sail
    let sail = project_path.join("vendor/bin/sail");
    if sail.exists() {
        // Check if Docker is running for Sail
        if let Ok(output) = Command::new("docker").args(["info"]).output() {
            if output.status.success() {
                return sail.to_string_lossy().to_string();
            }
        }
    }

    // Try php in PATH
    for cmd in &["php", "php8.3", "php8.2", "php8.1"] {
        if Command::new(cmd).arg("--version").output().is_ok() {
            return cmd.to_string();
        }
    }

    "php".to_string()
}

/// Format file size for display
pub fn format_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_non_laravel() {
        let dir = std::env::temp_dir().join("tatara-test-non-laravel");
        let _ = std::fs::create_dir_all(&dir);
        let info = detect_laravel(&dir);
        assert!(!info.is_laravel);
    }

    #[test]
    fn test_parse_log_line() {
        let entry = parse_log_line("[2026-03-06 10:30:00] production.ERROR: Something went wrong").unwrap();
        assert_eq!(entry.timestamp, "2026-03-06 10:30:00");
        assert_eq!(entry.level, "ERROR");
        assert_eq!(entry.message, "Something went wrong");
    }

    #[test]
    fn test_parse_log_multi_line() {
        let lines = vec![
            "[2026-03-06 10:30:00] production.ERROR: Main error",
            "#0 /app/Http/Controllers/UserController.php(42): method()",
            "#1 /vendor/laravel/framework/src/routing.php(100): dispatch()",
            "[2026-03-06 10:31:00] production.INFO: All good",
        ];
        let entries = parse_laravel_log(&lines);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].level, "ERROR");
        assert!(entries[0].context.is_some());
        assert!(entries[0].context.as_ref().unwrap().contains("UserController"));
        assert_eq!(entries[1].level, "INFO");
    }

    #[test]
    fn test_extract_env_value() {
        let content = "APP_NAME=Tatara\nAPP_ENV=local\nAPP_DEBUG=true\n";
        assert_eq!(extract_env_value(content, "APP_ENV"), Some("local".into()));
        assert_eq!(extract_env_value(content, "APP_DEBUG"), Some("true".into()));
        assert_eq!(extract_env_value(content, "MISSING"), None);
    }

    #[test]
    fn test_format_size() {
        assert_eq!(format_size(500), "500 B");
        assert_eq!(format_size(1500), "1.5 KB");
        assert_eq!(format_size(1500000), "1.4 MB");
    }
}
