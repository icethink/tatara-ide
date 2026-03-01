// ⚒️ Editor State Management
// Central store for open documents, tabs, and editor state

import { useState, useCallback, useRef } from "react";

export interface EditorTab {
  id: string;
  path: string;
  filename: string;
  content: string;
  modified: boolean;
  language: string;
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

export function useEditorStore() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
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
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);

        // If closing active tab, switch to neighbor
        if (tabId === activeTabId && next.length > 0) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        } else if (next.length === 0) {
          setActiveTabId(null);
        }

        return next;
      });
    },
    [activeTabId]
  );

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

  return {
    tabs,
    activeTabId,
    activeTab,
    recentFiles,
    openFile,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    setActiveTabId,
    updateTabContent,
    markTabSaved,
    updateCursor,
    updateScroll,
    getModifiedTabs,
  };
}
