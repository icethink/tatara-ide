// ⚒️ Database Panel — Browse & query your Laravel database
//
// Auto-connects from .env, shows tables, lets you browse data and run SQL.
// The panel that makes phpMyAdmin unnecessary.

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface TableInfo {
  name: string;
  row_count: number | null;
  engine: string | null;
}

interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  key: string;
  default_value: string | null;
  extra: string;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
  affected_rows: number | null;
  execution_time_ms: number;
  error: string | null;
}

interface DbConnection {
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  connected: boolean;
  error: string | null;
}

interface DatabasePanelProps {
  projectPath: string | null;
}

export function DatabasePanel({ projectPath }: DatabasePanelProps) {
  const [connection, setConnection] = useState<DbConnection | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [previewData, setPreviewData] = useState<QueryResult | null>(null);
  const [sqlInput, setSqlInput] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"tables" | "query">("tables");
  const [allowWrite, setAllowWrite] = useState(false);

  // Auto-connect on mount
  useEffect(() => {
    if (projectPath) {
      connectDb();
    }
  }, [projectPath]);

  const connectDb = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const conn = await invoke<DbConnection>("db_connect", { projectPath });
      setConnection(conn);
      if (conn.connected) {
        const t = await invoke<TableInfo[]>("db_tables", { projectPath });
        setTables(t);
      }
    } catch (e) {
      setConnection({ driver: "", host: "", port: 0, database: "", username: "", connected: false, error: String(e) });
    }
    setLoading(false);
  }, [projectPath]);

  const selectTable = useCallback(async (table: string) => {
    if (!projectPath) return;
    setSelectedTable(table);
    setLoading(true);
    try {
      const [cols, preview] = await Promise.all([
        invoke<ColumnInfo[]>("db_describe", { projectPath, table }),
        invoke<QueryResult>("db_preview", { projectPath, table, limit: 50 }),
      ]);
      setColumns(cols);
      setPreviewData(preview);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [projectPath]);

  const executeQuery = useCallback(async () => {
    if (!projectPath || !sqlInput.trim()) return;
    setLoading(true);
    try {
      const result = await invoke<QueryResult>("db_query", {
        projectPath,
        sql: sqlInput,
        allowWrite,
      });
      setQueryResult(result);
    } catch (e) {
      setQueryResult({
        columns: [], rows: [], affected_rows: null,
        execution_time_ms: 0, error: String(e),
      });
    }
    setLoading(false);
  }, [projectPath, sqlInput, allowWrite]);

  // Not connected yet
  if (!connection) {
    return (
      <div style={{ padding: 20, color: "#6c7086", textAlign: "center" }}>
        {loading ? "接続中..." : ".env からデータベースに接続します"}
        {projectPath && !loading && (
          <button onClick={connectDb} style={connectBtnStyle}>
            🔌 接続
          </button>
        )}
      </div>
    );
  }

  if (!connection.connected) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ color: "#f38ba8", marginBottom: 8 }}>
          ⊘ 接続エラー
        </div>
        <div style={{ color: "#a6adc8", fontSize: 12, marginBottom: 12 }}>
          {connection.error}
        </div>
        <div style={{ color: "#585b70", fontSize: 11 }}>
          {connection.driver && `ドライバ: ${connection.driver}`}
          {connection.host && ` | ホスト: ${connection.host}:${connection.port}`}
          {connection.database && ` | DB: ${connection.database}`}
        </div>
        <button onClick={connectDb} style={{ ...connectBtnStyle, marginTop: 12 }}>
          🔄 再接続
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
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
        <span style={{ color: "#a6e3a1" }}>●</span>
        <span>{connection.driver}</span>
        <span style={{ color: "#45475a" }}>|</span>
        <span>{connection.database}</span>
        {connection.host && (
          <>
            <span style={{ color: "#45475a" }}>@</span>
            <span>{connection.host}</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <TabBtn active={view === "tables"} onClick={() => setView("tables")}>📋 テーブル</TabBtn>
        <TabBtn active={view === "query"} onClick={() => setView("query")}>⚡ SQL</TabBtn>
      </div>

      {view === "tables" ? (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Table list */}
          <div style={{
            width: 200,
            borderRight: "1px solid #313244",
            overflow: "auto",
            flexShrink: 0,
          }}>
            {tables.map((t) => (
              <div
                key={t.name}
                onClick={() => selectTable(t.name)}
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  background: selectedTable === t.name ? "rgba(137,180,250,0.1)" : "transparent",
                  color: selectedTable === t.name ? "#89b4fa" : "#cdd6f4",
                  borderLeft: selectedTable === t.name ? "2px solid #89b4fa" : "2px solid transparent",
                }}
                onMouseEnter={(e) => { if (selectedTable !== t.name) e.currentTarget.style.background = "#313244"; }}
                onMouseLeave={(e) => { if (selectedTable !== t.name) e.currentTarget.style.background = "transparent"; }}
              >
                <span>📄 {t.name}</span>
                {t.row_count != null && (
                  <span style={{ color: "#585b70", fontSize: 10 }}>{t.row_count}</span>
                )}
              </div>
            ))}
          </div>

          {/* Table content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
            {selectedTable && columns.length > 0 && (
              <>
                {/* Column info */}
                <div style={{
                  padding: "6px 12px",
                  borderBottom: "1px solid #313244",
                  fontSize: 11,
                  color: "#a6adc8",
                  flexShrink: 0,
                }}>
                  <strong style={{ color: "#cdd6f4" }}>{selectedTable}</strong>
                  <span style={{ marginLeft: 8, color: "#585b70" }}>
                    {columns.length} カラム
                    {previewData && !previewData.error && ` | ${previewData.rows.length} 行表示`}
                  </span>
                </div>

                {/* Data grid */}
                {previewData && !previewData.error && (
                  <DataGrid columns={previewData.columns} rows={previewData.rows} />
                )}
              </>
            )}

            {!selectedTable && (
              <div style={{ padding: 20, color: "#585b70", textAlign: "center" }}>
                テーブルを選択してください
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SQL Query view */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* SQL Input */}
          <div style={{ padding: 8, borderBottom: "1px solid #313244", flexShrink: 0 }}>
            <textarea
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  executeQuery();
                }
              }}
              placeholder="SELECT * FROM users WHERE ..."
              style={{
                width: "100%",
                minHeight: 60,
                maxHeight: 200,
                background: "#313244",
                border: "1px solid #45475a",
                borderRadius: 4,
                color: "#cdd6f4",
                fontFamily: "var(--font-code)",
                fontSize: 12,
                padding: "8px 12px",
                resize: "vertical",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <button onClick={executeQuery} disabled={loading} style={{
                padding: "4px 16px",
                background: "#89b4fa",
                border: "none",
                borderRadius: 4,
                color: "#1e1e2e",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}>
                {loading ? "実行中..." : "⚡ 実行 (Ctrl+Enter)"}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6c7086", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allowWrite}
                  onChange={(e) => setAllowWrite(e.target.checked)}
                  style={{ accentColor: "#f38ba8" }}
                />
                書き込みを許可
              </label>
              {queryResult && !queryResult.error && (
                <span style={{ color: "#585b70", fontSize: 10, marginLeft: "auto" }}>
                  {queryResult.rows.length} 行 | {queryResult.execution_time_ms}ms
                </span>
              )}
            </div>
          </div>

          {/* Query results */}
          {queryResult && (
            queryResult.error ? (
              <div style={{ padding: 12, color: "#f38ba8", fontSize: 12 }}>
                ⊘ {queryResult.error}
              </div>
            ) : (
              <DataGrid columns={queryResult.columns} rows={queryResult.rows} />
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Data Grid ──

function DataGrid({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  if (columns.length === 0) return null;

  return (
    <div style={{ flex: 1, overflow: "auto", fontSize: 12 }}>
      <table style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "var(--font-code)",
      }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={{
                padding: "4px 12px",
                textAlign: "left",
                borderBottom: "2px solid #313244",
                background: "#181825",
                color: "#89b4fa",
                fontWeight: 600,
                fontSize: 11,
                position: "sticky",
                top: 0,
                whiteSpace: "nowrap",
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(137,180,250,0.03)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {row.map((val, j) => (
                <td key={j} style={{
                  padding: "3px 12px",
                  borderBottom: "1px solid #1e1e2e",
                  maxWidth: 300,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: val === null ? "#585b70" : "#cdd6f4",
                  fontStyle: val === null ? "italic" : "normal",
                }}>
                  {val === null ? "NULL" : String(val)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Styles ──

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "2px 8px",
      background: active ? "rgba(137,180,250,0.15)" : "transparent",
      border: "none",
      borderRadius: 3,
      color: active ? "#89b4fa" : "#6c7086",
      cursor: "pointer",
      fontSize: 11,
    }}>
      {children}
    </button>
  );
}

const connectBtnStyle: React.CSSProperties = {
  display: "block",
  margin: "12px auto 0",
  padding: "8px 24px",
  background: "rgba(137,180,250,0.1)",
  border: "1px solid #89b4fa",
  borderRadius: 6,
  color: "#89b4fa",
  cursor: "pointer",
  fontSize: 13,
};
