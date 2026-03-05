// ⚒️ File Tree — Explorer panel with collapsible directory tree

import { useState, useCallback } from "react";

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

interface FileTreeProps {
  root: FileNode | null;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
  onContextMenu?: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}

export function FileTree({ root, onFileSelect, selectedPath, onContextMenu }: FileTreeProps) {
  if (!root) {
    return (
      <div style={{ padding: "8px 12px", color: "var(--fg-muted)", fontSize: 13 }}>
        プロジェクトを開いてください (Ctrl+O)
      </div>
    );
  }

  return (
    <div style={{ fontSize: 13, userSelect: "none" }}>
      {root.children?.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth,
  onFileSelect,
  selectedPath,
  onContextMenu,
}: {
  node: FileNode;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedPath?: string;
  onContextMenu?: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedPath === node.path;

  const handleClick = useCallback(() => {
    if (node.isDir) {
      setExpanded((e) => !e);
    } else {
      onFileSelect(node.path);
    }
  }, [node, onFileSelect]);

  const indent = depth * 16 + 8;

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(e, node.path, node.isDir);
        }}
        style={{
          padding: "2px 8px 2px 0",
          paddingLeft: indent,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: isSelected ? "var(--sidebar-active)" : "transparent",
          color: isSelected ? "var(--fg-primary)" : "var(--fg-secondary)",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = "var(--sidebar-hover)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Chevron for directories */}
        {node.isDir ? (
          <span style={{
            fontSize: 10,
            width: 14,
            textAlign: "center",
            color: "var(--fg-muted)",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            display: "inline-block",
          }}>
            ▶
          </span>
        ) : (
          <span style={{ width: 14 }} />
        )}

        {/* Icon */}
        <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>
          {node.isDir
            ? expanded ? "📂" : "📁"
            : fileIcon(node.name)}
        </span>

        {/* Name */}
        <span style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {node.name}
        </span>
      </div>

      {/* Children */}
      {node.isDir && expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          onFileSelect={onFileSelect}
          selectedPath={selectedPath}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

function fileIcon(name: string): string {
  if (name.endsWith(".php")) return "🐘";
  if (name.endsWith(".blade.php")) return "🔪";
  if (name.endsWith(".vue")) return "💚";
  if (name.endsWith(".tsx") || name.endsWith(".jsx")) return "⚛️";
  if (name.endsWith(".ts") || name.endsWith(".js")) return "📜";
  if (name.endsWith(".css") || name.endsWith(".scss")) return "🎨";
  if (name.endsWith(".json")) return "📋";
  if (name.endsWith(".toml") || name.endsWith(".yaml") || name.endsWith(".yml")) return "⚙️";
  if (name.endsWith(".md")) return "📝";
  if (name.endsWith(".rs")) return "🦀";
  if (name.endsWith(".html")) return "🌐";
  if (name.endsWith(".env") || name.startsWith(".env")) return "🔒";
  if (name === ".gitignore" || name === ".gitattributes") return "🌿";
  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".svg")) return "🖼️";
  return "📄";
}
