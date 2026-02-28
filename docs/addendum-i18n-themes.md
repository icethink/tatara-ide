# ⚒️ Tatara IDE 設計書 v2 追補2

## 多言語対応（日本語/英語） & ビジュアルテーマシステム

---

## 📋 追補E: 多言語対応（i18n）

### E-1. 設計方針

「日本語がファーストクラス」

| 項目 | 方針 |
|------|------|
| 対応言語 | 日本語 (ja) / 英語 (en) |
| デフォルト | OSの言語設定に追従 |
| 切替方法 | 設定画面 + コマンドパレット（即時反映・再起動不要） |
| 翻訳方式 | キーベースの翻訳ファイル（JSON） |
| フォールバック | 対応翻訳なし → 英語 → キー名そのまま |

### E-2. 翻訳ファイル構造

```
locales/
├── ja.json   ← 日本語
├── en.json   ← 英語
└── schema.json ← 翻訳キーのスキーマ定義
```

### E-3. Rust側の実装

```rust
pub struct I18n {
    current_locale: String,
    translations: HashMap<String, Value>,
    fallback_locale: String, // "en"
}

impl I18n {
    pub fn t(&self, key: &str) -> String { /* ... */ }
    pub fn t_with(&self, key: &str, params: &[(&str, &str)]) -> String { /* ... */ }
    pub fn set_locale(&mut self, locale: &str) { /* ... */ }
    pub fn detect_system_locale() -> String { /* ... */ }
}
```

### E-4. フロントエンド使用例

```tsx
const { t, locale, setLocale } = useI18n();

<button>{t('common.save')}</button>       // → "保存"
<span>{t('editor.line')}: 42</span>       // → "行: 42"
<p>{t('search.results', { count: 15 })}</p> // → "15 件の結果"
```

### E-5. 日英で気をつけるポイント

| ポイント | 対策 |
|---------|------|
| フォント | 英語: JetBrains Mono / 日本語: Noto Sans JP をフォールバック |
| UIの幅 | 日本語は幅広 → flex/autoで対応 |
| 語順 | プレースホルダで語順を変えられる設計 |
| 敬体/常体 | 体言止め + 動詞終止形で統一 |
| エラーメッセージ | 技術用語は英語のまま |
| ドキュメントリンク | 日本語あれば日本語、なければ英語にフォールバック |

---

## 📋 追補F: ビジュアルテーマシステム

### F-1. 設計方針

テーマシステムは2層構造:
- **Layer 1: UIテーマ** — ウィンドウ・サイドバー・ステータスバー等のUI部品の色
- **Layer 2: シンタックステーマ** — コードのハイライト色

この2つは独立して選べる。

### F-2. ビルトインテーマ一覧

#### ダーク系（4種）

| テーマ名 | コンセプト | ベースカラー | アクセント |
|---------|----------|------------|----------|
| Midnight (デフォルト) | モダンで落ち着いた | #1E1E2E | #89B4FA |
| Abyss | 漆黒の集中モード | #000C18 | #6CB6FF |
| Dracula | 人気のパープル系 | #282A36 | #BD93F9 |
| Forest | 目に優しいグリーン | #1A2332 | #7ECE8B |

#### ライト系（3種）

| テーマ名 | コンセプト | ベースカラー | アクセント |
|---------|----------|------------|----------|
| Daylight | 柔らかく明るい | #FAFAFA | #0078D4 |
| Paper | 紙のような温かみ | #FFF8F0 | #D75F00 |
| Snow | クールで清潔感 | #FFFFFF | #0969DA |

#### ハイコントラスト（1種）

| テーマ名 | 用途 |
|---------|------|
| High Contrast | アクセシビリティ対応 |

### F-3. テーマのカラートークン設計

VS Codeと同様に「デザイントークン」方式を採用。

テーマファイル: `themes/midnight.toml`

主要トークンカテゴリ:
- `colors.base` — 基本色（背景、前景、ボーダー、アクセント）
- `colors.editor` — エディタ（行ハイライト、選択、カーソル、行番号）
- `colors.sidebar` — サイドバー
- `colors.activity_bar` — アクティビティバー
- `colors.status_bar` — ステータスバー
- `colors.tab` — タブ
- `colors.terminal` — ターミナル（ANSI 16色含む）
- `colors.input` — 入力系
- `colors.button` — ボタン
- `colors.notification` — 通知・バッジ
- `colors.git_gutter` — Git ガター
- `colors.search` — 検索ハイライト
- `colors.minimap` — ミニマップ
- `colors.scrollbar` — スクロールバー
- `colors.dialog` — ダイアログ

シンタックストークン: `themes/syntax/midnight.toml`
- comment, string, number, boolean, keyword, operator
- function_def, function_call, class_name, variable
- PHP固有: php_variable, php_this
- Blade固有: blade_directive, blade_echo
- Vue固有: vue_directive, vue_component

### F-5. OS連動 & 自動切替

| 機能 | 説明 |
|------|------|
| OS ダーク/ライトモード追従 | Windows のダークモード設定に自動追従 |
| 時間帯自動切替 | 日中はライト、夜はダーク |
| プロジェクト別テーマ | .tatara/profile.toml にテーマ設定を保存 |

```toml
[theme]
ui = "midnight"
syntax = "midnight"

[theme.auto]
follow_os = true
dark_theme = "midnight"
light_theme = "daylight"
```

### F-6. カスタムテーマ

```
~/.tatara/themes/
├── my-custom-dark.toml
├── my-custom-syntax.toml
└── imported/
    └── catppuccin-mocha.toml
```

将来的には:
- VS Code テーマの .json をインポートして自動変換
- TextMate テーマ (.tmTheme) のインポート
- コミュニティテーマの配布サイト
