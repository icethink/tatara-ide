// ⚒️ Editor State Management
// Central store for open documents, tabs, and editor state

import { useState, useCallback, useRef } from "react";

export type ViewType = "editor" | "image" | "markdown" | "svg";

export interface EditorTab {
  id: string;
  path: string;
  filename: string;
  content: string;
  modified: boolean;
  language: string;
  viewType: ViewType;
  cursorLine: number;
  cursorColumn: number;
  scrollTop: number;
}

export interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  recentFiles: string[];
}

const MAX_RECENT_FILES = 20;

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, string> = {
    php: "php",
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    vue: "vue",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    xml: "xml",
    svg: "svg",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    rs: "rust",
    py: "python",
    rb: "ruby",
    go: "go",
    env: "dotenv",
    blade: "blade",
  };

  // .blade.php special case
  if (path.endsWith(".blade.php")) return "blade";
  return langMap[ext] ?? "plaintext";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "avif"]);

function detectViewType(path: string): ViewType {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "svg") return "svg"; // Can be viewed as image or code
  if (ext === "md" || ext === "mdx") return "markdown";
  return "editor";
}

export function useEditorStore() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [closedTabs, setClosedTabs] = useState<EditorTab[]>([]);
  const tabIdCounter = useRef(0);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const openFile = useCallback(
    (path: string, content: string, line?: number) => {
      // Check if already open
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActiveTabId(existing.id);
        if (line !== undefined) {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === existing.id ? { ...t, cursorLine: line, cursorColumn: 0 } : t
            )
          );
        }
        return;
      }

      const id = `tab-${++tabIdCounter.current}`;
      const filename = path.split("/").pop() ?? path;
      const newTab: EditorTab = {
        id,
        path,
        filename,
        content,
        modified: false,
        language: detectLanguage(path),
        viewType: detectViewType(path),
        cursorLine: line ?? 0,
        cursorColumn: 0,
        scrollTop: 0,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);

      // Update recent files
      setRecentFiles((prev) => {
        const filtered = prev.filter((f) => f !== path);
        return [path, ...filtered].slice(0, MAX_RECENT_FILES);
      });
    },
    [tabs]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      // Save to closed tabs for restore
      const closing = tabs.find((t) => t.id === tabId);
      if (closing) {
        setClosedTabs((prev) => [closing, ...prev].slice(0, 20));
      }

      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);

        if (tabId === activeTabId && next.length > 0) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        } else if (next.length === 0) {
          setActiveTabId(null);
        }

        return next;
      });
    },
    [activeTabId, tabs]
  );

  const reopenClosedTab = useCallback(() => {
    if (closedTabs.length === 0) return;

    const [tab, ...rest] = closedTabs;
    setClosedTabs(rest);

    // Reopen with new id
    const id = `tab-${++tabIdCounter.current}`;
    const newTab = { ...tab, id };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  }, [closedTabs]);

  const closeOtherTabs = useCallback(
    (keepTabId: string) => {
      setTabs((prev) => prev.filter((t) => t.id === keepTabId));
      setActiveTabId(keepTabId);
    },
    []
  );

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId ? { ...t, content, modified: true } : t
      )
    );
  }, []);

  const markTabSaved = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, modified: false } : t))
    );
  }, []);

  const updateCursor = useCallback(
    (tabId: string, line: number, column: number) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId ? { ...t, cursorLine: line, cursorColumn: column } : t
        )
      );
    },
    []
  );

  const updateScroll = useCallback((tabId: string, scrollTop: number) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, scrollTop } : t))
    );
  }, []);

  const getModifiedTabs = useCallback(() => {
    return tabs.filter((t) => t.modified);
  }, [tabs]);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  return {
    tabs,
    activeTabId,
    activeTab,
    recentFiles,
    openFile,
    closeTab,
    reopenClosedTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTabId,
    updateTabContent,
    markTabSaved,
    updateCursor,
    updateScroll,
    getModifiedTabs,
    reorderTabs,
  };
}
