// ⚒️ Image Viewer — Preview images and SVGs
//
// Supports: PNG, JPG, GIF, WebP, SVG, ICO, BMP
// Features: Zoom, fit-to-window, actual size, checkerboard bg for transparency

import { useState, useRef, useCallback, useEffect } from "react";

interface ImageViewerProps {
  path: string;
  filename: string;
}

export function ImageViewer({ path, filename }: ImageViewerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [fileSize, setFileSize] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fitMode, setFitMode] = useState<"fit" | "actual">("fit");
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image via Tauri IPC (read as base64)
  useEffect(() => {
    loadImage(path).then(({ dataUrl, size }) => {
      setSrc(dataUrl);
      setFileSize(size);
    }).catch((e) => {
      setError(e.message || String(e));
    });
  }, [path]);

  const handleLoad = useCallback(() => {
    if (imgRef.current) {
      setNaturalSize({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(z * 1.25, 10));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.25, 0.1));
  const resetZoom = () => { setZoom(1); setFitMode("actual"); };
  const fitToWindow = () => { setZoom(1); setFitMode("fit"); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
  }, []);

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const isSvg = ext === "svg";

  if (error) {
    return (
      <div style={centerStyle}>
        <div style={{ color: "#f38ba8", fontSize: 14 }}>❌ 画像を読み込めませんでした</div>
        <div style={{ color: "#6c7086", fontSize: 12, marginTop: 8 }}>{error}</div>
      </div>
    );
  }

  if (!src) {
    return (
      <div style={centerStyle}>
        <div style={{ color: "#6c7086" }}>読み込み中...</div>
      </div>
    );
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>{isSvg ? "🎨" : "🖼️"} {filename}</span>
          {naturalSize.w > 0 && (
            <span style={{ color: "#585b70" }}>
              {naturalSize.w} × {naturalSize.h}
            </span>
          )}
          {fileSize && <span style={{ color: "#585b70" }}>{fileSize}</span>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <ToolBtn onClick={zoomOut} title="縮小">−</ToolBtn>
          <span style={{ minWidth: 45, textAlign: "center", lineHeight: "22px" }}>
            {Math.round(zoom * 100)}%
          </span>
          <ToolBtn onClick={zoomIn} title="拡大">+</ToolBtn>
          <ToolBtn onClick={fitToWindow} title="ウィンドウに合わせる" active={fitMode === "fit"}>Fit</ToolBtn>
          <ToolBtn onClick={resetZoom} title="実寸" active={fitMode === "actual"}>1:1</ToolBtn>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Checkerboard for transparency
          backgroundImage: `
            linear-gradient(45deg, #313244 25%, transparent 25%),
            linear-gradient(-45deg, #313244 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #313244 75%),
            linear-gradient(-45deg, transparent 75%, #313244 75%)
          `,
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
          backgroundColor: "#1e1e2e",
          padding: 20,
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={filename}
          onLoad={handleLoad}
          style={{
            maxWidth: fitMode === "fit" ? "100%" : undefined,
            maxHeight: fitMode === "fit" ? "100%" : undefined,
            width: fitMode === "actual" ? `${naturalSize.w * zoom}px` : undefined,
            height: fitMode === "actual" ? `${naturalSize.h * zoom}px` : undefined,
            objectFit: "contain",
            imageRendering: zoom > 2 ? "pixelated" : "auto",
            transition: "width 0.1s, height 0.1s",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// ── Toolbar Button ──

function ToolBtn({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        padding: "2px 8px",
        background: active ? "rgba(137, 180, 250, 0.2)" : "transparent",
        border: "1px solid transparent",
        borderRadius: 3,
        color: active ? "#89b4fa" : "#6c7086",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

// ── Load Image via Tauri or fallback ──

async function loadImage(path: string): Promise<{ dataUrl: string; size: string }> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<{ base64: string; mime: string; size: number }>("read_file_raw", { path });
    const dataUrl = `data:${result.mime};base64,${result.base64}`;
    return { dataUrl, size: formatBytes(result.size) };
  } catch {
    return { dataUrl: `file://${path}`, size: "" };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
