// ⚒️ Docker Panel — Manage Docker/Sail containers

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
}

interface DockerProject {
  has_docker_compose: boolean;
  has_sail: boolean;
  compose_file: string | null;
  services: string[];
}

interface DockerPanelProps {
  projectPath: string | null;
}

export function DockerPanel({ projectPath }: DockerPanelProps) {
  const [project, setProject] = useState<DockerProject | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (projectPath) detect();
  }, [projectPath]);

  const detect = useCallback(async () => {
    if (!projectPath) return;
    try {
      const p = await invoke<DockerProject>("docker_detect", { projectPath });
      setProject(p);
      if (p.has_docker_compose) {
        const c = await invoke<ContainerInfo[]>("docker_containers", { projectPath });
        setContainers(c);
      }
    } catch (e) { console.error(e); }
  }, [projectPath]);

  const doAction = useCallback(async (action: string, service?: string) => {
    if (!projectPath) return;
    setLoading(true);
    setActionMsg(null);
    try {
      const args: Record<string, unknown> = { projectPath };
      if (service) args.service = service;
      const msg = await invoke<string>(action, args);
      setActionMsg(msg || "完了");
      await detect();
    } catch (e) {
      setActionMsg(`エラー: ${e}`);
    }
    setLoading(false);
  }, [projectPath, detect]);

  const viewLogs = useCallback(async (service: string) => {
    if (!projectPath) return;
    setSelectedService(service);
    try {
      const chunk = await invoke<{ service: string; lines: string[] }>("docker_logs", { projectPath, service, lines: 100 });
      setLogs(chunk.lines);
    } catch (e) {
      setLogs([`エラー: ${e}`]);
    }
  }, [projectPath]);

  if (!project) {
    return <Placeholder text="Docker の検出中..." />;
  }

  if (!project.has_docker_compose) {
    return (
      <div style={{ padding: 20, fontSize: 12 }}>
        <div style={{ color: "#585b70", marginBottom: 12 }}>
          docker-compose.yml が見つかりません
        </div>
        <div style={{ color: "#6c7086", fontSize: 11, lineHeight: 1.8 }}>
          💡 Laravel Sail を使ってみましょう：
          <br />
          <code style={{ background: "#313244", padding: "2px 6px", borderRadius: 3 }}>
            composer require laravel/sail --dev
          </code>
          <br />
          <code style={{ background: "#313244", padding: "2px 6px", borderRadius: 3 }}>
            php artisan sail:install
          </code>
        </div>
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
        <span>🐳</span>
        <span>{project.has_sail ? "Laravel Sail" : "Docker Compose"}</span>
        <div style={{ flex: 1 }} />
        <ActionBtn label="▶ Up" color="#a6e3a1" loading={loading} onClick={() => doAction("docker_up")} />
        <ActionBtn label="■ Down" color="#f38ba8" loading={loading} onClick={() => doAction("docker_down")} />
      </div>

      {actionMsg && (
        <div style={{
          padding: "4px 12px",
          fontSize: 11,
          color: actionMsg.startsWith("エラー") ? "#f38ba8" : "#a6e3a1",
          background: "rgba(0,0,0,0.2)",
          borderBottom: "1px solid #313244",
        }}>
          {actionMsg}
        </div>
      )}

      {/* Container list */}
      <div style={{ flex: selectedService ? 0.5 : 1, overflow: "auto", minHeight: 0 }}>
        {containers.length === 0 ? (
          <div style={{ padding: 12, color: "#585b70" }}>
            コンテナが見つかりません。「▶ Up」で起動してください。
          </div>
        ) : (
          containers.map((c) => (
            <div key={c.id} style={{
              padding: "6px 12px",
              borderBottom: "1px solid #1e1e2e",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#313244"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ color: stateColor(c.state) }}>●</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#cdd6f4", fontWeight: 500 }}>{c.name}</div>
                <div style={{ color: "#585b70", fontSize: 10 }}>
                  {c.image} | {c.status}
                  {c.ports && ` | ${c.ports}`}
                </div>
              </div>
              <button onClick={() => viewLogs(c.name)} style={smallBtn} title="ログ">📋</button>
              <button onClick={() => doAction("docker_restart", c.name)} style={smallBtn} title="再起動">🔄</button>
              <button onClick={() => doAction("docker_stop_service", c.name)} style={smallBtn} title="停止">⏹</button>
            </div>
          ))
        )}
      </div>

      {/* Logs viewer */}
      {selectedService && (
        <div style={{
          flex: 0.5,
          borderTop: "1px solid #313244",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}>
          <div style={{
            padding: "4px 12px",
            borderBottom: "1px solid #313244",
            display: "flex",
            alignItems: "center",
            fontSize: 11,
            color: "#6c7086",
            flexShrink: 0,
          }}>
            📋 {selectedService} のログ
            <div style={{ flex: 1 }} />
            <button onClick={() => setSelectedService(null)} style={smallBtn}>✕</button>
          </div>
          <div style={{
            flex: 1,
            overflow: "auto",
            padding: 8,
            fontFamily: "var(--font-code)",
            fontSize: 11,
            lineHeight: 1.5,
            color: "#a6adc8",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {logs.map((line, i) => (
              <div key={i} style={{ color: logColor(line) }}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, loading, onClick }: { label: string; color: string; loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      padding: "2px 8px",
      background: "transparent",
      border: `1px solid ${color}`,
      borderRadius: 3,
      color,
      cursor: loading ? "not-allowed" : "pointer",
      fontSize: 10,
      opacity: loading ? 0.5 : 1,
    }}>
      {label}
    </button>
  );
}

function Placeholder({ text }: { text: string }) {
  return <div style={{ padding: 20, color: "#585b70", fontSize: 12, textAlign: "center" }}>{text}</div>;
}

function stateColor(state: string): string {
  switch (state) {
    case "Running": return "#a6e3a1";
    case "Exited": case "Stopped": return "#f38ba8";
    case "Paused": return "#f9e2af";
    default: return "#585b70";
  }
}

function logColor(line: string): string {
  if (line.includes("ERROR") || line.includes("error")) return "#f38ba8";
  if (line.includes("WARNING") || line.includes("warn")) return "#f9e2af";
  return "#a6adc8";
}

const smallBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  padding: "2px 4px",
  borderRadius: 3,
  opacity: 0.7,
};
