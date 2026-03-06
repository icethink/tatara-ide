// ⚒️ Canvas Text Renderer
// High-performance text rendering engine for the editor
//
// Renders: line numbers, text content, cursor, selections, bracket highlights
// Uses requestAnimationFrame for smooth 60fps rendering

export interface RenderConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  tabSize: number;
  // Colors (from theme)
  bgColor: string;
  fgColor: string;
  gutterBg: string;
  gutterFg: string;
  gutterActiveFg: string;
  cursorColor: string;
  selectionBg: string;
  matchBracketBg: string;
  currentLineBg: string;
  indentGuideColor: string;
  whitespaceColor: string;
  // Layout
  gutterWidth: number;
  padding: number;
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 14,
  lineHeight: 22,
  tabSize: 4,
  bgColor: "#1E1E2E",
  fgColor: "#CDD6F4",
  gutterBg: "#181825",
  gutterFg: "#585B70",
  gutterActiveFg: "#BAC2DE",
  cursorColor: "#F5E0DC",
  selectionBg: "rgba(137, 180, 250, 0.25)",
  matchBracketBg: "rgba(243, 139, 168, 0.3)",
  currentLineBg: "rgba(49, 50, 68, 0.5)",
  indentGuideColor: "rgba(88, 91, 112, 0.2)",
  whitespaceColor: "rgba(88, 91, 112, 0.4)",
  gutterWidth: 60,
  padding: 8,
};

export interface CursorPos {
  line: number;
  column: number;
}

export interface Selection {
  start: CursorPos;
  end: CursorPos;
}

export type GutterMark = "added" | "modified" | "deleted";

export interface DiagnosticMark {
  line: number;
  startCol: number;
  endCol: number;
  severity: "error" | "warning" | "information" | "hint";
}

export interface RenderState {
  lines: string[];
  cursor: CursorPos;
  selection: Selection | null;
  scrollTop: number;
  matchBracketPos: CursorPos | null;
  totalLines: number;
  lineTokens?: ColoredSpan[][];
  gutterMarks?: Map<number, GutterMark>;
  diagnosticMarks?: DiagnosticMark[];
}

export interface ColoredSpan {
  text: string;
  color: string;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: RenderConfig;
  private charWidth: number = 0;
  private animFrameId: number | null = null;
  private cursorVisible: boolean = true;
  private cursorBlinkInterval: ReturnType<typeof setInterval> | null = null;
  private dpr: number;
  public showWhitespace: boolean = true;
  public showIndentGuides: boolean = true;

  constructor(canvas: HTMLCanvasElement, config?: Partial<RenderConfig>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
    this.dpr = window.devicePixelRatio || 1;

    this.measureCharWidth();
    this.startCursorBlink();
  }

  private measureCharWidth(): void {
    this.ctx.font = `${this.config.fontSize}px ${this.config.fontFamily}`;
    this.charWidth = this.ctx.measureText("M").width;

    // Update gutter width based on max line numbers
    // Will be recalculated on render
  }

  updateConfig(config: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...config };
    this.measureCharWidth();
  }

  resize(width: number, height: number): void {
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.dpr, this.dpr);
    this.measureCharWidth();
  }

  // ── Gutter Width Calculation ──

  private calcGutterWidth(totalLines: number): number {
    const digits = Math.max(3, String(totalLines).length);
    return digits * this.charWidth + this.config.padding * 2 + 8;
  }

  // ── Viewport Calculations ──

  getVisibleLineRange(height: number, scrollTop: number): { start: number; end: number } {
    const start = Math.floor(scrollTop / this.config.lineHeight);
    const visibleCount = Math.ceil(height / this.config.lineHeight) + 1;
    return { start, end: start + visibleCount };
  }

  getLineAtY(y: number, scrollTop: number): number {
    return Math.floor((y + scrollTop) / this.config.lineHeight);
  }

  getColumnAtX(x: number, gutterWidth: number): number {
    const textX = x - gutterWidth - this.config.padding;
    if (textX < 0) return 0;
    return Math.round(textX / this.charWidth);
  }

  // ── Main Render ──

  render(state: RenderState): void {
    const { width, height } = this.canvas.style;
    const w = parseInt(width);
    const h = parseInt(height);

    if (!w || !h) return;

    const ctx = this.ctx;
    const cfg = this.config;
    const gutterW = this.calcGutterWidth(state.totalLines);

    // Clear
    ctx.fillStyle = cfg.bgColor;
    ctx.fillRect(0, 0, w, h);

    const { start: firstVisible } = this.getVisibleLineRange(h, state.scrollTop);
    const offsetY = -(state.scrollTop % cfg.lineHeight);

    // Render each visible line
    for (let i = 0; i < state.lines.length; i++) {
      const lineIdx = firstVisible + i;
      const y = offsetY + i * cfg.lineHeight;

      if (y + cfg.lineHeight < 0 || y > h) continue;

      // Current line highlight
      if (lineIdx === state.cursor.line) {
        ctx.fillStyle = cfg.currentLineBg;
        ctx.fillRect(gutterW, y, w - gutterW, cfg.lineHeight);
      }

      // Selection highlight
      if (state.selection) {
        this.renderSelection(ctx, state.selection, lineIdx, y, gutterW, w);
      }

      // Bracket match highlight
      if (state.matchBracketPos && state.matchBracketPos.line === lineIdx) {
        const bracketX = gutterW + cfg.padding + state.matchBracketPos.column * this.charWidth;
        ctx.fillStyle = cfg.matchBracketBg;
        ctx.fillRect(bracketX, y, this.charWidth, cfg.lineHeight);
      }

      // Gutter background
      ctx.fillStyle = cfg.gutterBg;
      ctx.fillRect(0, y, gutterW, cfg.lineHeight);

      // Line number
      ctx.font = `${cfg.fontSize}px ${cfg.fontFamily}`;
      ctx.fillStyle = lineIdx === state.cursor.line ? cfg.gutterActiveFg : cfg.gutterFg;
      ctx.textBaseline = "middle";
      const lineNum = String(lineIdx + 1);
      const numX = gutterW - cfg.padding - ctx.measureText(lineNum).width;
      ctx.fillText(lineNum, numX, y + cfg.lineHeight / 2);

      // Git gutter marks
      if (state.gutterMarks) {
        const mark = state.gutterMarks.get(lineIdx);
        if (mark) {
          const markColor = mark === "added" ? "#a6e3a1"
            : mark === "modified" ? "#89b4fa"
            : "#f38ba8";
          ctx.fillStyle = markColor;
          ctx.fillRect(gutterW - 3, y, 3, cfg.lineHeight);
        }
      }

      // Indent guides
      if (state.lines[i]) {
        this.renderIndentGuides(ctx, state.lines[i], y, gutterW, cfg);
      }

      // Whitespace visualization
      if (this.showWhitespace) {
        this.renderWhitespace(ctx, state.lines[i] ?? "", y, gutterW, cfg);
      }

      // Text content (with syntax highlighting if available)
      const textX = gutterW + cfg.padding;
      const textY = y + cfg.lineHeight / 2;

      if (state.lineTokens && state.lineTokens[i]) {
        // Render with syntax colors
        let x = textX;
        for (const span of state.lineTokens[i]) {
          const text = this.expandTabs(span.text);
          ctx.fillStyle = span.color;
          ctx.fillText(text, x, textY);
          x += ctx.measureText(text).width;
        }
      } else {
        // Plain text fallback
        ctx.fillStyle = cfg.fgColor;
        const displayText = this.expandTabs(state.lines[i] ?? "");
        ctx.fillText(displayText, textX, textY);
      }
    }

    // Gutter separator
    ctx.strokeStyle = "rgba(88, 91, 112, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gutterW, 0);
    ctx.lineTo(gutterW, h);
    ctx.stroke();

    // Diagnostic squiggly lines
    if (state.diagnosticMarks) {
      for (const mark of state.diagnosticMarks) {
        if (mark.line < firstVisible || mark.line >= firstVisible + state.lines.length) continue;
        const screenLine = mark.line - firstVisible;
        const lineY = offsetY + screenLine * cfg.lineHeight;
        const startX = gutterW + cfg.padding + mark.startCol * this.charWidth;
        const endX = gutterW + cfg.padding + mark.endCol * this.charWidth;
        const squiggleY = lineY + cfg.lineHeight - 3;

        ctx.strokeStyle = mark.severity === "error" ? "#f38ba8"
          : mark.severity === "warning" ? "#f9e2af"
          : mark.severity === "information" ? "#89b4fa"
          : "#a6e3a1";
        ctx.lineWidth = 1;
        ctx.beginPath();

        const amplitude = 2;
        const wavelength = 4;
        for (let x = startX; x < endX; x += 1) {
          const y = squiggleY + amplitude * Math.sin((x - startX) * Math.PI / wavelength);
          if (x === startX) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    }

    // Cursor
    if (this.cursorVisible && state.cursor.line >= firstVisible) {
      const cursorScreenLine = state.cursor.line - firstVisible;
      const cursorY = offsetY + cursorScreenLine * cfg.lineHeight;
      const cursorX = gutterW + cfg.padding + state.cursor.column * this.charWidth;

      ctx.fillStyle = cfg.cursorColor;
      ctx.fillRect(cursorX, cursorY, 2, cfg.lineHeight);
    }
  }

  private renderSelection(
    ctx: CanvasRenderingContext2D,
    sel: Selection,
    lineIdx: number,
    y: number,
    gutterW: number,
    canvasW: number
  ): void {
    const { start, end } = this.normalizeSelection(sel);

    if (lineIdx < start.line || lineIdx > end.line) return;

    const cfg = this.config;
    ctx.fillStyle = cfg.selectionBg;

    if (start.line === end.line) {
      // Single line selection
      const x1 = gutterW + cfg.padding + start.column * this.charWidth;
      const x2 = gutterW + cfg.padding + end.column * this.charWidth;
      ctx.fillRect(x1, y, x2 - x1, cfg.lineHeight);
    } else if (lineIdx === start.line) {
      const x = gutterW + cfg.padding + start.column * this.charWidth;
      ctx.fillRect(x, y, canvasW - x, cfg.lineHeight);
    } else if (lineIdx === end.line) {
      const x = gutterW + cfg.padding + end.column * this.charWidth;
      ctx.fillRect(gutterW + cfg.padding, y, x - gutterW - cfg.padding, cfg.lineHeight);
    } else {
      // Full line
      ctx.fillRect(gutterW, y, canvasW - gutterW, cfg.lineHeight);
    }
  }

  private normalizeSelection(sel: Selection): Selection {
    if (
      sel.start.line > sel.end.line ||
      (sel.start.line === sel.end.line && sel.start.column > sel.end.column)
    ) {
      return { start: sel.end, end: sel.start };
    }
    return sel;
  }

  private expandTabs(text: string): string {
    const tabStr = " ".repeat(this.config.tabSize);
    return text.replace(/\t/g, tabStr);
  }

  // ── Cursor Blink ──

  private startCursorBlink(): void {
    this.cursorBlinkInterval = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
    }, 530);
  }

  resetCursorBlink(): void {
    this.cursorVisible = true;
    if (this.cursorBlinkInterval) {
      clearInterval(this.cursorBlinkInterval);
    }
    this.startCursorBlink();
  }

  // ── Scroll Helpers ──

  getMaxScroll(totalLines: number, viewportHeight: number): number {
    return Math.max(0, totalLines * this.config.lineHeight - viewportHeight);
  }

  scrollToLine(line: number, viewportHeight: number): number {
    const targetY = line * this.config.lineHeight;
    const halfView = viewportHeight / 2;
    return Math.max(0, targetY - halfView);
  }

  // ── Indent Guides ──

  private renderIndentGuides(
    ctx: CanvasRenderingContext2D,
    line: string,
    y: number,
    gutterW: number,
    cfg: RenderConfig
  ): void {
    if (!this.showIndentGuides) return;

    // Count leading whitespace
    const match = line.match(/^(\s*)/);
    if (!match || match[1].length === 0) return;

    const leadingSpaces = match[1].replace(/\t/g, " ".repeat(cfg.tabSize)).length;
    const indentLevels = Math.floor(leadingSpaces / cfg.tabSize);

    ctx.strokeStyle = cfg.indentGuideColor;
    ctx.lineWidth = 1;

    for (let level = 0; level < indentLevels; level++) {
      const x = gutterW + cfg.padding + level * cfg.tabSize * this.charWidth + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + cfg.lineHeight);
      ctx.stroke();
    }
  }

  // ── Whitespace Visualization ──

  private renderWhitespace(
    ctx: CanvasRenderingContext2D,
    line: string,
    y: number,
    gutterW: number,
    cfg: RenderConfig
  ): void {
    const midY = y + cfg.lineHeight / 2;
    const dotSize = 1.5;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const x = gutterW + cfg.padding + i * this.charWidth;

      if (ch === " ") {
        // Show trailing spaces and spaces within indent
        const isTrailing = line.slice(i).trim().length === 0;
        const isLeading = line.slice(0, i).trim().length === 0;

        if (isTrailing || isLeading) {
          ctx.fillStyle = cfg.whitespaceColor;
          ctx.beginPath();
          ctx.arc(x + this.charWidth / 2, midY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ch === "\t") {
        ctx.strokeStyle = cfg.whitespaceColor;
        ctx.lineWidth = 1;
        const tabW = cfg.tabSize * this.charWidth;
        const arrowY = midY;
        ctx.beginPath();
        ctx.moveTo(x + 2, arrowY);
        ctx.lineTo(x + tabW - 2, arrowY);
        // Arrow head
        ctx.lineTo(x + tabW - 5, arrowY - 3);
        ctx.moveTo(x + tabW - 2, arrowY);
        ctx.lineTo(x + tabW - 5, arrowY + 3);
        ctx.stroke();
      }
    }
  }

  // ── Cleanup ──

  destroy(): void {
    if (this.cursorBlinkInterval) {
      clearInterval(this.cursorBlinkInterval);
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  // ── Getters ──

  getCharWidth(): number {
    return this.charWidth;
  }

  getLineHeight(): number {
    return this.config.lineHeight;
  }

  getGutterWidth(totalLines: number): number {
    return this.calcGutterWidth(totalLines);
  }
}
