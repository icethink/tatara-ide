// ⚒️ Settings Panel — GUI settings editor
//
// All settings have PHPStorm-equivalent defaults (from settings.rs)
// Categories: エディタ, ターミナル, 外観, Laravel, キーバインド

import { useState } from "react";

interface Setting {
  key: string;
  label: string;
  description: string;
  type: "boolean" | "number" | "string" | "select";
  value: string | number | boolean;
  options?: { value: string; label: string }[];
  category: string;
}

const DEFAULT_SETTINGS: Setting[] = [
  // エディタ
  { key: "editor.fontSize", label: "フォントサイズ", description: "エディタのフォントサイズ", type: "number", value: 15, category: "エディタ" },
  { key: "editor.fontFamily", label: "フォントファミリー", description: "コードフォント", type: "string", value: "JetBrains Mono", category: "エディタ" },
  { key: "editor.tabSize", label: "タブサイズ", description: "タブのスペース数", type: "number", value: 4, category: "エディタ" },
  { key: "editor.insertSpaces", label: "スペースでインデント", description: "タブの代わりにスペースを挿入", type: "boolean", value: true, category: "エディタ" },
  { key: "editor.wordWrap", label: "折り返し", description: "長い行の折り返し", type: "select", value: "off", options: [
    { value: "off", label: "なし" }, { value: "on", label: "あり" }, { value: "wordWrapColumn", label: "指定列" },
  ], category: "エディタ" },
  { key: "editor.wordWrapColumn", label: "折り返し列", description: "折り返す列番号", type: "number", value: 120, category: "エディタ" },
  { key: "editor.minimap", label: "ミニマップ", description: "右側のコード概要", type: "boolean", value: true, category: "エディタ" },
  { key: "editor.lineNumbers", label: "行番号", description: "行番号の表示", type: "select", value: "on", options: [
    { value: "on", label: "表示" }, { value: "off", label: "非表示" }, { value: "relative", label: "相対" },
  ], category: "エディタ" },
  { key: "editor.bracketPairColorization", label: "括弧の色分け", description: "対応する括弧を色で表示", type: "boolean", value: true, category: "エディタ" },
  { key: "editor.autoClosingBrackets", label: "括弧の自動閉じ", description: "開き括弧で自動的に閉じ括弧を追加", type: "boolean", value: true, category: "エディタ" },
  { key: "editor.formatOnSave", label: "保存時フォーマット", description: "保存時に自動フォーマット", type: "boolean", value: true, category: "エディタ" },
  { key: "editor.formatOnPaste", label: "ペースト時フォーマット", description: "ペースト時に自動フォーマット", type: "boolean", value: false, category: "エディタ" },

  // ターミナル
  { key: "terminal.fontSize", label: "フォントサイズ", description: "ターミナルのフォントサイズ", type: "number", value: 14, category: "ターミナル" },
  { key: "terminal.shell", label: "シェル", description: "デフォルトシェル", type: "select", value: "auto", options: [
    { value: "auto", label: "自動検出" }, { value: "bash", label: "Bash" }, { value: "zsh", label: "Zsh" }, { value: "fish", label: "Fish" }, { value: "powershell", label: "PowerShell" },
  ], category: "ターミナル" },
  { key: "terminal.dangerWarning", label: "危険コマンド警告", description: "rm -rf等の実行前に確認", type: "boolean", value: true, category: "ターミナル" },
  { key: "terminal.pasteWarning", label: "複数行ペースト警告", description: "3行以上のペースト時に確認", type: "boolean", value: true, category: "ターミナル" },

  // 外観
  { key: "appearance.theme", label: "テーマ", description: "UIテーマ", type: "select", value: "midnight", options: [
    { value: "midnight", label: "Midnight" }, { value: "dracula", label: "Dracula" }, { value: "abyss", label: "Abyss" },
    { value: "forest", label: "Forest" }, { value: "daylight", label: "Daylight" }, { value: "paper", label: "Paper" },
  ], category: "外観" },
  { key: "appearance.language", label: "言語", description: "UIの表示言語", type: "select", value: "ja", options: [
    { value: "ja", label: "日本語" }, { value: "en", label: "English" },
  ], category: "外観" },
  { key: "appearance.iconTheme", label: "アイコンテーマ", description: "ファイルアイコンのテーマ", type: "select", value: "emoji", options: [
    { value: "emoji", label: "絵文字" }, { value: "minimal", label: "ミニマル" },
  ], category: "外観" },

  // Laravel
  { key: "laravel.artisanPath", label: "Artisanパス", description: "artisanファイルへのパス", type: "string", value: "artisan", category: "Laravel" },
  { key: "laravel.sailEnabled", label: "Laravel Sail", description: "Sail経由でコマンドを実行", type: "boolean", value: false, category: "Laravel" },
  { key: "laravel.autoDetect", label: "フレームワーク自動検出", description: "プロジェクト開始時に自動検出", type: "boolean", value: true, category: "Laravel" },
  { key: "laravel.envValidation", label: ".env検証", description: "APP_KEY等の設定を検証", type: "boolean", value: true, category: "Laravel" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("エディタ");

  const categories = [...new Set(settings.map((s) => s.category))];

  const filtered = settings.filter((s) => {
    const matchesCategory = s.category === activeCategory;
    const matchesSearch = !searchQuery ||
      s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const updateSetting = (key: string, value: string | number | boolean) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );
    // TODO: Persist via Tauri IPC
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "var(--bg-primary)",
      zIndex: 200,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>⚙️ 設定</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="設定を検索..."
          style={{
            flex: 1,
            maxWidth: 400,
            padding: "6px 12px",
            background: "#313244",
            border: "1px solid var(--border)",
            borderRadius: 4,
            color: "var(--fg-primary)",
            fontSize: 13,
            outline: "none",
          }}
        />
        <button onClick={onClose} style={{
          background: "none",
          border: "none",
          color: "var(--fg-muted)",
          cursor: "pointer",
          fontSize: 16,
        }}>
          ✕
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Category sidebar */}
        <div style={{
          width: 160,
          borderRight: "1px solid var(--border)",
          padding: "8px 0",
          overflow: "auto",
        }}>
          {categories.map((cat) => (
            <div
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                cursor: "pointer",
                color: cat === activeCategory ? "var(--fg-primary)" : "var(--fg-muted)",
                background: cat === activeCategory ? "var(--sidebar-active)" : "transparent",
                borderLeft: cat === activeCategory ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {cat}
            </div>
          ))}
        </div>

        {/* Settings list */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
          {filtered.map((setting) => (
            <div
              key={setting.key}
              style={{
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: "1px solid rgba(49, 50, 68, 0.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{setting.label}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{setting.description}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)", opacity: 0.6, marginTop: 2, fontFamily: "var(--font-code)" }}>
                    {setting.key}
                  </div>
                </div>

                <div style={{ minWidth: 180, display: "flex", justifyContent: "flex-end" }}>
                  {setting.type === "boolean" && (
                    <ToggleSwitch
                      checked={setting.value as boolean}
                      onChange={(v) => updateSetting(setting.key, v)}
                    />
                  )}
                  {setting.type === "number" && (
                    <input
                      type="number"
                      value={setting.value as number}
                      onChange={(e) => updateSetting(setting.key, parseInt(e.target.value) || 0)}
                      style={{
                        width: 80,
                        padding: "4px 8px",
                        background: "#313244",
                        border: "1px solid var(--border)",
                        borderRadius: 3,
                        color: "var(--fg-primary)",
                        fontSize: 13,
                        textAlign: "right",
                        outline: "none",
                      }}
                    />
                  )}
                  {setting.type === "string" && (
                    <input
                      type="text"
                      value={setting.value as string}
                      onChange={(e) => updateSetting(setting.key, e.target.value)}
                      style={{
                        width: 180,
                        padding: "4px 8px",
                        background: "#313244",
                        border: "1px solid var(--border)",
                        borderRadius: 3,
                        color: "var(--fg-primary)",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                  )}
                  {setting.type === "select" && (
                    <select
                      value={setting.value as string}
                      onChange={(e) => updateSetting(setting.key, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        background: "#313244",
                        border: "1px solid var(--border)",
                        borderRadius: 3,
                        color: "var(--fg-primary)",
                        fontSize: 13,
                        outline: "none",
                      }}
                    >
                      {setting.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? "var(--accent)" : "#45475a",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute",
        top: 2,
        left: checked ? 20 : 2,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "white",
        transition: "left 0.2s",
      }} />
    </div>
  );
}
