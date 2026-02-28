// ⚒️ Tatara IDE — Settings Management
//
// Settings are loaded from:
// 1. Built-in defaults (PHPStorm best practices)
// 2. User settings (~/.tatara/settings.toml)
// 3. Project settings (.tatara/profile.toml)
//
// Project settings override user settings override defaults.

use serde::{Deserialize, Serialize};

/// Global IDE settings (~/.tatara/settings.toml)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub editor: EditorSettings,
    pub terminal: TerminalSettings,
    pub theme: ThemeSettings,
    pub locale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorSettings {
    pub font_family: String,
    pub font_size: u32,
    pub font_ligatures: bool,
    pub line_numbers: bool,
    pub show_whitespace: ShowWhitespace,
    pub highlight_current_line: bool,
    pub word_wrap: bool,
    pub indent_size: u32,
    pub indent_style: IndentStyle,
    pub encoding: String,
    pub line_ending: String,
    pub auto_save: bool,
    pub format_on_save: bool,
    pub rainbow_brackets: bool,
    pub breadcrumbs: bool,
    pub minimap: bool,
    pub indent_guides: bool,
    pub git_gutter: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShowWhitespace {
    None,
    Trailing,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IndentStyle {
    Spaces,
    Tabs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSettings {
    pub default_shell: String,
    pub wsl_distro: String,
    pub input_mode: String,
    pub ctrl_c_behavior: String,
    pub multiline_confirm: bool,
    pub dangerous_command_warn: bool,
    pub font_size: u32,
    pub cursor_style: String,
    pub scrollback_lines: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeSettings {
    pub ui: String,
    pub syntax: String,
    pub follow_os: bool,
    pub dark_theme: String,
    pub light_theme: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            editor: EditorSettings {
                font_family: "JetBrains Mono".into(),
                font_size: 15,
                font_ligatures: true,
                line_numbers: true,
                show_whitespace: ShowWhitespace::Trailing,
                highlight_current_line: true,
                word_wrap: false,
                indent_size: 4,
                indent_style: IndentStyle::Spaces,
                encoding: "utf-8".into(),
                line_ending: "lf".into(),
                auto_save: true,
                format_on_save: true,
                rainbow_brackets: true,
                breadcrumbs: true,
                minimap: true,
                indent_guides: true,
                git_gutter: true,
            },
            terminal: TerminalSettings {
                default_shell: "wsl".into(),
                wsl_distro: "Ubuntu".into(),
                input_mode: "edit".into(),
                ctrl_c_behavior: "smart".into(),
                multiline_confirm: true,
                dangerous_command_warn: true,
                font_size: 15,
                cursor_style: "block".into(),
                scrollback_lines: 10000,
            },
            theme: ThemeSettings {
                ui: "midnight".into(),
                syntax: "midnight".into(),
                follow_os: true,
                dark_theme: "midnight".into(),
                light_theme: "daylight".into(),
            },
            locale: "ja".into(),
        }
    }
}
