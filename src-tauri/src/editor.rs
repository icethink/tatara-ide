// ⚒️ Tatara IDE — Editor Core
//
// Phase 1 MVP:
// - Text buffer management (ropey)
// - Cursor & selection management
// - Basic editing operations (insert, delete, undo/redo)
// - Line operations (duplicate, move, delete line)
// - Bracket matching & auto-close

use ropey::Rope;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

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
    /// Cursor positions (supports multi-cursor)
    pub cursors: Vec<Cursor>,
    /// Undo history
    undo_stack: VecDeque<EditAction>,
    /// Redo history
    redo_stack: Vec<EditAction>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Encoding {
    Utf8,
    Utf8Bom,
    ShiftJis,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum LineEnding {
    Lf,
    CrLf,
}

/// Cursor position in the editor
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Position {
    pub line: usize,   // 0-indexed
    pub column: usize, // 0-indexed, in chars
}

/// A cursor with optional selection
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Cursor {
    pub position: Position,
    pub anchor: Option<Position>, // Selection start (if selecting)
}

/// An edit action for undo/redo
#[derive(Debug, Clone)]
enum EditAction {
    Insert {
        position: Position,
        text: String,
    },
    Delete {
        position: Position,
        text: String,
    },
    Replace {
        position: Position,
        old_text: String,
        new_text: String,
    },
}

/// Serializable document state for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentState {
    pub path: Option<String>,
    pub content: String,
    pub modified: bool,
    pub encoding: String,
    pub line_ending: String,
    pub line_count: usize,
    pub cursors: Vec<Cursor>,
}

const MAX_UNDO_HISTORY: usize = 1000;

/// Bracket pairs for auto-close and matching
const BRACKET_PAIRS: &[(char, char)] = &[
    ('(', ')'),
    ('[', ']'),
    ('{', '}'),
    ('<', '>'),
];

const QUOTE_CHARS: &[char] = &['"', '\'', '`'];

impl Document {
    pub fn new() -> Self {
        Self {
            path: None,
            content: Rope::new(),
            modified: false,
            encoding: Encoding::Utf8,
            line_ending: LineEnding::Lf,
            cursors: vec![Cursor {
                position: Position { line: 0, column: 0 },
                anchor: None,
            }],
            undo_stack: VecDeque::new(),
            redo_stack: Vec::new(),
        }
    }

    pub fn from_str(text: &str) -> Self {
        let line_ending = if text.contains("\r\n") {
            LineEnding::CrLf
        } else {
            LineEnding::Lf
        };
        // Normalize to LF internally
        let normalized = text.replace("\r\n", "\n");
        let content = Rope::from_str(&normalized);
        let line_count = content.len_lines();

        Self {
            path: None,
            content,
            modified: false,
            encoding: Encoding::Utf8,
            line_ending,
            cursors: vec![Cursor {
                position: Position { line: 0, column: 0 },
                anchor: None,
            }],
            undo_stack: VecDeque::new(),
            redo_stack: Vec::new(),
        }
    }

    pub fn line_count(&self) -> usize {
        self.content.len_lines()
    }

    pub fn char_count(&self) -> usize {
        self.content.len_chars()
    }

    /// Get a specific line as string
    pub fn line(&self, line_idx: usize) -> Option<String> {
        if line_idx >= self.content.len_lines() {
            return None;
        }
        let line = self.content.line(line_idx);
        Some(line.to_string().trim_end_matches('\n').to_string())
    }

    /// Get visible lines for rendering (start..end exclusive)
    pub fn visible_lines(&self, start: usize, end: usize) -> Vec<String> {
        let end = end.min(self.content.len_lines());
        (start..end)
            .map(|i| {
                self.content
                    .line(i)
                    .to_string()
                    .trim_end_matches('\n')
                    .to_string()
            })
            .collect()
    }

    /// Convert Position to char index in rope
    fn pos_to_char_idx(&self, pos: &Position) -> usize {
        if pos.line >= self.content.len_lines() {
            return self.content.len_chars();
        }
        let line_start = self.content.line_to_char(pos.line);
        let line_len = self.content.line(pos.line).len_chars();
        // Don't count the newline
        let max_col = if pos.line < self.content.len_lines() - 1 {
            line_len.saturating_sub(1)
        } else {
            line_len
        };
        line_start + pos.column.min(max_col)
    }

    /// Convert char index to Position
    fn char_idx_to_pos(&self, idx: usize) -> Position {
        let idx = idx.min(self.content.len_chars());
        let line = self.content.char_to_line(idx);
        let line_start = self.content.line_to_char(line);
        Position {
            line,
            column: idx - line_start,
        }
    }

    // ── Edit Operations ──

    /// Insert text at primary cursor position
    pub fn insert_text(&mut self, text: &str) {
        let pos = self.cursors[0].position;
        let char_idx = self.pos_to_char_idx(&pos);

        // Record for undo
        self.push_undo(EditAction::Insert {
            position: pos,
            text: text.to_string(),
        });

        self.content.insert(char_idx, text);
        self.modified = true;

        // Move cursor after inserted text
        let new_idx = char_idx + text.chars().count();
        self.cursors[0].position = self.char_idx_to_pos(new_idx);
        self.cursors[0].anchor = None;
    }

    /// Delete character before cursor (backspace)
    pub fn backspace(&mut self) {
        let pos = self.cursors[0].position;
        let char_idx = self.pos_to_char_idx(&pos);

        if char_idx == 0 {
            return;
        }

        let deleted_char = self.content.char(char_idx - 1);
        self.push_undo(EditAction::Delete {
            position: self.char_idx_to_pos(char_idx - 1),
            text: deleted_char.to_string(),
        });

        self.content.remove(char_idx - 1..char_idx);
        self.modified = true;
        self.cursors[0].position = self.char_idx_to_pos(char_idx - 1);
        self.cursors[0].anchor = None;
    }

    /// Delete character at cursor (delete key)
    pub fn delete_forward(&mut self) {
        let pos = self.cursors[0].position;
        let char_idx = self.pos_to_char_idx(&pos);

        if char_idx >= self.content.len_chars() {
            return;
        }

        let deleted_char = self.content.char(char_idx);
        self.push_undo(EditAction::Delete {
            position: pos,
            text: deleted_char.to_string(),
        });

        self.content.remove(char_idx..char_idx + 1);
        self.modified = true;
    }

    /// Duplicate current line (Ctrl+D)
    pub fn duplicate_line(&mut self) {
        let line_idx = self.cursors[0].position.line;
        if let Some(line_text) = self.line(line_idx) {
            let line_start = self.content.line_to_char(line_idx);
            let line = self.content.line(line_idx).to_string();
            let insert_pos = line_start + line.len();

            // Ensure there's a newline
            let text_to_insert = if line.ends_with('\n') {
                line_text.clone() + "\n"
            } else {
                "\n".to_string() + &line_text
            };

            self.push_undo(EditAction::Insert {
                position: self.char_idx_to_pos(insert_pos),
                text: text_to_insert.clone(),
            });

            self.content.insert(insert_pos, &text_to_insert);
            self.modified = true;

            // Move cursor to duplicated line
            self.cursors[0].position.line += 1;
        }
    }

    /// Delete current line (Ctrl+Shift+K)
    pub fn delete_line(&mut self) {
        let line_idx = self.cursors[0].position.line;
        if line_idx >= self.content.len_lines() {
            return;
        }

        let line_start = self.content.line_to_char(line_idx);
        let line_text = self.content.line(line_idx).to_string();
        let line_end = line_start + line_text.len();

        self.push_undo(EditAction::Delete {
            position: Position { line: line_idx, column: 0 },
            text: line_text,
        });

        self.content.remove(line_start..line_end.min(self.content.len_chars()));
        self.modified = true;

        // Adjust cursor
        if self.cursors[0].position.line >= self.content.len_lines() && self.content.len_lines() > 0 {
            self.cursors[0].position.line = self.content.len_lines() - 1;
        }
        self.cursors[0].position.column = 0;
    }

    /// Move line up (Alt+Up)
    pub fn move_line_up(&mut self) {
        let line_idx = self.cursors[0].position.line;
        if line_idx == 0 {
            return;
        }

        let current = self.line(line_idx).unwrap_or_default();
        let above = self.line(line_idx - 1).unwrap_or_default();

        // Delete current line and above, then insert swapped
        let above_start = self.content.line_to_char(line_idx - 1);
        let current_end_idx = self.content.line_to_char(line_idx) +
            self.content.line(line_idx).len_chars();

        let old_text = self.content.slice(above_start..current_end_idx.min(self.content.len_chars())).to_string();
        let new_text = format!("{}\n{}\n", current, above);

        self.content.remove(above_start..current_end_idx.min(self.content.len_chars()));
        self.content.insert(above_start, &new_text.trim_end_matches('\n'));

        // Re-add trailing newline if needed
        self.modified = true;
        self.cursors[0].position.line -= 1;
    }

    // ── Undo/Redo ──

    fn push_undo(&mut self, action: EditAction) {
        if self.undo_stack.len() >= MAX_UNDO_HISTORY {
            self.undo_stack.pop_front();
        }
        self.undo_stack.push_back(action);
        self.redo_stack.clear();
    }

    pub fn undo(&mut self) -> bool {
        if let Some(action) = self.undo_stack.pop_back() {
            match &action {
                EditAction::Insert { position, text } => {
                    let char_idx = self.pos_to_char_idx(position);
                    let end = char_idx + text.chars().count();
                    self.content.remove(char_idx..end);
                    self.cursors[0].position = *position;
                }
                EditAction::Delete { position, text } => {
                    let char_idx = self.pos_to_char_idx(position);
                    self.content.insert(char_idx, text);
                    let new_idx = char_idx + text.chars().count();
                    self.cursors[0].position = self.char_idx_to_pos(new_idx);
                }
                EditAction::Replace { position, old_text, new_text } => {
                    let char_idx = self.pos_to_char_idx(position);
                    let end = char_idx + new_text.chars().count();
                    self.content.remove(char_idx..end);
                    self.content.insert(char_idx, old_text);
                    self.cursors[0].position = *position;
                }
            }
            self.redo_stack.push(action);
            self.modified = true;
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(action) = self.redo_stack.pop() {
            match &action {
                EditAction::Insert { position, text } => {
                    let char_idx = self.pos_to_char_idx(position);
                    self.content.insert(char_idx, text);
                    let new_idx = char_idx + text.chars().count();
                    self.cursors[0].position = self.char_idx_to_pos(new_idx);
                }
                EditAction::Delete { position, text } => {
                    let char_idx = self.pos_to_char_idx(position);
                    let end = char_idx + text.chars().count();
                    self.content.remove(char_idx..end);
                    self.cursors[0].position = *position;
                }
                EditAction::Replace { position, old_text, new_text } => {
                    let char_idx = self.pos_to_char_idx(position);
                    let end = char_idx + old_text.chars().count();
                    self.content.remove(char_idx..end);
                    self.content.insert(char_idx, new_text);
                    self.cursors[0].position = *position;
                }
            }
            self.undo_stack.push_back(action);
            self.modified = true;
            true
        } else {
            false
        }
    }

    // ── Bracket Matching ──

    /// Find matching bracket for the character at position
    pub fn find_matching_bracket(&self, pos: &Position) -> Option<Position> {
        let char_idx = self.pos_to_char_idx(pos);
        if char_idx >= self.content.len_chars() {
            return None;
        }

        let ch = self.content.char(char_idx);

        // Check if it's an opening bracket
        for (open, close) in BRACKET_PAIRS {
            if ch == *open {
                return self.find_forward(char_idx, *open, *close);
            }
            if ch == *close {
                return self.find_backward(char_idx, *open, *close);
            }
        }

        None
    }

    fn find_forward(&self, start: usize, open: char, close: char) -> Option<Position> {
        let mut depth = 0;
        for i in start..self.content.len_chars() {
            let ch = self.content.char(i);
            if ch == open {
                depth += 1;
            } else if ch == close {
                depth -= 1;
                if depth == 0 {
                    return Some(self.char_idx_to_pos(i));
                }
            }
        }
        None
    }

    fn find_backward(&self, start: usize, open: char, close: char) -> Option<Position> {
        let mut depth = 0;
        for i in (0..=start).rev() {
            let ch = self.content.char(i);
            if ch == close {
                depth += 1;
            } else if ch == open {
                depth -= 1;
                if depth == 0 {
                    return Some(self.char_idx_to_pos(i));
                }
            }
        }
        None
    }

    /// Get the auto-close character for a typed character
    pub fn auto_close_char(ch: char) -> Option<char> {
        for (open, close) in BRACKET_PAIRS {
            if ch == *open {
                return Some(*close);
            }
        }
        if QUOTE_CHARS.contains(&ch) {
            return Some(ch);
        }
        None
    }

    /// Export state for frontend
    pub fn to_state(&self) -> DocumentState {
        DocumentState {
            path: self.path.clone(),
            content: self.content.to_string(),
            modified: self.modified,
            encoding: match self.encoding {
                Encoding::Utf8 => "utf-8",
                Encoding::Utf8Bom => "utf-8-bom",
                Encoding::ShiftJis => "shift-jis",
            }.to_string(),
            line_ending: match self.line_ending {
                LineEnding::Lf => "lf",
                LineEnding::CrLf => "crlf",
            }.to_string(),
            line_count: self.line_count(),
            cursors: self.cursors.clone(),
        }
    }
}

// ── Comment Toggle (Ctrl+/) ──

/// Get comment prefix for a file type
pub fn comment_prefix(file_extension: &str) -> &'static str {
    match file_extension {
        "php" | "js" | "ts" | "jsx" | "tsx" | "vue" | "css" | "scss" | "rs" | "java" | "c" | "cpp" | "go" => "//",
        "py" | "rb" | "sh" | "bash" | "yaml" | "yml" | "toml" => "#",
        "html" | "xml" | "svg" => "<!--",
        "sql" => "--",
        "lua" => "--",
        _ => "//",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_document() {
        let doc = Document::new();
        assert_eq!(doc.line_count(), 1); // Empty rope has 1 line
        assert!(!doc.modified);
    }

    #[test]
    fn test_from_str() {
        let doc = Document::from_str("hello\nworld\n");
        assert_eq!(doc.line_count(), 3); // "hello", "world", ""
        assert_eq!(doc.line(0), Some("hello".into()));
        assert_eq!(doc.line(1), Some("world".into()));
    }

    #[test]
    fn test_insert_text() {
        let mut doc = Document::new();
        doc.insert_text("hello");
        assert_eq!(doc.content.to_string(), "hello");
        assert!(doc.modified);
        assert_eq!(doc.cursors[0].position, Position { line: 0, column: 5 });
    }

    #[test]
    fn test_backspace() {
        let mut doc = Document::from_str("hello");
        doc.cursors[0].position = Position { line: 0, column: 5 };
        doc.backspace();
        assert_eq!(doc.content.to_string(), "hell");
        assert_eq!(doc.cursors[0].position, Position { line: 0, column: 4 });
    }

    #[test]
    fn test_delete_forward() {
        let mut doc = Document::from_str("hello");
        doc.cursors[0].position = Position { line: 0, column: 0 };
        doc.delete_forward();
        assert_eq!(doc.content.to_string(), "ello");
    }

    #[test]
    fn test_undo_redo() {
        let mut doc = Document::new();
        doc.insert_text("hello");
        assert_eq!(doc.content.to_string(), "hello");

        doc.undo();
        assert_eq!(doc.content.to_string(), "");

        doc.redo();
        assert_eq!(doc.content.to_string(), "hello");
    }

    #[test]
    fn test_duplicate_line() {
        let mut doc = Document::from_str("line1\nline2\nline3\n");
        doc.cursors[0].position = Position { line: 1, column: 0 };
        doc.duplicate_line();
        assert_eq!(doc.line(1), Some("line2".into()));
        assert_eq!(doc.line(2), Some("line2".into()));
        assert_eq!(doc.line(3), Some("line3".into()));
    }

    #[test]
    fn test_delete_line() {
        let mut doc = Document::from_str("line1\nline2\nline3\n");
        doc.cursors[0].position = Position { line: 1, column: 0 };
        doc.delete_line();
        assert_eq!(doc.line(0), Some("line1".into()));
        assert_eq!(doc.line(1), Some("line3".into()));
    }

    #[test]
    fn test_bracket_matching() {
        //                         0123456789...
        let doc = Document::from_str("fn() { (x); }");
        // { at column 5
        let result = doc.find_matching_bracket(&Position { line: 0, column: 5 });
        assert_eq!(result, Some(Position { line: 0, column: 12 }));

        // ( at column 7
        let result = doc.find_matching_bracket(&Position { line: 0, column: 7 });
        assert_eq!(result, Some(Position { line: 0, column: 9 }));
        
        // ) at column 9 — should find matching ( at 7
        let result = doc.find_matching_bracket(&Position { line: 0, column: 9 });
        assert_eq!(result, Some(Position { line: 0, column: 7 }));
    }

    #[test]
    fn test_auto_close() {
        assert_eq!(Document::auto_close_char('('), Some(')'));
        assert_eq!(Document::auto_close_char('{'), Some('}'));
        assert_eq!(Document::auto_close_char('"'), Some('"'));
        assert_eq!(Document::auto_close_char('a'), None);
    }

    #[test]
    fn test_line_ending_detection() {
        let doc = Document::from_str("hello\r\nworld\r\n");
        assert_eq!(doc.line_ending, LineEnding::CrLf);

        let doc = Document::from_str("hello\nworld\n");
        assert_eq!(doc.line_ending, LineEnding::Lf);
    }

    #[test]
    fn test_visible_lines() {
        let doc = Document::from_str("a\nb\nc\nd\ne\n");
        let lines = doc.visible_lines(1, 3);
        assert_eq!(lines, vec!["b", "c"]);
    }

    #[test]
    fn test_comment_prefix() {
        assert_eq!(comment_prefix("php"), "//");
        assert_eq!(comment_prefix("py"), "#");
        assert_eq!(comment_prefix("html"), "<!--");
        assert_eq!(comment_prefix("sql"), "--");
    }

    #[test]
    fn test_japanese_text() {
        let mut doc = Document::from_str("こんにちは\n世界\n");
        assert_eq!(doc.line(0), Some("こんにちは".into()));
        assert_eq!(doc.line(1), Some("世界".into()));
        
        doc.cursors[0].position = Position { line: 0, column: 5 };
        doc.insert_text("！");
        assert_eq!(doc.line(0), Some("こんにちは！".into()));
    }
}
