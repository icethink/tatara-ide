// ⚒️ Markdown Preview — Live rendered markdown viewer
//
// Features:
// - GitHub-flavored-ish rendering (headings, lists, code, links, images, tables)
// - Syntax highlighting for code blocks (reuses our tokenizer colors)
// - Dark theme matching Catppuccin Mocha
// - Split view support (editor left, preview right)
// - Scroll sync (approximate)

import { useMemo, useState } from "react";

interface MarkdownPreviewProps {
  content: string;
  filename: string;
  /** If true, show as standalone preview. If false, just the rendered HTML. */
  standalone?: boolean;
}

export function MarkdownPreview({ content, filename, standalone = true }: MarkdownPreviewProps) {
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview");
  const html = useMemo(() => renderMarkdown(content), [content]);

  if (!standalone) {
    return <div style={previewBodyStyle} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 12px",
        borderBottom: "1px solid var(--border)",
        fontSize: 11,
        color: "var(--fg-muted)",
        userSelect: "none",
        flexShrink: 0,
      }}>
        <span>📄 {filename}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <ModeBtn active={viewMode === "preview"} onClick={() => setViewMode("preview")}>
            プレビュー
          </ModeBtn>
          <ModeBtn active={viewMode === "source"} onClick={() => setViewMode("source")}>
            ソース
          </ModeBtn>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {viewMode === "preview" ? (
          <div style={previewBodyStyle} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre style={{
            padding: "16px 24px",
            margin: 0,
            fontFamily: "var(--font-code)",
            fontSize: 13,
            lineHeight: 1.6,
            color: "#cdd6f4",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "2px 10px",
      background: active ? "rgba(137, 180, 250, 0.2)" : "transparent",
      border: "none",
      borderRadius: 3,
      color: active ? "#89b4fa" : "#6c7086",
      cursor: "pointer",
      fontSize: 11,
      fontWeight: 600,
    }}>
      {children}
    </button>
  );
}

const previewBodyStyle: React.CSSProperties = {
  padding: "24px 32px",
  maxWidth: 800,
  margin: "0 auto",
  lineHeight: 1.7,
  color: "#cdd6f4",
  fontSize: 14,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// ── Markdown Renderer (lightweight, no dependencies) ──

function renderMarkdown(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let i = 0;
  let inCodeBlock = false;
  let codeContent = "";
  let inList: "ul" | "ol" | null = null;
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList) {
      html += `</${inList}>`;
      inList = null;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      html += "<table style=\"border-collapse:collapse;width:100%;margin:12px 0\">";
      tableRows.forEach((row, ri) => {
        const tag = ri === 0 ? "th" : "td";
        html += "<tr>";
        row.forEach((cell) => {
          const style = "padding:6px 12px;border:1px solid #45475a;text-align:left";
          const bgStyle = ri === 0 ? ";background:#313244;font-weight:600" : "";
          html += `<${tag} style="${style}${bgStyle}">${inlineFormat(cell.trim())}</${tag}>`;
        });
        html += "</tr>";
      });
      html += "</table>";
      tableRows = [];
      inTable = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html += `<pre style="background:#313244;border-radius:6px;padding:12px 16px;overflow-x:auto;margin:12px 0;font-size:13px;line-height:1.5"><code>${escapeHtml(codeContent.trimEnd())}</code></pre>`;
        inCodeBlock = false;
        codeContent = "";
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
        // codeLang = line.slice(3).trim(); // TODO: syntax highlight by language
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      i++;
      continue;
    }

    // Table detection
    if (line.includes("|") && line.trim().startsWith("|")) {
      const cells = line.split("|").slice(1, -1);
      // Check if separator row
      if (cells.every((c) => /^[\s:-]+$/.test(c))) {
        i++;
        continue;
      }
      if (!inTable) {
        flushList();
        inTable = true;
      }
      tableRows.push(cells);
      i++;
      continue;
    } else {
      flushTable();
    }

    // Empty line
    if (line.trim() === "") {
      flushList();
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const sizes = ["1.8em", "1.5em", "1.25em", "1.1em", "1em", "0.9em"];
      const borderBottom = level <= 2 ? ";border-bottom:1px solid #45475a;padding-bottom:6px" : "";
      html += `<h${level} style="font-size:${sizes[level - 1]};margin:20px 0 8px;color:#cdd6f4;font-weight:600${borderBottom}">${inlineFormat(headingMatch[2])}</h${level}>`;
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList();
      html += `<hr style="border:none;border-top:1px solid #45475a;margin:16px 0">`;
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      flushList();
      let quote = "";
      while (i < lines.length && lines[i].startsWith(">")) {
        quote += lines[i].replace(/^>\s?/, "") + "\n";
        i++;
      }
      html += `<blockquote style="border-left:3px solid #89b4fa;margin:12px 0;padding:8px 16px;color:#a6adc8;background:#181825;border-radius:0 4px 4px 0">${inlineFormat(quote.trim())}</blockquote>`;
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*+]\s/.test(line)) {
      if (inList !== "ul") {
        flushList();
        inList = "ul";
        html += `<ul style="margin:8px 0;padding-left:24px">`;
      }
      const text = line.replace(/^[\s]*[-*+]\s/, "");
      html += `<li style="margin:2px 0">${inlineFormat(text)}</li>`;
      i++;
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s/.test(line)) {
      if (inList !== "ol") {
        flushList();
        inList = "ol";
        html += `<ol style="margin:8px 0;padding-left:24px">`;
      }
      const text = line.replace(/^[\s]*\d+\.\s/, "");
      html += `<li style="margin:2px 0">${inlineFormat(text)}</li>`;
      i++;
      continue;
    }

    // Checkbox
    if (/^[\s]*[-*]\s\[([ xX])\]/.test(line)) {
      if (inList !== "ul") {
        flushList();
        inList = "ul";
        html += `<ul style="margin:8px 0;padding-left:8px;list-style:none">`;
      }
      const checked = /\[[xX]\]/.test(line);
      const text = line.replace(/^[\s]*[-*]\s\[[ xX]\]\s?/, "");
      const checkbox = checked
        ? `<span style="color:#a6e3a1;margin-right:6px">☑</span>`
        : `<span style="color:#585b70;margin-right:6px">☐</span>`;
      html += `<li style="margin:2px 0">${checkbox}${inlineFormat(text)}</li>`;
      i++;
      continue;
    }

    // Paragraph
    flushList();
    html += `<p style="margin:8px 0">${inlineFormat(line)}</p>`;
    i++;
  }

  flushList();
  flushTable();

  return html;
}

// ── Inline formatting ──

function inlineFormat(text: string): string {
  let result = escapeHtml(text);

  // Images: ![alt](url)
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:4px 0">');

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#89b4fa;text-decoration:none" target="_blank">$1</a>');

  // Bold + italic: ***text***
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f5e0dc">$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong style="color:#f5e0dc">$1</strong>');

  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, '<del style="color:#6c7086">$1</del>');

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g,
    '<code style="background:#313244;padding:2px 6px;border-radius:3px;font-size:0.9em;color:#f38ba8;font-family:var(--font-code)">$1</code>');

  // Line breaks
  result = result.replace(/  $/gm, "<br>");

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
