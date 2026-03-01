// ⚒️ Tab Bar — Editor tabs with modified indicator and close button

import { useCallback } from "react";

export interface Tab {
  id: string;
  path: string;
  filename: string;
  modified: boolean;
  language?: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function TabBar({ tabs, activeTabId, onTabSelect, onTabClose }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div style={{
      height: 36,
      background: "var(--tab-inactive-bg)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "stretch",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex",
        alignItems: "stretch",
        overflow: "auto",
        scrollbarWidth: "none",
      }}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => onTabSelect(tab.id)}
            onClose={() => onTabClose(tab.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TabItem({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 12px",
        cursor: "pointer",
        fontSize: 13,
        color: active ? "var(--tab-active-fg)" : "var(--tab-inactive-fg)",
        background: active ? "var(--tab-active-bg)" : "transparent",
        borderBottom: active ? "1px solid var(--accent)" : "1px solid transparent",
        borderRight: "1px solid var(--border)",
        minWidth: 0,
        whiteSpace: "nowrap",
      }}
    >
      {/* File icon */}
      <span style={{ fontSize: 13 }}>{fileIcon(tab.filename)}</span>

      {/* File name */}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
        {tab.filename}
      </span>

      {/* Modified indicator / close button */}
      <span
        onClick={handleClose}
        style={{
          fontSize: 10,
          width: 16,
          height: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 3,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {tab.modified ? (
          <span style={{ color: "#F9E2AF", fontSize: 18 }}>●</span>
        ) : (
          "✕"
        )}
      </span>
    </div>
  );
}

function fileIcon(name: string): string {
  if (name.endsWith(".php")) return "🐘";
  if (name.endsWith(".blade.php")) return "🔪";
  if (name.endsWith(".vue")) return "💚";
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "⚛️";
  if (name.endsWith(".ts") || name.endsWith(".js")) return "📜";
  if (name.endsWith(".css")) return "🎨";
  if (name.endsWith(".rs")) return "🦀";
  return "📄";
}
