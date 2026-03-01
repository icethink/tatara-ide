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

export interface RenderState {
  lines: string[];
  cursor: CursorPos;
  selection: Selection | null;
  scrollTop: number;
  matchBracketPos: CursorPos | null;
  totalLines: number;
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

      // Text content
      ctx.fillStyle = cfg.fgColor;
      const textX = gutterW + cfg.padding;
      const textY = y + cfg.lineHeight / 2;
      const displayText = this.expandTabs(state.lines[i] ?? "");
      ctx.fillText(displayText, textX, textY);
    }

    // Gutter separator
    ctx.strokeStyle = "rgba(88, 91, 112, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gutterW, 0);
    ctx.lineTo(gutterW, h);
    ctx.stroke();

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
