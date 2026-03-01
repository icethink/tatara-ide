// ⚒️ Tatara IDE — Terminal Module
//
// Smart terminal with Edit/RAW mode and safety features.
// Phase 1 scope:
// - Dangerous command detection
// - Multi-line paste analysis
// - RAW mode auto-detection
// - Terminal input mode management

use serde::{Deserialize, Serialize};

/// Terminal input mode
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum TerminalMode {
    Edit, // Default: Ctrl+C=copy, Ctrl+V=paste
    Raw,  // For vi/top/tmux: keystrokes go directly to PTY
}

/// Danger level for commands
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum DangerLevel {
    Safe,
    Medium,
    High,
}

/// Result of analyzing a command for danger
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandAnalysis {
    pub command: String,
    pub danger_level: DangerLevel,
    pub warning: Option<String>,
}

/// Commands that trigger automatic RAW mode switch
const RAW_MODE_COMMANDS: &[&str] = &[
    "vi", "vim", "nvim", "nano", "emacs",
    "top", "htop", "btop",
    "tmux", "screen",
    "less", "more",
    "mysql", "psql", "sqlite3",
    "ssh", "telnet",
    "node",  // interactive REPL (no args)
    "python", "python3", // interactive REPL (no args)
    "irb", "rails console",
];

/// Dangerous command patterns
const DANGER_PATTERNS_HIGH: &[(&str, &str)] = &[
    ("rm -rf", "ファイルを再帰的に強制削除します"),
    ("rm -r", "ファイルを再帰的に削除します"),
    ("migrate:fresh", "データベースの全テーブルを削除して再作成します"),
    ("migrate:reset", "全マイグレーションをロールバックします"),
    ("db:wipe", "データベースの全テーブルを削除します"),
    ("DROP DATABASE", "データベースを完全に削除します"),
    ("DROP TABLE", "テーブルを完全に削除します"),
    ("TRUNCATE TABLE", "テーブルの全データを削除します"),
    ("dd if=", "ディスクへの低レベル書き込みです"),
    ("mkfs", "ファイルシステムをフォーマットします"),
    ("> /dev/sda", "ディスクを上書きします"),
];

const DANGER_PATTERNS_MEDIUM: &[(&str, &str)] = &[
    ("chmod 777", "全ユーザーにフルアクセス権限を付与します（セキュリティリスク）"),
    ("sudo", "管理者権限でコマンドを実行します"),
    ("--force", "確認をスキップして実行します"),
    ("--no-confirm", "確認をスキップして実行します"),
    ("> /dev/null", "出力を破棄します"),
    ("curl | bash", "リモートスクリプトを直接実行します（危険）"),
    ("curl | sh", "リモートスクリプトを直接実行します（危険）"),
    ("wget -O - |", "リモートスクリプトを直接実行します（危険）"),
];

/// Analyze a command for potential danger
pub fn analyze_command(command: &str) -> CommandAnalysis {
    let cmd_lower = command.to_lowercase();

    // Check high danger patterns
    for (pattern, warning) in DANGER_PATTERNS_HIGH {
        if cmd_lower.contains(&pattern.to_lowercase()) {
            return CommandAnalysis {
                command: command.to_string(),
                danger_level: DangerLevel::High,
                warning: Some(format!("⚠️ 危険: {}", warning)),
            };
        }
    }

    // Check medium danger patterns
    for (pattern, warning) in DANGER_PATTERNS_MEDIUM {
        if cmd_lower.contains(&pattern.to_lowercase()) {
            return CommandAnalysis {
                command: command.to_string(),
                danger_level: DangerLevel::Medium,
                warning: Some(format!("⚡ 注意: {}", warning)),
            };
        }
    }

    CommandAnalysis {
        command: command.to_string(),
        danger_level: DangerLevel::Safe,
        warning: None,
    }
}

/// Analyze multi-line paste content
pub fn analyze_paste(content: &str) -> PasteAnalysis {
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();

    let mut dangers: Vec<CommandAnalysis> = Vec::new();
    for line in &lines {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let analysis = analyze_command(trimmed);
        if analysis.danger_level != DangerLevel::Safe {
            dangers.push(analysis);
        }
    }

    let has_danger = !dangers.is_empty();
    let max_danger = if dangers.iter().any(|d| d.danger_level == DangerLevel::High) {
        DangerLevel::High
    } else if has_danger {
        DangerLevel::Medium
    } else {
        DangerLevel::Safe
    };

    PasteAnalysis {
        line_count,
        is_multiline: line_count > 1,
        dangerous_commands: dangers,
        max_danger_level: max_danger,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasteAnalysis {
    pub line_count: usize,
    pub is_multiline: bool,
    pub dangerous_commands: Vec<CommandAnalysis>,
    pub max_danger_level: DangerLevel,
}

/// Check if a command should trigger RAW mode
pub fn should_use_raw_mode(command: &str) -> bool {
    let cmd = command.trim();
    let first_word = cmd.split_whitespace().next().unwrap_or("");

    // Check direct command names
    for raw_cmd in RAW_MODE_COMMANDS {
        if first_word == *raw_cmd {
            return true;
        }
    }

    // Check "php artisan tinker" specifically
    if cmd.contains("artisan tinker") {
        return true;
    }

    // Check for piped commands ending in interactive programs
    if let Some(last_pipe) = cmd.rsplit('|').next() {
        let last_cmd = last_pipe.trim().split_whitespace().next().unwrap_or("");
        if RAW_MODE_COMMANDS.contains(&last_cmd) {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_danger_detection_high() {
        let result = analyze_command("rm -rf /var/www/*");
        assert_eq!(result.danger_level, DangerLevel::High);
        assert!(result.warning.is_some());
    }

    #[test]
    fn test_danger_detection_medium() {
        let result = analyze_command("sudo apt update");
        assert_eq!(result.danger_level, DangerLevel::Medium);
    }

    #[test]
    fn test_danger_detection_safe() {
        let result = analyze_command("php artisan serve");
        assert_eq!(result.danger_level, DangerLevel::Safe);
        assert!(result.warning.is_none());
    }

}

/// Result of executing a shell command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

/// Execute a shell command in the given working directory
pub fn exec_command(cmd: &str, cwd: Option<&str>) -> ExecResult {
    let output = if cfg!(target_os = "windows") {
        let mut command = std::process::Command::new("cmd");
        command.args(["/C", cmd]);
        if let Some(dir) = cwd {
            command.current_dir(dir);
        }
        command.output()
    } else {
        let mut command = std::process::Command::new("sh");
        command.args(["-c", cmd]);
        if let Some(dir) = cwd {
            command.current_dir(dir);
        }
        command.output()
    };

    match output {
        Ok(out) => ExecResult {
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
            code: out.status.code().unwrap_or(-1),
        },
        Err(e) => ExecResult {
            stdout: String::new(),
            stderr: format!("実行エラー: {}", e),
            code: -1,
        },
    }
}

#[cfg(test)]
mod more_tests {
    use super::*;

    #[test]
    fn test_paste_analysis() {
        let paste = "cd /var/www\nrm -rf storage/logs/*\nphp artisan migrate:fresh";
        let result = analyze_paste(paste);
        assert_eq!(result.line_count, 3);
        assert!(result.is_multiline);
        assert_eq!(result.dangerous_commands.len(), 2);
        assert_eq!(result.max_danger_level, DangerLevel::High);
    }

    #[test]
    fn test_raw_mode_detection() {
        assert!(should_use_raw_mode("vim file.php"));
        assert!(should_use_raw_mode("htop"));
        assert!(should_use_raw_mode("php artisan tinker"));
        assert!(should_use_raw_mode("ssh user@server"));
        assert!(!should_use_raw_mode("php artisan serve"));
        assert!(!should_use_raw_mode("ls -la"));
        assert!(!should_use_raw_mode("npm run dev"));
    }

    #[test]
    fn test_migrate_fresh_danger() {
        let result = analyze_command("php artisan migrate:fresh --seed");
        assert_eq!(result.danger_level, DangerLevel::High);
    }
}
