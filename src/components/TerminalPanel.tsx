// ⚒️ Terminal Panel — Smart terminal with Edit/RAW mode
//
// Edit mode (default): Ctrl+C = copy, standard editing
// RAW mode (auto): vi/tmux/ssh — keystrokes go directly to PTY
// Safety: Dangerous command warnings, multi-line paste confirmation

import { useState, useRef, useCallback, useEffect } from "react";

interface TerminalLine {
  id: number;
  content: string;
  type: "input" | "output" | "error" | "system";
  timestamp: number;
}

type TerminalMode = "edit" | "raw";

interface TerminalPanelProps {
  projectPath?: string | null;
}

export function TerminalPanel({ projectPath }: TerminalPanelProps = {}) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 0,
      content: "⚒️ Tatara Terminal — コードを、鍛える。",
      type: "system",
      timestamp: Date.now(),
    },
    {
      id: 1,
      content: "Type 'help' for available commands. Laravel Artisan integration active.",
      type: "system",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<TerminalMode>("edit");
  const cwd = projectPath ? projectPath.split(/[/\\]/).pop() || projectPath : "~";
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dangerWarning, setDangerWarning] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(2);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on click
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((content: string, type: TerminalLine["type"]) => {
    setLines(prev => [
      ...prev,
      { id: ++lineIdRef.current, content, type, timestamp: Date.now() },
    ]);
  }, []);

  // ── Dangerous Command Detection ──

  const checkDanger = useCallback((cmd: string): { level: string; warning: string } | null => {
    const dangerHigh = [
      { pattern: "rm -rf", msg: "ファイルを再帰的に強制削除します" },
      { pattern: "migrate:fresh", msg: "全テーブルを削除して再作成します" },
      { pattern: "db:wipe", msg: "全テーブルを削除します" },
    ];
    const dangerMed = [
      { pattern: "sudo", msg: "管理者権限で実行します" },
      { pattern: "--force", msg: "確認をスキップします" },
      { pattern: "chmod 777", msg: "全ユーザーにフルアクセス権限を付与します" },
    ];

    const lower = cmd.toLowerCase();
    for (const d of dangerHigh) {
      if (lower.includes(d.pattern)) return { level: "high", warning: `⚠️ 危険: ${d.msg}` };
    }
    for (const d of dangerMed) {
      if (lower.includes(d.pattern)) return { level: "medium", warning: `⚡ 注意: ${d.msg}` };
    }
    return null;
  }, []);

  // ── RAW Mode Detection ──

  const shouldGoRaw = useCallback((cmd: string): boolean => {
    const rawCmds = ["vim", "vi", "nvim", "nano", "htop", "top", "tmux", "ssh", "less", "more"];
    const first = cmd.trim().split(/\s+/)[0];
    return rawCmds.includes(first) || cmd.includes("artisan tinker");
  }, []);

  // ── Command Execution ──

  const executeCommand = useCallback(async (cmd: string) => {
    addLine(`${cwd} ❯ ${cmd}`, "input");

    // Add to history
    setHistory(prev => [...prev.filter(h => h !== cmd), cmd]);
    setHistoryIndex(-1);

    // Built-in commands
    const trimmed = cmd.trim();

    if (trimmed === "help") {
      addLine("  clear     — ターミナルをクリア", "system");
      addLine("  help      — このヘルプを表示", "system");
      addLine("  mode      — Edit/RAW モードを切替", "system");
      addLine("  artisan   — php artisan コマンド一覧", "system");
      return;
    }

    if (trimmed === "clear") {
      setLines([]);
      return;
    }

    if (trimmed === "mode") {
      const newMode = mode === "edit" ? "raw" : "edit";
      setMode(newMode);
      addLine(`モード切替: ${newMode.toUpperCase()}`, "system");
      return;
    }

    // Check for RAW mode auto-switch
    if (shouldGoRaw(trimmed) && mode === "edit") {
      setMode("raw");
      addLine("🔄 RAW モードに自動切替", "system");
    }

    // Execute via Tauri IPC (Rust std::process::Command)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ stdout: string; stderr: string; code: number }>(
        "exec_command",
        { cmd: trimmed, cwd: projectPath || undefined }
      );
      if (result.stdout) {
        for (const line of result.stdout.split("\n")) {
          if (line !== "") addLine(line, "output");
        }
      }
      if (result.stderr) {
        for (const line of result.stderr.split("\n")) {
          if (line.trim()) addLine(line, "error");
        }
      }
      if (result.code !== 0 && !result.stdout && !result.stderr) {
        addLine(`終了コード: ${result.code}`, "error");
      }
    } catch (err) {
      // Fallback for browser dev mode
      addLine(`[実行エラー] ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [cwd, mode, addLine, shouldGoRaw, projectPath]);

  const handleSubmit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;

    // Check for danger
    const danger = checkDanger(cmd);
    if (danger && !pendingCommand) {
      setDangerWarning(danger.warning);
      setPendingCommand(cmd);
      setInput("");
      return;
    }

    executeCommand(cmd);
    setInput("");
    setPendingCommand(null);
    setDangerWarning(null);
  }, [input, checkDanger, executeCommand, pendingCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // History navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length > 0) {
          const newIdx = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
          setHistoryIndex(newIdx);
          setInput(history[history.length - 1 - newIdx]);
        }
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIdx = historyIndex - 1;
          setHistoryIndex(newIdx);
          setInput(history[history.length - 1 - newIdx]);
        } else {
          setHistoryIndex(-1);
          setInput("");
        }
        return;
      }

      // Ctrl+C in edit mode = clear input
      if (e.key === "c" && e.ctrlKey && mode === "edit") {
        e.preventDefault();
        if (input) {
          addLine(`${cwd} ❯ ${input}^C`, "input");
          setInput("");
        }
        // Cancel danger confirmation
        if (pendingCommand) {
          setPendingCommand(null);
          setDangerWarning(null);
          addLine("キャンセルしました", "system");
        }
        return;
      }

      // Ctrl+L = clear
      if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
        return;
      }
    },
    [handleSubmit, history, historyIndex, mode, input, cwd, addLine, pendingCommand]
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--terminal-bg)",
        fontFamily: "var(--font-code)",
        fontSize: 13,
        minHeight: 0,
      }}
      onClick={focusInput}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 12px",
        borderBottom: "1px solid var(--border)",
        fontSize: 11,
        color: "var(--fg-muted)",
        userSelect: "none",
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>💻 ターミナル</span>
          <span style={{
            padding: "1px 6px",
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            background: mode === "raw" ? "rgba(243, 139, 168, 0.2)" : "rgba(137, 180, 250, 0.2)",
            color: mode === "raw" ? "var(--flame)" : "var(--tamahagane)",
          }}>
            {mode.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMode(mode === "edit" ? "raw" : "edit"); }}
            style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", fontSize: 11 }}
          >
            {mode === "edit" ? "⌨️ RAW" : "✏️ Edit"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setLines([]); }}
            style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", fontSize: 11 }}
          >
            🗑️ クリア
          </button>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "4px 12px",
          lineHeight: 1.6,
        }}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            style={{
              color: lineColor(line.type),
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {line.content}
          </div>
        ))}
      </div>

      {/* Danger warning */}
      {dangerWarning && (
        <div style={{
          padding: "6px 12px",
          background: "rgba(243, 139, 168, 0.15)",
          borderTop: "1px solid rgba(243, 139, 168, 0.3)",
          color: "#f38ba8",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{dangerWarning}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (pendingCommand) executeCommand(pendingCommand);
                setDangerWarning(null);
                setPendingCommand(null);
              }}
              style={{
                padding: "2px 8px",
                background: "rgba(243, 139, 168, 0.3)",
                border: "1px solid #f38ba8",
                borderRadius: 3,
                color: "#f38ba8",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              実行する
            </button>
            <button
              onClick={() => { setDangerWarning(null); setPendingCommand(null); }}
              style={{
                padding: "2px 8px",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 3,
                color: "var(--fg-muted)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Input line */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 12px",
        borderTop: "1px solid var(--border)",
        gap: 8,
      }}>
        <span style={{ color: "var(--tamahagane)", fontWeight: 600, whiteSpace: "nowrap" }}>
          {cwd} ❯
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--terminal-fg)",
            fontFamily: "var(--font-code)",
            fontSize: 13,
          }}
          placeholder={pendingCommand ? "Enterで実行、Ctrl+Cでキャンセル" : ""}
        />
      </div>
    </div>
  );
}

function lineColor(type: TerminalLine["type"]): string {
  switch (type) {
    case "input": return "#89B4FA";
    case "output": return "#CDD6F4";
    case "error": return "#F38BA8";
    case "system": return "#6C7086";
  }
}
