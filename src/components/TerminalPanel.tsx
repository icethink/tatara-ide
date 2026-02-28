// ⚒️ Terminal Panel — Smart terminal with Edit/RAW mode
//
// Key design decisions (from design doc):
// - Edit mode (default): Ctrl+C=copy, Ctrl+V=paste, IME-friendly
// - RAW mode (auto): Activates for vi/top/tmux/ssh etc.
// - Canvas rendering + transparent textarea overlay for IME
// - Multi-line paste confirmation dialog (MobaXterm-style)

import { useState } from "react";

export function TerminalPanel() {
  const [mode, setMode] = useState<"edit" | "raw">("edit");

  return (
    <div className="terminal-panel" style={{
      height: 250,
      minHeight: 100,
      background: "var(--terminal-bg)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Terminal header */}
      <div style={{
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>💻 ターミナル</span>
          <span style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 3,
            background: mode === "edit" ? "var(--accent)" : "var(--warning)",
            color: "var(--bg-primary)",
          }}>
            {mode === "edit" ? "📝 Edit" : "⌨️ RAW"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={termBtnStyle} title="新しいターミナル">+</button>
          <button style={termBtnStyle} title="分割">⊞</button>
          <button style={termBtnStyle} title="閉じる">×</button>
        </div>
      </div>

      {/* Terminal output area */}
      <div style={{
        flex: 1,
        padding: "8px 12px",
        fontFamily: "var(--font-code)",
        fontSize: "var(--font-size)",
        color: "var(--terminal-fg)",
        overflow: "auto",
      }}>
        <div style={{ color: "var(--success)" }}>
          ⚒️ Tatara IDE Terminal v0.1.0
        </div>
        <div style={{ color: "var(--fg-muted)", marginBottom: 8 }}>
          WSL: Ubuntu — Edit Mode (Ctrl+C=コピー)
        </div>
      </div>

      {/* Input area (native textarea for IME support) */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 12px 8px",
        gap: 8,
      }}>
        <span style={{ color: "var(--accent)", fontFamily: "var(--font-code)", fontSize: 13 }}>
          $
        </span>
        <textarea
          rows={1}
          placeholder="コマンドを入力..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--terminal-fg)",
            fontFamily: "var(--font-code)",
            fontSize: 14,
            resize: "none",
          }}
        />
      </div>
    </div>
  );
}

const termBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--fg-muted)",
  cursor: "pointer",
  fontSize: 14,
  padding: "0 4px",
};
