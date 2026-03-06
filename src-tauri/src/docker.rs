// ⚒️ Tatara IDE — Docker / Laravel Sail Module
//
// Manages Docker containers for Laravel projects.
// Auto-detects docker-compose.yml / docker-compose.yaml.
// Supports Laravel Sail (vendor/bin/sail) transparently.
//
// Why CLI? Docker SDK is massive. `docker` / `docker compose` CLI
// is what every dev already has. Same approach as VS Code Docker extension.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// Container info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: ContainerState,
    pub ports: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContainerState {
    Running,
    Stopped,
    Exited,
    Paused,
    Restarting,
    Unknown,
}

/// Docker project info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerProject {
    pub has_docker_compose: bool,
    pub has_sail: bool,
    pub compose_file: Option<String>,
    pub services: Vec<String>,
}

/// Docker log line
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerLogChunk {
    pub service: String,
    pub lines: Vec<String>,
}

// ── Detection ──

/// Detect Docker setup in project
pub fn detect_docker(project_path: &Path) -> DockerProject {
    let compose_files = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
    let compose_file = compose_files.iter()
        .find(|f| project_path.join(f).exists())
        .map(|f| f.to_string());

    let has_sail = project_path.join("vendor/bin/sail").exists();

    let services = if compose_file.is_some() {
        list_compose_services(project_path).unwrap_or_default()
    } else {
        vec![]
    };

    DockerProject {
        has_docker_compose: compose_file.is_some(),
        has_sail,
        compose_file,
        services,
    }
}

/// Check if Docker is available
pub fn docker_available() -> bool {
    Command::new("docker").arg("--version").output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// ── Container Management ──

/// List containers for the project
pub fn list_containers(project_path: &Path) -> Result<Vec<ContainerInfo>, String> {
    let output = compose_cmd(project_path, &["ps", "--format", "json", "-a"])
        .output()
        .map_err(|e| format!("docker compose 実行エラー: {}", e))?;

    if !output.status.success() {
        // Fallback: try docker ps with project filter
        return list_containers_fallback(project_path);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_compose_ps_json(&stdout)
}

fn list_containers_fallback(project_path: &Path) -> Result<Vec<ContainerInfo>, String> {
    let project_name = project_path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric(), "");

    let output = Command::new("docker")
        .args(["ps", "-a", "--format", "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.State}}\t{{.Ports}}\t{{.CreatedAt}}", "--filter", &format!("name={}", project_name)])
        .output()
        .map_err(|e| format!("docker ps エラー: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let containers = stdout.lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            ContainerInfo {
                id: parts.first().unwrap_or(&"").to_string(),
                name: parts.get(1).unwrap_or(&"").to_string(),
                image: parts.get(2).unwrap_or(&"").to_string(),
                status: parts.get(3).unwrap_or(&"").to_string(),
                state: parse_state(parts.get(4).unwrap_or(&"")),
                ports: parts.get(5).unwrap_or(&"").to_string(),
                created: parts.get(6).unwrap_or(&"").to_string(),
            }
        })
        .collect();

    Ok(containers)
}

fn parse_compose_ps_json(stdout: &str) -> Result<Vec<ContainerInfo>, String> {
    let mut containers = vec![];

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
            containers.push(ContainerInfo {
                id: v["ID"].as_str().unwrap_or("").to_string(),
                name: v["Name"].as_str().or(v["Names"].as_str()).unwrap_or("").to_string(),
                image: v["Image"].as_str().unwrap_or("").to_string(),
                status: v["Status"].as_str().unwrap_or("").to_string(),
                state: parse_state(v["State"].as_str().unwrap_or("")),
                ports: v["Ports"].as_str().unwrap_or("").to_string(),
                created: v["CreatedAt"].as_str().unwrap_or("").to_string(),
            });
        }
    }

    Ok(containers)
}

/// Start all services (docker compose up -d)
pub fn compose_up(project_path: &Path) -> Result<String, String> {
    run_compose(project_path, &["up", "-d"])
}

/// Stop all services
pub fn compose_down(project_path: &Path) -> Result<String, String> {
    run_compose(project_path, &["down"])
}

/// Restart a specific service
pub fn compose_restart(project_path: &Path, service: &str) -> Result<String, String> {
    run_compose(project_path, &["restart", service])
}

/// Stop a specific service
pub fn compose_stop(project_path: &Path, service: &str) -> Result<String, String> {
    run_compose(project_path, &["stop", service])
}

/// Start a specific service
pub fn compose_start(project_path: &Path, service: &str) -> Result<String, String> {
    run_compose(project_path, &["start", service])
}

/// Get logs for a service (last N lines)
pub fn compose_logs(project_path: &Path, service: &str, lines: usize) -> Result<DockerLogChunk, String> {
    let output = compose_cmd(project_path, &["logs", "--tail", &lines.to_string(), "--no-color", service])
        .output()
        .map_err(|e| format!("docker compose logs エラー: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let all_output = format!("{}{}", stdout, stderr);

    Ok(DockerLogChunk {
        service: service.to_string(),
        lines: all_output.lines().map(|l| l.to_string()).collect(),
    })
}

// ── Helpers ──

fn list_compose_services(project_path: &Path) -> Result<Vec<String>, String> {
    let output = compose_cmd(project_path, &["config", "--services"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().filter(|l| !l.is_empty()).map(|l| l.trim().to_string()).collect())
}

fn compose_cmd(project_path: &Path, args: &[&str]) -> Command {
    let has_sail = project_path.join("vendor/bin/sail").exists();

    if has_sail {
        let mut cmd = Command::new("./vendor/bin/sail");
        cmd.args(args);
        cmd.current_dir(project_path);
        cmd
    } else {
        let mut cmd = Command::new("docker");
        let mut full_args = vec!["compose"];
        full_args.extend(args);
        cmd.args(&full_args);
        cmd.current_dir(project_path);
        cmd
    }
}

fn run_compose(project_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = compose_cmd(project_path, args)
        .output()
        .map_err(|e| format!("コマンド実行エラー: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(format!("{}{}", stdout, stderr).trim().to_string())
    } else {
        Err(stderr.trim().to_string())
    }
}

fn parse_state(s: &str) -> ContainerState {
    match s.to_lowercase().as_str() {
        "running" => ContainerState::Running,
        "exited" => ContainerState::Exited,
        "paused" => ContainerState::Paused,
        "restarting" => ContainerState::Restarting,
        s if s.contains("up") => ContainerState::Running,
        s if s.contains("exit") => ContainerState::Exited,
        _ => ContainerState::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_docker_no_compose() {
        let dir = std::env::temp_dir().join("tatara-test-no-docker");
        let _ = std::fs::create_dir_all(&dir);
        let info = detect_docker(&dir);
        assert!(!info.has_docker_compose);
        assert!(!info.has_sail);
    }

    #[test]
    fn test_parse_state() {
        assert_eq!(parse_state("running"), ContainerState::Running);
        assert_eq!(parse_state("exited"), ContainerState::Exited);
        assert_eq!(parse_state("Up 2 hours"), ContainerState::Running);
        assert_eq!(parse_state("Exited (0)"), ContainerState::Exited);
    }

    #[test]
    fn test_parse_compose_ps_json() {
        let json = r#"{"ID":"abc123","Name":"app","Image":"laravel","Status":"Up 2h","State":"running","Ports":"8080->80","CreatedAt":"2026-01-01"}"#;
        let containers = parse_compose_ps_json(json).unwrap();
        assert_eq!(containers.len(), 1);
        assert_eq!(containers[0].name, "app");
        assert_eq!(containers[0].state, ContainerState::Running);
    }
}
