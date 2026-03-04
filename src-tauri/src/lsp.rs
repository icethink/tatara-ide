// ⚒️ Tatara IDE — LSP Client Module
//
// Language Server Protocol client for multiple language servers:
// - intelephense (PHP/Laravel)
// - typescript-language-server (JS/TS)
// - volar (Vue)
// - css-languageserver (CSS/SCSS)
//
// Architecture:
// - Each server runs as a child process communicating via stdio JSON-RPC
// - LspManager holds multiple server sessions
// - Frontend sends requests via IPC, receives responses + notifications via events

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Emitter;

// ── Types ──

pub type ServerId = String; // e.g., "intelephense", "typescript", "volar"

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerConfig {
    pub id: ServerId,
    pub command: String,
    pub args: Vec<String>,
    pub languages: Vec<String>,
    pub root_uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub path: String,
    pub line: u32,
    pub column: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub severity: DiagSeverity,
    pub message: String,
    pub source: String,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiagSeverity {
    Error,
    Warning,
    Information,
    Hint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: String,
    pub detail: Option<String>,
    pub insert_text: Option<String>,
    pub documentation: Option<String>,
    pub sort_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverResult {
    pub contents: String,
    pub range: Option<LspRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspRange {
    pub start_line: u32,
    pub start_col: u32,
    pub end_line: u32,
    pub end_col: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub path: String,
    pub line: u32,
    pub column: u32,
}

/// Event payload for LSP notifications sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspEvent {
    pub server_id: String,
    pub method: String,
    pub data: Value,
}

// ── Server Session ──

struct LspSession {
    stdin: Mutex<ChildStdin>,
    _child: Child,
    next_id: AtomicI64,
    pending: Arc<Mutex<HashMap<i64, tokio_oneshot::Sender<Value>>>>,
    alive: Arc<AtomicBool>,
    root_uri: String,
    initialized: AtomicBool,
}

// Simple oneshot channel (no tokio dependency)
mod tokio_oneshot {
    use std::sync::{Arc, Condvar, Mutex};

    pub struct Sender<T> {
        inner: Arc<(Mutex<Option<T>>, Condvar)>,
    }

    pub struct Receiver<T> {
        inner: Arc<(Mutex<Option<T>>, Condvar)>,
    }

    pub fn channel<T>() -> (Sender<T>, Receiver<T>) {
        let inner = Arc::new((Mutex::new(None), Condvar::new()));
        (
            Sender { inner: inner.clone() },
            Receiver { inner },
        )
    }

    impl<T> Sender<T> {
        pub fn send(self, val: T) {
            let (lock, cvar) = &*self.inner;
            let mut guard = lock.lock().unwrap();
            *guard = Some(val);
            cvar.notify_one();
        }
    }

    impl<T> Receiver<T> {
        pub fn recv_timeout(&self, duration: std::time::Duration) -> Option<T> {
            let (lock, cvar) = &*self.inner;
            let mut guard = lock.lock().unwrap();
            if guard.is_some() {
                return guard.take();
            }
            let (mut guard, _) = cvar.wait_timeout(guard, duration).ok()?;
            guard.take()
        }
    }
}

// ── LSP Manager ──

pub struct LspManager {
    sessions: Mutex<HashMap<ServerId, LspSession>>,
}

impl LspManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Start an LSP server
    pub fn start_server(
        &self,
        config: LspServerConfig,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if sessions.contains_key(&config.id) {
            return Err(format!("サーバー {} は既に起動中", config.id));
        }

        // Spawn process
        let mut child = Command::new(&config.command)
            .args(&config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("{} の起動に失敗: {} (コマンド: {})", config.id, e, config.command))?;

        let stdin = child.stdin.take().ok_or("stdin取得失敗")?;
        let stdout = child.stdout.take().ok_or("stdout取得失敗")?;

        let alive = Arc::new(AtomicBool::new(true));
        let pending: Arc<Mutex<HashMap<i64, tokio_oneshot::Sender<Value>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        // Reader thread — parse LSP JSON-RPC messages from stdout
        let alive_clone = alive.clone();
        let pending_clone = pending.clone();
        let server_id = config.id.clone();
        let app_clone = app_handle.clone();

        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            while alive_clone.load(Ordering::Relaxed) {
                match read_lsp_message(&mut reader) {
                    Ok(Some(msg)) => {
                        // Check if response (has "id")
                        if let Some(id) = msg.get("id").and_then(|v| v.as_i64()) {
                            let mut pending = pending_clone.lock().unwrap();
                            if let Some(sender) = pending.remove(&id) {
                                sender.send(msg);
                                continue;
                            }
                        }

                        // It's a notification — forward to frontend
                        if let Some(method) = msg.get("method").and_then(|v| v.as_str()) {
                            let _ = app_clone.emit("lsp-event", LspEvent {
                                server_id: server_id.clone(),
                                method: method.to_string(),
                                data: msg.get("params").cloned().unwrap_or(Value::Null),
                            });
                        }
                    }
                    Ok(None) => break, // EOF
                    Err(_) => break,
                }
            }
            alive_clone.store(false, Ordering::Relaxed);
        });

        let session = LspSession {
            stdin: Mutex::new(stdin),
            _child: child,
            next_id: AtomicI64::new(1),
            pending,
            alive,
            root_uri: config.root_uri.clone(),
            initialized: AtomicBool::new(false),
        };

        sessions.insert(config.id.clone(), session);
        drop(sessions);

        // Send initialize request
        self.initialize(&config.id, &config.root_uri)?;

        Ok(())
    }

    /// Send initialize request to server
    fn initialize(&self, server_id: &str, root_uri: &str) -> Result<(), String> {
        let params = json!({
            "processId": std::process::id(),
            "rootUri": root_uri,
            "capabilities": {
                "textDocument": {
                    "completion": {
                        "completionItem": {
                            "snippetSupport": true,
                            "resolveSupport": { "properties": ["documentation", "detail"] }
                        }
                    },
                    "hover": { "contentFormat": ["markdown", "plaintext"] },
                    "definition": {},
                    "references": {},
                    "publishDiagnostics": { "relatedInformation": true },
                    "synchronization": {
                        "didSave": true,
                        "willSave": false,
                        "dynamicRegistration": false
                    },
                    "formatting": {},
                    "signatureHelp": {
                        "signatureInformation": {
                            "documentationFormat": ["markdown", "plaintext"]
                        }
                    }
                },
                "workspace": {
                    "workspaceFolders": true,
                    "configuration": true
                }
            },
            "workspaceFolders": [{
                "uri": root_uri,
                "name": root_uri.rsplit('/').next().unwrap_or("project")
            }]
        });

        let response = self.send_request(server_id, "initialize", params)?;

        // Send initialized notification
        self.send_notification(server_id, "initialized", json!({}))?;

        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(server_id) {
            session.initialized.store(true, Ordering::Relaxed);
        }

        Ok(())
    }

    /// Send a JSON-RPC request and wait for response
    pub fn send_request(
        &self,
        server_id: &str,
        method: &str,
        params: Value,
    ) -> Result<Value, String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(server_id)
            .ok_or_else(|| format!("サーバー {} が見つかりません", server_id))?;

        if !session.alive.load(Ordering::Relaxed) {
            return Err(format!("サーバー {} は停止しています", server_id));
        }

        let id = session.next_id.fetch_add(1, Ordering::Relaxed);

        let msg = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        // Register pending response
        let (tx, rx) = tokio_oneshot::channel();
        session.pending.lock().unwrap().insert(id, tx);

        // Send message
        let body = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        let header = format!("Content-Length: {}\r\n\r\n", body.len());

        let mut stdin = session.stdin.lock().unwrap();
        stdin.write_all(header.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;

        drop(stdin);
        drop(sessions);

        // Wait for response (timeout 10s)
        rx.recv_timeout(std::time::Duration::from_secs(10))
            .ok_or_else(|| format!("{} request timed out", method))
    }

    /// Send a JSON-RPC notification (no response expected)
    pub fn send_notification(
        &self,
        server_id: &str,
        method: &str,
        params: Value,
    ) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(server_id)
            .ok_or_else(|| format!("サーバー {} が見つかりません", server_id))?;

        let msg = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let body = serde_json::to_string(&msg).map_err(|e| e.to_string())?;
        let header = format!("Content-Length: {}\r\n\r\n", body.len());

        let mut stdin = session.stdin.lock().unwrap();
        stdin.write_all(header.as_bytes()).map_err(|e| e.to_string())?;
        stdin.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
        stdin.flush().map_err(|e| e.to_string())?;

        Ok(())
    }

    // ── High-Level LSP Operations ──

    /// Notify server that a file was opened
    pub fn did_open(
        &self,
        server_id: &str,
        uri: &str,
        language_id: &str,
        version: i32,
        text: &str,
    ) -> Result<(), String> {
        self.send_notification(server_id, "textDocument/didOpen", json!({
            "textDocument": {
                "uri": uri,
                "languageId": language_id,
                "version": version,
                "text": text,
            }
        }))
    }

    /// Notify server that a file was changed
    pub fn did_change(
        &self,
        server_id: &str,
        uri: &str,
        version: i32,
        text: &str,
    ) -> Result<(), String> {
        self.send_notification(server_id, "textDocument/didChange", json!({
            "textDocument": { "uri": uri, "version": version },
            "contentChanges": [{ "text": text }]
        }))
    }

    /// Notify server that a file was saved
    pub fn did_save(&self, server_id: &str, uri: &str, text: &str) -> Result<(), String> {
        self.send_notification(server_id, "textDocument/didSave", json!({
            "textDocument": { "uri": uri },
            "text": text,
        }))
    }

    /// Notify server that a file was closed
    pub fn did_close(&self, server_id: &str, uri: &str) -> Result<(), String> {
        self.send_notification(server_id, "textDocument/didClose", json!({
            "textDocument": { "uri": uri }
        }))
    }

    /// Request completions at a position
    pub fn completion(
        &self,
        server_id: &str,
        uri: &str,
        line: u32,
        character: u32,
    ) -> Result<Vec<CompletionItem>, String> {
        let response = self.send_request(server_id, "textDocument/completion", json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
        }))?;

        parse_completion_response(response)
    }

    /// Request hover info at a position
    pub fn hover(
        &self,
        server_id: &str,
        uri: &str,
        line: u32,
        character: u32,
    ) -> Result<Option<HoverResult>, String> {
        let response = self.send_request(server_id, "textDocument/hover", json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
        }))?;

        parse_hover_response(response)
    }

    /// Go to definition
    pub fn definition(
        &self,
        server_id: &str,
        uri: &str,
        line: u32,
        character: u32,
    ) -> Result<Vec<Location>, String> {
        let response = self.send_request(server_id, "textDocument/definition", json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
        }))?;

        parse_location_response(response)
    }

    /// Find all references
    pub fn references(
        &self,
        server_id: &str,
        uri: &str,
        line: u32,
        character: u32,
    ) -> Result<Vec<Location>, String> {
        let response = self.send_request(server_id, "textDocument/references", json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
            "context": { "includeDeclaration": true },
        }))?;

        parse_location_response(response)
    }

    /// Format document
    pub fn format(
        &self,
        server_id: &str,
        uri: &str,
        tab_size: u32,
        insert_spaces: bool,
    ) -> Result<Vec<TextEdit>, String> {
        let response = self.send_request(server_id, "textDocument/formatting", json!({
            "textDocument": { "uri": uri },
            "options": {
                "tabSize": tab_size,
                "insertSpaces": insert_spaces,
            }
        }))?;

        parse_text_edits(response)
    }

    /// Signature help
    pub fn signature_help(
        &self,
        server_id: &str,
        uri: &str,
        line: u32,
        character: u32,
    ) -> Result<Option<SignatureHelp>, String> {
        let response = self.send_request(server_id, "textDocument/signatureHelp", json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character },
        }))?;

        parse_signature_help(response)
    }

    /// Stop a server
    pub fn stop_server(&self, server_id: &str) -> Result<(), String> {
        // Send shutdown request
        let _ = self.send_request(server_id, "shutdown", Value::Null);
        let _ = self.send_notification(server_id, "exit", Value::Null);

        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.remove(server_id) {
            session.alive.store(false, Ordering::Relaxed);
        }
        Ok(())
    }

    /// List active servers
    pub fn list_servers(&self) -> Vec<String> {
        self.sessions.lock().unwrap().keys().cloned().collect()
    }

    /// Get server for a language
    pub fn server_for_language(&self, language: &str) -> Option<String> {
        // Map language to server ID
        match language {
            "php" | "blade" => Some("intelephense".to_string()),
            "javascript" | "typescript" | "javascriptreact" | "typescriptreact" => {
                Some("typescript".to_string())
            }
            "vue" => Some("volar".to_string()),
            "css" | "scss" | "less" => Some("css".to_string()),
            _ => None,
        }
    }
}

// ── Text Edit ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
    pub range: LspRange,
    pub new_text: String,
}

// ── Signature Help ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureHelp {
    pub signatures: Vec<SignatureInfo>,
    pub active_signature: u32,
    pub active_parameter: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureInfo {
    pub label: String,
    pub documentation: Option<String>,
    pub parameters: Vec<ParameterInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterInfo {
    pub label: String,
    pub documentation: Option<String>,
}

// ── LSP Message Parsing ──

fn read_lsp_message(reader: &mut BufReader<impl Read>) -> Result<Option<Value>, String> {
    // Read headers
    let mut content_length: usize = 0;
    loop {
        let mut line = String::new();
        let bytes_read = reader.read_line(&mut line).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            return Ok(None); // EOF
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            break;
        }
        if let Some(len) = trimmed.strip_prefix("Content-Length: ") {
            content_length = len.parse().map_err(|e: std::num::ParseIntError| e.to_string())?;
        }
    }

    if content_length == 0 {
        return Err("Content-Length が 0".to_string());
    }

    // Read body
    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).map_err(|e| e.to_string())?;

    let msg: Value = serde_json::from_slice(&body).map_err(|e| e.to_string())?;
    Ok(Some(msg))
}

fn parse_completion_response(response: Value) -> Result<Vec<CompletionItem>, String> {
    let result = response.get("result").unwrap_or(&Value::Null);

    let items = if let Some(arr) = result.as_array() {
        arr.clone()
    } else if let Some(obj) = result.as_object() {
        obj.get("items").and_then(|v| v.as_array()).cloned().unwrap_or_default()
    } else {
        return Ok(vec![]);
    };

    Ok(items.iter().filter_map(|item| {
        let label = item.get("label")?.as_str()?.to_string();
        let kind_num = item.get("kind").and_then(|v| v.as_u64()).unwrap_or(0);
        let kind = completion_kind_str(kind_num);

        Some(CompletionItem {
            label,
            kind,
            detail: item.get("detail").and_then(|v| v.as_str()).map(String::from),
            insert_text: item.get("insertText").and_then(|v| v.as_str()).map(String::from),
            documentation: extract_documentation(item),
            sort_text: item.get("sortText").and_then(|v| v.as_str()).map(String::from),
        })
    }).collect())
}

fn parse_hover_response(response: Value) -> Result<Option<HoverResult>, String> {
    let result = response.get("result").unwrap_or(&Value::Null);
    if result.is_null() {
        return Ok(None);
    }

    let contents = if let Some(s) = result.get("contents") {
        extract_markup_content(s)
    } else {
        return Ok(None);
    };

    let range = result.get("range").and_then(parse_range);

    Ok(Some(HoverResult { contents, range }))
}

fn parse_location_response(response: Value) -> Result<Vec<Location>, String> {
    let result = response.get("result").unwrap_or(&Value::Null);

    if result.is_null() {
        return Ok(vec![]);
    }

    let locations = if result.is_array() {
        result.as_array().unwrap().clone()
    } else if result.is_object() {
        vec![result.clone()]
    } else {
        return Ok(vec![]);
    };

    Ok(locations.iter().filter_map(|loc| {
        let uri = loc.get("uri")?.as_str()?;
        let path = uri_to_path(uri);
        let pos = loc.get("range")?.get("start")?;
        let line = pos.get("line")?.as_u64()? as u32;
        let column = pos.get("character")?.as_u64()? as u32;
        Some(Location { path, line, column })
    }).collect())
}

fn parse_text_edits(response: Value) -> Result<Vec<TextEdit>, String> {
    let result = response.get("result").unwrap_or(&Value::Null);
    if let Some(arr) = result.as_array() {
        Ok(arr.iter().filter_map(|edit| {
            let range = parse_range(edit.get("range")?)?;
            let new_text = edit.get("newText")?.as_str()?.to_string();
            Some(TextEdit { range, new_text })
        }).collect())
    } else {
        Ok(vec![])
    }
}

fn parse_signature_help(response: Value) -> Result<Option<SignatureHelp>, String> {
    let result = response.get("result").unwrap_or(&Value::Null);
    if result.is_null() {
        return Ok(None);
    }

    let signatures = result.get("signatures").and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|sig| {
            let label = sig.get("label")?.as_str()?.to_string();
            let documentation = extract_documentation(sig);
            let parameters = sig.get("parameters").and_then(|v| v.as_array())
                .map(|params| params.iter().filter_map(|p| {
                    let plabel = if let Some(s) = p.get("label").and_then(|v| v.as_str()) {
                        s.to_string()
                    } else {
                        return None;
                    };
                    Some(ParameterInfo {
                        label: plabel,
                        documentation: extract_documentation(p),
                    })
                }).collect())
                .unwrap_or_default();
            Some(SignatureInfo { label, documentation, parameters })
        }).collect())
        .unwrap_or_default();

    Ok(Some(SignatureHelp {
        signatures,
        active_signature: result.get("activeSignature").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        active_parameter: result.get("activeParameter").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
    }))
}

// ── Helpers ──

fn parse_range(val: &Value) -> Option<LspRange> {
    let start = val.get("start")?;
    let end = val.get("end")?;
    Some(LspRange {
        start_line: start.get("line")?.as_u64()? as u32,
        start_col: start.get("character")?.as_u64()? as u32,
        end_line: end.get("line")?.as_u64()? as u32,
        end_col: end.get("character")?.as_u64()? as u32,
    })
}

fn extract_markup_content(val: &Value) -> String {
    if let Some(s) = val.as_str() {
        return s.to_string();
    }
    if let Some(obj) = val.as_object() {
        if let Some(value) = obj.get("value").and_then(|v| v.as_str()) {
            return value.to_string();
        }
    }
    if let Some(arr) = val.as_array() {
        return arr.iter().map(|v| extract_markup_content(v)).collect::<Vec<_>>().join("\n\n");
    }
    String::new()
}

fn extract_documentation(item: &Value) -> Option<String> {
    let doc = item.get("documentation")?;
    if let Some(s) = doc.as_str() {
        return Some(s.to_string());
    }
    if let Some(obj) = doc.as_object() {
        return obj.get("value").and_then(|v| v.as_str()).map(String::from);
    }
    None
}

fn uri_to_path(uri: &str) -> String {
    if let Some(path) = uri.strip_prefix("file:///") {
        // Windows: file:///C:/... → C:/...
        if path.chars().nth(1) == Some(':') {
            return path.replace('/', "\\");
        }
        // Unix: file:///home/... → /home/...
        return format!("/{}", path);
    }
    if let Some(path) = uri.strip_prefix("file://") {
        return path.to_string();
    }
    uri.to_string()
}

pub fn path_to_uri(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if normalized.starts_with('/') {
        format!("file://{}", normalized)
    } else {
        // Windows: C:/... → file:///C:/...
        format!("file:///{}", normalized)
    }
}

fn completion_kind_str(kind: u64) -> String {
    match kind {
        1 => "text", 2 => "method", 3 => "function", 4 => "constructor",
        5 => "field", 6 => "variable", 7 => "class", 8 => "interface",
        9 => "module", 10 => "property", 11 => "unit", 12 => "value",
        13 => "enum", 14 => "keyword", 15 => "snippet", 16 => "color",
        17 => "file", 18 => "reference", 19 => "folder", 20 => "enum_member",
        21 => "constant", 22 => "struct", 23 => "event", 24 => "operator",
        25 => "type_parameter",
        _ => "text",
    }.to_string()
}
