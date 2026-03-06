// ⚒️ EditorCanvas — Canvas-based text editor component
//
// Handles:
// - Canvas rendering via CanvasRenderer
// - Keyboard input (typing, navigation, shortcuts)
// - Mouse input (click to position cursor, drag to select)
// - Scroll (wheel + scrollbar)
// - IME composition (Japanese input via hidden textarea)

import { useRef, useEffect, useCallback, useState } from "react";
import { CanvasRenderer } from "../lib/renderer";
import type { Selection, RenderState, ColoredSpan, DiagnosticMark } from "../lib/renderer";
import { tokenizeLine, colorizeTokens } from "../lib/syntax";

interface EditorCanvasProps {
  content: string;
  language: string;
  cursorLine: number;
  cursorColumn: number;
  onContentChange: (content: string) => void;
  onCursorChange: (line: number, column: number) => void;
  onSave?: () => void;
  diagnosticMarks?: DiagnosticMark[];
  onHoverRequest?: (line: number, col: number, x: number, y: number) => void;
  onHoverDismiss?: () => void;
  onSignatureRequest?: (line: number, col: number, x: number, y: number) => void;
  onSignatureDismiss?: () => void;
  onCompletionRequest?: (line: number, col: number, x: number, y: number, prefix: string) => void;
  onCompletionDismiss?: () => void;
}

export function EditorCanvas({
  content,
  language,
  cursorLine,
  cursorColumn,
  onContentChange,
  onCursorChange,
  onSave,
  diagnosticMarks,
  onHoverRequest,
  onHoverDismiss,
  onSignatureRequest,
  onSignatureDismiss,
  onCompletionRequest,
  onCompletionDismiss,
}: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const linesRef = useRef<string[]>([]);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse content into lines
  useEffect(() => {
    linesRef.current = content.split("\n");
  }, [content]);

  const lines = content.split("\n");
  const totalLines = lines.length;

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new CanvasRenderer(canvas);
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      rendererRef.current?.resize(width, height);
      requestRender();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render loop
  const requestRender = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const { start, end } = renderer.getVisibleLineRange(
      canvasRef.current?.clientHeight ?? 0,
      scrollTop
    );

    // Tokenize visible lines for syntax highlighting
    const visibleLines = lines.slice(start, end);
    const lineTokens: ColoredSpan[][] = visibleLines.map((line) => {
      const tokens = tokenizeLine(line, language);
      return colorizeTokens(line, tokens);
    });

    const state: RenderState = {
      lines: visibleLines,
      cursor: { line: cursorLine, column: cursorColumn },
      selection,
      scrollTop,
      matchBracketPos: findMatchingBracket(lines, cursorLine, cursorColumn),
      totalLines,
      lineTokens,
      diagnosticMarks,
    };

    renderer.render(state);
  }, [lines, cursorLine, cursorColumn, scrollTop, selection, totalLines]);

  // Re-render on state changes
  useEffect(() => {
    const id = requestAnimationFrame(requestRender);
    return () => cancelAnimationFrame(id);
  }, [requestRender]);

  // ── Keyboard Input ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const newLine = Math.max(0, cursorLine - 1);
        const maxCol = lines[newLine]?.length ?? 0;
        onCursorChange(newLine, Math.min(cursorColumn, maxCol));
        if (!shift) setSelection(null);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const newLine = Math.min(totalLines - 1, cursorLine + 1);
        const maxCol = lines[newLine]?.length ?? 0;
        onCursorChange(newLine, Math.min(cursorColumn, maxCol));
        if (!shift) setSelection(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (cursorColumn > 0) {
          onCursorChange(cursorLine, cursorColumn - 1);
        } else if (cursorLine > 0) {
          const prevLine = cursorLine - 1;
          onCursorChange(prevLine, lines[prevLine]?.length ?? 0);
        }
        if (!shift) setSelection(null);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const lineLen = lines[cursorLine]?.length ?? 0;
        if (cursorColumn < lineLen) {
          onCursorChange(cursorLine, cursorColumn + 1);
        } else if (cursorLine < totalLines - 1) {
          onCursorChange(cursorLine + 1, 0);
        }
        if (!shift) setSelection(null);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        onCursorChange(cursorLine, 0);
        if (!shift) setSelection(null);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        onCursorChange(cursorLine, lines[cursorLine]?.length ?? 0);
        if (!shift) setSelection(null);
        return;
      }

      // Ctrl shortcuts
      if (ctrl && e.key === "s") {
        e.preventDefault();
        onSave?.();
        return;
      }
      if (ctrl && e.key === "a") {
        e.preventDefault();
        setSelection({
          start: { line: 0, column: 0 },
          end: { line: totalLines - 1, column: lines[totalLines - 1]?.length ?? 0 },
        });
        return;
      }

      // Backspace
      if (e.key === "Backspace") {
        e.preventDefault();
        if (selection) {
          deleteSelection();
          return;
        }
        if (cursorColumn > 0) {
          const line = lines[cursorLine];
          const newLine = line.slice(0, cursorColumn - 1) + line.slice(cursorColumn);
          const newLines = [...lines];
          newLines[cursorLine] = newLine;
          onContentChange(newLines.join("\n"));
          onCursorChange(cursorLine, cursorColumn - 1);
        } else if (cursorLine > 0) {
          const prevLine = lines[cursorLine - 1];
          const currLine = lines[cursorLine];
          const newCol = prevLine.length;
          const newLines = [...lines];
          newLines[cursorLine - 1] = prevLine + currLine;
          newLines.splice(cursorLine, 1);
          onContentChange(newLines.join("\n"));
          onCursorChange(cursorLine - 1, newCol);
        }
        return;
      }

      // Delete
      if (e.key === "Delete") {
        e.preventDefault();
        if (selection) {
          deleteSelection();
          return;
        }
        const lineLen = lines[cursorLine]?.length ?? 0;
        if (cursorColumn < lineLen) {
          const line = lines[cursorLine];
          const newLine = line.slice(0, cursorColumn) + line.slice(cursorColumn + 1);
          const newLines = [...lines];
          newLines[cursorLine] = newLine;
          onContentChange(newLines.join("\n"));
        } else if (cursorLine < totalLines - 1) {
          const newLines = [...lines];
          newLines[cursorLine] = lines[cursorLine] + lines[cursorLine + 1];
          newLines.splice(cursorLine + 1, 1);
          onContentChange(newLines.join("\n"));
        }
        return;
      }

      // Enter
      if (e.key === "Enter") {
        e.preventDefault();
        if (selection) deleteSelection();
        const line = lines[cursorLine];
        const before = line.slice(0, cursorColumn);
        const after = line.slice(cursorColumn);

        // Auto-indent: match leading whitespace
        const indent = before.match(/^(\s*)/)?.[1] ?? "";

        // Extra indent after { or :
        const lastChar = before.trim().slice(-1);
        const extraIndent = lastChar === "{" || lastChar === ":" ? "    " : "";

        const newLines = [...lines];
        newLines[cursorLine] = before;
        newLines.splice(cursorLine + 1, 0, indent + extraIndent + after);
        onContentChange(newLines.join("\n"));
        onCursorChange(cursorLine + 1, indent.length + extraIndent.length);
        return;
      }

      // Tab
      if (e.key === "Tab") {
        e.preventDefault();
        if (shift) {
          // Outdent
          const line = lines[cursorLine];
          if (line.startsWith("    ")) {
            const newLines = [...lines];
            newLines[cursorLine] = line.slice(4);
            onContentChange(newLines.join("\n"));
            onCursorChange(cursorLine, Math.max(0, cursorColumn - 4));
          } else if (line.startsWith("\t")) {
            const newLines = [...lines];
            newLines[cursorLine] = line.slice(1);
            onContentChange(newLines.join("\n"));
            onCursorChange(cursorLine, Math.max(0, cursorColumn - 1));
          }
        } else {
          // Indent
          insertText("    ");
        }
        return;
      }
    },
    [lines, cursorLine, cursorColumn, totalLines, selection, onContentChange, onCursorChange, onSave]
  );

  // ── Text Input (for regular characters and IME) ──

  const insertText = useCallback(
    (text: string) => {
      const line = lines[cursorLine] ?? "";
      const newLine = line.slice(0, cursorColumn) + text + line.slice(cursorColumn);

      // Handle auto-close brackets
      let autoClose = "";
      if (text.length === 1) {
        const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'", "`": "`" };
        if (pairs[text]) {
          autoClose = pairs[text];
        }
      }

      const newLines = [...lines];
      newLines[cursorLine] = autoClose
        ? line.slice(0, cursorColumn) + text + autoClose + line.slice(cursorColumn)
        : newLine;

      onContentChange(newLines.join("\n"));
      onCursorChange(cursorLine, cursorColumn + text.length);

      // Trigger signature help on '('
      if (text === "(") {
        const canvas = canvasRef.current;
        const renderer = rendererRef.current;
        if (canvas && renderer) {
          const rect = canvas.getBoundingClientRect();
          const gutterW = renderer.getGutterWidth(totalLines);
          const px = rect.left + gutterW + 8 + (cursorColumn + 1) * renderer.getCharWidth();
          const py = rect.top + (cursorLine - Math.floor(scrollTop / renderer.getLineHeight())) * renderer.getLineHeight();
          onSignatureRequest?.(cursorLine, cursorColumn + 1, px, py);
        }
      } else if (text === ")" || text === "\n") {
        onSignatureDismiss?.();
      }

      // Trigger completion on alphanumeric / $ / > / :
      if (text.length === 1 && /[a-zA-Z0-9_$>:]/.test(text)) {
        const lineContent = (autoClose
          ? line.slice(0, cursorColumn) + text + autoClose + line.slice(cursorColumn)
          : newLine);
        // Extract prefix (word before cursor)
        const beforeCursor = lineContent.slice(0, cursorColumn + text.length);
        const prefixMatch = beforeCursor.match(/[\w$>:]+$/);
        const prefix = prefixMatch ? prefixMatch[0] : "";

        if (prefix.length >= 1) {
          const canvas = canvasRef.current;
          const renderer = rendererRef.current;
          if (canvas && renderer) {
            const rect = canvas.getBoundingClientRect();
            const gutterW = renderer.getGutterWidth(totalLines);
            const px = rect.left + gutterW + 8 + (cursorColumn + 1) * renderer.getCharWidth();
            const py = rect.top + (cursorLine - Math.floor(scrollTop / renderer.getLineHeight()) + 1) * renderer.getLineHeight();
            onCompletionRequest?.(cursorLine, cursorColumn + text.length, px, py, prefix);
          }
        }
      } else if (text.length === 1 && /\s/.test(text)) {
        onCompletionDismiss?.();
      }
    },
    [lines, cursorLine, cursorColumn, totalLines, scrollTop, onContentChange, onCursorChange, onSignatureRequest, onSignatureDismiss, onCompletionRequest, onCompletionDismiss]
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;

    const { start, end } = normalizeSelection(selection);
    const before = lines[start.line].slice(0, start.column);
    const after = lines[end.line].slice(end.column);

    const newLines = [
      ...lines.slice(0, start.line),
      before + after,
      ...lines.slice(end.line + 1),
    ];

    onContentChange(newLines.join("\n"));
    onCursorChange(start.line, start.column);
    setSelection(null);
  }, [selection, lines, onContentChange, onCursorChange]);

  // Hidden textarea for IME input
  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const value = textarea.value;
      if (value) {
        insertText(value);
        textarea.value = "";
      }
    },
    [insertText]
  );

  // ── Mouse Input ──

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const gutterW = renderer.getGutterWidth(totalLines);
      const line = renderer.getLineAtY(y, scrollTop);
      const col = renderer.getColumnAtX(x, gutterW);

      const clampedLine = Math.max(0, Math.min(totalLines - 1, line));
      const lineLen = lines[clampedLine]?.length ?? 0;
      const clampedCol = Math.max(0, Math.min(lineLen, col));

      onCursorChange(clampedLine, clampedCol);
      setSelection(null);
      setIsSelecting(true);

      // Focus hidden textarea for keyboard input
      textareaRef.current?.focus();
    },
    [totalLines, scrollTop, lines, onCursorChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const renderer = rendererRef.current;
      if (!renderer) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const gutterW = renderer.getGutterWidth(totalLines);
      const line = Math.max(0, Math.min(totalLines - 1, renderer.getLineAtY(y, scrollTop)));
      const lineLen = lines[line]?.length ?? 0;
      const col = Math.max(0, Math.min(lineLen, renderer.getColumnAtX(x, gutterW)));

      // Selection dragging
      if (isSelecting) {
        setSelection({
          start: { line: cursorLine, column: cursorColumn },
          end: { line, column: col },
        });
      }

      // Hover detection (300ms delay)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      onHoverDismiss?.();
      hoverTimerRef.current = setTimeout(() => {
        if (!isSelecting) {
          onHoverRequest?.(line, col, e.clientX, e.clientY + 20);
        }
      }, 300);
    },
    [isSelecting, totalLines, scrollTop, lines, cursorLine, cursorColumn, onHoverRequest, onHoverDismiss]
  );

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // ── Scroll ──

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const renderer = rendererRef.current;
      if (!renderer) return;

      const maxScroll = renderer.getMaxScroll(
        totalLines,
        canvasRef.current?.clientHeight ?? 0
      );
      setScrollTop((prev) => Math.max(0, Math.min(maxScroll, prev + e.deltaY)));
    },
    [totalLines]
  );

  // Auto-scroll to cursor
  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;

    const lineH = renderer.getLineHeight();
    const viewH = canvas.clientHeight;
    const cursorY = cursorLine * lineH;

    if (cursorY < scrollTop) {
      setScrollTop(cursorY);
    } else if (cursorY + lineH > scrollTop + viewH) {
      setScrollTop(cursorY + lineH - viewH);
    }
  }, [cursorLine]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "text",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      {/* Hidden textarea for IME + keyboard input */}
      <textarea
        ref={textareaRef}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        autoFocus
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          padding: 0,
          border: "none",
          outline: "none",
          resize: "none",
          overflow: "hidden",
          whiteSpace: "pre",
          fontSize: 16, // Prevents zoom on iOS
        }}
      />
    </div>
  );
}

function findMatchingBracket(lines: string[], line: number, col: number): { line: number; column: number } | null {
  const brackets: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const closeBrackets: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const currentLine = lines[line];
  if (!currentLine) return null;

  const ch = currentLine[col];
  const prevCh = col > 0 ? currentLine[col - 1] : undefined;

  // Check current char or previous char
  let searchChar: string;
  let searchCol: number;
  let isForward: boolean;

  if (ch && brackets[ch]) {
    searchChar = ch;
    searchCol = col;
    isForward = true;
  } else if (prevCh && closeBrackets[prevCh]) {
    searchChar = prevCh;
    searchCol = col - 1;
    isForward = false;
  } else if (ch && closeBrackets[ch]) {
    searchChar = ch;
    searchCol = col;
    isForward = false;
  } else if (prevCh && brackets[prevCh]) {
    searchChar = prevCh;
    searchCol = col - 1;
    isForward = true;
  } else {
    return null;
  }

  const matchChar = isForward ? brackets[searchChar] : closeBrackets[searchChar];
  let depth = 0;

  if (isForward) {
    for (let l = line; l < lines.length && l < line + 500; l++) {
      const startC = l === line ? searchCol : 0;
      for (let c = startC; c < lines[l].length; c++) {
        if (lines[l][c] === searchChar) depth++;
        if (lines[l][c] === matchChar) { depth--; if (depth === 0) return { line: l, column: c }; }
      }
    }
  } else {
    for (let l = line; l >= 0 && l > line - 500; l--) {
      const startC = l === line ? searchCol : lines[l].length - 1;
      for (let c = startC; c >= 0; c--) {
        if (lines[l][c] === searchChar) depth++;
        if (lines[l][c] === matchChar) { depth--; if (depth === 0) return { line: l, column: c }; }
      }
    }
  }

  return null;
}

function normalizeSelection(sel: Selection): Selection {
  if (
    sel.start.line > sel.end.line ||
    (sel.start.line === sel.end.line && sel.start.column > sel.end.column)
  ) {
    return { start: sel.end, end: sel.start };
  }
  return sel;
}
