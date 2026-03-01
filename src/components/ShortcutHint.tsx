// ⚒️ Shortcut Hint — Shows keyboard shortcut when hovering over menu items
//
// Design doc: "マウス操作時にショートカットを表示"

import { useState } from "react";
import { defaultBindings } from "../hooks/useKeybindings";

interface ShortcutHintProps {
  action: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function ShortcutHint({ action, children, position = "bottom" }: ShortcutHintProps) {
  const [showHint, setShowHint] = useState(false);
  const binding = defaultBindings.find((b) => b.action === action);

  if (!binding) return <>{children}</>;

  const shortcutText = formatShortcut(binding.key);

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShowHint(true)}
      onMouseLeave={() => setShowHint(false)}
    >
      {children}
      {showHint && (
        <div style={{
          position: "absolute",
          ...getPositionStyle(position),
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "4px 8px",
          fontSize: 11,
          whiteSpace: "nowrap",
          zIndex: 100,
          pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <span style={{ color: "var(--fg-secondary)" }}>{binding.label}</span>
          <kbd style={{
            padding: "1px 5px",
            background: "rgba(137, 180, 250, 0.15)",
            borderRadius: 3,
            fontSize: 10,
            fontFamily: "var(--font-code)",
            color: "var(--accent)",
          }}>
            {shortcutText}
          </kbd>
        </div>
      )}
    </div>
  );
}

/** Floating shortcut toast that appears briefly when a shortcut is used */
export function ShortcutToast({ shortcut, visible }: { shortcut: string; visible: boolean }) {
  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 40,
      left: "50%",
      transform: "translateX(-50%)",
      background: "var(--bg-tertiary)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "8px 16px",
      fontSize: 13,
      zIndex: 500,
      display: "flex",
      alignItems: "center",
      gap: 8,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      animation: "fadeIn 0.15s ease-out",
    }}>
      <kbd style={{
        padding: "2px 8px",
        background: "rgba(137, 180, 250, 0.15)",
        borderRadius: 4,
        fontFamily: "var(--font-code)",
        fontSize: 12,
        color: "var(--accent)",
      }}>
        {shortcut}
      </kbd>
    </div>
  );
}

function formatShortcut(key: string): string {
  return key
    .split("+")
    .map((k) => {
      switch (k) {
        case "ctrl": return "Ctrl";
        case "shift": return "Shift";
        case "alt": return "Alt";
        case "enter": return "Enter";
        case "escape": return "Esc";
        case "`": return "`";
        default: return k.toUpperCase();
      }
    })
    .join("+");
}

function getPositionStyle(pos: string): React.CSSProperties {
  switch (pos) {
    case "top": return { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4 };
    case "bottom": return { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 4 };
    case "left": return { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: 4 };
    case "right": return { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: 4 };
    default: return {};
  }
}
