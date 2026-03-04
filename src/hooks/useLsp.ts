// ⚒️ LSP Hook — Manages LSP server lifecycle and document sync
//
// Auto-starts servers when project is opened.
// Syncs document changes to LSP servers.
// Collects diagnostics from servers.

import { useState, useCallback, useEffect, useRef } from "react";
import type { Diagnostic } from "../components/DiagnosticsPanel";

interface LspState {
  servers: string[];
  diagnostics: Diagnostic[];
  loading: boolean;
}

let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let listen: ((event: string, handler: (e: { payload: unknown }) => void) => Promise<() => void>) | null = null;

async function initTauri() {
  try {
    const core = await import("@tauri-apps/api/core");
    invoke = core.invoke;
    const event = await import("@tauri-apps/api/event");
    listen = event.listen as typeof listen;
  } catch {}
}
initTauri();

export function useLsp(projectPath: string | null) {
  const [state, setState] = useState<LspState>({
    servers: [],
    diagnostics: [],
    loading: false,
  });

  const versionMap = useRef(new Map<string, number>());

  // Auto-detect and start LSP servers when project opens
  useEffect(() => {
    if (!projectPath || !invoke) return;

    setState((s) => ({ ...s, loading: true }));

    (async () => {
      try {
        const started = await invoke("lsp_auto_detect", {
          rootPath: projectPath,
        }) as string[];
        setState((s) => ({ ...s, servers: started, loading: false }));
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    })();

    // Listen for diagnostics
    let unlistenDiag: (() => void) | null = null;

    if (listen) {
      listen("lsp-event", (event) => {
        const payload = event.payload as { server_id: string; method: string; data: unknown };

        if (payload.method === "textDocument/publishDiagnostics") {
          const data = payload.data as {
            uri: string;
            diagnostics: Array<{
              range: { start: { line: number; character: number }; end: { line: number; character: number } };
              severity?: number;
              message: string;
              source?: string;
              code?: string | number;
            }>;
          };

          const path = uriToPath(data.uri);
          const newDiags: Diagnostic[] = data.diagnostics.map((d) => ({
            path,
            line: d.range.start.line,
            column: d.range.start.character,
            endLine: d.range.end.line,
            endColumn: d.range.end.character,
            severity: severityFromNumber(d.severity),
            message: d.message,
            source: d.source || payload.server_id,
            code: d.code?.toString(),
          }));

          setState((s) => ({
            ...s,
            diagnostics: [
              ...s.diagnostics.filter((d) => d.path !== path),
              ...newDiags,
            ],
          }));
        }
      }).then((fn) => { unlistenDiag = fn; });
    }

    return () => {
      if (unlistenDiag) unlistenDiag();
      // Stop all servers on cleanup
      if (invoke) {
        invoke("lsp_list").then((servers) => {
          for (const id of servers as string[]) {
            invoke!("lsp_stop", { serverId: id }).catch(() => {});
          }
        }).catch(() => {});
      }
    };
  }, [projectPath]);

  // Notify file opened
  const didOpen = useCallback(async (path: string, language: string, text: string) => {
    if (!invoke) return;
    const version = 1;
    versionMap.current.set(path, version);
    try {
      await invoke("lsp_did_open", { path, language, version, text });
    } catch {}
  }, []);

  // Notify file changed
  const didChange = useCallback(async (path: string, language: string, text: string) => {
    if (!invoke) return;
    const version = (versionMap.current.get(path) || 0) + 1;
    versionMap.current.set(path, version);
    try {
      await invoke("lsp_did_change", { path, language, version, text });
    } catch {}
  }, []);

  // Notify file saved
  const didSave = useCallback(async (path: string, language: string, text: string) => {
    if (!invoke) return;
    try {
      await invoke("lsp_did_save", { path, language, text });
    } catch {}
  }, []);

  // Request completion
  const completion = useCallback(async (path: string, language: string, line: number, character: number) => {
    if (!invoke) return [];
    try {
      return await invoke("lsp_completion", { path, language, line, character }) as Array<{
        label: string;
        kind: string;
        detail?: string;
        insert_text?: string;
        documentation?: string;
      }>;
    } catch {
      return [];
    }
  }, []);

  // Request hover
  const hover = useCallback(async (path: string, language: string, line: number, character: number) => {
    if (!invoke) return null;
    try {
      return await invoke("lsp_hover", { path, language, line, character }) as {
        contents: string;
        range?: { start_line: number; start_col: number; end_line: number; end_col: number };
      } | null;
    } catch {
      return null;
    }
  }, []);

  // Go to definition
  const definition = useCallback(async (path: string, language: string, line: number, character: number) => {
    if (!invoke) return [];
    try {
      return await invoke("lsp_definition", { path, language, line, character }) as Array<{
        path: string;
        line: number;
        column: number;
      }>;
    } catch {
      return [];
    }
  }, []);

  // Find references
  const references = useCallback(async (path: string, language: string, line: number, character: number) => {
    if (!invoke) return [];
    try {
      return await invoke("lsp_references", { path, language, line, character }) as Array<{
        path: string;
        line: number;
        column: number;
      }>;
    } catch {
      return [];
    }
  }, []);

  // Format document
  const format = useCallback(async (path: string, language: string) => {
    if (!invoke) return [];
    try {
      return await invoke("lsp_format", { path, language, tabSize: 4, insertSpaces: true }) as Array<{
        range: { start_line: number; start_col: number; end_line: number; end_col: number };
        new_text: string;
      }>;
    } catch {
      return [];
    }
  }, []);

  // Get diagnostics for a specific file
  const getDiagnosticsForFile = useCallback((path: string) => {
    return state.diagnostics.filter((d) => d.path === path);
  }, [state.diagnostics]);

  return {
    servers: state.servers,
    diagnostics: state.diagnostics,
    loading: state.loading,
    didOpen,
    didChange,
    didSave,
    completion,
    hover,
    definition,
    references,
    format,
    getDiagnosticsForFile,
  };
}

// ── Helpers ──

function severityFromNumber(n?: number): Diagnostic["severity"] {
  switch (n) {
    case 1: return "error";
    case 2: return "warning";
    case 3: return "information";
    case 4: return "hint";
    default: return "information";
  }
}

function uriToPath(uri: string): string {
  if (uri.startsWith("file:///")) {
    const path = uri.slice(8);
    // Windows: file:///C:/... → C:\...
    if (path.match(/^[A-Za-z]:/)) {
      return path.replace(/\//g, "\\");
    }
    return "/" + path;
  }
  if (uri.startsWith("file://")) {
    return uri.slice(7);
  }
  return uri;
}
