// ⚒️ Go To Line — Ctrl+G line jump dialog

import { useState, useRef, useEffect } from "react";

interface GoToLineProps {
  visible: boolean;
  totalLines: number;
  onClose: () => void;
  onJump: (line: number) => void;
}

export function GoToLine({ visible, totalLines, onClose, onJump }: GoToLineProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
      setValue("");
    }
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = () => {
    const line = parseInt(value);
    if (line >= 1 && line <= totalLines) {
      onJump(line - 1); // Convert to 0-indexed
      onClose();
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: "20%",
      left: "50%",
      transform: "translateX(-50%)",
      width: 320,
      background: "var(--bg-secondary)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 12,
      zIndex: 200,
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 8 }}>
        行番号を入力 (1〜{totalLines})
      </div>
      <input
        ref={inputRef}
        type="number"
        min={1}
        max={totalLines}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onClose();
        }}
        placeholder={`行番号 (1-${totalLines})`}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: "#313244",
          border: "1px solid var(--border)",
          borderRadius: 4,
          color: "var(--fg-primary)",
          fontSize: 14,
          fontFamily: "var(--font-code)",
          outline: "none",
        }}
      />
    </div>
  );
}
