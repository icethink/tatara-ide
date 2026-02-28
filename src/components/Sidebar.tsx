// ⚒️ Sidebar — File explorer, search, git, etc.

interface SidebarProps {
  activePanel: string;
}

export function Sidebar({ activePanel }: SidebarProps) {
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
      }}>
        {activePanel === "explorer" && "エクスプローラー"}
        {activePanel === "search" && "検索"}
        {activePanel === "git" && "ソース管理"}
        {activePanel === "debug" && "デバッグ"}
        {activePanel === "extensions" && "拡張機能"}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {activePanel === "explorer" && <FileExplorer />}
        {activePanel === "search" && <SearchPanel />}
        {activePanel === "git" && <GitPanel />}
      </div>
    </div>
  );
}

function FileExplorer() {
  return (
    <div style={{ padding: "0 8px", color: "var(--fg-secondary)", fontSize: 13 }}>
      <div style={{ padding: "4px 8px", opacity: 0.6 }}>
        プロジェクトを開いてください (Ctrl+O)
      </div>
    </div>
  );
}

function SearchPanel() {
  return (
    <div style={{ padding: "8px 12px" }}>
      <input
        type="text"
        placeholder="検索..."
        style={{
          width: "100%",
          padding: "6px 8px",
          background: "#313244",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--fg-primary)",
          fontSize: 13,
          outline: "none",
        }}
      />
    </div>
  );
}

function GitPanel() {
  return (
    <div style={{ padding: "8px 12px", color: "var(--fg-muted)", fontSize: 13 }}>
      Git リポジトリが検出されませんでした
    </div>
  );
}
