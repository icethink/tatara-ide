// ⚒️ Git Panel — Source control sidebar panel
//
// Shows staged/modified/untracked files with stage/unstage/discard actions
// Commit message input with Ctrl+Enter to commit

import { useState, useCallback, useEffect } from "react";

interface FileChange {
  path: string;
  status: string;
}

interface GitStatusData {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  modified: FileChange[];
  untracked: string[];
  is_repo: boolean;
}

interface GitPanelProps {
  projectPath: string | null;
  onFileOpen: (path: string) => void;
}

export function GitPanel({ projectPath, onFileOpen }: GitPanelProps) {
  const [status, setStatus] = useState<GitStatusData | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      // TODO: Call Tauri IPC git_status
      // Mock for now
      setStatus({
        branch: "main",
        ahead: 0,
        behind: 0,
        staged: [],
        modified: [],
        untracked: [],
        is_repo: true,
      });
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCommit = useCallback(async () => {
    if (!commitMsg.trim() || !projectPath) return;
    // TODO: Call Tauri IPC git_commit
    setCommitMsg("");
    refresh();
  }, [commitMsg, projectPath, refresh]);

  if (!status?.is_repo) {
    return (
      <div style={{ padding: 16, color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>🌿</div>
        <div>Gitリポジトリが見つかりません</div>
        <button
          style={{
            marginTop: 12,
            padding: "6px 16px",
            background: "var(--accent)",
            color: "var(--accent-fg)",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          git init
        </button>
      </div>
    );
  }

  const totalChanges = status.staged.length + status.modified.length + status.untracked.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontSize: 13 }}>
      {/* Commit input */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCommit();
            }
          }}
          placeholder="コミットメッセージ (Ctrl+Enter)"
          rows={3}
          style={{
            width: "100%",
            padding: "6px 8px",
            background: "#313244",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--fg-primary)",
            fontSize: 12,
            fontFamily: "var(--font-code)",
            resize: "vertical",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button
            onClick={handleCommit}
            disabled={!commitMsg.trim() || status.staged.length === 0}
            style={{
              flex: 1,
              padding: "5px",
              background: commitMsg.trim() && status.staged.length > 0
                ? "var(--accent)" : "#313244",
              color: commitMsg.trim() && status.staged.length > 0
                ? "var(--accent-fg)" : "var(--fg-muted)",
              border: "none",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✓ コミット
          </button>
          <button
            onClick={refresh}
            style={{
              padding: "5px 10px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--fg-muted)",
              cursor: "pointer",
              fontSize: 12,
            }}
            title="更新"
          >
            🔄
          </button>
        </div>
      </div>

      {/* File lists */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading && (
          <div style={{ padding: 12, color: "var(--fg-muted)", textAlign: "center" }}>
            読み込み中...
          </div>
        )}

        {error && (
          <div style={{ padding: 12, color: "var(--error)", fontSize: 12 }}>
            {error}
          </div>
        )}

        {totalChanges === 0 && !loading && (
          <div style={{ padding: 16, color: "var(--fg-muted)", textAlign: "center" }}>
            変更なし ✨
          </div>
        )}

        {/* Staged */}
        {status.staged.length > 0 && (
          <FileSection
            title="ステージ済み"
            count={status.staged.length}
            color="var(--git-added)"
          >
            {status.staged.map((f) => (
              <FileRow
                key={f.path}
                path={f.path}
                status={f.status}
                statusColor="var(--git-added)"
                onClick={() => onFileOpen(f.path)}
                actions={[
                  { icon: "−", title: "ステージ解除", onClick: () => {} },
                ]}
              />
            ))}
          </FileSection>
        )}

        {/* Modified */}
        {status.modified.length > 0 && (
          <FileSection
            title="変更"
            count={status.modified.length}
            color="var(--git-modified)"
          >
            {status.modified.map((f) => (
              <FileRow
                key={f.path}
                path={f.path}
                status={f.status}
                statusColor="var(--git-modified)"
                onClick={() => onFileOpen(f.path)}
                actions={[
                  { icon: "+", title: "ステージ", onClick: () => {} },
                  { icon: "↩", title: "変更を破棄", onClick: () => {} },
                ]}
              />
            ))}
          </FileSection>
        )}

        {/* Untracked */}
        {status.untracked.length > 0 && (
          <FileSection
            title="未追跡"
            count={status.untracked.length}
            color="var(--fg-muted)"
          >
            {status.untracked.map((path) => (
              <FileRow
                key={path}
                path={path}
                status="U"
                statusColor="var(--fg-muted)"
                onClick={() => onFileOpen(path)}
                actions={[
                  { icon: "+", title: "ステージ", onClick: () => {} },
                ]}
              />
            ))}
          </FileSection>
        )}
      </div>

      {/* Branch info */}
      <div style={{
        padding: "4px 12px",
        borderTop: "1px solid var(--border)",
        fontSize: 11,
        color: "var(--fg-muted)",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span>🌿 {status.branch}</span>
        {(status.ahead > 0 || status.behind > 0) && (
          <span>
            {status.ahead > 0 && `↑${status.ahead}`}
            {status.behind > 0 && ` ↓${status.behind}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function FileSection({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 9 }}>{collapsed ? "▶" : "▼"}</span>
        <span>{title}</span>
        <span style={{
          background: color,
          color: "var(--bg-primary)",
          borderRadius: 8,
          padding: "0 5px",
          fontSize: 10,
        }}>
          {count}
        </span>
      </div>
      {!collapsed && children}
    </div>
  );
}

function FileRow({
  path,
  status,
  statusColor,
  onClick,
  actions,
}: {
  path: string;
  status: string;
  statusColor: string;
  onClick: () => void;
  actions: { icon: string; title: string; onClick: () => void }[];
}) {
  const [hovered, setHovered] = useState(false);
  const filename = path.split("/").pop() ?? path;
  const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "2px 12px 2px 24px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        background: hovered ? "var(--sidebar-hover)" : "transparent",
      }}
    >
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span>{filename}</span>
        {dir && <span style={{ color: "var(--fg-muted)", fontSize: 11, marginLeft: 4 }}>{dir}</span>}
      </span>

      {/* Actions (visible on hover) */}
      {hovered && (
        <div style={{ display: "flex", gap: 2 }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); a.onClick(); }}
              title={a.title}
              style={{
                width: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "var(--fg-muted)",
                cursor: "pointer",
                fontSize: 12,
                borderRadius: 2,
              }}
            >
              {a.icon}
            </button>
          ))}
        </div>
      )}

      {/* Status badge */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: statusColor,
        minWidth: 14,
        textAlign: "center",
      }}>
        {status.charAt(0)}
      </span>
    </div>
  );
}
