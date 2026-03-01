// ⚒️ Tatara IDE — Git Integration
//
// Git operations via CLI commands (no libgit2 dependency).
// Provides: status, diff, log, branch, stage, commit, stash

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<FileChange>,
    pub modified: Vec<FileChange>,
    pub untracked: Vec<String>,
    pub is_repo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub path: String,
    pub status: ChangeStatus,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ChangeStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    Untracked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitDiff {
    pub file: String,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub content: String,
    pub line_type: DiffLineType,
    pub old_line: Option<usize>,
    pub new_line: Option<usize>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DiffLineType {
    Context,
    Added,
    Removed,
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("git実行エラー: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(stderr)
    }
}

/// Check if directory is a git repo
pub fn is_git_repo(path: &Path) -> bool {
    run_git(path, &["rev-parse", "--is-inside-work-tree"]).is_ok()
}

/// Get current branch name
pub fn current_branch(path: &Path) -> Result<String, String> {
    run_git(path, &["branch", "--show-current"])
        .map(|s| s.trim().to_string())
}

/// Get full git status
pub fn status(path: &Path) -> Result<GitStatus, String> {
    if !is_git_repo(path) {
        return Ok(GitStatus {
            branch: String::new(),
            ahead: 0,
            behind: 0,
            staged: vec![],
            modified: vec![],
            untracked: vec![],
            is_repo: false,
        });
    }

    let branch = current_branch(path).unwrap_or_else(|_| "HEAD".into());

    // Ahead/behind
    let (ahead, behind) = get_ahead_behind(path).unwrap_or((0, 0));

    // Porcelain v2 status
    let output = run_git(path, &["status", "--porcelain=v2", "--branch"])?;

    let mut staged = Vec::new();
    let mut modified = Vec::new();
    let mut untracked = Vec::new();

    for line in output.lines() {
        if line.starts_with('1') || line.starts_with('2') {
            // Changed entry
            let parts: Vec<&str> = line.splitn(9, ' ').collect();
            if parts.len() >= 9 {
                let xy = parts[1];
                let file_path = parts[8].to_string();
                let x = xy.chars().next().unwrap_or('.');
                let y = xy.chars().nth(1).unwrap_or('.');

                if x != '.' {
                    staged.push(FileChange {
                        path: file_path.clone(),
                        status: char_to_status(x),
                    });
                }
                if y != '.' {
                    modified.push(FileChange {
                        path: file_path,
                        status: char_to_status(y),
                    });
                }
            }
        } else if line.starts_with('?') {
            // Untracked
            let path = line[2..].to_string();
            untracked.push(path);
        }
    }

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        modified,
        untracked,
        is_repo: true,
    })
}

fn get_ahead_behind(path: &Path) -> Result<(usize, usize), String> {
    let output = run_git(path, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])?;
    let parts: Vec<&str> = output.trim().split('\t').collect();
    if parts.len() == 2 {
        let ahead = parts[0].parse().unwrap_or(0);
        let behind = parts[1].parse().unwrap_or(0);
        Ok((ahead, behind))
    } else {
        Ok((0, 0))
    }
}

fn char_to_status(c: char) -> ChangeStatus {
    match c {
        'A' => ChangeStatus::Added,
        'M' => ChangeStatus::Modified,
        'D' => ChangeStatus::Deleted,
        'R' => ChangeStatus::Renamed,
        'C' => ChangeStatus::Copied,
        _ => ChangeStatus::Modified,
    }
}

/// Get git log
pub fn log(path: &Path, count: usize) -> Result<Vec<GitLogEntry>, String> {
    let format = "--format=%H%n%h%n%an%n%ar%n%s";
    let output = run_git(path, &["log", format, &format!("-{}", count)])?;

    let lines: Vec<&str> = output.lines().collect();
    let mut entries = Vec::new();

    for chunk in lines.chunks(5) {
        if chunk.len() == 5 {
            entries.push(GitLogEntry {
                hash: chunk[0].to_string(),
                short_hash: chunk[1].to_string(),
                author: chunk[2].to_string(),
                date: chunk[3].to_string(),
                message: chunk[4].to_string(),
            });
        }
    }

    Ok(entries)
}

/// Get diff for a specific file
pub fn diff_file(path: &Path, file: &str) -> Result<GitDiff, String> {
    let output = run_git(path, &["diff", "--", file])?;
    Ok(parse_diff(&output, file))
}

/// Get staged diff for a file
pub fn diff_staged(path: &Path, file: &str) -> Result<GitDiff, String> {
    let output = run_git(path, &["diff", "--cached", "--", file])?;
    Ok(parse_diff(&output, file))
}

fn parse_diff(output: &str, file: &str) -> GitDiff {
    let mut hunks = Vec::new();
    let mut current_hunk: Option<DiffHunk> = None;
    let mut old_line: usize = 0;
    let mut new_line: usize = 0;

    for line in output.lines() {
        if line.starts_with("@@") {
            // Save previous hunk
            if let Some(hunk) = current_hunk.take() {
                hunks.push(hunk);
            }

            // Parse hunk header: @@ -a,b +c,d @@
            if let Some((old_start, new_start)) = parse_hunk_header(line) {
                old_line = old_start;
                new_line = new_start;
            }

            current_hunk = Some(DiffHunk {
                header: line.to_string(),
                lines: Vec::new(),
            });
        } else if let Some(ref mut hunk) = current_hunk {
            if let Some(stripped) = line.strip_prefix('+') {
                hunk.lines.push(DiffLine {
                    content: stripped.to_string(),
                    line_type: DiffLineType::Added,
                    old_line: None,
                    new_line: Some(new_line),
                });
                new_line += 1;
            } else if let Some(stripped) = line.strip_prefix('-') {
                hunk.lines.push(DiffLine {
                    content: stripped.to_string(),
                    line_type: DiffLineType::Removed,
                    old_line: Some(old_line),
                    new_line: None,
                });
                old_line += 1;
            } else if let Some(stripped) = line.strip_prefix(' ') {
                hunk.lines.push(DiffLine {
                    content: stripped.to_string(),
                    line_type: DiffLineType::Context,
                    old_line: Some(old_line),
                    new_line: Some(new_line),
                });
                old_line += 1;
                new_line += 1;
            }
        }
    }

    if let Some(hunk) = current_hunk {
        hunks.push(hunk);
    }

    GitDiff {
        file: file.to_string(),
        hunks,
    }
}

fn parse_hunk_header(header: &str) -> Option<(usize, usize)> {
    // @@ -1,5 +1,7 @@
    let parts: Vec<&str> = header.split(' ').collect();
    if parts.len() >= 4 {
        let old_start = parts[1]
            .trim_start_matches('-')
            .split(',')
            .next()?
            .parse()
            .ok()?;
        let new_start = parts[2]
            .trim_start_matches('+')
            .split(',')
            .next()?
            .parse()
            .ok()?;
        Some((old_start, new_start))
    } else {
        None
    }
}

/// Stage a file
pub fn stage_file(path: &Path, file: &str) -> Result<(), String> {
    run_git(path, &["add", file]).map(|_| ())
}

/// Unstage a file
pub fn unstage_file(path: &Path, file: &str) -> Result<(), String> {
    run_git(path, &["restore", "--staged", file]).map(|_| ())
}

/// Commit staged changes
pub fn commit(path: &Path, message: &str) -> Result<String, String> {
    run_git(path, &["commit", "-m", message])
}

/// Discard changes in a file
pub fn discard_changes(path: &Path, file: &str) -> Result<(), String> {
    run_git(path, &["checkout", "--", file]).map(|_| ())
}

/// List branches
pub fn branches(path: &Path) -> Result<Vec<String>, String> {
    let output = run_git(path, &["branch", "--format=%(refname:short)"])?;
    Ok(output.lines().map(|l| l.to_string()).collect())
}

/// Stash
pub fn stash(path: &Path) -> Result<String, String> {
    run_git(path, &["stash"])
}

/// Stash pop
pub fn stash_pop(path: &Path) -> Result<String, String> {
    run_git(path, &["stash", "pop"])
}

/// Get gutter decorations (line-level changed/added/removed indicators)
pub fn gutter_decorations(path: &Path, file: &str) -> Result<Vec<GutterDecoration>, String> {
    let output = run_git(path, &["diff", "--unified=0", "--", file])?;
    let mut decorations = Vec::new();

    for line in output.lines() {
        if line.starts_with("@@") {
            if let Some((old_start, new_start)) = parse_hunk_header(line) {
                // Parse the range counts
                let parts: Vec<&str> = line.split(' ').collect();
                if parts.len() >= 4 {
                    let old_count: usize = parts[1]
                        .split(',')
                        .nth(1)
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(1);
                    let new_count: usize = parts[2]
                        .split(',')
                        .nth(1)
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(1);

                    if old_count == 0 {
                        // Pure addition
                        for i in 0..new_count {
                            decorations.push(GutterDecoration {
                                line: new_start + i,
                                kind: GutterKind::Added,
                            });
                        }
                    } else if new_count == 0 {
                        // Pure deletion — mark the line after
                        decorations.push(GutterDecoration {
                            line: new_start,
                            kind: GutterKind::Deleted,
                        });
                    } else {
                        // Modification
                        for i in 0..new_count {
                            decorations.push(GutterDecoration {
                                line: new_start + i,
                                kind: GutterKind::Modified,
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(decorations)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GutterDecoration {
    pub line: usize,
    pub kind: GutterKind,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum GutterKind {
    Added,
    Modified,
    Deleted,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_char_to_status() {
        assert_eq!(char_to_status('A'), ChangeStatus::Added);
        assert_eq!(char_to_status('M'), ChangeStatus::Modified);
        assert_eq!(char_to_status('D'), ChangeStatus::Deleted);
    }

    #[test]
    fn test_parse_hunk_header() {
        let (old, new) = parse_hunk_header("@@ -1,5 +1,7 @@ fn main()").unwrap();
        assert_eq!(old, 1);
        assert_eq!(new, 1);

        let (old, new) = parse_hunk_header("@@ -42,3 +45,10 @@").unwrap();
        assert_eq!(old, 42);
        assert_eq!(new, 45);
    }

    #[test]
    fn test_parse_diff() {
        let diff_output = r#"@@ -1,3 +1,4 @@
 line1
+added
 line2
 line3
"#;
        let diff = parse_diff(diff_output, "test.php");
        assert_eq!(diff.hunks.len(), 1);
        assert_eq!(diff.hunks[0].lines.len(), 4);
        assert!(matches!(diff.hunks[0].lines[1].line_type, DiffLineType::Added));
        assert_eq!(diff.hunks[0].lines[1].content, "added");
    }

    #[test]
    fn test_is_git_repo() {
        // The tatara-ide project itself is a git repo
        let project = Path::new(env!("CARGO_MANIFEST_DIR"));
        assert!(is_git_repo(project));

        // /tmp is not
        assert!(!is_git_repo(Path::new("/tmp")));
    }

    #[test]
    fn test_current_branch() {
        let project = Path::new(env!("CARGO_MANIFEST_DIR"));
        let branch = current_branch(project);
        assert!(branch.is_ok());
    }

    #[test]
    fn test_status() {
        let project = Path::new(env!("CARGO_MANIFEST_DIR"));
        let st = status(project).unwrap();
        assert!(st.is_repo);
        assert!(!st.branch.is_empty());
    }

    #[test]
    fn test_log() {
        let project = Path::new(env!("CARGO_MANIFEST_DIR"));
        let entries = log(project, 3).unwrap();
        assert!(!entries.is_empty());
        assert!(!entries[0].hash.is_empty());
        assert!(!entries[0].message.is_empty());
    }

    #[test]
    fn test_branches() {
        let project = Path::new(env!("CARGO_MANIFEST_DIR"));
        let br = branches(project).unwrap();
        assert!(br.iter().any(|b| b == "main"));
    }
}
