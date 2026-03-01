// ⚒️ Status Bar — Bottom bar showing editor state

interface StatusBarProps {
  branch: string;
  encoding: string;
  lineEnding: string;
  line: number;
  column: number;
  language?: string;
  framework?: string | null;
  onToggleTerminal: () => void;
}

export function StatusBar({
  branch,
  encoding,
  lineEnding,
  line,
  column,
  language,
  framework,
  onToggleTerminal,
}: StatusBarProps) {
  return (
    <div className="status-bar" style={{
      height: 24,
      background: "var(--statusbar-bg)",
      color: "var(--statusbar-fg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px",
      fontSize: 12,
      borderTop: "1px solid var(--border)",
      userSelect: "none",
    }}>
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span title="Git ブランチ" style={{ cursor: "pointer" }}>
          🌿 {branch}
        </span>
        {framework && (
          <span style={{ color: "var(--flame)" }}>
            🔥 {framework}
          </span>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>{encoding}</span>
        <span>{lineEnding}</span>
        {language && language !== "plaintext" && (
          <span style={{ textTransform: "capitalize" }}>{language}</span>
        )}
        <span style={{ fontFamily: "var(--font-code)" }}>
          Ln {line}, Col {column}
        </span>
        <button
          onClick={onToggleTerminal}
          title="ターミナル (Ctrl+`)"
          style={{
            background: "none",
            border: "none",
            color: "var(--statusbar-fg)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          💻 ターミナル
        </button>
      </div>
    </div>
  );
}
