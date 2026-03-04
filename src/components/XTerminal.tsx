// ⚒️ XTerminal — Real interactive terminal with PTY
//
// Uses xterm.js for terminal emulation + Tauri PTY backend.
// Supports: vim, ssh, tmux, claude code, artisan tinker, and ALL interactive CLIs.
// Features: Multiple tabs, Unicode 11, Catppuccin theme, auto-resize.

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";

interface XTerminalProps {
  projectPath?: string | null;
  visible?: boolean;
}

// Catppuccin Mocha theme
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

interface TermTab {
  id: number;
  label: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  sessionId: number | null;
  connected: boolean;
  cleanup: (() => void) | null;
}

let nextTabId = 1;

export function XTerminal({ projectPath, visible = true }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const tabsRef = useRef<TermTab[]>([]);
  tabsRef.current = tabs;

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // Create a new terminal tab
  const createTab = useCallback((label?: string) => {
    const terminal = new Terminal({
      theme: CATPPUCCIN_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 10000,
      allowTransparency: true,
      convertEol: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.unicode.activeVersion = "11";

    const id = nextTabId++;
    const tab: TermTab = {
      id,
      label: label || `ターミナル ${id}`,
      terminal,
      fitAddon,
      sessionId: null,
      connected: false,
      cleanup: null,
    };

    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);

    return tab;
  }, []);

  // Connect a tab to PTY
  const connectTab = useCallback(async (tab: TermTab) => {
    if (!containerRef.current) return;

    // Mount terminal to DOM
    const el = containerRef.current;
    el.innerHTML = "";
    tab.terminal.open(el);
    setTimeout(() => tab.fitAddon.fit(), 50);

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen } = await import("@tauri-apps/api/event");

      const { cols, rows } = tab.terminal;

      const sessionId = await invoke<number>("pty_spawn", {
        cwd: projectPath || undefined,
        rows,
        cols,
      });

      tab.sessionId = sessionId;
      tab.connected = true;
      setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, sessionId, connected: true } : t)));

      // Listen for PTY output
      const unlisten = await listen<{ session_id: number; data: string; exited: boolean }>(
        "pty-output",
        (event) => {
          if (event.payload.session_id !== sessionId) return;

          if (event.payload.exited) {
            tab.terminal.writeln("\r\n\x1b[90m[プロセスが終了しました — Enter で再接続]\x1b[0m");
            tab.connected = false;
            tab.sessionId = null;
            setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, connected: false, sessionId: null } : t)));
          } else {
            tab.terminal.write(event.payload.data);
          }
        }
      );

      // Forward input to PTY
      const onData = tab.terminal.onData((data: string) => {
        if (tab.sessionId !== null) {
          invoke("pty_write", { sessionId: tab.sessionId, data }).catch(() => {});
        } else if (data === "\r") {
          // Enter on dead session → reconnect
          connectTab(tab);
        }
      });

      const onBinary = tab.terminal.onBinary((data: string) => {
        if (tab.sessionId !== null) {
          invoke("pty_write", { sessionId: tab.sessionId, data }).catch(() => {});
        }
      });

      tab.cleanup = () => {
        unlisten();
        onData.dispose();
        onBinary.dispose();
        if (tab.sessionId !== null) {
          invoke("pty_kill", { sessionId: tab.sessionId }).catch(() => {});
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      tab.terminal.writeln("\x1b[33m⚒️ Tatara Terminal\x1b[0m");
      tab.terminal.writeln(`\x1b[31mPTY接続エラー: ${msg}\x1b[0m`);
    }
  }, [projectPath]);

  // Auto-create first tab
  useEffect(() => {
    if (tabs.length === 0 && visible) {
      const tab = createTab();
      // Defer connection to next tick so container is mounted
      setTimeout(() => connectTab(tab), 100);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch active tab → mount its terminal
  useEffect(() => {
    if (!containerRef.current || !activeTab) return;
    const el = containerRef.current;
    el.innerHTML = "";
    activeTab.terminal.open(el);
    setTimeout(() => {
      activeTab.fitAddon.fit();
      activeTab.terminal.focus();
    }, 50);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize handler
  useEffect(() => {
    if (!visible || !activeTab) return;

    const handleResize = () => {
      if (activeTab) {
        try {
          activeTab.fitAddon.fit();
          if (activeTab.sessionId !== null) {
            const { cols, rows } = activeTab.terminal;
            resizePty(activeTab.sessionId, rows, cols);
          }
        } catch {}
      }
    };

    setTimeout(handleResize, 50);

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible, activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close tab
  const closeTab = useCallback((id: number) => {
    const tab = tabsRef.current.find((t) => t.id === id);
    if (tab) {
      if (tab.cleanup) tab.cleanup();
      tab.terminal.dispose();
    }

    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length === 0) {
        setActiveTabId(null);
      } else if (activeTabId === id) {
        setActiveTabId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  }, [activeTabId]);

  // New tab + connect
  const addTab = useCallback((label?: string) => {
    const tab = createTab(label);
    setTimeout(() => connectTab(tab), 100);
  }, [createTab, connectTab]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      tabsRef.current.forEach((tab) => {
        if (tab.cleanup) tab.cleanup();
        tab.terminal.dispose();
      });
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: "#1e1e2e",
      minHeight: 0,
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
        borderBottom: "1px solid #313244",
        fontSize: 11,
        color: "#6c7086",
        userSelect: "none",
        flexShrink: 0,
        height: 28,
        gap: 0,
      }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 10px",
              height: "100%",
              cursor: "pointer",
              borderBottom: tab.id === activeTabId ? "2px solid #89b4fa" : "2px solid transparent",
              color: tab.id === activeTabId ? "#cdd6f4" : "#6c7086",
              background: tab.id === activeTabId ? "rgba(137, 180, 250, 0.05)" : "transparent",
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: tab.connected ? "#a6e3a1" : "#f38ba8",
              flexShrink: 0,
            }} />
            <span>{tab.label}</span>
            <span
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              style={{
                cursor: "pointer",
                opacity: 0.5,
                padding: "0 2px",
                fontSize: 13,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
            >
              ×
            </span>
          </div>
        ))}

        {/* New tab button */}
        <button
          onClick={() => addTab()}
          style={{
            background: "none",
            border: "none",
            color: "#6c7086",
            cursor: "pointer",
            fontSize: 15,
            padding: "0 8px",
            height: "100%",
            display: "flex",
            alignItems: "center",
          }}
          title="新しいターミナル"
        >
          +
        </button>

        <div style={{ flex: 1 }} />

        {/* Quick launch */}
        <button
          onClick={() => addTab("claude")}
          style={{
            background: "rgba(203, 166, 247, 0.1)",
            border: "1px solid rgba(203, 166, 247, 0.2)",
            borderRadius: 3,
            color: "#cba6f7",
            cursor: "pointer",
            fontSize: 10,
            padding: "2px 8px",
            marginRight: 4,
          }}
          title="Claude Code ターミナルを開く"
        >
          ✦ Claude
        </button>
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

// ── Helper ──

async function resizePty(sessionId: number, rows: number, cols: number) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("pty_resize", { sessionId, rows, cols });
  } catch {}
}
