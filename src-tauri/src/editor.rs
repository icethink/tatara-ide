// ⚒️ Tatara IDE — Editor Core
//
// Phase 1 MVP:
// - Text buffer management (ropey)
// - tree-sitter integration for syntax highlighting
// - Basic editing operations (insert, delete, selection)
// - Line operations (duplicate, move, delete line)
// - Multi-cursor support
// - Bracket matching & auto-close

use ropey::Rope;
use serde::{Deserialize, Serialize};

/// Represents an open document in the editor
#[derive(Debug)]
pub struct Document {
    /// File path (None for untitled)
    pub path: Option<String>,
    /// Text content buffer
    pub content: Rope,
    /// Whether the document has unsaved changes
    pub modified: bool,
    /// Character encoding
    pub encoding: Encoding,
    /// Line ending style
    pub line_ending: LineEnding,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Encoding {
    Utf8,
    ShiftJis,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum LineEnding {
    Lf,
    CrLf,
}

impl Document {
    pub fn new() -> Self {
        Self {
            path: None,
            content: Rope::new(),
            modified: false,
            encoding: Encoding::Utf8,
            line_ending: LineEnding::Lf,
        }
    }

    pub fn from_str(text: &str) -> Self {
        Self {
            path: None,
            content: Rope::from_str(text),
            modified: false,
            encoding: Encoding::Utf8,
            line_ending: LineEnding::Lf,
        }
    }

    pub fn line_count(&self) -> usize {
        self.content.len_lines()
    }
}

/// Cursor position in the editor
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
    pub line: usize,
    pub column: usize,
}

/// A selection range in the editor
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Selection {
    pub anchor: Position,
    pub head: Position,
}
