// ⚒️ Activity Bar — Left icon strip (VS Code style)

interface ActivityBarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
}

const panels = [
  { id: "explorer", icon: "📂", label: "エクスプローラー" },
  { id: "search", icon: "🔍", label: "検索" },
  { id: "git", icon: "🌿", label: "ソース管理" },
  { id: "database", icon: "🗄️", label: "データベース" },
  { id: "laravel", icon: "🔥", label: "Laravel" },
  { id: "docker", icon: "🐳", label: "Docker" },
  { id: "debug", icon: "🐛", label: "デバッグ" },
  { id: "extensions", icon: "📦", label: "拡張機能" },
];

export function ActivityBar({ activePanel, onPanelChange }: ActivityBarProps) {
  return (
    <div className="activity-bar" style={{
      width: 48,
      minWidth: 48,
      background: "var(--bg-tertiary)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 8,
      borderRight: "1px solid var(--border)",
    }}>
      {panels.map((panel) => (
        <button
          key={panel.id}
          title={panel.label}
          onClick={() => onPanelChange(panel.id)}
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            background: "none",
            border: "none",
            cursor: "pointer",
            borderRadius: 4,
            opacity: activePanel === panel.id ? 1 : 0.5,
            borderLeft: activePanel === panel.id ? "2px solid var(--accent)" : "2px solid transparent",
          }}
        >
          {panel.icon}
        </button>
      ))}
    </div>
  );
}
