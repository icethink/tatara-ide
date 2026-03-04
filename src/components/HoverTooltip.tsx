// ⚒️ Hover Tooltip — Shows type info / documentation on hover
//
// Appears when hovering over a symbol in the editor.
// Renders markdown content from LSP hover response.

import { useMemo } from "react";

interface HoverTooltipProps {
  visible: boolean;
  content: string;
  x: number;
  y: number;
}

export function HoverTooltip({ visible, content, x, y }: HoverTooltipProps) {
  const html = useMemo(() => renderHoverContent(content), [content]);

  if (!visible || !content) return null;

  return (
    <div style={{
      position: "fixed",
      left: Math.min(x, window.innerWidth - 420),
      top: y,
      maxWidth: 400,
      maxHeight: 300,
      overflow: "auto",
      background: "#1e1e2e",
      border: "1px solid #45475a",
      borderRadius: 6,
      padding: "8px 12px",
      fontSize: 12,
      lineHeight: 1.5,
      color: "#cdd6f4",
      fontFamily: "var(--font-code)",
      zIndex: 400,
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      pointerEvents: "none",
    }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function renderHoverContent(content: string): string {
  if (!content) return "";

  // Simple markdown-ish rendering for LSP hover
  let html = escapeHtml(content);

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
    '<pre style="background:#313244;padding:6px 10px;border-radius:4px;margin:4px 0;overflow-x:auto;font-size:11px"><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g,
    '<code style="background:#313244;padding:1px 4px;border-radius:2px;color:#f38ba8">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  // Horizontal rules
  html = html.replace(/<br>---<br>/g, '<hr style="border:none;border-top:1px solid #45475a;margin:6px 0">');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
