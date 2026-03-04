// ⚒️ Diagnostics Panel — Shows errors/warnings from LSP
//
// VS Code "Problems" panel equivalent

import { useState, useMemo } from "react";

export interface Diagnostic {
  path: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  severity: "error" | "warning" | "information" | "hint";
  message: string;
  source: string;
  code?: string;
}

interface DiagnosticsPanelProps {
  diagnostics: Diagnostic[];
  onJumpTo: (path: string, line: number, column: number) => void;
}

export function DiagnosticsPanel({ diagnostics, onJumpTo }: DiagnosticsPanelProps) {
  const [filter, setFilter] = useState<"all" | "error" | "warning">("all");

  const filtered = useMemo(() => {
    if (filter === "all") return diagnostics;
    return diagnostics.filter((d) => d.severity === filter);
  }, [diagnostics, filter]);

  // Group by file
  const grouped = useMemo(() => {
    const map = new Map<string, Diagnostic[]>();
    for (const d of filtered) {
      const list = map.get(d.path) || [];
      list.push(d);
      map.set(d.path, list);
    }
    return map;
  }, [filtered]);

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "4px 12px",
        borderBottom: "1px solid #313244",
        fontSize: 11,
        color: "#6c7086",
        userSelect: "none",
        gap: 12,
      }}>
        <span>📋 問題</span>
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
          すべて ({diagnostics.length})
        </FilterBtn>
        <FilterBtn active={filter === "error"} onClick={() => setFilter("error")}>
          <span style={{ color: "#f38ba8" }}>●</span> エラー ({errorCount})
        </FilterBtn>
        <FilterBtn active={filter === "warning"} onClick={() => setFilter("warning")}>
          <span style={{ color: "#f9e2af" }}>●</span> 警告 ({warnCount})
        </FilterBtn>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", fontSize: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#585b70" }}>
            問題は見つかりませんでした ✨
          </div>
        ) : (
          Array.from(grouped.entries()).map(([path, diags]) => (
            <div key={path}>
              <div style={{
                padding: "4px 12px",
                color: "#cdd6f4",
                fontWeight: 600,
                fontSize: 11,
                background: "#181825",
              }}>
                📄 {path.split(/[/\\]/).pop()}
                <span style={{ color: "#585b70", fontWeight: 400, marginLeft: 8 }}>
                  {path}
                </span>
              </div>
              {diags.map((d, i) => (
                <div
                  key={`${d.line}-${d.column}-${i}`}
                  onClick={() => onJumpTo(d.path, d.line, d.column)}
                  style={{
                    padding: "3px 12px 3px 24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    color: "#cdd6f4",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#313244"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ color: severityColor(d.severity), flexShrink: 0 }}>
                    {severityIcon(d.severity)}
                  </span>
                  <span style={{ flex: 1 }}>{d.message}</span>
                  <span style={{ color: "#585b70", flexShrink: 0 }}>
                    {d.source}{d.code ? `(${d.code})` : ""}
                  </span>
                  <span style={{ color: "#585b70", flexShrink: 0 }}>
                    [{d.line + 1}:{d.column + 1}]
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "1px 8px",
      background: active ? "rgba(137, 180, 250, 0.15)" : "transparent",
      border: "none",
      borderRadius: 3,
      color: active ? "#89b4fa" : "#6c7086",
      cursor: "pointer",
      fontSize: 11,
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}>
      {children}
    </button>
  );
}

function severityColor(s: string): string {
  switch (s) {
    case "error": return "#f38ba8";
    case "warning": return "#f9e2af";
    case "information": return "#89b4fa";
    case "hint": return "#a6e3a1";
    default: return "#6c7086";
  }
}

function severityIcon(s: string): string {
  switch (s) {
    case "error": return "✕";
    case "warning": return "⚠";
    case "information": return "ℹ";
    case "hint": return "💡";
    default: return "•";
  }
}
