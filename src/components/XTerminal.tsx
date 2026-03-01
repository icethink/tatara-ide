// ⚒️ XTerminal — Real interactive terminal with PTY
//
// Uses xterm.js for terminal emulation + Tauri PTY backend.
// Supports: vim, ssh, tmux, artisan tinker, and all interactive CLI tools.

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface XTerminalProps {
  projectPath?: string | null;
  visible?: boolean;
}

// Catppuccin Mocha theme for xterm
const CATPPUCCIN_THEME = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  cursorAccent: "#1e1e2e",
  selectionBackground: "#585b7066",
  selectionForeground: "#cdd6f4",
  black: "#45475a",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
  magenta: "#cba6f7",
  cyan: "#94e2d5",
  white: "#bac2de",
  brightBlack: "#585b70",
  brightRed: "#f38ba8",
  brightGreen: "#a6e3a1",
  brightYellow: "#f9e2af",
  brightBlue: "#89b4fa",
  brightMagenta: "#cba6f7",
  brightCyan: "#94e2d5",
  brightWhite: "#a6adc8",
};

export function XTerminal({ projectPath, visible = true }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      theme: CATPPUCCIN_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      allowTransparency: true,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(containerRef.current);

    // Initial fit
    setTimeout(() => fitAddon.fit(), 50);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Handle resize
  useEffect(() => {
    if (!visible) return;

    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
          // Notify PTY backend of new size
          if (sessionIdRef.current !== null) {
            const { cols, rows } = terminalRef.current;
            resizePty(sessionIdRef.current, rows, cols);
          }
        } catch {}
      }
    };

    // Fit when becoming visible
    setTimeout(handleResize, 50);

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [visible]);

  // Connect to PTY backend
  const connectPty = useCallback(async () => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      // Get terminal dimensions
      const { cols, rows } = terminal;

      // Spawn PTY
      const sessionId = await invoke<number>("pty_spawn", {
        cwd: projectPath || undefined,
        rows,
        cols,
      });

      sessionIdRef.current = sessionId;
      setConnected(true);
      setError(null);

      // Listen for PTY output
      const unlisten = await listen<{ session_id: number; data: string; exited: boolean }>(
        "pty-output",
        (event) => {
          if (event.payload.session_id !== sessionId) return;

          if (event.payload.exited) {
            terminal.writeln("\r\n\x1b[90m[プロセスが終了しました]\x1b[0m");
            setConnected(false);
            sessionIdRef.current = null;
          } else {
            terminal.write(event.payload.data);
          }
        }
      );

      // Forward keyboard input to PTY
      const onData = terminal.onData((data: string) => {
        if (sessionIdRef.current !== null) {
          invoke("pty_write", { sessionId: sessionIdRef.current, data }).catch(() => {});
        }
      });

      // Handle binary data (special keys)
      const onBinary = terminal.onBinary((data: string) => {
        if (sessionIdRef.current !== null) {
          invoke("pty_write", { sessionId: sessionIdRef.current, data }).catch(() => {});
        }
      });

      // Store cleanup refs for unmount
      cleanupRef.current = () => {
        unlisten();
        onData.dispose();
        onBinary.dispose();
        if (sessionIdRef.current !== null) {
          invoke("pty_kill", { sessionId: sessionIdRef.current }).catch(() => {});
          sessionIdRef.current = null;
        }
      };
    } catch (err) {
      // Not in Tauri — show fallback message
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      terminal.writeln("\x1b[33m⚒️ Tatara Terminal\x1b[0m");
      terminal.writeln(`\x1b[31mPTY接続エラー: ${msg}\x1b[0m`);
      terminal.writeln("\x1b[90m(ブラウザ開発モードではPTYは使えません)\x1b[0m");
    }
  }, [projectPath]);

  // Auto-connect on mount
  useEffect(() => {
    if (!connected && terminalRef.current && !error) {
      connectPty();
    }
  }, [connectPty, connected, error]);

  // Reconnect button
  const handleReconnect = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
      setError(null);
      setConnected(false);
      connectPty();
    }
  }, [connectPty]);

  if (!visible) return null;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: "#1e1e2e",
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 12px",
        borderBottom: "1px solid #313244",
        fontSize: 11,
        color: "#6c7086",
        userSelect: "none",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span>💻 ターミナル</span>
          <span style={{
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            background: connected ? "rgba(166, 227, 161, 0.2)" : "rgba(243, 139, 168, 0.2)",
            color: connected ? "#a6e3a1" : "#f38ba8",
          }}>
            {connected ? "接続中" : "未接続"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!connected && (
            <button
              onClick={handleReconnect}
              style={{
                background: "none",
                border: "none",
                color: "#89b4fa",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              🔄 再接続
            </button>
          )}
          <button
            onClick={() => {
              if (sessionIdRef.current !== null) {
                import("@tauri-apps/api/core").then(({ invoke }) => {
                  invoke("pty_kill", { sessionId: sessionIdRef.current }).catch(() => {});
                });
                sessionIdRef.current = null;
                setConnected(false);
              }
            }}
            style={{
              background: "none",
              border: "none",
              color: "#6c7086",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ✕ 終了
          </button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: "4px 0 4px 8px",
          minHeight: 0,
          overflow: "hidden",
        }}
      />
    </div>
  );
}

// ── Helper functions ──

async function resizePty(sessionId: number, rows: number, cols: number) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("pty_resize", { sessionId, rows, cols });
  } catch {}
}
