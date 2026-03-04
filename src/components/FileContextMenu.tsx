// ⚒️ File Context Menu — Right-click actions for file tree

import { useState, useEffect } from "react";

interface FileContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  targetPath: string;
  isDir: boolean;
  onClose: () => void;
  onNewFile: (parentDir: string) => void;
  onNewFolder: (parentDir: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onCopyPath: (path: string) => void;
  onRevealInExplorer: (path: string) => void;
}

export function FileContextMenu({
  visible, x, y, targetPath, isDir, onClose,
  onNewFile, onNewFolder, onRename, onDelete, onCopyPath, onRevealInExplorer
}: FileContextMenuProps) {
  // Close on click outside or Escape
  useEffect(() => {
    if (!visible) return;
    const handleClose = () => onClose();
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    setTimeout(() => document.addEventListener("click", handleClose), 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClose);
      document.removeEventListener("keydown", handleKey);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const parentDir = isDir ? targetPath : targetPath.replace(/[/\\][^/\\]+$/, "");

  return (
    <div style={{
      position: "fixed",
      left: x,
      top: y,
      minWidth: 180,
      background: "#1e1e2e",
      border: "1px solid #45475a",
      borderRadius: 6,
      padding: "4px 0",
      zIndex: 500,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      fontSize: 12,
      color: "#cdd6f4",
    }}>
      <MenuItem icon="📄" label="新しいファイル" onClick={() => onNewFile(parentDir)} />
      <MenuItem icon="📁" label="新しいフォルダ" onClick={() => onNewFolder(parentDir)} />
      <Divider />
      <MenuItem icon="✏️" label="名前の変更" shortcut="F2" onClick={() => onRename(targetPath)} />
      <MenuItem icon="🗑️" label="削除" danger onClick={() => onDelete(targetPath)} />
      <Divider />
      <MenuItem icon="📋" label="パスをコピー" onClick={() => onCopyPath(targetPath)} />
      <MenuItem icon="📂" label="エクスプローラーで表示" onClick={() => onRevealInExplorer(targetPath)} />
    </div>
  );
}

function MenuItem({ icon, label, shortcut, danger, onClick }: {
  icon: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        padding: "4px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        color: danger ? "#f38ba8" : "#cdd6f4",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#313244"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ width: 16, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{ color: "#585b70", fontSize: 10 }}>{shortcut}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #313244", margin: "4px 0" }} />;
}

// ── File Operation Dialog ──

interface FileDialogProps {
  visible: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export function FileDialog({ visible, title, defaultValue, placeholder, onSubmit, onClose }: FileDialogProps) {
  const [value, setValue] = useState(defaultValue || "");

  useEffect(() => {
    if (visible) setValue(defaultValue || "");
  }, [visible, defaultValue]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 600,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#1e1e2e",
        border: "1px solid #45475a",
        borderRadius: 8,
        padding: 20,
        width: 350,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 14, color: "#cdd6f4", marginBottom: 12, fontWeight: 600 }}>
          {title}
        </div>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
            if (e.key === "Escape") onClose();
          }}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "#313244",
            border: "1px solid #45475a",
            borderRadius: 4,
            color: "#cdd6f4",
            fontSize: 13,
            fontFamily: "var(--font-code)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btnStyle("#6c7086")}>キャンセル</button>
          <button onClick={() => value.trim() && onSubmit(value.trim())} style={btnStyle("#89b4fa")}>OK</button>
        </div>
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "6px 16px",
    background: "transparent",
    border: `1px solid ${color}`,
    borderRadius: 4,
    color,
    cursor: "pointer",
    fontSize: 12,
  };
}
