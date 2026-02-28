// ⚒️ Tatara IDE — Keybinding System
// VS Code compatible base with PHPStorm enhancements

import { useEffect, useCallback } from "react";

export interface KeyBinding {
  key: string; // e.g., "ctrl+p", "ctrl+shift+f", "shift+shift"
  action: string;
  label: string;
  category: string;
}

// Top 20 keybindings from design doc
export const defaultBindings: KeyBinding[] = [
  { key: "ctrl+p", action: "file.quickOpen", label: "ファイル検索", category: "search" },
  { key: "ctrl+shift+p", action: "command.palette", label: "コマンドパレット", category: "search" },
  { key: "ctrl+shift+f", action: "search.inFiles", label: "全文検索", category: "search" },
  { key: "ctrl+shift+o", action: "search.symbols", label: "シンボル検索", category: "search" },
  { key: "f12", action: "editor.goToDefinition", label: "定義ジャンプ", category: "navigation" },
  { key: "alt+left", action: "editor.goBack", label: "戻る", category: "navigation" },
  { key: "alt+right", action: "editor.goForward", label: "進む", category: "navigation" },
  { key: "shift+f12", action: "editor.findReferences", label: "参照検索", category: "navigation" },
  { key: "ctrl+e", action: "file.recentFiles", label: "最近のファイル", category: "navigation" },
  { key: "ctrl+g", action: "editor.goToLine", label: "行ジャンプ", category: "navigation" },
  { key: "ctrl+f12", action: "editor.outline", label: "構造ビュー", category: "navigation" },
  { key: "alt+enter", action: "editor.quickFix", label: "クイックフィックス", category: "edit" },
  { key: "shift+f6", action: "editor.rename", label: "リネーム", category: "edit" },
  { key: "ctrl+d", action: "editor.duplicateLine", label: "行複製", category: "edit" },
  { key: "ctrl+shift+k", action: "editor.deleteLine", label: "行削除", category: "edit" },
  { key: "alt+up", action: "editor.moveLineUp", label: "行を上に移動", category: "edit" },
  { key: "alt+down", action: "editor.moveLineDown", label: "行を下に移動", category: "edit" },
  { key: "ctrl+/", action: "editor.toggleComment", label: "コメントトグル", category: "edit" },
  { key: "ctrl+alt+l", action: "editor.format", label: "コードフォーマット", category: "edit" },
  { key: "ctrl+`", action: "panel.toggleTerminal", label: "ターミナル切替", category: "panel" },
  { key: "ctrl+b", action: "panel.toggleSidebar", label: "サイドバー切替", category: "panel" },
  { key: "ctrl+s", action: "file.save", label: "保存", category: "file" },
  { key: "ctrl+shift+s", action: "file.saveAll", label: "すべて保存", category: "file" },
  { key: "ctrl+shift+t", action: "file.reopenClosed", label: "閉じたタブを復元", category: "file" },
  { key: "f5", action: "debug.start", label: "デバッグ開始", category: "debug" },
  { key: "f9", action: "debug.toggleBreakpoint", label: "ブレークポイント", category: "debug" },
];

function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");

  const key = e.key.toLowerCase();
  if (!["control", "shift", "alt", "meta"].includes(key)) {
    parts.push(key === " " ? "space" : key);
  }
  return parts.join("+");
}

export function useKeybindings(
  handlers: Record<string, () => void>,
  bindings: KeyBinding[] = defaultBindings,
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const key = normalizeKey(e);
      const binding = bindings.find((b) => b.key === key);
      if (binding && handlers[binding.action]) {
        e.preventDefault();
        handlers[binding.action]();
      }
    },
    [handlers, bindings],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
