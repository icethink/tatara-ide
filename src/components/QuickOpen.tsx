// ⚒️ Quick Open — Ctrl+P Fuzzy File Finder

import { useState, useEffect, useRef } from "react";

interface QuickOpenProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function QuickOpen({ visible, onClose, onSelect }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      // TODO: Load file list from Tauri backend via IPC
      setFiles([
        "src/App.tsx",
        "src/main.tsx",
        "src/components/EditorArea.tsx",
        "src/components/Sidebar.tsx",
        "src/components/StatusBar.tsx",
        "src/components/TerminalPanel.tsx",
        "src/components/ActivityBar.tsx",
        "src/components/CommandPalette.tsx",
        "src/hooks/useI18n.ts",
        "src/hooks/useKeybindings.ts",
        "src/styles/global.css",
      ]);
    }
  }, [visible]);

  const filtered = query
    ? files.filter((f) => fuzzyMatch(f.toLowerCase(), query.toLowerCase()))
    : files;

  if (!visible) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex]);
      onClose();
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
      <div
        style={{
          position: "fixed",
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          maxWidth: "90vw",
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 1000,
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="ファイル名を入力..."
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--fg-primary)",
              fontSize: 14,
              fontFamily: "var(--font-code)",
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {filtered.map((file, i) => (
            <div
              key={file}
              onClick={() => { onSelect(file); onClose(); }}
              style={{
                padding: "5px 16px",
                cursor: "pointer",
                background: i === selectedIndex ? "var(--sidebar-active)" : "transparent",
                fontSize: 13,
                fontFamily: "var(--font-code)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ color: "var(--fg-muted)" }}>
                {fileIcon(file)}
              </span>
              <span>{fileName(file)}</span>
              <span style={{ color: "var(--fg-muted)", fontSize: 11, marginLeft: "auto" }}>
                {filePath(file)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function fuzzyMatch(str: string, query: string): boolean {
  let qi = 0;
  for (let i = 0; i < str.length && qi < query.length; i++) {
    if (str[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

function fileName(path: string): string {
  return path.split("/").pop() || path;
}

function filePath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function fileIcon(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "⚛️";
  if (path.endsWith(".ts") || path.endsWith(".js")) return "📜";
  if (path.endsWith(".css")) return "🎨";
  if (path.endsWith(".json")) return "📋";
  if (path.endsWith(".rs")) return "🦀";
  if (path.endsWith(".toml")) return "⚙️";
  if (path.endsWith(".php")) return "🐘";
  if (path.endsWith(".vue")) return "💚";
  if (path.endsWith(".blade.php")) return "🔪";
  return "📄";
}
