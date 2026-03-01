// ⚒️ Find & Replace — Ctrl+F / Ctrl+H in-editor search

import { useState, useCallback, useRef, useEffect } from "react";

interface FindReplaceProps {
  visible: boolean;
  content: string;
  onClose: () => void;
  onHighlight: (matches: Match[]) => void;
  onReplace: (oldText: string, newText: string, all: boolean) => void;
  onJumpToLine: (line: number, column: number) => void;
}

export interface Match {
  line: number;
  column: number;
  length: number;
}

export function FindReplace({
  visible,
  content,
  onClose,
  onHighlight,
  onReplace,
  onJumpToLine,
}: FindReplaceProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);

  const findRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => {
    if (visible) findRef.current?.focus();
  }, [visible]);

  // Search on text/options change
  useEffect(() => {
    if (!findText) {
      setMatches([]);
      onHighlight([]);
      return;
    }

    const found = findMatches(content, findText, { caseSensitive, wholeWord, useRegex });
    setMatches(found);
    setCurrentMatch(0);
    onHighlight(found);

    if (found.length > 0) {
      onJumpToLine(found[0].line, found[0].column);
    }
  }, [findText, content, caseSensitive, wholeWord, useRegex]);

  const goToMatch = useCallback(
    (index: number) => {
      if (matches.length === 0) return;
      const idx = ((index % matches.length) + matches.length) % matches.length;
      setCurrentMatch(idx);
      onJumpToLine(matches[idx].line, matches[idx].column);
    },
    [matches, onJumpToLine]
  );

  const handleNext = () => goToMatch(currentMatch + 1);
  const handlePrev = () => goToMatch(currentMatch - 1);

  const handleReplace = () => {
    if (matches.length === 0) return;
    onReplace(findText, replaceText, false);
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;
    onReplace(findText, replaceText, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Enter") {
      if (e.shiftKey) handlePrev();
      else handleNext();
      return;
    }
    if (e.key === "h" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowReplace((v) => !v);
      return;
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 24,
        zIndex: 100,
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "0 0 6px 6px",
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        minWidth: 340,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Find row */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button
          onClick={() => setShowReplace((v) => !v)}
          style={toggleBtnStyle(showReplace)}
          title="置換を表示 (Ctrl+H)"
        >
          ▾
        </button>
        <input
          ref={findRef}
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          placeholder="検索..."
          style={inputStyle}
        />
        <TogBtn active={caseSensitive} onClick={() => setCaseSensitive((v) => !v)} label="Aa" title="大文字小文字を区別" />
        <TogBtn active={wholeWord} onClick={() => setWholeWord((v) => !v)} label="W" title="単語全体を一致" />
        <TogBtn active={useRegex} onClick={() => setUseRegex((v) => !v)} label=".*" title="正規表現" />
        <span style={{ fontSize: 11, color: "var(--fg-muted)", minWidth: 50, textAlign: "center" }}>
          {matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : "0 件"}
        </span>
        <button onClick={handlePrev} style={navBtnStyle} title="前へ (Shift+Enter)">↑</button>
        <button onClick={handleNext} style={navBtnStyle} title="次へ (Enter)">↓</button>
        <button onClick={onClose} style={navBtnStyle} title="閉じる (Esc)">✕</button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", paddingLeft: 24 }}>
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="置換..."
            style={inputStyle}
          />
          <button onClick={handleReplace} style={navBtnStyle} title="置換">
            ↻
          </button>
          <button onClick={handleReplaceAll} style={navBtnStyle} title="すべて置換">
            ↻∀
          </button>
        </div>
      )}
    </div>
  );
}

// ── Match Finding ──

function findMatches(
  content: string,
  searchText: string,
  opts: { caseSensitive: boolean; wholeWord: boolean; useRegex: boolean }
): Match[] {
  const lines = content.split("\n");
  const results: Match[] = [];

  let regex: RegExp;
  try {
    let pattern = opts.useRegex ? searchText : escapeRegex(searchText);
    if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
    const flags = opts.caseSensitive ? "g" : "gi";
    regex = new RegExp(pattern, flags);
  } catch {
    return [];
  }

  for (let i = 0; i < lines.length; i++) {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(lines[i])) !== null) {
      results.push({
        line: i,
        column: match.index,
        length: match[0].length,
      });
      if (match[0].length === 0) break; // Prevent infinite loop on empty match
    }
  }

  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Styles ──

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "4px 8px",
  background: "#313244",
  border: "1px solid var(--border)",
  borderRadius: 3,
  color: "var(--fg-primary)",
  fontSize: 13,
  fontFamily: "var(--font-code)",
  outline: "none",
};

const navBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: "none",
  color: "var(--fg-muted)",
  cursor: "pointer",
  fontSize: 12,
  borderRadius: 3,
};

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    ...navBtnStyle,
    transform: active ? "rotate(0deg)" : "rotate(-90deg)",
    transition: "transform 0.15s",
  };
}

function TogBtn({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title: string }) {
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
