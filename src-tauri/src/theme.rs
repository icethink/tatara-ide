// ⚒️ Tatara IDE — Theme System
//
// Two-layer theme system:
// Layer 1: UI Theme (window, sidebar, status bar colors)
// Layer 2: Syntax Theme (code highlighting colors)
//
// Themes are defined in TOML files.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Complete theme (UI + Syntax combined for frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub meta: ThemeMeta,
    pub colors: HashMap<String, String>, // Flat map of token -> color
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeMeta {
    pub name: String,
    #[serde(rename = "type")]
    pub theme_type: String, // "dark" | "light" | "high-contrast"
    pub author: Option<String>,
}

/// Built-in theme names
pub const BUILTIN_THEMES: &[(&str, &str)] = &[
    ("midnight", "dark"),
    ("abyss", "dark"),
    ("dracula", "dark"),
    ("forest", "dark"),
    ("daylight", "light"),
    ("paper", "light"),
    ("snow", "light"),
    ("high-contrast", "high-contrast"),
];

/// Load a theme from TOML file
pub fn load_theme_file(path: &Path) -> Result<Theme, String> {
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    parse_theme_toml(&content)
}

/// Parse theme TOML into flat color map
fn parse_theme_toml(content: &str) -> Result<Theme, String> {
    let value: toml::Value = content.parse().map_err(|e: toml::de::Error| e.to_string())?;

    let meta = ThemeMeta {
        name: value
            .get("meta")
            .and_then(|m| m.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string(),
        theme_type: value
            .get("meta")
            .and_then(|m| m.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("dark")
            .to_string(),
        author: value
            .get("meta")
            .and_then(|m| m.get("author"))
            .and_then(|v| v.as_str())
            .map(String::from),
    };

    let mut colors = HashMap::new();

    // Flatten nested TOML into "section.key" format
    if let Some(colors_table) = value.get("colors") {
        flatten_toml(colors_table, "", &mut colors);
    }
    if let Some(syntax_table) = value.get("syntax") {
        flatten_toml(syntax_table, "syntax.", &mut colors);
    }

    Ok(Theme { meta, colors })
}

fn flatten_toml(value: &toml::Value, prefix: &str, out: &mut HashMap<String, String>) {
    if let Some(table) = value.as_table() {
        for (key, val) in table {
            let full_key = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{}{}", prefix, key)
            };

            match val {
                toml::Value::String(s) => {
                    out.insert(full_key, s.clone());
                }
                toml::Value::Table(_) => {
                    flatten_toml(val, &format!("{}.", full_key), out);
                }
                _ => {}
            }
        }
    }
}

/// Convert theme colors to CSS custom properties
pub fn theme_to_css_vars(theme: &Theme) -> String {
    let mut css = String::from(":root {\n");

    for (key, value) in &theme.colors {
        let css_var = key.replace('.', "-");
        css.push_str(&format!("  --{}: {};\n", css_var, value));
    }

    css.push_str("}\n");
    css
}

/// List available themes (built-in + user)
pub fn list_themes(user_theme_dir: Option<&Path>) -> Vec<ThemeInfo> {
    let mut themes: Vec<ThemeInfo> = BUILTIN_THEMES
        .iter()
        .map(|(name, ttype)| ThemeInfo {
            name: name.to_string(),
            theme_type: ttype.to_string(),
            is_builtin: true,
            path: None,
        })
        .collect();

    // Scan user themes directory
    if let Some(dir) = user_theme_dir {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("toml") {
                        if let Ok(theme) = load_theme_file(&path) {
                            themes.push(ThemeInfo {
                                name: theme.meta.name,
                                theme_type: theme.meta.theme_type,
                                is_builtin: false,
                                path: Some(path.to_string_lossy().to_string()),
                            });
                        }
                    }
                }
            }
        }
    }

    themes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeInfo {
    pub name: String,
    pub theme_type: String,
    pub is_builtin: bool,
    pub path: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_theme() {
        let toml_content = r##"
[meta]
name = "Test Theme"
type = "dark"

[colors.base]
background = "#1E1E2E"
foreground = "#CDD6F4"

[colors.editor]
background = "#1E1E2E"
cursor = "#F5E0DC"
"##;
        let theme = parse_theme_toml(toml_content).unwrap();
        assert_eq!(theme.meta.name, "Test Theme");
        assert_eq!(theme.meta.theme_type, "dark");
        assert!(theme.colors.get("base.background").is_some());
        assert!(theme.colors.get("editor.cursor").is_some());
    }

    #[test]
    fn test_css_vars() {
        let mut colors = HashMap::new();
        colors.insert("base.background".into(), "#1E1E2E".into());
        colors.insert("editor.cursor".into(), "#F5E0DC".into());
        let theme = Theme {
            meta: ThemeMeta { name: "test".into(), theme_type: "dark".into(), author: None },
            colors,
        };
        let css = theme_to_css_vars(&theme);
        assert!(css.contains("--base-background:"));
        assert!(css.contains("--editor-cursor:"));
    }

    #[test]
    fn test_list_builtin_themes() {
        let themes = list_themes(None);
        assert_eq!(themes.len(), 8);
        assert!(themes.iter().any(|t| t.name == "midnight"));
        assert!(themes.iter().any(|t| t.name == "dracula"));
    }

    #[test]
    fn test_parse_syntax_theme() {
        let toml_content = r##"
[meta]
name = "Test Syntax"
type = "dark"

[syntax]
comment = "#6C7086"
string = "#A6E3A1"
keyword = "#CBA6F7"
"##;
        let theme = parse_theme_toml(toml_content).unwrap();
        assert!(theme.colors.get("syntax.comment").is_some());
        assert!(theme.colors.get("syntax.keyword").is_some());
    }
}
