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
  errors?: number;
  warnings?: number;
  lspServers?: string[];
  onDiagnosticsClick?: () => void;
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
  errors = 0,
  warnings = 0,
  lspServers = [],
  onDiagnosticsClick,
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
        {/* Diagnostics count */}
        {(errors > 0 || warnings > 0) && (
          <span style={{ display: "flex", gap: 6, cursor: "pointer" }} onClick={onDiagnosticsClick}>
            {errors > 0 && <span style={{ color: "#f38ba8" }}>⊘ {errors}</span>}
            {warnings > 0 && <span style={{ color: "#f9e2af" }}>⚠ {warnings}</span>}
          </span>
        )}
        {/* LSP indicator */}
        {lspServers.length > 0 && (
          <span style={{ color: "#a6e3a1", fontSize: 10 }} title={lspServers.join(", ")}>
            ● LSP
          </span>
        )}
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
