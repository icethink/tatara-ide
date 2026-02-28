// ⚒️ Sidebar — Panel switcher for explorer, search, git, etc.

import { FileTree, type FileNode } from "./FileTree";
import { SearchPanel } from "./SearchPanel";

interface SidebarProps {
  activePanel: string;
  fileTree?: FileNode | null;
  selectedFilePath?: string;
  onFileSelect?: (path: string) => void;
  onFileOpen?: (path: string, line?: number) => void;
}

export function Sidebar({
  activePanel,
  fileTree,
  selectedFilePath,
  onFileSelect,
  onFileOpen,
}: SidebarProps) {
  return (
    <div className="sidebar" style={{
      width: 260,
      minWidth: 200,
      maxWidth: 400,
      background: "var(--sidebar-bg)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "8px 16px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--fg-muted)",
        borderBottom: "1px solid var(--border)",
      }}>
        {panelTitle(activePanel)}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activePanel === "explorer" && (
          <FileTree
            root={fileTree ?? null}
            onFileSelect={onFileSelect ?? (() => {})}
            selectedPath={selectedFilePath}
          />
        )}
        {activePanel === "search" && (
          <SearchPanel onFileOpen={onFileOpen ?? (() => {})} />
        )}
        {activePanel === "git" && <GitPanel />}
        {activePanel === "debug" && <PlaceholderPanel text="デバッグ (Phase 4)" />}
        {activePanel === "extensions" && <PlaceholderPanel text="拡張機能 (将来)" />}
      </div>
    </div>
  );
}

function panelTitle(panel: string): string {
  switch (panel) {
    case "explorer": return "エクスプローラー";
    case "search": return "検索";
    case "git": return "ソース管理";
    case "debug": return "デバッグ";
    case "extensions": return "拡張機能";
    default: return panel;
  }
}

function GitPanel() {
  return (
    <div style={{ padding: "12px", color: "var(--fg-secondary)", fontSize: 13 }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{ color: "var(--fg-muted)", fontSize: 12 }}>
          ソース管理 (Phase 3)
        </div>

        {/* Git status preview */}
        <div style={{
          padding: "8px 12px",
          background: "var(--sidebar-active)",
          borderRadius: 4,
          fontSize: 12,
        }}>
          <div style={{ marginBottom: 4, color: "var(--fg-muted)" }}>変更</div>
          <div style={{ color: "var(--git-added)" }}>+ 新規ファイル</div>
          <div style={{ color: "var(--git-modified)" }}>~ 変更ファイル</div>
          <div style={{ color: "var(--git-deleted)" }}>- 削除ファイル</div>
        </div>

        {/* Commit message */}
        <textarea
          placeholder="コミットメッセージを入力..."
          rows={3}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: "#313244",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--fg-primary)",
            fontSize: 12,
            resize: "vertical",
            outline: "none",
          }}
        />

        <button style={{
          width: "100%",
          padding: "6px",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          border: "none",
          borderRadius: 4,
          fontSize: 12,
          cursor: "pointer",
          fontWeight: 600,
        }}>
          ✓ コミット
        </button>
      </div>
    </div>
  );
}

function PlaceholderPanel({ text }: { text: string }) {
  return (
    <div style={{
      padding: "24px 12px",
      color: "var(--fg-muted)",
      fontSize: 13,
      textAlign: "center",
    }}>
      {text}
    </div>
  );
}
