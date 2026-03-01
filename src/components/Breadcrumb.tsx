// ⚒️ Breadcrumb — File path navigation bar above editor

interface BreadcrumbProps {
  path: string | null;
  onSegmentClick?: (path: string) => void;
}

export function Breadcrumb({ path, onSegmentClick }: BreadcrumbProps) {
  if (!path) return null;

  const segments = path.split("/").filter(Boolean);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "2px 12px",
      fontSize: 12,
      color: "var(--fg-muted)",
      background: "var(--bg-primary)",
      borderBottom: "1px solid var(--border)",
      gap: 2,
      overflow: "hidden",
      whiteSpace: "nowrap",
      flexShrink: 0,
    }}>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const fullPath = segments.slice(0, i + 1).join("/");
        const icon = isLast ? fileIcon(seg) : "📁";

        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {i > 0 && <span style={{ color: "var(--fg-muted)", opacity: 0.4, margin: "0 2px" }}>›</span>}
            <span
              onClick={() => onSegmentClick?.(fullPath)}
              style={{
                cursor: "pointer",
                color: isLast ? "var(--fg-primary)" : "var(--fg-muted)",
                padding: "1px 4px",
                borderRadius: 3,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {icon} {seg}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function fileIcon(name: string): string {
  if (name.endsWith(".php")) return "🐘";
  if (name.endsWith(".blade.php")) return "🔪";
  if (name.endsWith(".vue")) return "💚";
  if (name.endsWith(".ts") || name.endsWith(".tsx")) return "📜";
  if (name.endsWith(".js") || name.endsWith(".jsx")) return "📒";
  if (name.endsWith(".css") || name.endsWith(".scss")) return "🎨";
  if (name.endsWith(".json")) return "📋";
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".env")) return "🔐";
  if (name.endsWith(".toml") || name.endsWith(".yaml") || name.endsWith(".yml")) return "⚙️";
  return "📄";
}
