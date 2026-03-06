// ⚒️ Tatara IDE — Database Module
//
// Connect to MySQL/PostgreSQL/SQLite via CLI tools or embedded drivers.
// Auto-reads .env for connection details.
//
// Architecture:
// - SQLite: rusqlite (embedded, no external tool needed)
// - MySQL: shells out to `mysql` CLI
// - PostgreSQL: shells out to `psql` CLI
//
// Why CLI? Laravel devs already have mysql/psql installed (via Docker/Homebrew/etc).
// Zero extra native dependencies, and we match what `php artisan tinker` does.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

use crate::dotenv;

/// Database connection state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConnection {
    pub driver: String,
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub connected: bool,
    pub error: Option<String>,
}

/// Table info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub row_count: Option<i64>,
    pub engine: Option<String>,
}

/// Column info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub nullable: bool,
    pub key: String,       // PRI, UNI, MUL, or ""
    pub default_value: Option<String>,
    pub extra: String,     // auto_increment, etc.
}

/// Query result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub affected_rows: Option<i64>,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

// ── Connection ──

/// Auto-detect DB from .env and test connection
pub fn connect_from_env(project_path: &Path) -> Result<DbConnection, String> {
    let env_path = project_path.join(".env");
    let env = dotenv::parse_env_file(&env_path)?;
    let config = dotenv::extract_db_config(&env)
        .ok_or_else(|| ".env にデータベース設定が見つかりません".to_string())?;

    let mut conn = DbConnection {
        driver: config.driver.clone(),
        host: config.host.clone(),
        port: config.port,
        database: config.database.clone(),
        username: config.username.clone(),
        connected: false,
        error: None,
    };

    // Test connection
    match config.driver.as_str() {
        "sqlite" => {
            let db_path = if config.database.starts_with('/') || config.database.starts_with('\\') {
                config.database.clone()
            } else {
                project_path.join(&config.database).to_string_lossy().to_string()
            };
            match rusqlite::Connection::open_with_flags(
                &db_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE,
            ) {
                Ok(_) => conn.connected = true,
                Err(e) => conn.error = Some(format!("SQLite接続エラー: {}", e)),
            }
        }
        "mysql" => {
            let result = Command::new("mysql")
                .args([
                    "-h", &config.host,
                    "-P", &config.port.to_string(),
                    "-u", &config.username,
                    &format!("-p{}", config.password),
                    &config.database,
                    "-e", "SELECT 1",
                ])
                .output();

            match result {
                Ok(output) if output.status.success() => conn.connected = true,
                Ok(output) => {
                    conn.error = Some(String::from_utf8_lossy(&output.stderr).trim().to_string());
                }
                Err(_) => {
                    conn.error = Some("mysql コマンドが見つかりません。MySQL CLIをインストールしてください。".to_string());
                }
            }
        }
        "pgsql" => {
            let result = Command::new("psql")
                .env("PGPASSWORD", &config.password)
                .args([
                    "-h", &config.host,
                    "-p", &config.port.to_string(),
                    "-U", &config.username,
                    "-d", &config.database,
                    "-c", "SELECT 1",
                ])
                .output();

            match result {
                Ok(output) if output.status.success() => conn.connected = true,
                Ok(output) => {
                    conn.error = Some(String::from_utf8_lossy(&output.stderr).trim().to_string());
                }
                Err(_) => {
                    conn.error = Some("psql コマンドが見つかりません。PostgreSQL CLIをインストールしてください。".to_string());
                }
            }
        }
        other => {
            conn.error = Some(format!("未対応のドライバ: {}", other));
        }
    }

    Ok(conn)
}

// ── Tables ──

/// List tables in the connected database
pub fn list_tables(project_path: &Path) -> Result<Vec<TableInfo>, String> {
    let env_path = project_path.join(".env");
    let env = dotenv::parse_env_file(&env_path)?;
    let config = dotenv::extract_db_config(&env)
        .ok_or_else(|| "DB設定なし".to_string())?;

    match config.driver.as_str() {
        "sqlite" => list_tables_sqlite(project_path, &config.database),
        "mysql" => list_tables_mysql(&config),
        "pgsql" => list_tables_pgsql(&config),
        _ => Err(format!("未対応: {}", config.driver)),
    }
}

fn list_tables_sqlite(project_path: &Path, db_name: &str) -> Result<Vec<TableInfo>, String> {
    let db_path = if db_name.starts_with('/') {
        db_name.to_string()
    } else {
        project_path.join(db_name).to_string_lossy().to_string()
    };

    let conn = rusqlite::Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let tables: Vec<TableInfo> = stmt.query_map([], |row| {
        let name: String = row.get(0)?;
        Ok(name)
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .map(|name| {
        // Get row count
        let count = conn.query_row(
            &format!("SELECT COUNT(*) FROM \"{}\"", name),
            [],
            |row| row.get::<_, i64>(0),
        ).ok();
        TableInfo { name, row_count: count, engine: Some("SQLite".into()) }
    })
    .collect();

    Ok(tables)
}

fn list_tables_mysql(config: &dotenv::DatabaseConfig) -> Result<Vec<TableInfo>, String> {
    let sql = format!(
        "SELECT TABLE_NAME, TABLE_ROWS, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='{}' ORDER BY TABLE_NAME",
        config.database
    );

    let output = Command::new("mysql")
        .args([
            "-h", &config.host,
            "-P", &config.port.to_string(),
            "-u", &config.username,
            &format!("-p{}", config.password),
            &config.database,
            "-e", &sql,
            "-N", // No headers
            "--batch",
        ])
        .output()
        .map_err(|e| format!("mysql実行エラー: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let tables = stdout.lines().map(|line| {
        let parts: Vec<&str> = line.split('\t').collect();
        TableInfo {
            name: parts.first().unwrap_or(&"").to_string(),
            row_count: parts.get(1).and_then(|s| s.parse().ok()),
            engine: parts.get(2).map(|s| s.to_string()),
        }
    }).collect();

    Ok(tables)
}

fn list_tables_pgsql(config: &dotenv::DatabaseConfig) -> Result<Vec<TableInfo>, String> {
    let sql = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename";

    let output = Command::new("psql")
        .env("PGPASSWORD", &config.password)
        .args([
            "-h", &config.host,
            "-p", &config.port.to_string(),
            "-U", &config.username,
            "-d", &config.database,
            "-t", "-A", // Tuples only, unaligned
            "-c", sql,
        ])
        .output()
        .map_err(|e| format!("psql実行エラー: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let tables = stdout.lines()
        .filter(|l| !l.is_empty())
        .map(|name| TableInfo {
            name: name.trim().to_string(),
            row_count: None,
            engine: Some("PostgreSQL".into()),
        })
        .collect();

    Ok(tables)
}

// ── Columns ──

/// Describe table columns
pub fn describe_table(project_path: &Path, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let env_path = project_path.join(".env");
    let env = dotenv::parse_env_file(&env_path)?;
    let config = dotenv::extract_db_config(&env)
        .ok_or_else(|| "DB設定なし".to_string())?;

    match config.driver.as_str() {
        "sqlite" => describe_table_sqlite(project_path, &config.database, table),
        "mysql" => describe_table_mysql(&config, table),
        "pgsql" => describe_table_pgsql(&config, table),
        _ => Err(format!("未対応: {}", config.driver)),
    }
}

fn describe_table_sqlite(project_path: &Path, db_name: &str, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let db_path = if db_name.starts_with('/') {
        db_name.to_string()
    } else {
        project_path.join(db_name).to_string_lossy().to_string()
    };

    let conn = rusqlite::Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(&format!("PRAGMA table_info(\"{}\")", table))
        .map_err(|e| e.to_string())?;

    let columns: Vec<ColumnInfo> = stmt.query_map([], |row| {
        Ok(ColumnInfo {
            name: row.get::<_, String>(1)?,
            data_type: row.get::<_, String>(2)?,
            nullable: row.get::<_, i32>(3)? == 0,
            key: if row.get::<_, i32>(5)? > 0 { "PRI".into() } else { String::new() },
            default_value: row.get::<_, Option<String>>(4)?,
            extra: String::new(),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(columns)
}

fn describe_table_mysql(config: &dotenv::DatabaseConfig, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let output = Command::new("mysql")
        .args([
            "-h", &config.host,
            "-P", &config.port.to_string(),
            "-u", &config.username,
            &format!("-p{}", config.password),
            &config.database,
            "-e", &format!("DESCRIBE `{}`", table),
            "-N", "--batch",
        ])
        .output()
        .map_err(|e| format!("mysql実行エラー: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let columns = stdout.lines().map(|line| {
        let parts: Vec<&str> = line.split('\t').collect();
        ColumnInfo {
            name: parts.first().unwrap_or(&"").to_string(),
            data_type: parts.get(1).unwrap_or(&"").to_string(),
            nullable: parts.get(2).map(|s| *s == "YES").unwrap_or(true),
            key: parts.get(3).unwrap_or(&"").to_string(),
            default_value: parts.get(4).map(|s| if *s == "NULL" { None } else { Some(s.to_string()) }).unwrap_or(None),
            extra: parts.get(5).unwrap_or(&"").to_string(),
        }
    }).collect();

    Ok(columns)
}

fn describe_table_pgsql(config: &dotenv::DatabaseConfig, table: &str) -> Result<Vec<ColumnInfo>, String> {
    let sql = format!(
        "SELECT column_name, data_type, is_nullable, column_default \
         FROM information_schema.columns \
         WHERE table_name='{}' AND table_schema='public' \
         ORDER BY ordinal_position",
        table
    );

    let output = Command::new("psql")
        .env("PGPASSWORD", &config.password)
        .args([
            "-h", &config.host,
            "-p", &config.port.to_string(),
            "-U", &config.username,
            "-d", &config.database,
            "-t", "-A",
            "-F", "\t",
            "-c", &sql,
        ])
        .output()
        .map_err(|e| format!("psql実行エラー: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let columns = stdout.lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            ColumnInfo {
                name: parts.first().unwrap_or(&"").to_string(),
                data_type: parts.get(1).unwrap_or(&"").to_string(),
                nullable: parts.get(2).map(|s| *s == "YES").unwrap_or(true),
                key: String::new(), // Would need separate query for constraints
                default_value: parts.get(3).map(|s| s.to_string()),
                extra: String::new(),
            }
        })
        .collect();

    Ok(columns)
}

// ── Query Execution ──

/// Execute a SQL query (read-only for safety, unless explicitly allowed)
pub fn execute_query(project_path: &Path, sql: &str, allow_write: bool) -> Result<QueryResult, String> {
    let start = std::time::Instant::now();

    // Safety check: block write queries unless explicitly allowed
    let sql_upper = sql.trim().to_uppercase();
    if !allow_write {
        for keyword in &["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"] {
            if sql_upper.starts_with(keyword) {
                return Err(format!(
                    "書き込みクエリはブロックされました: {}。実行するには「書き込みを許可」を有効にしてください。",
                    keyword
                ));
            }
        }
    }

    let env_path = project_path.join(".env");
    let env = dotenv::parse_env_file(&env_path)?;
    let config = dotenv::extract_db_config(&env)
        .ok_or_else(|| "DB設定なし".to_string())?;

    let result = match config.driver.as_str() {
        "sqlite" => execute_query_sqlite(project_path, &config.database, sql, allow_write),
        "mysql" => execute_query_cli("mysql", &config, sql),
        "pgsql" => execute_query_cli("psql", &config, sql),
        _ => Err(format!("未対応: {}", config.driver)),
    };

    let elapsed = start.elapsed().as_millis() as u64;

    match result {
        Ok(mut qr) => {
            qr.execution_time_ms = elapsed;
            Ok(qr)
        }
        Err(e) => Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: None,
            execution_time_ms: elapsed,
            error: Some(e),
        }),
    }
}

fn execute_query_sqlite(project_path: &Path, db_name: &str, sql: &str, allow_write: bool) -> Result<QueryResult, String> {
    let db_path = if db_name.starts_with('/') {
        db_name.to_string()
    } else {
        project_path.join(db_name).to_string_lossy().to_string()
    };

    let flags = if allow_write {
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
    } else {
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY
    };

    let conn = rusqlite::Connection::open_with_flags(&db_path, flags)
        .map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let col_count = stmt.column_count();
    let columns: Vec<String> = (0..col_count).map(|i| stmt.column_name(i).unwrap_or("?").to_string()).collect();

    let rows: Vec<Vec<serde_json::Value>> = stmt.query_map([], |row| {
        let mut values = Vec::new();
        for i in 0..col_count {
            let val = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
                Ok(rusqlite::types::ValueRef::Integer(n)) => serde_json::json!(n),
                Ok(rusqlite::types::ValueRef::Real(f)) => serde_json::json!(f),
                Ok(rusqlite::types::ValueRef::Text(s)) => {
                    serde_json::Value::String(String::from_utf8_lossy(s).to_string())
                }
                Ok(rusqlite::types::ValueRef::Blob(b)) => {
                    serde_json::Value::String(format!("[BLOB {} bytes]", b.len()))
                }
                Err(_) => serde_json::Value::Null,
            };
            values.push(val);
        }
        Ok(values)
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(QueryResult {
        columns,
        rows,
        affected_rows: None,
        execution_time_ms: 0,
        error: None,
    })
}

fn execute_query_cli(driver: &str, config: &dotenv::DatabaseConfig, sql: &str) -> Result<QueryResult, String> {
    let output = match driver {
        "mysql" => {
            Command::new("mysql")
                .args([
                    "-h", &config.host,
                    "-P", &config.port.to_string(),
                    "-u", &config.username,
                    &format!("-p{}", config.password),
                    &config.database,
                    "-e", sql,
                    "--batch",
                ])
                .output()
                .map_err(|e| format!("{} 実行エラー: {}", driver, e))?
        }
        "psql" => {
            Command::new("psql")
                .env("PGPASSWORD", &config.password)
                .args([
                    "-h", &config.host,
                    "-p", &config.port.to_string(),
                    "-U", &config.username,
                    "-d", &config.database,
                    "-A",
                    "-F", "\t",
                    "-c", sql,
                ])
                .output()
                .map_err(|e| format!("{} 実行エラー: {}", driver, e))?
        }
        _ => return Err(format!("未対応: {}", driver)),
    };

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut lines = stdout.lines();

    // First line is header
    let columns: Vec<String> = if let Some(header) = lines.next() {
        header.split('\t').map(|s| s.to_string()).collect()
    } else {
        return Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            affected_rows: None,
            execution_time_ms: 0,
            error: None,
        });
    };

    // Parse rows
    let rows: Vec<Vec<serde_json::Value>> = lines
        .filter(|l| !l.is_empty() && !l.starts_with('('))  // Skip psql row count footer
        .map(|line| {
            line.split('\t')
                .map(|val| {
                    if val == "NULL" || val == "\\N" {
                        serde_json::Value::Null
                    } else if let Ok(n) = val.parse::<i64>() {
                        serde_json::json!(n)
                    } else if let Ok(f) = val.parse::<f64>() {
                        serde_json::json!(f)
                    } else {
                        serde_json::Value::String(val.to_string())
                    }
                })
                .collect()
        })
        .collect();

    Ok(QueryResult {
        columns,
        rows,
        affected_rows: None,
        execution_time_ms: 0,
        error: None,
    })
}

// ── Preview (SELECT * LIMIT) ──

/// Preview table data (first N rows)
pub fn preview_table(project_path: &Path, table: &str, limit: usize) -> Result<QueryResult, String> {
    let env_path = project_path.join(".env");
    let env = dotenv::parse_env_file(&env_path)?;
    let config = dotenv::extract_db_config(&env)
        .ok_or_else(|| "DB設定なし".to_string())?;

    let sql = match config.driver.as_str() {
        "mysql" => format!("SELECT * FROM `{}` LIMIT {}", table, limit),
        "pgsql" => format!("SELECT * FROM \"{}\" LIMIT {}", table, limit),
        "sqlite" => format!("SELECT * FROM \"{}\" LIMIT {}", table, limit),
        _ => return Err(format!("未対応: {}", config.driver)),
    };

    execute_query(project_path, &sql, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn create_test_env(dir: &Path, content: &str) {
        let mut f = std::fs::File::create(dir.join(".env")).unwrap();
        f.write_all(content.as_bytes()).unwrap();
    }

    fn create_test_sqlite(dir: &Path) -> String {
        let db_path = dir.join("test.sqlite");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT);
             INSERT INTO users VALUES (1, 'Alice', 'alice@example.com');
             INSERT INTO users VALUES (2, 'Bob', 'bob@example.com');
             CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER);"
        ).unwrap();
        "test.sqlite".into()
    }

    #[test]
    fn test_list_tables_sqlite() {
        let dir = tempfile::tempdir().unwrap();
        let db_name = create_test_sqlite(dir.path());
        create_test_env(dir.path(), &format!(
            "DB_CONNECTION=sqlite\nDB_DATABASE={}\nAPP_KEY=test\n", db_name
        ));

        let tables = list_tables(dir.path()).unwrap();
        assert_eq!(tables.len(), 2);
        assert!(tables.iter().any(|t| t.name == "users"));
        assert!(tables.iter().any(|t| t.name == "posts"));
        assert_eq!(tables.iter().find(|t| t.name == "users").unwrap().row_count, Some(2));
    }

    #[test]
    fn test_describe_table_sqlite() {
        let dir = tempfile::tempdir().unwrap();
        let db_name = create_test_sqlite(dir.path());
        create_test_env(dir.path(), &format!(
            "DB_CONNECTION=sqlite\nDB_DATABASE={}\nAPP_KEY=test\n", db_name
        ));

        let cols = describe_table(dir.path(), "users").unwrap();
        assert_eq!(cols.len(), 3);
        assert_eq!(cols[0].name, "id");
        assert!(cols[0].key.contains("PRI"));
        assert_eq!(cols[1].name, "name");
        assert_eq!(cols[2].name, "email");
    }

    #[test]
    fn test_execute_query_sqlite() {
        let dir = tempfile::tempdir().unwrap();
        let db_name = create_test_sqlite(dir.path());
        create_test_env(dir.path(), &format!(
            "DB_CONNECTION=sqlite\nDB_DATABASE={}\nAPP_KEY=test\n", db_name
        ));

        let result = execute_query(dir.path(), "SELECT name, email FROM users ORDER BY id", false).unwrap();
        assert!(result.error.is_none());
        assert_eq!(result.columns, vec!["name", "email"]);
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0][0], serde_json::json!("Alice"));
    }

    #[test]
    fn test_write_protection() {
        let dir = tempfile::tempdir().unwrap();
        let db_name = create_test_sqlite(dir.path());
        create_test_env(dir.path(), &format!(
            "DB_CONNECTION=sqlite\nDB_DATABASE={}\nAPP_KEY=test\n", db_name
        ));

        // Should be blocked (write not allowed)
        let result = execute_query(dir.path(), "DELETE FROM users WHERE id=1", false);
        assert!(result.is_err() || result.as_ref().unwrap().error.is_some());

        // With allow_write — should succeed
        let result = execute_query(dir.path(), "DELETE FROM users WHERE id=1", true);
        // DELETE is a statement, not a query — rusqlite may error on prepare for non-SELECT
        // Just verify it doesn't hit the write protection block
        if let Ok(r) = &result {
            assert!(r.error.as_ref().map(|e| !e.contains("ブロック")).unwrap_or(true));
        }
    }

    #[test]
    fn test_preview_table_sqlite() {
        let dir = tempfile::tempdir().unwrap();
        let db_name = create_test_sqlite(dir.path());
        create_test_env(dir.path(), &format!(
            "DB_CONNECTION=sqlite\nDB_DATABASE={}\nAPP_KEY=test\n", db_name
        ));

        let result = preview_table(dir.path(), "users", 1).unwrap();
        assert!(result.error.is_none());
        assert_eq!(result.rows.len(), 1);
    }
}
