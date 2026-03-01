// ⚒️ Tatara IDE — File System Module
//
// Handles:
// - Directory tree listing (respecting .gitignore)
// - File read/write with encoding detection
// - WSL path translation (Windows ↔ WSL)
// - File watching for external changes

use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// A node in the file tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// Default directories to exclude from file tree
const DEFAULT_EXCLUDES: &[&str] = &[
    "node_modules",
    "vendor",
    ".git",
    "storage/framework/cache",
    "storage/logs",
    "bootstrap/cache",
    ".idea",
    ".vscode",
    "target", // Rust build output
];

/// Read a directory tree, respecting .gitignore and default excludes
pub fn read_directory_tree(root: &Path, max_depth: usize) -> Option<FileNode> {
    if !root.exists() || !root.is_dir() {
        return None;
    }

    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string_lossy().to_string());

    let children = collect_children(root, 0, max_depth);

    Some(FileNode {
        name,
        path: root.to_string_lossy().to_string(),
        is_dir: true,
        children: Some(children),
    })
}

fn collect_children(dir: &Path, depth: usize, max_depth: usize) -> Vec<FileNode> {
    if depth >= max_depth {
        return vec![];
    }

    let mut entries: Vec<FileNode> = Vec::new();

    // Use ignore crate to respect .gitignore
    let walker = WalkBuilder::new(dir)
        .max_depth(Some(1))
        .hidden(false) // Show dotfiles like .env
        .git_ignore(true) // Respect .gitignore
        .git_global(false)
        .git_exclude(true)
        .build();

    for entry in walker.flatten() {
        let path = entry.path();

        // Skip the root directory itself
        if path == dir {
            continue;
        }

        let name = match path.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };

        // Skip default excludes
        if DEFAULT_EXCLUDES.contains(&name.as_str()) {
            continue;
        }

        let is_dir = path.is_dir();
        let children = if is_dir {
            Some(collect_children(path, depth + 1, max_depth))
        } else {
            None
        };

        entries.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    // Sort: directories first, then alphabetical
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    entries
}

/// Read file content as UTF-8 string
/// Handles BOM detection and Shift-JIS fallback
pub fn read_file_content(path: &Path) -> Result<FileContent, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;

    // Detect BOM
    let (content, encoding) = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        // UTF-8 BOM
        (String::from_utf8_lossy(&bytes[3..]).to_string(), "utf-8-bom")
    } else if bytes.starts_with(&[0xFF, 0xFE]) {
        // UTF-16 LE
        let chars: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        (String::from_utf16_lossy(&chars), "utf-16le")
    } else {
        // Try UTF-8 first
        match String::from_utf8(bytes.clone()) {
            Ok(s) => (s, "utf-8"),
            Err(_) => {
                // Try Shift-JIS (common in Japanese PHP projects)
                // TODO: Use encoding_rs crate for proper detection
                (String::from_utf8_lossy(&bytes).to_string(), "utf-8-fallback")
            }
        }
    };

    // Detect line ending
    let line_ending = if content.contains("\r\n") {
        "crlf"
    } else {
        "lf"
    };

    let line_count = content.lines().count();
    Ok(FileContent {
        content,
        encoding: encoding.to_string(),
        line_ending: line_ending.to_string(),
        line_count,
    })
}

/// Write file content, respecting encoding and line ending settings
pub fn write_file_content(
    path: &Path,
    content: &str,
    line_ending: &str,
) -> Result<(), String> {
    let output = if line_ending == "crlf" {
        content.replace('\n', "\r\n")
    } else {
        // Normalize to LF (design doc default)
        content.replace("\r\n", "\n")
    };

    std::fs::write(path, output.as_bytes()).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub content: String,
    pub encoding: String,
    pub line_ending: String,
    pub line_count: usize,
}

/// Detect if a path is inside WSL
pub fn is_wsl_path(path: &str) -> bool {
    path.starts_with("/mnt/") || path.contains("\\\\wsl") || path.contains("//wsl")
}

/// Normalize path for cross-platform compatibility.
/// Handles:
/// - \\wsl$\Ubuntu\home\user\project → /home/user/project (for WSL commands)
/// - \\wsl.localhost\Ubuntu\... → same
/// - Regular Windows paths stay as-is
pub fn normalize_path(path: &str) -> String {
    let p = path.replace('\\', "/");

    // \\wsl$\distro\... or \\wsl.localhost\distro\...
    if let Some(rest) = p.strip_prefix("//wsl$/") .or_else(|| p.strip_prefix("//wsl.localhost/")) {
        // Skip distro name (e.g., "Ubuntu/")
        if let Some(idx) = rest.find('/') {
            return rest[idx..].to_string();
        }
    }

    // Also handle the raw \\wsl$ form
    if p.starts_with("//wsl$") || p.starts_with("//wsl.localhost") {
        // Try to extract after distro
        let parts: Vec<&str> = p.splitn(4, '/').collect();
        if parts.len() >= 4 {
            return format!("/{}", parts[3]);
        }
    }

    path.to_string()
}

/// Warn if project is on Windows filesystem (slow I/O)
pub fn check_wsl_path_warning(project_path: &str) -> Option<String> {
    let normalized = normalize_path(project_path);
    if normalized.starts_with("/mnt/c/") || normalized.starts_with("/mnt/d/") {
        Some(
            "⚠️ プロジェクトが Windows ファイルシステム上にあります。\n\
             WSL ネイティブパス（~/projects/ 等）に移動すると大幅に高速化されます。"
                .to_string(),
        )
    } else {
        None
    }
}

/// Convert a Windows/WSL path to the form needed for file operations.
/// On Windows, \\wsl$ paths can be used directly.
/// This returns the path suitable for std::fs operations.
pub fn resolve_project_path(path: &str) -> String {
    // On Windows, \\wsl$ UNC paths work with std::fs
    // Just normalize backslashes
    if path.contains("wsl$") || path.contains("wsl.localhost") {
        return path.replace('/', "\\");
    }
    path.to_string()
}

/// Detect Laravel project by checking for artisan and composer.json
pub fn detect_framework(project_path: &Path) -> Option<FrameworkInfo> {
    let composer_path = project_path.join("composer.json");
    if !composer_path.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&composer_path).ok()?;

    if content.contains("\"laravel/framework\"") {
        // Extract Laravel version from composer.lock if available
        let version = extract_laravel_version(project_path);
        Some(FrameworkInfo {
            name: "laravel".to_string(),
            version,
        })
    } else if content.contains("\"symfony/symfony\"") || content.contains("\"symfony/framework-bundle\"") {
        Some(FrameworkInfo {
            name: "symfony".to_string(),
            version: None,
        })
    } else {
        Some(FrameworkInfo {
            name: "php".to_string(),
            version: None,
        })
    }
}

fn extract_laravel_version(project_path: &Path) -> Option<String> {
    let lock_path = project_path.join("composer.lock");
    let content = std::fs::read_to_string(&lock_path).ok()?;
    // Simple extraction — look for laravel/framework version
    let idx = content.find("\"laravel/framework\"")?;
    let rest = &content[idx..];
    let ver_idx = rest.find("\"version\":")?;
    let ver_rest = &rest[ver_idx + 11..];
    let quote_idx = ver_rest.find('"')?;
    let ver_end = ver_rest[quote_idx + 1..].find('"')?;
    Some(ver_rest[quote_idx + 1..quote_idx + 1 + ver_end].to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameworkInfo {
    pub name: String,
    pub version: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_wsl_path_detection() {
        assert!(is_wsl_path("/mnt/c/Users/user/project"));
        assert!(is_wsl_path("\\\\wsl$\\Ubuntu\\home\\user"));
        assert!(is_wsl_path("\\\\wsl.localhost\\Ubuntu\\home\\user"));
        assert!(!is_wsl_path("/home/user/projects/app"));
        assert!(!is_wsl_path("C:\\Users\\user\\project"));
    }

    #[test]
    fn test_normalize_path() {
        assert_eq!(
            normalize_path("\\\\wsl$\\Ubuntu\\home\\user\\project"),
            "/home/user/project"
        );
        assert_eq!(
            normalize_path("\\\\wsl.localhost\\Ubuntu\\home\\user\\project"),
            "/home/user/project"
        );
        assert_eq!(
            normalize_path("C:\\Users\\user\\project"),
            "C:\\Users\\user\\project"
        );
        assert_eq!(
            normalize_path("/home/user/project"),
            "/home/user/project"
        );
    }

    #[test]
    fn test_wsl_path_warning() {
        assert!(check_wsl_path_warning("/mnt/c/Users/user/project").is_some());
        assert!(check_wsl_path_warning("/home/user/projects/app").is_none());
    }

    #[test]
    fn test_read_directory_tree() {
        let dir = std::env::temp_dir().join("tatara_test_tree");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("src")).unwrap();
        fs::write(dir.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(dir.join("README.md"), "# Test").unwrap();

        let tree = read_directory_tree(&dir, 3).unwrap();
        assert_eq!(tree.is_dir, true);
        let children = tree.children.unwrap();
        assert!(children.len() >= 2); // src/ and README.md

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_file_read_write() {
        let dir = std::env::temp_dir().join("tatara_test_rw");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let file = dir.join("test.php");
        let content = "<?php\necho 'Hello';\n";
        write_file_content(&file, content, "lf").unwrap();

        let result = read_file_content(&file).unwrap();
        assert_eq!(result.content, content);
        assert_eq!(result.encoding, "utf-8");
        assert_eq!(result.line_ending, "lf");
        assert_eq!(result.line_count, 2);

        let _ = fs::remove_dir_all(&dir);
    }
}
