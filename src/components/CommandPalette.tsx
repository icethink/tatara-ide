// ⚒️ Command Palette — Ctrl+Shift+P (VS Code / PHPStorm style)

import { useState, useEffect, useRef, useMemo } from "react";
import { defaultBindings, type KeyBinding } from "../hooks/useKeybindings";

interface CommandPaletteProps {
  visible: boolean;
  onClose: () => void;
  onExecute: (action: string) => void;
}

export function CommandPalette({ visible, onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [visible]);

  // Filter commands by fuzzy match
  const filtered = useMemo(() => {
    if (!query) return defaultBindings;
    const lower = query.toLowerCase();
    return defaultBindings.filter(
      (b) =>
        b.label.toLowerCase().includes(lower) ||
        b.action.toLowerCase().includes(lower) ||
        b.key.includes(lower),
    );
  }, [query]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  if (!visible) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      onExecute(filtered[selectedIndex].action);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
        }}
      />

      {/* Palette */}
      <div
        style={{
          position: "fixed",
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          maxWidth: "90vw",
          background: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 1000,
          overflow: "hidden",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="> コマンドを入力..."
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--fg-primary)",
              fontSize: 14,
              fontFamily: "var(--font-code)",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {filtered.map((cmd, i) => (
            <CommandItem
              key={cmd.action}
              binding={cmd}
              selected={i === selectedIndex}
              onClick={() => {
                onExecute(cmd.action);
                onClose();
              }}
            />
          ))}
          {filtered.length === 0 && (
            <div style={{
              padding: "16px 20px",
              color: "var(--fg-muted)",
              fontSize: 13,
              textAlign: "center",
            }}>
              コマンドが見つかりません
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CommandItem({
  binding,
  selected,
  onClick,
}: {
  binding: KeyBinding;
  selected: boolean;
  onClick: () => void;
}) {
  const categoryIcons: Record<string, string> = {
    search: "🔍",
    navigation: "🧭",
    edit: "✏️",
    panel: "🖥️",
    file: "📂",
    debug: "🐛",
  };

  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        background: selected ? "var(--sidebar-active)" : "transparent",
        fontSize: 13,
      }}
    >
      <span>
        <span style={{ marginRight: 8 }}>
          {categoryIcons[binding.category] || "⚡"}
        </span>
        {binding.label}
      </span>
      <kbd
        style={{
          fontSize: 11,
          padding: "1px 6px",
          background: "#313244",
          border: "1px solid #45475a",
          borderRadius: 3,
          color: "var(--fg-muted)",
          fontFamily: "var(--font-code)",
        }}
      >
        {binding.key}
      </kbd>
    </div>
  );
}
