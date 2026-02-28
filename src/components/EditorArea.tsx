// ⚒️ Editor Area — Main code editing surface
// Phase 1: Canvas-based text rendering with tree-sitter highlighting

import { useRef, useEffect } from "react";

export function EditorArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to container
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      render(ctx, canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="editor-area" style={{
      flex: 1,
      position: "relative",
      background: "var(--editor-bg)",
      overflow: "hidden",
    }}>
      {/* Tab bar */}
      <div style={{
        height: 36,
        background: "var(--tab-inactive-bg)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
      }}>
        <div style={{
          padding: "0 16px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          fontSize: 13,
          color: "var(--tab-active-fg)",
          background: "var(--tab-active-bg)",
          borderBottom: "1px solid var(--accent)",
        }}>
          ⚒️ ようこそ
        </div>
      </div>

      {/* Editor canvas */}
      <div style={{ flex: 1, position: "relative", height: "calc(100% - 36px)" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />

        {/* Welcome overlay */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          color: "var(--fg-muted)",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚒️</div>
          <h1 style={{
            fontSize: 24,
            fontWeight: 300,
            color: "var(--fg-secondary)",
            marginBottom: 8,
          }}>
            Tatara IDE
          </h1>
          <p style={{ fontSize: 14, opacity: 0.6 }}>
            コードを、鍛える。
          </p>
          <div style={{ marginTop: 24, fontSize: 13 }}>
            <div style={{ marginBottom: 4 }}>
              <kbd style={kbdStyle}>Ctrl+O</kbd> ファイルを開く
            </div>
            <div style={{ marginBottom: 4 }}>
              <kbd style={kbdStyle}>Ctrl+P</kbd> ファイル検索
            </div>
            <div style={{ marginBottom: 4 }}>
              <kbd style={kbdStyle}>Ctrl+Shift+P</kbd> コマンドパレット
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: 11,
  fontFamily: "var(--font-code)",
  background: "#313244",
  border: "1px solid #45475a",
  borderRadius: 4,
  marginRight: 8,
};

function render(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Clear canvas
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--editor-bg").trim() || "#1e1e2e";
  ctx.fillRect(0, 0, width, height);

  // TODO: Phase 1 — Render text buffer with line numbers and syntax highlighting
}
