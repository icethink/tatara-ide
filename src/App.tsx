import { useState, useMemo, useCallback, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorCanvas } from "./components/EditorCanvas";
import { StatusBar } from "./components/StatusBar";
import { ActivityBar } from "./components/ActivityBar";
import { TabBar } from "./components/TabBar";
import { XTerminal } from "./components/XTerminal";
import { CommandPalette } from "./components/CommandPalette";
import { QuickOpen } from "./components/QuickOpen";
import { useKeybindings } from "./hooks/useKeybindings";
import { useEditorStore } from "./hooks/useEditorStore";
import { FindReplace } from "./components/FindReplace";
import { Breadcrumb } from "./components/Breadcrumb";
import { GoToLine } from "./components/GoToLine";
import { NotificationContainer, useNotifications } from "./components/Notifications";
import { ImageViewer } from "./components/ImageViewer";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { HoverTooltip } from "./components/HoverTooltip";
import { SignatureHelp } from "./components/SignatureHelp";
import { FileContextMenu, FileDialog } from "./components/FileContextMenu";
import { useLsp } from "./hooks/useLsp";
import { useAutoSave } from "./hooks/useAutoSave";
import type { FileNode } from "./components/FileTree";

// ── Tauri IPC (graceful fallback for browser dev) ──
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriDialogOpen: ((opts: Record<string, unknown>) => Promise<string | string[] | null>) | null = null;

async function initTauri() {
  try {
    const core = await import("@tauri-apps/api/core");
    tauriInvoke = core.invoke;
  } catch {
    // Running in browser
  }
  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    tauriDialogOpen = dialog.open as typeof tauriDialogOpen;
  } catch {
    // dialog plugin not available
  }
}
initTauri();

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (tauriInvoke) return tauriInvoke(cmd, args) as Promise<T>;
  return null;
}

async function openFolderDialog(): Promise<string | null> {
  if (tauriDialogOpen) {
    const result = await tauriDialogOpen({ directory: true, multiple: false, title: "プロジェクトフォルダを選択" });
    if (typeof result === "string") return result;
    if (Array.isArray(result) && result.length > 0) return result[0];
  }
  return null;
}

function App() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<string>("explorer");
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [projectPath, setProjectPath] = useState<string | null>(() => {
    try { return localStorage.getItem("tatara:lastProject"); } catch { return null; }
  });
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [framework, setFramework] = useState<string | null>(null);
  const [findVisible, setFindVisible] = useState(false);
  const [goToLineVisible, setGoToLineVisible] = useState(false);

  const [hoverInfo, _setHoverInfo] = useState<{ content: string; x: number; y: number } | null>(null);
  const [signatureInfo, _setSignatureInfo] = useState<{ signatures: { label: string; documentation?: string; parameters: { label: string; documentation?: string }[] }[]; activeSignature: number; activeParameter: number; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  const [fileDialog, setFileDialog] = useState<{ title: string; defaultValue?: string; placeholder?: string; onSubmit: (v: string) => void } | null>(null);
  const [diagnosticsPanelVisible, setDiagnosticsPanelVisible] = useState(false);

  const editor = useEditorStore();
  const lsp = useLsp(projectPath);

  // Auto-save hook
  const modifiedTabIds = editor.tabs.filter(t => t.modified).map(t => t.id);
  const handleAutoSave = useCallback((tabId: string) => {
    const tab = editor.tabs.find(t => t.id === tabId);
    if (!tab) return;
    invoke("write_file", { path: tab.path, content: tab.content }).then(() => {
      editor.markTabSaved(tabId);
    });
  }, [editor]);

  useAutoSave({ enabled: true, onSave: handleAutoSave, modifiedTabIds });
  const { notifications, notify, dismiss } = useNotifications();

  // ── Project / Folder Operations ──

  const openFolder = useCallback(async () => {
    const path = await openFolderDialog();
    if (path) {
      setProjectPath(path);
      notify(`📂 ${path}`, "info", { duration: 3000 });
    }
  }, [notify]);

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

    // Image files don't need content loading
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const imageExts = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif", "svg"]);
    if (imageExts.has(ext)) {
      editor.openFile(path, "", line);
      return;
    }

    const result = await invoke<{ content: string; encoding: string }>("read_file", { path });
    if (result) {
      editor.openFile(path, result.content, line);
      // Notify LSP
      const lang = detectLangForLsp(path);
      if (lang) lsp.didOpen(path, lang, result.content);
    } else {
      editor.openFile(path, `// ${path}\n// (File content unavailable in browser mode)\n`, line);
    }
  }, [editor, lsp]);

  const saveFile = useCallback(async () => {
    const tab = editor.activeTab;
    if (!tab) return;

    const success = await invoke("write_file", { path: tab.path, content: tab.content });
    if (success !== null) {
      editor.markTabSaved(tab.id);
      notify(`${tab.filename} を保存しました`, "success", { duration: 2000 });
      // Notify LSP
      const lang = detectLangForLsp(tab.path);
      if (lang) lsp.didSave(tab.path, lang, tab.content);
    }
  }, [editor, notify, lsp]);

  // ── Project Detection ──

  useEffect(() => {
    if (!projectPath) return;
    loadFileTree(projectPath);

    // Detect framework
    invoke<{ name: string }>("detect_framework", { path: projectPath }).then(fw => {
      if (fw) {
        setFramework(fw.name);
        notify(`🔥 ${fw.name} プロジェクトを検出しました`, "info", { duration: 3000 });
      }
    });

    // WSL path warning
    invoke<string | null>("check_wsl_warning", { path: projectPath }).then(warning => {
      if (warning) {
        notify(warning, "warning", { duration: 8000 });
      }
    });

    // Update window title
    const folderName = projectPath.split(/[/\\]/).pop() || projectPath;
    document.title = `${folderName} — Tatara IDE`;

    // Remember last opened project + recent list
    try {
      localStorage.setItem("tatara:lastProject", projectPath);
      const recent = JSON.parse(localStorage.getItem("tatara:recentProjects") || "[]") as string[];
      const updated = [projectPath, ...recent.filter((p: string) => p !== projectPath)].slice(0, 10);
      localStorage.setItem("tatara:recentProjects", JSON.stringify(updated));
    } catch {}
  }, [projectPath, loadFileTree, notify]);

  // ── Keybinding Handlers ──

  const handlers = useMemo(
    () => ({
      "command.palette": () => setCommandPaletteVisible(true),
      "file.quickOpen": () => setQuickOpenVisible(true),
      "panel.toggleTerminal": () => setTerminalVisible(v => !v),
      "panel.toggleSidebar": () => setSidebarVisible(v => !v),
      "file.openFolder": openFolder,
      "editor.find": () => setFindVisible(true),
      "editor.replace": () => setFindVisible(true),
      "editor.goToLine": () => setGoToLineVisible(true),
      "file.save": saveFile,
      "file.close": () => {
        if (editor.activeTabId) editor.closeTab(editor.activeTabId);
      },
      "file.reopenClosed": () => editor.reopenClosedTab(),
      "editor.goToDefinition": async () => {
        const tab = editor.activeTab;
        if (!tab) return;
        const lang = detectLangForLsp(tab.path);
        if (!lang) return;
        const locations = await lsp.definition(tab.path, lang, tab.cursorLine, tab.cursorColumn);
        if (locations.length > 0) {
          openFile(locations[0].path, locations[0].line);
        }
      },
      "editor.findReferences": async () => {
        const tab = editor.activeTab;
        if (!tab) return;
        const lang = detectLangForLsp(tab.path);
        if (!lang) return;
        const refs = await lsp.references(tab.path, lang, tab.cursorLine, tab.cursorColumn);
        if (refs.length > 0) {
          // TODO: show references panel. For now, jump to first.
          openFile(refs[0].path, refs[0].line);
        }
      },
      "editor.format": async () => {
        const tab = editor.activeTab;
        if (!tab) return;
        const lang = detectLangForLsp(tab.path);
        if (!lang) return;
        const edits = await lsp.format(tab.path, lang);
        if (edits.length > 0) {
          // Apply edits (simplified: replace full content with last edit)
          let content = tab.content;
          // Apply in reverse order to preserve positions
          for (const edit of edits.reverse()) {
            const lines = content.split("\n");
            const startIdx = lines.slice(0, edit.range.start_line).join("\n").length + (edit.range.start_line > 0 ? 1 : 0) + edit.range.start_col;
            const endIdx = lines.slice(0, edit.range.end_line).join("\n").length + (edit.range.end_line > 0 ? 1 : 0) + edit.range.end_col;
            content = content.slice(0, startIdx) + edit.new_text + content.slice(endIdx);
          }
          editor.updateTabContent(tab.id, content);
          notify("フォーマット完了", "success", { duration: 2000 });
        }
      },
    }),
    [saveFile, editor, lsp, openFile, notify],
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
              onContextMenu={(e, path, isDir) => {
                setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
              }}
            />
          )}

          {/* Editor + Terminal column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {/* Tab bar */}
            <TabBar
              tabs={editor.tabs}
              activeTabId={editor.activeTabId}
              onTabSelect={editor.setActiveTabId}
              onTabClose={editor.closeTab}
            />

            {/* Breadcrumb */}
            <Breadcrumb path={activeTab?.path ?? null} />

            {/* Editor content — takes remaining space, shares with terminal */}
            <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
              {/* Find & Replace overlay */}
              {findVisible && activeTab && (
                <FindReplace
                  visible={findVisible}
                  content={activeTab.content}
                  onClose={() => setFindVisible(false)}
                  onHighlight={() => {}}
                  onReplace={(oldText, newText, all) => {
                    if (!activeTab) return;
                    const content = all
                      ? activeTab.content.replaceAll(oldText, newText)
                      : activeTab.content.replace(oldText, newText);
                    editor.updateTabContent(activeTab.id, content);
                  }}
                  onJumpToLine={(line, col) => {
                    if (activeTab) editor.updateCursor(activeTab.id, line, col);
                  }}
                />
              )}

              {activeTab ? (
                activeTab.viewType === "image" || activeTab.viewType === "svg" ? (
                  <ImageViewer path={activeTab.path} filename={activeTab.filename} />
                ) : activeTab.viewType === "markdown" ? (
                  <MarkdownPreview content={activeTab.content} filename={activeTab.filename} />
                ) : (
                  <EditorCanvas
                    content={activeTab.content}
                    language={activeTab.language}
                    cursorLine={activeTab.cursorLine}
                    cursorColumn={activeTab.cursorColumn}
                    onContentChange={(content) => {
                    editor.updateTabContent(activeTab.id, content);
                    const lang = detectLangForLsp(activeTab.path);
                    if (lang) lsp.didChange(activeTab.path, lang, content);
                  }}
                    onCursorChange={(line, col) => editor.updateCursor(activeTab.id, line, col)}
                    onSave={saveFile}
                  />
                )
              ) : (
                <WelcomeScreen
                  onOpenFolder={openFolder}
                  onOpenPath={setProjectPath}
                  framework={framework}
                />
              )}
            </div>

            {/* Bottom panel — Terminal or Diagnostics */}
            {(terminalVisible || diagnosticsPanelVisible) && (
              <div style={{
                height: "35%",
                minHeight: 120,
                maxHeight: "50%",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
              }}>
                {/* Panel tabs */}
                <div style={{
                  display: "flex",
                  borderBottom: "1px solid #313244",
                  fontSize: 11,
                  userSelect: "none",
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => { setTerminalVisible(true); setDiagnosticsPanelVisible(false); }}
                    style={{
                      padding: "4px 12px",
                      background: terminalVisible ? "rgba(137,180,250,0.05)" : "transparent",
                      border: "none",
                      borderBottom: terminalVisible ? "2px solid #89b4fa" : "2px solid transparent",
                      color: terminalVisible ? "#cdd6f4" : "#6c7086",
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    💻 ターミナル
                  </button>
                  <button
                    onClick={() => { setDiagnosticsPanelVisible(true); setTerminalVisible(false); }}
                    style={{
                      padding: "4px 12px",
                      background: diagnosticsPanelVisible ? "rgba(137,180,250,0.05)" : "transparent",
                      border: "none",
                      borderBottom: diagnosticsPanelVisible ? "2px solid #89b4fa" : "2px solid transparent",
                      color: diagnosticsPanelVisible ? "#cdd6f4" : "#6c7086",
                      cursor: "pointer",
                      fontSize: 11,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    📋 問題
                    {lsp.diagnostics.length > 0 && (
                      <span style={{
                        background: lsp.diagnostics.some(d => d.severity === "error") ? "#f38ba8" : "#f9e2af",
                        color: "#1e1e2e",
                        borderRadius: 8,
                        padding: "0 5px",
                        fontSize: 10,
                        fontWeight: 700,
                      }}>
                        {lsp.diagnostics.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Panel content */}
                {terminalVisible && <XTerminal projectPath={projectPath} visible={terminalVisible} />}
                {diagnosticsPanelVisible && (
                  <DiagnosticsPanel
                    diagnostics={lsp.diagnostics}
                    onJumpTo={(path, line, _col) => {
                      openFile(path, line);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
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
        errors={lsp.diagnostics.filter(d => d.severity === "error").length}
        warnings={lsp.diagnostics.filter(d => d.severity === "warning").length}
        lspServers={lsp.servers}
        onDiagnosticsClick={() => { setDiagnosticsPanelVisible(true); setTerminalVisible(false); }}
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

      <GoToLine
        visible={goToLineVisible}
        totalLines={activeTab ? activeTab.content.split("\n").length : 0}
        onClose={() => setGoToLineVisible(false)}
        onJump={(line) => {
          if (activeTab) editor.updateCursor(activeTab.id, line, 0);
        }}
      />

      {/* Hover Tooltip */}
      <HoverTooltip
        visible={!!hoverInfo}
        content={hoverInfo?.content ?? ""}
        x={hoverInfo?.x ?? 0}
        y={hoverInfo?.y ?? 0}
      />

      {/* Signature Help */}
      <SignatureHelp
        visible={!!signatureInfo}
        x={signatureInfo?.x ?? 0}
        y={signatureInfo?.y ?? 0}
        signatures={signatureInfo?.signatures ?? []}
        activeSignature={signatureInfo?.activeSignature ?? 0}
        activeParameter={signatureInfo?.activeParameter ?? 0}
      />

      {/* File Context Menu */}
      <FileContextMenu
        visible={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        targetPath={contextMenu?.path ?? ""}
        isDir={contextMenu?.isDir ?? false}
        onClose={() => setContextMenu(null)}
        onNewFile={(dir) => {
          setContextMenu(null);
          setFileDialog({
            title: "新しいファイル",
            placeholder: "ファイル名",
            onSubmit: async (name) => {
              const path = `${dir}/${name}`;
              await invoke("create_file", { path });
              setFileDialog(null);
              if (projectPath) loadFileTree(projectPath);
              openFile(path);
            },
          });
        }}
        onNewFolder={(dir) => {
          setContextMenu(null);
          setFileDialog({
            title: "新しいフォルダ",
            placeholder: "フォルダ名",
            onSubmit: async (name) => {
              await invoke("create_directory", { path: `${dir}/${name}` });
              setFileDialog(null);
              if (projectPath) loadFileTree(projectPath);
            },
          });
        }}
        onRename={(path) => {
          setContextMenu(null);
          const oldName = path.split(/[/\\]/).pop() || "";
          setFileDialog({
            title: "名前の変更",
            defaultValue: oldName,
            onSubmit: async (newName) => {
              const dir = path.replace(/[/\\][^/\\]+$/, "");
              await invoke("rename_path", { oldPath: path, newPath: `${dir}/${newName}` });
              setFileDialog(null);
              if (projectPath) loadFileTree(projectPath);
            },
          });
        }}
        onDelete={async (path) => {
          setContextMenu(null);
          const name = path.split(/[/\\]/).pop() || path;
          if (confirm(`${name} を削除しますか？`)) {
            await invoke("delete_path", { path });
            if (projectPath) loadFileTree(projectPath);
          }
        }}
        onCopyPath={(path) => {
          setContextMenu(null);
          navigator.clipboard.writeText(path);
          notify("パスをコピーしました", "info", { duration: 2000 });
        }}
        onRevealInExplorer={(path) => {
          setContextMenu(null);
          invoke("exec_command", { cmd: `explorer /select,"${path.replace(/\//g, "\\")}"` });
        }}
      />

      {/* File Dialog */}
      {fileDialog && (
        <FileDialog
          visible={true}
          title={fileDialog.title}
          defaultValue={fileDialog.defaultValue}
          placeholder={fileDialog.placeholder}
          onSubmit={fileDialog.onSubmit}
          onClose={() => setFileDialog(null)}
        />
      )}

      {/* Notifications */}
      <NotificationContainer notifications={notifications} onDismiss={dismiss} />
    </div>
  );
}

// ── Welcome Screen ──

function WelcomeScreen({
  onOpenFolder,
  onOpenPath,
  framework,
}: {
  onOpenFolder: () => void;
  onOpenPath?: (path: string) => void;
  framework: string | null;
}) {
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tatara:recentProjects");
      if (stored) setRecentProjects(JSON.parse(stored));
    } catch {}
  }, []);
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

      {/* Recent projects */}
      {recentProjects.length > 0 && onOpenPath && (
        <div style={{ marginTop: 16, width: 280 }}>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            最近のプロジェクト
          </div>
          {recentProjects.slice(0, 5).map((p) => (
            <div
              key={p}
              onClick={() => onOpenPath(p)}
              style={{
                padding: "4px 8px",
                fontSize: 12,
                color: "var(--fg-secondary)",
                cursor: "pointer",
                borderRadius: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--sidebar-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              📁 {p.split(/[/\\]/).pop()} <span style={{ color: "var(--fg-muted)", fontSize: 11 }}>{p}</span>
            </div>
          ))}
        </div>
      )}

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

// ── Helpers ──

function detectLangForLsp(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (path.endsWith(".blade.php")) return "blade";
  const map: Record<string, string> = {
    php: "php",
    js: "javascript",
    jsx: "javascriptreact",
    ts: "typescript",
    tsx: "typescriptreact",
    vue: "vue",
    css: "css",
    scss: "scss",
    less: "less",
  };
  return map[ext] || null;
}

export default App;
