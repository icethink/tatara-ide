import { useState, useMemo, useCallback, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorCanvas } from "./components/EditorCanvas";
import { StatusBar } from "./components/StatusBar";
import { ActivityBar } from "./components/ActivityBar";
import { TabBar } from "./components/TabBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { CommandPalette } from "./components/CommandPalette";
import { QuickOpen } from "./components/QuickOpen";
import { useKeybindings } from "./hooks/useKeybindings";
import { useEditorStore } from "./hooks/useEditorStore";
import type { FileNode } from "./components/FileTree";

// ── Tauri IPC (graceful fallback for browser dev) ──
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function initTauri() {
  try {
    const mod = await import("@tauri-apps/api/core");
    tauriInvoke = mod.invoke;
  } catch {
    // Running in browser — use mock data
  }
}
initTauri();

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (tauriInvoke) return tauriInvoke(cmd, args) as Promise<T>;
  return null;
}

function App() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<string>("explorer");
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [framework, setFramework] = useState<string | null>(null);

  const editor = useEditorStore();

  // ── File Operations ──

  const loadFileTree = useCallback(async (path: string) => {
    const tree = await invoke<FileNode>("read_directory", { path });
    if (tree) setFileTree(tree);
  }, []);

  const openFile = useCallback(async (path: string, line?: number) => {
    // Check if already open
    const existing = editor.tabs.find(t => t.path === path);
    if (existing) {
      editor.setActiveTabId(existing.id);
      if (line !== undefined) editor.updateCursor(existing.id, line, 0);
      return;
    }

    const result = await invoke<{ content: string; encoding: string }>("read_file", { path });
    if (result) {
      editor.openFile(path, result.content, line);
    } else {
      // Fallback: open with empty content (browser dev mode)
      editor.openFile(path, `// ${path}\n// (File content unavailable in browser mode)\n`, line);
    }
  }, [editor]);

  const saveFile = useCallback(async () => {
    const tab = editor.activeTab;
    if (!tab) return;

    const success = await invoke("write_file", { path: tab.path, content: tab.content });
    if (success !== null) {
      editor.markTabSaved(tab.id);
    }
  }, [editor]);

  // ── Project Detection ──

  useEffect(() => {
    if (!projectPath) return;
    loadFileTree(projectPath);

    // Detect framework
    invoke<{ name: string }>("detect_framework", { path: projectPath }).then(fw => {
      if (fw) setFramework(fw.name);
    });
  }, [projectPath, loadFileTree]);

  // ── Keybinding Handlers ──

  const handlers = useMemo(
    () => ({
      "command.palette": () => setCommandPaletteVisible(true),
      "file.quickOpen": () => setQuickOpenVisible(true),
      "panel.toggleTerminal": () => setTerminalVisible(v => !v),
      "panel.toggleSidebar": () => setSidebarVisible(v => !v),
      "file.save": saveFile,
      "file.close": () => {
        if (editor.activeTabId) editor.closeTab(editor.activeTabId);
      },
    }),
    [saveFile, editor],
  );

  useKeybindings(handlers);

  const handleCommand = (action: string) => {
    const handler = handlers[action as keyof typeof handlers];
    if (handler) handler();
  };

  // ── Active Tab Info ──

  const activeTab = editor.activeTab;
  const encoding = "UTF-8"; // TODO: from document state
  const lineEnding = "LF";

  return (
    <div className="app-container">
      {/* Activity Bar */}
      <ActivityBar activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* Main content */}
      <div className="main-area">
        <div className="editor-row">
          {sidebarVisible && (
            <Sidebar
              activePanel={activePanel}
              fileTree={fileTree}
              selectedFilePath={activeTab?.path}
              projectPath={projectPath}
              onFileSelect={openFile}
              onFileOpen={openFile}
            />
          )}

          {/* Editor area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Tab bar */}
            <TabBar
              tabs={editor.tabs}
              activeTabId={editor.activeTabId}
              onTabSelect={editor.setActiveTabId}
              onTabClose={editor.closeTab}
            />

            {/* Editor content */}
            <div style={{ flex: 1, position: "relative" }}>
              {activeTab ? (
                <EditorCanvas
                  content={activeTab.content}
                  language={activeTab.language}
                  cursorLine={activeTab.cursorLine}
                  cursorColumn={activeTab.cursorColumn}
                  onContentChange={(content) => editor.updateTabContent(activeTab.id, content)}
                  onCursorChange={(line, col) => editor.updateCursor(activeTab.id, line, col)}
                  onSave={saveFile}
                />
              ) : (
                <WelcomeScreen
                  onOpenFolder={async () => {
                    // TODO: Use Tauri dialog to pick folder
                    // For now, try current directory
                    setProjectPath(".");
                  }}
                  framework={framework}
                />
              )}
            </div>
          </div>
        </div>
        {terminalVisible && <TerminalPanel />}
      </div>

      {/* Status Bar */}
      <StatusBar
        branch="main"
        encoding={encoding}
        lineEnding={lineEnding}
        line={(activeTab?.cursorLine ?? 0) + 1}
        column={(activeTab?.cursorColumn ?? 0) + 1}
        language={activeTab?.language ?? "plaintext"}
        framework={framework}
        onToggleTerminal={() => setTerminalVisible(!terminalVisible)}
      />

      {/* Overlays */}
      <CommandPalette
        visible={commandPaletteVisible}
        onClose={() => setCommandPaletteVisible(false)}
        onExecute={handleCommand}
      />
      <QuickOpen
        visible={quickOpenVisible}
        onClose={() => setQuickOpenVisible(false)}
        onSelect={(path) => openFile(path)}
      />
    </div>
  );
}

// ── Welcome Screen ──

function WelcomeScreen({
  onOpenFolder,
  framework,
}: {
  onOpenFolder: () => void;
  framework: string | null;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: "var(--fg-secondary)",
      gap: 24,
      userSelect: "none",
    }}>
      {/* Logo */}
      <div style={{ fontSize: 48, opacity: 0.15 }}>⚒️</div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: "var(--flame)",
        fontFamily: "var(--font-heading)",
        letterSpacing: "0.05em",
      }}>
        Tatara
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: -16 }}>
        コードを、鍛える。
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <QuickAction icon="📂" label="フォルダを開く" shortcut="Ctrl+O" onClick={onOpenFolder} />
        <QuickAction icon="📄" label="新しいファイル" shortcut="Ctrl+N" onClick={() => {}} />
        <QuickAction icon="⌨️" label="コマンドパレット" shortcut="Ctrl+Shift+P" onClick={() => {}} />
      </div>

      {framework && (
        <div style={{
          marginTop: 16,
          padding: "8px 16px",
          background: "rgba(243, 139, 168, 0.1)",
          borderRadius: 8,
          fontSize: 13,
          color: "var(--flame)",
        }}>
          🔥 {framework} プロジェクトを検出しました
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div style={{
        marginTop: 24,
        fontSize: 11,
        color: "var(--fg-muted)",
        textAlign: "center",
        lineHeight: 2,
      }}>
        <div>Ctrl+P — ファイルを開く</div>
        <div>Ctrl+Shift+P — コマンドパレット</div>
        <div>Ctrl+` — ターミナル</div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  shortcut,
  onClick,
}: {
  icon: string;
  label: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        color: "var(--fg-secondary)",
        cursor: "pointer",
        fontSize: 13,
        width: 280,
        textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-code)" }}>
        {shortcut}
      </span>
    </button>
  );
}

export default App;
