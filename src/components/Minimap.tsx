// ⚒️ Minimap — Code overview sidebar (right edge of editor)
//
// Shows a miniature view of the entire file for navigation

import { useRef, useEffect, useCallback } from "react";

interface MinimapProps {
  lines: string[];
  visibleStartLine: number;
  visibleEndLine: number;
  totalLines: number;
  cursorLine: number;
  onLineClick: (line: number) => void;
  width?: number;
}

const CHAR_WIDTH = 1.4;
const LINE_HEIGHT = 2.4;
const MAX_CHARS = 80;

export function Minimap({
  lines,
  visibleStartLine,
  visibleEndLine,
  totalLines,
  cursorLine,
  onLineClick,
  width = 60,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const height = containerRef.current?.clientHeight ?? 400;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "rgba(17, 17, 27, 0.6)";
    ctx.fillRect(0, 0, width, height);

    // Scale to fit
    const scale = Math.min(1, height / (totalLines * LINE_HEIGHT));
    const scaledLineH = LINE_HEIGHT * scale;

    // Visible area highlight
    const visY = visibleStartLine * scaledLineH;
    const visH = (visibleEndLine - visibleStartLine) * scaledLineH;
    ctx.fillStyle = "rgba(137, 180, 250, 0.08)";
    ctx.fillRect(0, visY, width, visH);
    ctx.strokeStyle = "rgba(137, 180, 250, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, visY, width, visH);

    // Current line
    const cursorY = cursorLine * scaledLineH;
    ctx.fillStyle = "rgba(243, 139, 168, 0.3)";
    ctx.fillRect(0, cursorY, width, scaledLineH);

    // Render code blocks
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || !line.trim()) continue;

      const y = i * scaledLineH;
      if (y > height) break;

      const indent = line.match(/^(\s*)/)?.[0].length ?? 0;
      const textLen = Math.min(line.trim().length, MAX_CHARS);
      const x = indent * CHAR_WIDTH * 0.5;
      const w = textLen * CHAR_WIDTH * 0.5;

      // Color based on content
      let color = "rgba(205, 214, 244, 0.3)";
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) {
        color = "rgba(108, 112, 134, 0.3)"; // comment
      } else if (trimmed.startsWith("function") || trimmed.startsWith("class") || trimmed.startsWith("public") || trimmed.startsWith("private")) {
        color = "rgba(203, 166, 247, 0.4)"; // keyword
      } else if (trimmed.startsWith("return") || trimmed.startsWith("if") || trimmed.startsWith("for") || trimmed.startsWith("while")) {
        color = "rgba(249, 226, 175, 0.4)"; // control
      }

      ctx.fillStyle = color;
      ctx.fillRect(x + 4, y, Math.max(2, w), Math.max(1, scaledLineH - 0.5));
    }
  }, [lines, visibleStartLine, visibleEndLine, totalLines, cursorLine, width]);

  useEffect(() => {
    render();
  }, [render]);

  // Resize
  useEffect(() => {
    const observer = new ResizeObserver(() => render());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [render]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      const height = rect.height;
      const scale = Math.min(1, height / (totalLines * LINE_HEIGHT));
      const line = Math.floor(y / (LINE_HEIGHT * scale));
      onLineClick(Math.max(0, Math.min(totalLines - 1, line)));
    },
    [totalLines, onLineClick]
  );

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height: "100%",
        borderLeft: "1px solid var(--border)",
        cursor: "pointer",
        flexShrink: 0,
      }}
      onClick={handleClick}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
