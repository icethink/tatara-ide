// ⚒️ DiffViewer — Side-by-side or unified diff display

// DiffViewer

interface DiffLine {
  content: string;
  line_type: "Context" | "Added" | "Removed";
  old_line: number | null;
  new_line: number | null;
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffViewerProps {
  hunks: DiffHunk[];
  filename: string;
  _mode?: "unified" | "side-by-side";
}

export function DiffViewer({ hunks, filename }: DiffViewerProps) {
  if (hunks.length === 0) {
    return (
      <div style={{
        padding: 24,
        textAlign: "center",
        color: "var(--fg-muted)",
        fontSize: 13,
      }}>
        変更なし
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "var(--font-code)",
      fontSize: 13,
      lineHeight: 1.5,
      overflow: "auto",
    }}>
      {/* File header */}
      <div style={{
        padding: "6px 12px",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--fg-secondary)",
        fontWeight: 600,
      }}>
        {filename}
      </div>

      {hunks.map((hunk, hi) => (
        <div key={hi}>
          {/* Hunk header */}
          <div style={{
            padding: "2px 12px",
            background: "rgba(137, 180, 250, 0.08)",
            color: "var(--fg-muted)",
            fontSize: 12,
          }}>
            {hunk.header}
          </div>

          {/* Lines */}
          {hunk.lines.map((line, li) => (
            <div
              key={`${hi}-${li}`}
              style={{
                display: "flex",
                background: lineBackground(line.line_type),
                borderLeft: `3px solid ${lineBorderColor(line.line_type)}`,
              }}
            >
              {/* Old line number */}
              <div style={{
                width: 50,
                textAlign: "right",
                padding: "0 8px",
                color: "var(--fg-muted)",
                fontSize: 12,
                userSelect: "none",
                flexShrink: 0,
              }}>
                {line.old_line ?? ""}
              </div>

              {/* New line number */}
              <div style={{
                width: 50,
                textAlign: "right",
                padding: "0 8px",
                color: "var(--fg-muted)",
                fontSize: 12,
                userSelect: "none",
                flexShrink: 0,
              }}>
                {line.new_line ?? ""}
              </div>

              {/* Sign */}
              <div style={{
                width: 16,
                textAlign: "center",
                color: lineSignColor(line.line_type),
                fontWeight: 600,
                userSelect: "none",
                flexShrink: 0,
              }}>
                {lineSign(line.line_type)}
              </div>

              {/* Content */}
              <div style={{
                flex: 1,
                padding: "0 8px",
                whiteSpace: "pre",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {line.content}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function lineBackground(type: string): string {
  switch (type) {
    case "Added": return "rgba(166, 227, 161, 0.08)";
    case "Removed": return "rgba(243, 139, 168, 0.08)";
    default: return "transparent";
  }
}

function lineBorderColor(type: string): string {
  switch (type) {
    case "Added": return "var(--git-added)";
    case "Removed": return "var(--git-deleted)";
    default: return "transparent";
  }
}

function lineSign(type: string): string {
  switch (type) {
    case "Added": return "+";
    case "Removed": return "−";
    default: return " ";
  }
}

function lineSignColor(type: string): string {
  switch (type) {
    case "Added": return "var(--git-added)";
    case "Removed": return "var(--git-deleted)";
    default: return "var(--fg-muted)";
  }
}
