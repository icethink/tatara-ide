// ⚒️ Sidebar — Panel switcher for explorer, search, git, etc.

import { FileTree, type FileNode } from "./FileTree";
import { SearchPanel } from "./SearchPanel";
import { GitPanel } from "./GitPanel";
import { DatabasePanel } from "./DatabasePanel";
import { DockerPanel } from "./DockerPanel";
import { LaravelPanel } from "./LaravelPanel";

interface SidebarProps {
  activePanel: string;
  fileTree?: FileNode | null;
  selectedFilePath?: string;
  projectPath?: string | null;
  onFileSelect?: (path: string) => void;
  onFileOpen?: (path: string, line?: number) => void;
  onContextMenu?: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}

export function Sidebar({
  activePanel,
  fileTree,
  selectedFilePath,
  projectPath,
  onFileSelect,
  onFileOpen,
  onContextMenu,
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
            onContextMenu={onContextMenu}
            selectedPath={selectedFilePath}
          />
        )}
        {activePanel === "search" && (
          <SearchPanel onFileOpen={onFileOpen ?? (() => {})} />
        )}
        {activePanel === "git" && (
          <GitPanel
            projectPath={projectPath ?? null}
            onFileOpen={onFileOpen ?? (() => {})}
          />
        )}
        {activePanel === "database" && (
          <DatabasePanel projectPath={projectPath ?? null} />
        )}
        {activePanel === "laravel" && (
          <LaravelPanel projectPath={projectPath ?? null} />
        )}
        {activePanel === "docker" && (
          <DockerPanel projectPath={projectPath ?? null} />
        )}
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
    case "database": return "データベース";
    case "laravel": return "Laravel";
    case "docker": return "Docker";
    case "debug": return "デバッグ";
    case "extensions": return "拡張機能";
    default: return panel;
  }
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
