// ⚒️ Tatara IDE — .env File Parser
//
// Parses Laravel .env files for:
// - Database auto-connection (.env → DB panel)
// - APP_KEY validation
// - Environment display in status bar

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Parsed .env file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvFile {
    pub values: HashMap<String, String>,
    pub warnings: Vec<EnvWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvWarning {
    pub key: String,
    pub message: String,
    pub severity: WarningSeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WarningSeverity {
    Error,
    Warning,
    Info,
}

/// Database connection info extracted from .env
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub driver: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

/// Parse a .env file
pub fn parse_env_file(path: &Path) -> Result<EnvFile, String> {
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(parse_env_string(&content))
}

/// Parse .env content string
pub fn parse_env_string(content: &str) -> EnvFile {
    let mut values = HashMap::new();
    let mut warnings = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Parse KEY=VALUE
        if let Some(eq_pos) = trimmed.find('=') {
            let key = trimmed[..eq_pos].trim().to_string();
            let mut value = trimmed[eq_pos + 1..].trim().to_string();

            // Remove surrounding quotes
            if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value = value[1..value.len() - 1].to_string();
            }

            // Remove inline comments (but not in quoted strings)
            if let Some(comment_pos) = value.find(" #") {
                value = value[..comment_pos].trim().to_string();
            }

            values.insert(key, value);
        }
    }

    // Validate Laravel-specific keys
    validate_laravel_env(&values, &mut warnings);

    EnvFile { values, warnings }
}

fn validate_laravel_env(values: &HashMap<String, String>, warnings: &mut Vec<EnvWarning>) {
    // Check APP_KEY
    if let Some(key) = values.get("APP_KEY") {
        if key.is_empty() {
            warnings.push(EnvWarning {
                key: "APP_KEY".into(),
                message: "APP_KEY が設定されていません。`php artisan key:generate` を実行してください".into(),
                severity: WarningSeverity::Error,
            });
        }
    } else {
        warnings.push(EnvWarning {
            key: "APP_KEY".into(),
            message: "APP_KEY が見つかりません".into(),
            severity: WarningSeverity::Error,
        });
    }

    // Check APP_DEBUG in production
    if let (Some(env), Some(debug)) = (values.get("APP_ENV"), values.get("APP_DEBUG")) {
        if env == "production" && debug == "true" {
            warnings.push(EnvWarning {
                key: "APP_DEBUG".into(),
                message: "本番環境で APP_DEBUG=true は危険です".into(),
                severity: WarningSeverity::Warning,
            });
        }
    }

    // Check DB connection
    if let Some(connection) = values.get("DB_CONNECTION") {
        if connection != "sqlite" {
            // Non-SQLite needs host/user/password
            if values.get("DB_HOST").map(|v| v.is_empty()).unwrap_or(true) {
                warnings.push(EnvWarning {
                    key: "DB_HOST".into(),
                    message: "DB_HOST が設定されていません".into(),
                    severity: WarningSeverity::Warning,
                });
            }
        }
    }
}

/// Extract database config from .env values
pub fn extract_db_config(env: &EnvFile) -> Option<DatabaseConfig> {
    let driver = env.values.get("DB_CONNECTION")?.clone();
    
    if driver == "sqlite" {
        return Some(DatabaseConfig {
            driver,
            host: String::new(),
            port: 0,
            database: env.values.get("DB_DATABASE").cloned().unwrap_or_else(|| "database/database.sqlite".into()),
            username: String::new(),
            password: String::new(),
        });
    }

    let default_port = match driver.as_str() {
        "mysql" => 3306,
        "pgsql" => 5432,
        "sqlsrv" => 1433,
        _ => 3306,
    };

    Some(DatabaseConfig {
        driver,
        host: env.values.get("DB_HOST").cloned().unwrap_or_else(|| "127.0.0.1".into()),
        port: env.values.get("DB_PORT")
            .and_then(|p| p.parse().ok())
            .unwrap_or(default_port),
        database: env.values.get("DB_DATABASE").cloned().unwrap_or_default(),
        username: env.values.get("DB_USERNAME").cloned().unwrap_or_default(),
        password: env.values.get("DB_PASSWORD").cloned().unwrap_or_default(),
    })
}

/// Check if .env.example exists but .env doesn't
pub fn check_env_exists(project_path: &Path) -> EnvCheckResult {
    let env_path = project_path.join(".env");
    let example_path = project_path.join(".env.example");

    if env_path.exists() {
        EnvCheckResult::Exists
    } else if example_path.exists() {
        EnvCheckResult::MissingButExampleExists
    } else {
        EnvCheckResult::Missing
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnvCheckResult {
    Exists,
    MissingButExampleExists,
    Missing,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_basic() {
        let env = parse_env_string("APP_NAME=Tatara\nAPP_ENV=local\nAPP_DEBUG=true\n");
        assert_eq!(env.values.get("APP_NAME").unwrap(), "Tatara");
        assert_eq!(env.values.get("APP_ENV").unwrap(), "local");
        assert_eq!(env.values.get("APP_DEBUG").unwrap(), "true");
    }

    #[test]
    fn test_parse_quoted() {
        let env = parse_env_string("APP_NAME=\"Tatara IDE\"\nDB_PASSWORD='secret'\n");
        assert_eq!(env.values.get("APP_NAME").unwrap(), "Tatara IDE");
        assert_eq!(env.values.get("DB_PASSWORD").unwrap(), "secret");
    }

    #[test]
    fn test_parse_comments() {
        let env = parse_env_string("# This is a comment\nAPP_NAME=Test\n# Another comment\n");
        assert_eq!(env.values.len(), 1);
        assert_eq!(env.values.get("APP_NAME").unwrap(), "Test");
    }

    #[test]
    fn test_empty_app_key_warning() {
        let env = parse_env_string("APP_KEY=\n");
        assert!(env.warnings.iter().any(|w| w.key == "APP_KEY"));
    }

    #[test]
    fn test_production_debug_warning() {
        let env = parse_env_string("APP_ENV=production\nAPP_DEBUG=true\nAPP_KEY=base64:abc123\n");
        assert!(env.warnings.iter().any(|w| w.key == "APP_DEBUG"));
    }

    #[test]
    fn test_extract_mysql_config() {
        let env = parse_env_string(
            "DB_CONNECTION=mysql\nDB_HOST=127.0.0.1\nDB_PORT=3306\nDB_DATABASE=laravel\nDB_USERNAME=root\nDB_PASSWORD=secret\nAPP_KEY=base64:test\n"
        );
        let db = extract_db_config(&env).unwrap();
        assert_eq!(db.driver, "mysql");
        assert_eq!(db.host, "127.0.0.1");
        assert_eq!(db.port, 3306);
        assert_eq!(db.database, "laravel");
        assert_eq!(db.username, "root");
    }

    #[test]
    fn test_extract_sqlite_config() {
        let env = parse_env_string("DB_CONNECTION=sqlite\nAPP_KEY=base64:test\n");
        let db = extract_db_config(&env).unwrap();
        assert_eq!(db.driver, "sqlite");
        assert_eq!(db.database, "database/database.sqlite");
    }
}
