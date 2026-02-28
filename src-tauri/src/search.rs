// ⚒️ Tatara IDE — Search Module
//
// Full-text search powered by ripgrep-like file walking + pattern matching.
// Uses the `ignore` crate (same core as ripgrep) for .gitignore-aware walking
// and `globset` for file filtering.

use globset::{Glob, GlobSetBuilder};
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// A single search match
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// Search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub matches: Vec<SearchMatch>,
    pub total_files_searched: usize,
    pub total_matches: usize,
    pub truncated: bool,
}

/// Search options
#[derive(Debug, Clone, Deserialize)]
pub struct SearchOptions {
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub include_pattern: Option<String>, // e.g., "*.blade.php"
    pub exclude_pattern: Option<String>,
    pub max_results: usize,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            query: String::new(),
            case_sensitive: false,
            whole_word: false,
            regex: false,
            include_pattern: None,
            exclude_pattern: None,
            max_results: 1000,
        }
    }
}

/// Perform a full-text search across project files
pub fn search_in_files(root: &Path, options: &SearchOptions) -> SearchResults {
    let mut matches = Vec::new();
    let mut total_files = 0;
    let mut truncated = false;

    // Build include glob filter
    let include_glob = options.include_pattern.as_ref().and_then(|p| {
        let mut builder = GlobSetBuilder::new();
        for pattern in p.split(',').map(str::trim) {
            if let Ok(g) = Glob::new(pattern) {
                builder.add(g);
            }
        }
        builder.build().ok()
    });

    // Build exclude glob filter
    let exclude_glob = options.exclude_pattern.as_ref().and_then(|p| {
        let mut builder = GlobSetBuilder::new();
        for pattern in p.split(',').map(str::trim) {
            if let Ok(g) = Glob::new(pattern) {
                builder.add(g);
            }
        }
        builder.build().ok()
    });

    // Prepare query for matching
    let query = if options.case_sensitive {
        options.query.clone()
    } else {
        options.query.to_lowercase()
    };

    // Walk files
    let walker = WalkBuilder::new(root)
        .hidden(true) // Skip hidden files (but .env is important — handled separately)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .build();

    for entry in walker.flatten() {
        let path = entry.path();

        // Skip directories
        if path.is_dir() {
            continue;
        }

        // Skip binary files (simple heuristic)
        if is_likely_binary(path) {
            continue;
        }

        // Apply include filter
        if let Some(ref glob) = include_glob {
            if !glob.is_match(path) {
                continue;
            }
        }

        // Apply exclude filter
        if let Some(ref glob) = exclude_glob {
            if glob.is_match(path) {
                continue;
            }
        }

        total_files += 1;

        // Read and search file
        if let Ok(content) = std::fs::read_to_string(path) {
            for (line_idx, line) in content.lines().enumerate() {
                let search_line = if options.case_sensitive {
                    line.to_string()
                } else {
                    line.to_lowercase()
                };

                // Find all occurrences in line
                let mut start = 0;
                while let Some(pos) = search_line[start..].find(&query) {
                    let match_start = start + pos;
                    let match_end = match_start + query.len();

                    // Check whole word boundary
                    if options.whole_word {
                        let before_ok = match_start == 0
                            || !search_line.as_bytes()[match_start - 1].is_ascii_alphanumeric();
                        let after_ok = match_end >= search_line.len()
                            || !search_line.as_bytes()[match_end].is_ascii_alphanumeric();
                        if !before_ok || !after_ok {
                            start = match_start + 1;
                            continue;
                        }
                    }

                    matches.push(SearchMatch {
                        path: path
                            .strip_prefix(root)
                            .unwrap_or(path)
                            .to_string_lossy()
                            .to_string(),
                        line_number: line_idx + 1,
                        line_content: line.to_string(),
                        match_start,
                        match_end,
                    });

                    if matches.len() >= options.max_results {
                        truncated = true;
                        break;
                    }

                    start = match_start + 1;
                }

                if truncated {
                    break;
                }
            }
        }

        if truncated {
            break;
        }
    }

    let total_matches = matches.len();
    SearchResults {
        matches,
        total_files_searched: total_files,
        total_matches,
        truncated,
    }
}

/// Simple heuristic to skip binary files
fn is_likely_binary(path: &Path) -> bool {
    let binary_extensions = [
        "png", "jpg", "jpeg", "gif", "webp", "ico", "svg",
        "woff", "woff2", "ttf", "otf", "eot",
        "zip", "tar", "gz", "bz2", "7z", "rar",
        "pdf", "doc", "docx", "xls", "xlsx",
        "exe", "dll", "so", "dylib",
        "o", "a", "lib",
        "mp3", "mp4", "avi", "mov", "webm",
        "sqlite", "db",
    ];

    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| binary_extensions.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_search_basic() {
        let dir = std::env::temp_dir().join("tatara_search_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("test.php"), "<?php\necho 'hello world';\necho 'hello again';\n").unwrap();
        fs::write(dir.join("test.js"), "console.log('hello');\n").unwrap();

        let results = search_in_files(
            &dir,
            &SearchOptions {
                query: "hello".into(),
                ..Default::default()
            },
        );

        assert_eq!(results.total_matches, 3);
        assert_eq!(results.total_files_searched, 2);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_search_case_sensitive() {
        let dir = std::env::temp_dir().join("tatara_search_case");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("test.php"), "Hello\nhello\nHELLO\n").unwrap();

        let results = search_in_files(
            &dir,
            &SearchOptions {
                query: "Hello".into(),
                case_sensitive: true,
                ..Default::default()
            },
        );

        assert_eq!(results.total_matches, 1);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_search_with_filter() {
        let dir = std::env::temp_dir().join("tatara_search_filter");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        fs::write(dir.join("test.php"), "hello\n").unwrap();
        fs::write(dir.join("test.js"), "hello\n").unwrap();

        let results = search_in_files(
            &dir,
            &SearchOptions {
                query: "hello".into(),
                include_pattern: Some("*.php".into()),
                ..Default::default()
            },
        );

        assert_eq!(results.total_matches, 1);

        let _ = fs::remove_dir_all(&dir);
    }
}
