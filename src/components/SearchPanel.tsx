// ⚒️ Search Panel — Ctrl+Shift+F project-wide search

import { useState, useCallback } from "react";

interface SearchResult {
  path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

interface SearchPanelProps {
  onFileOpen: (path: string, line?: number) => void;
}

export function SearchPanel({ onFileOpen }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [includeFilter, setIncludeFilter] = useState("");
  const [totalFiles, setTotalFiles] = useState(0);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);

    // TODO: Call Tauri IPC search_files command
    // For now, mock results
    setResults([]);
    setTotalFiles(0);
    setSearching(false);
  }, [query, caseSensitive, wholeWord, useRegex, includeFilter]);

  // Group results by file
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.path]) acc[r.path] = [];
    acc[r.path].push(r);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
      {/* Search input */}
      <div style={{ padding: "8px 12px" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="検索..."
            style={{
              width: "100%",
              padding: "6px 8px",
              paddingRight: 80,
              background: "#313244",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--fg-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
          {/* Toggle buttons */}
          <div style={{
            position: "absolute",
            right: 4,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            gap: 2,
          }}>
            <ToggleButton
              active={caseSensitive}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="大文字小文字を区別 (Aa)"
              label="Aa"
            />
            <ToggleButton
              active={wholeWord}
              onClick={() => setWholeWord(!wholeWord)}
              title="単語全体を一致"
              label="W"
            />
            <ToggleButton
              active={useRegex}
              onClick={() => setUseRegex(!useRegex)}
              title="正規表現"
              label=".*"
            />
          </div>
        </div>

        {/* File filter */}
        <input
          type="text"
          value={includeFilter}
          onChange={(e) => setIncludeFilter(e.target.value)}
          placeholder="対象ファイル (例: *.blade.php)"
          style={{
            width: "100%",
            padding: "4px 8px",
            marginTop: 4,
            background: "#313244",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--fg-primary)",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>

      {/* Status */}
      {results.length > 0 && (
        <div style={{
          padding: "4px 12px",
          fontSize: 11,
          color: "var(--fg-muted)",
          borderBottom: "1px solid var(--border)",
        }}>
          {results.length} 件の結果（{totalFiles} ファイル）
        </div>
      )}

      {/* Results */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {searching && (
          <div style={{ padding: "16px 12px", color: "var(--fg-muted)", textAlign: "center" }}>
            検索中...
          </div>
        )}

        {!searching && query && results.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--fg-muted)", textAlign: "center" }}>
            結果が見つかりません
          </div>
        )}

        {Object.entries(grouped).map(([filePath, fileResults]) => (
          <div key={filePath}>
            {/* File header */}
            <div style={{
              padding: "4px 12px",
              fontSize: 12,
              color: "var(--fg-secondary)",
              background: "var(--sidebar-hover)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <span>{fileIcon(filePath)}</span>
              <span style={{ fontWeight: 600 }}>{fileName(filePath)}</span>
              <span style={{ color: "var(--fg-muted)" }}>{filePath}</span>
              <span style={{
                marginLeft: "auto",
                background: "var(--accent)",
                color: "var(--bg-primary)",
                borderRadius: 8,
                padding: "0 6px",
                fontSize: 10,
              }}>
                {fileResults.length}
              </span>
            </div>

            {/* Matches */}
            {fileResults.map((r, i) => (
              <div
                key={`${r.path}:${r.line_number}:${i}`}
                onClick={() => onFileOpen(r.path, r.line_number)}
                style={{
                  padding: "2px 12px 2px 32px",
                  cursor: "pointer",
                  display: "flex",
                  gap: 8,
                  fontFamily: "var(--font-code)",
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--sidebar-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ color: "var(--fg-muted)", minWidth: 32, textAlign: "right" }}>
                  {r.line_number}
                </span>
                <span style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {r.line_content}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  title,
  label,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "var(--font-code)",
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--accent-fg)" : "var(--fg-muted)",
        border: active ? "none" : "1px solid var(--border)",
        borderRadius: 3,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function fileIcon(path: string): string {
  if (path.endsWith(".php")) return "🐘";
  if (path.endsWith(".vue")) return "💚";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "📜";
  if (path.endsWith(".css")) return "🎨";
  return "📄";
}

function fileName(path: string): string {
  return path.split("/").pop() || path;
}
