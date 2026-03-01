// ⚒️ Autocomplete Dropdown — Shows completion suggestions

import { useState, useEffect, useRef } from "react";
import type { CompletionItem } from "../lib/autocomplete";

interface AutocompleteProps {
  items: CompletionItem[];
  visible: boolean;
  x: number;
  y: number;
  onSelect: (item: CompletionItem) => void;
  onClose: () => void;
}

export function Autocomplete({ items, visible, x, y, onSelect, onClose }: AutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!visible) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (items[selectedIndex]) onSelect(items[selectedIndex]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [visible, items, selectedIndex, onSelect, onClose]);

  if (!visible || items.length === 0) return null;

  return (
    <div
      ref={listRef}
      style={{
        position: "fixed",
        left: x,
        top: y,
        minWidth: 250,
        maxWidth: 400,
        maxHeight: 200,
        overflow: "auto",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        zIndex: 300,
        fontSize: 13,
        fontFamily: "var(--font-code)",
      }}
    >
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          onClick={() => onSelect(item)}
          style={{
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            background: i === selectedIndex ? "var(--sidebar-active)" : "transparent",
            borderLeft: i === selectedIndex ? "2px solid var(--accent)" : "2px solid transparent",
          }}
        >
          <span style={{
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 3,
            background: kindColor(item.kind),
            color: "var(--bg-primary)",
            flexShrink: 0,
          }}>
            {kindIcon(item.kind)}
          </span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.label}
          </span>
          {item.detail && (
            <span style={{ fontSize: 11, color: "var(--fg-muted)", flexShrink: 0 }}>
              {item.detail}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function kindIcon(kind: string): string {
  switch (kind) {
    case "keyword": return "K";
    case "function": return "f";
    case "class": return "C";
    case "snippet": return "S";
    case "tag": return "<>";
    case "attribute": return "@";
    case "value": return "V";
    case "directive": return "@";
    case "tailwind": return "T";
    default: return "?";
  }
}

function kindColor(kind: string): string {
  switch (kind) {
    case "keyword": return "#cba6f7";
    case "function": return "#89b4fa";
    case "class": return "#f9e2af";
    case "snippet": return "#a6e3a1";
    case "tag": return "#f38ba8";
    case "attribute": return "#fab387";
    case "directive": return "#cba6f7";
    case "tailwind": return "#94e2d5";
    default: return "#6c7086";
  }
}
