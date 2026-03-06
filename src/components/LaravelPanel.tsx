// ⚒️ Laravel Panel — Logs, Routes, Artisan, Cache management
//
// The "Laravel toolbox" — everything you'd otherwise do in terminal.

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface LaravelInfo {
  is_laravel: boolean;
  version: string | null;
  env: string | null;
  debug: boolean | null;
}

interface LogFile {
  name: string;
  path: string;
  size: number;
  modified: number;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: string | null;
}

interface RouteEntry {
  method: string;
  uri: string;
  name: string | null;
  action: string;
  middleware: string[];
}

interface LaravelPanelProps {
  projectPath: string | null;
}

type TabId = "logs" | "routes" | "artisan" | "cache";

export function LaravelPanel({ projectPath }: LaravelPanelProps) {
  const [info, setInfo] = useState<LaravelInfo | null>(null);
  const [tab, setTab] = useState<TabId>("logs");

  useEffect(() => {
    if (projectPath) {
      invoke<LaravelInfo>("laravel_detect", { projectPath }).then(setInfo);
    }
  }, [projectPath]);

  if (!info || !info.is_laravel) {
    return (
      <div style={{ padding: 20, color: "#585b70", fontSize: 12, textAlign: "center" }}>
        Laravel プロジェクトではありません
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 12 }}>
      {/* Header */}
      <div style={{
        padding: "6px 12px",
        borderBottom: "1px solid #313244",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "#6c7086",
        flexShrink: 0,
      }}>
        <span style={{ color: "#f38ba8" }}>🔥</span>
        <span>Laravel {info.version || ""}</span>
        {info.env && (
          <span style={{
            padding: "0 6px",
            background: info.env === "production" ? "rgba(243,139,168,0.15)" : "rgba(166,227,161,0.15)",
            color: info.env === "production" ? "#f38ba8" : "#a6e3a1",
            borderRadius: 3,
            fontSize: 10,
          }}>
            {info.env}
          </span>
        )}
        {info.debug && (
          <span style={{ color: "#f9e2af", fontSize: 10 }}>DEBUG</span>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid #313244",
        fontSize: 11,
        flexShrink: 0,
      }}>
        {([
          ["logs", "📋 ログ"],
          ["routes", "🛣️ ルート"],
          ["artisan", "⚡ Artisan"],
          ["cache", "🗑️ キャッシュ"],
        ] as [TabId, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "4px 12px",
            background: tab === id ? "rgba(137,180,250,0.05)" : "transparent",
            border: "none",
            borderBottom: tab === id ? "2px solid #89b4fa" : "2px solid transparent",
            color: tab === id ? "#cdd6f4" : "#6c7086",
            cursor: "pointer",
            fontSize: 11,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {tab === "logs" && <LogsTab projectPath={projectPath!} />}
        {tab === "routes" && <RoutesTab projectPath={projectPath!} />}
        {tab === "artisan" && <ArtisanTab projectPath={projectPath!} />}
        {tab === "cache" && <CacheTab projectPath={projectPath!} />}
      </div>
    </div>
  );
}

// ── Logs Tab ──

function LogsTab({ projectPath }: { projectPath: string }) {
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  useEffect(() => {
    invoke<LogFile[]>("laravel_logs", { projectPath }).then(setLogFiles);
  }, [projectPath]);

  const openLog = useCallback(async (path: string) => {
    setSelectedLog(path);
    const e = await invoke<LogEntry[]>("laravel_read_log", { path, maxLines: 500 });
    setEntries(e.reverse()); // Newest first
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Log file list */}
      {!selectedLog ? (
        logFiles.length === 0 ? (
          <div style={{ padding: 12, color: "#585b70" }}>ログファイルがありません</div>
        ) : (
          logFiles.map((f) => (
            <div key={f.name} onClick={() => openLog(f.path)} style={{
              padding: "6px 12px",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              color: "#cdd6f4",
              borderBottom: "1px solid #1e1e2e",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#313244"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span>📄 {f.name}</span>
              <span style={{ color: "#585b70", fontSize: 10 }}>
                {formatSize(f.size)}
              </span>
            </div>
          ))
        )
      ) : (
        <>
          <div style={{
            padding: "4px 12px",
            borderBottom: "1px solid #313244",
            display: "flex",
            alignItems: "center",
            fontSize: 11,
            color: "#6c7086",
            flexShrink: 0,
          }}>
            <button onClick={() => setSelectedLog(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#89b4fa", fontSize: 11, marginRight: 8 }}>
              ← 戻る
            </button>
            {selectedLog.split(/[/\\]/).pop()}
            <span style={{ marginLeft: 8, color: "#585b70" }}>{entries.length} エントリ</span>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {entries.map((entry, i) => (
              <div key={i} style={{
                padding: "4px 12px",
                borderBottom: "1px solid #1e1e2e",
                cursor: entry.context ? "pointer" : "default",
              }}
                onClick={() => entry.context && setExpandedEntry(expandedEntry === i ? null : i)}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ color: levelColor(entry.level), fontWeight: 600, flexShrink: 0, fontSize: 10, width: 55, textAlign: "center" }}>
                    {entry.level}
                  </span>
                  <span style={{ color: "#585b70", flexShrink: 0, fontSize: 10 }}>
                    {entry.timestamp}
                  </span>
                  <span style={{ color: "#cdd6f4", flex: 1 }}>{entry.message}</span>
                  {entry.context && <span style={{ color: "#585b70", fontSize: 10 }}>▸</span>}
                </div>
                {expandedEntry === i && entry.context && (
                  <pre style={{
                    marginTop: 4,
                    padding: 8,
                    background: "#181825",
                    borderRadius: 4,
                    fontSize: 10,
                    color: "#a6adc8",
                    overflow: "auto",
                    maxHeight: 200,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}>
                    {entry.context}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Routes Tab ──

function RoutesTab({ projectPath }: { projectPath: string }) {
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await invoke<RouteEntry[]>("laravel_routes", { projectPath });
      setRoutes(r);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [projectPath]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter
    ? routes.filter((r) => r.uri.includes(filter) || r.action.includes(filter) || (r.name || "").includes(filter))
    : routes;

  if (error) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ color: "#f38ba8", marginBottom: 8 }}>ルート取得エラー</div>
        <div style={{ color: "#a6adc8", fontSize: 11 }}>{error}</div>
        <div style={{ color: "#585b70", fontSize: 10, marginTop: 8 }}>
          💡 php artisan route:list が実行できるか確認してください
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "6px 12px", borderBottom: "1px solid #313244", flexShrink: 0 }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ルートを検索..."
          style={{
            width: "100%",
            padding: "4px 8px",
            background: "#313244",
            border: "1px solid #45475a",
            borderRadius: 3,
            color: "#cdd6f4",
            fontSize: 11,
            outline: "none",
          }}
        />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 12, color: "#585b70" }}>読み込み中...</div>
        ) : (
          filtered.map((r, i) => (
            <div key={i} style={{
              padding: "4px 12px",
              borderBottom: "1px solid #1e1e2e",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}>
              <span style={{
                color: methodColor(r.method),
                fontWeight: 700,
                fontSize: 10,
                width: 50,
                textAlign: "center",
                flexShrink: 0,
              }}>
                {r.method}
              </span>
              <span style={{ color: "#cdd6f4", flex: 1 }}>{r.uri}</span>
              {r.name && <span style={{ color: "#89b4fa", fontSize: 10 }}>{r.name}</span>}
              <span style={{ color: "#585b70", fontSize: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.action.replace(/^App\\Http\\Controllers\\/, "")}
              </span>
            </div>
          ))
        )}
        <div style={{ padding: "4px 12px", color: "#585b70", fontSize: 10 }}>
          {filtered.length} / {routes.length} ルート
        </div>
      </div>
    </div>
  );
}

// ── Artisan Tab ──

function ArtisanTab({ projectPath }: { projectPath: string }) {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [commands, setCommands] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    invoke<string[]>("laravel_artisan_commands", { projectPath })
      .then(setCommands)
      .catch(() => {});
  }, [projectPath]);

  const run = useCallback(async () => {
    if (!command.trim()) return;
    setLoading(true);
    try {
      const args = command.trim().split(/\s+/);
      const result = await invoke<{ success: boolean; output: string; error: string }>("laravel_artisan", { projectPath, args });
      setOutput(result.output + (result.error ? `\n--- STDERR ---\n${result.error}` : ""));
    } catch (e) {
      setOutput(`エラー: ${e}`);
    }
    setLoading(false);
  }, [projectPath, command]);

  const suggestions = command
    ? commands.filter((c) => c.startsWith(command.split(" ")[0]))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 8, borderBottom: "1px solid #313244", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6, position: "relative" }}>
          <span style={{ color: "#585b70", fontSize: 11, lineHeight: "28px" }}>php artisan</span>
          <input
            value={command}
            onChange={(e) => { setCommand(e.target.value); setShowSuggestions(true); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { run(); setShowSuggestions(false); }
              if (e.key === "Escape") setShowSuggestions(false);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="migrate, make:model, route:list ..."
            style={{
              flex: 1,
              padding: "4px 8px",
              background: "#313244",
              border: "1px solid #45475a",
              borderRadius: 3,
              color: "#cdd6f4",
              fontFamily: "var(--font-code)",
              fontSize: 12,
              outline: "none",
            }}
          />
          <button onClick={run} disabled={loading} style={{
            padding: "4px 12px",
            background: "#89b4fa",
            border: "none",
            borderRadius: 3,
            color: "#1e1e2e",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}>
            {loading ? "..." : "▶"}
          </button>
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && suggestions.length > 0 && suggestions.length < 20 && (
          <div style={{
            marginTop: 4,
            background: "#1e1e2e",
            border: "1px solid #45475a",
            borderRadius: 4,
            maxHeight: 150,
            overflow: "auto",
          }}>
            {suggestions.map((s) => (
              <div key={s}
                onMouseDown={() => { setCommand(s); setShowSuggestions(false); }}
                style={{
                  padding: "3px 8px",
                  cursor: "pointer",
                  color: "#cdd6f4",
                  fontSize: 11,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#313244"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {["migrate", "migrate:status", "route:list", "queue:work --once", "tinker"].map((cmd) => (
            <button key={cmd} onClick={() => { setCommand(cmd); }} style={{
              padding: "2px 8px",
              background: "rgba(137,180,250,0.08)",
              border: "1px solid #313244",
              borderRadius: 3,
              color: "#89b4fa",
              cursor: "pointer",
              fontSize: 10,
            }}>
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      <pre style={{
        flex: 1,
        overflow: "auto",
        padding: 8,
        margin: 0,
        fontFamily: "var(--font-code)",
        fontSize: 11,
        lineHeight: 1.5,
        color: "#a6adc8",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}>
        {output || "コマンドを入力して ▶ で実行"}
      </pre>
    </div>
  );
}

// ── Cache Tab ──

function CacheTab({ projectPath }: { projectPath: string }) {
  const [results, setResults] = useState<{ type: string; message: string; success: boolean }[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const clearCache = useCallback(async (cacheType: string, label: string) => {
    setLoading(cacheType);
    try {
      const msg = await invoke<string>("laravel_clear_cache", { projectPath, cacheType });
      setResults((prev) => [...prev, { type: label, message: msg, success: true }]);
    } catch (e) {
      setResults((prev) => [...prev, { type: label, message: String(e), success: false }]);
    }
    setLoading(null);
  }, [projectPath]);

  const cacheTypes = [
    { id: "all", label: "すべてクリア", desc: "config + route + view + cache + event", icon: "🧹", color: "#f38ba8" },
    { id: "config", label: "設定キャッシュ", desc: "config:clear", icon: "⚙️", color: "#89b4fa" },
    { id: "route", label: "ルートキャッシュ", desc: "route:clear", icon: "🛣️", color: "#a6e3a1" },
    { id: "view", label: "ビューキャッシュ", desc: "view:clear", icon: "🎨", color: "#f9e2af" },
    { id: "cache", label: "アプリキャッシュ", desc: "cache:clear", icon: "💾", color: "#cba6f7" },
    { id: "event", label: "イベントキャッシュ", desc: "event:clear", icon: "📡", color: "#fab387" },
  ];

  return (
    <div>
      <div style={{ padding: "8px 12px 4px", color: "#585b70", fontSize: 10 }}>
        キャッシュクリアボタン — もう artisan を手打ちしなくていい
      </div>
      {cacheTypes.map((ct) => (
        <div key={ct.id} style={{
          padding: "8px 12px",
          borderBottom: "1px solid #1e1e2e",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span>{ct.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#cdd6f4" }}>{ct.label}</div>
            <div style={{ color: "#585b70", fontSize: 10 }}>{ct.desc}</div>
          </div>
          <button
            onClick={() => clearCache(ct.id, ct.label)}
            disabled={loading === ct.id}
            style={{
              padding: "4px 12px",
              background: "transparent",
              border: `1px solid ${ct.color}`,
              borderRadius: 4,
              color: ct.color,
              cursor: loading === ct.id ? "not-allowed" : "pointer",
              fontSize: 11,
              opacity: loading === ct.id ? 0.5 : 1,
            }}
          >
            {loading === ct.id ? "..." : "クリア"}
          </button>
        </div>
      ))}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ padding: 8 }}>
          {results.map((r, i) => (
            <div key={i} style={{
              padding: "3px 8px",
              fontSize: 11,
              color: r.success ? "#a6e3a1" : "#f38ba8",
            }}>
              {r.success ? "✓" : "✕"} {r.type}: {r.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function levelColor(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR": case "CRITICAL": case "ALERT": case "EMERGENCY": return "#f38ba8";
    case "WARNING": return "#f9e2af";
    case "INFO": case "NOTICE": return "#89b4fa";
    case "DEBUG": return "#a6e3a1";
    default: return "#6c7086";
  }
}

function methodColor(method: string): string {
  if (method.includes("GET")) return "#a6e3a1";
  if (method.includes("POST")) return "#89b4fa";
  if (method.includes("PUT") || method.includes("PATCH")) return "#f9e2af";
  if (method.includes("DELETE")) return "#f38ba8";
  return "#6c7086";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
