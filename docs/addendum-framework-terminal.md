# ⚒️ Tatara IDE 設計書 v2 追補

## フレームワークプロファイル & ターミナルUX & コンソール設計

---

## 📋 追補A: フレームワークプロファイルシステム

### A-1. 設計思想

「フレームワークは開始時に選ぶが、途中で変えられる」
「IDEの振る舞い・補完・スニペット・ツールが選んだフレームワークに合わせて最適化される」

### A-2. プロファイルのアーキテクチャ

```
IDE コア（共通基盤）
├── エディタ / ターミナル / Git
├── ファイル管理 / 検索 / LSP
└── フレームワーク プロファイル（着脱可能なレイヤー）
    ├── Laravel Profile (v1.0)
    ├── Vue.js Profile (v1.0)
    ├── React Profile (将来)
    ├── None (素PHP) (v1.0)
    └── (将来) Symfony / Rails / Django
```

### A-3. プロファイルが制御するもの

| レイヤー | 制御内容 | Laravel プロファイルの例 |
|---------|---------|----------------------|
| LSP設定 | 有効にする言語サーバー | intelephense + Blade LSP + Volar |
| スニペット | ライブテンプレートセット | `rc` → ResourceController |
| コマンドパレット | フレームワーク固有コマンド | artisan コマンドGUI |
| プロジェクト検出 | フレームワーク自動認識 | composer.json に laravel/framework → 自動適用 |
| コードスタイル | フォーマッター設定 | Laravel Pint (PSR-12ベース) |
| ファイル除外 | 検索・ツリーから隠すもの | vendor/, node_modules/, storage/logs/ |
| 新規ファイルGUI | 生成できるファイル種別 | Controller, Model, Migration... |
| デバッグ設定 | デフォルトデバッグ構成 | Xdebug + artisan serve |
| DB統合 | DB接続の自動設定元 | .env の DB_* 変数 |
| Docker統合 | コンテナ管理方法 | Laravel Sail 特化 |
| ドキュメント参照 | ヘルプリンク先 | Laravel 公式ドキュメント |
| 初心者ガイド | つまずきポイント検出 | Part 4 の全項目 |

### A-5. 自動検出ロジック

| 検出対象 | 判定条件 | 適用プロファイル |
|---------|---------|---------------|
| composer.json に laravel/framework | あり | Laravel |
| composer.json に symfony/symfony | あり | Symfony（将来） |
| package.json に vue (composer.json なし) | あり | Vue.js 単体 |
| package.json に react (composer.json なし) | あり | React（将来） |
| 上記いずれにも該当しない PHP | — | なし（素PHP） |

### A-6. プロファイル設定ファイル（.tatara/profile.toml）

```toml
[framework]
name = "laravel"
version = "12"

[lsp]
php = "intelephense"
blade = true
vue = true

[style]
formatter = "pint"
on_save = true

[paths]
exclude = [
    "vendor", "node_modules", "storage/logs",
    "storage/framework/cache", "bootstrap/cache", ".idea",
]

[docker]
engine = "sail"

[debug]
php_debugger = "xdebug"

[database]
source = "env"

[commands.dev]
label = "開発サーバー起動"
command = "php artisan serve & npm run dev"
group = "development"
```

---

## 📋 追補B: ターミナル / コンソール UX設計

### B-1. 解決すべき既存ターミナルの問題

| # | 問題 | 原因 |
|---|------|------|
| 1 | 日本語IME入力時にカーソルが飛ぶ | IME変換ウィンドウの位置がカーソルと連動しない |
| 2 | IME変換候補が画面左上や右下に出る | TSF実装不備 |
| 3 | IMEモード切替で文字化け | キーイベントのハンドリングミス |
| 4 | Ctrl+C がコピーにならない | Ctrl+C = SIGINT が伝統 |
| 5 | Ctrl+V がペーストにならない | ターミナルでは別のショートカット |
| 6 | 複数行ペーストで即実行される | 改行=Enterとして解釈 |
| 7 | Enter確定で日本語が途中で切れる | IMEの確定とシェルの改行が競合 |

### B-2. ターミナルの動作モード設計

**📝 エディットモード（デフォルト）**
- テキストエディタと同じ操作感
- Ctrl+C = コピー, Ctrl+V = ペースト
- 入力行はテキストエリアとして振る舞う
- Enter で実行（複数行は確認ダイアログ）

**💻 RAWモード（特殊アプリ用・自動切替）**
- vi, top, htop, tmux 等が起動した時
- キー入力をそのままPTYに送信
- Ctrl+C = SIGINT（従来通り）

### B-3. エディットモード キーバインド

| キー | エディットモード | RAWモード |
|------|---------------|---------|
| Ctrl+C | コピー（選択時）/ SIGINT（未選択時） | SIGINT |
| Ctrl+V | ペースト | そのまま送信 |
| Ctrl+X | カット | そのまま送信 |
| Ctrl+A | 全選択 | そのまま送信 |
| Ctrl+Z | Undo（入力中） | サスペンド |
| Enter | 実行（単行）/ 確認（複数行） | そのまま送信 |
| Shift+Enter | 改行（実行しない） | — |
| Tab | 補完候補 | そのまま送信 |
| ↑ / ↓ | コマンド履歴 | そのまま送信 |
| Escape | 入力キャンセル | そのまま送信 |

### B-4. 複数行ペースト確認ダイアログ（MobaXterm方式）

3つの実行方式:
| 方式 | 説明 | ユースケース |
|------|------|-----------| 
| 1行ずつ実行 | 各行の末尾でEnter送信 | デプロイ手順のコピペ実行 |
| テキストとして貼り付け | 実行しない | 確認してから手動実行 |
| 1コマンドに結合 | 改行を && に変換 | 複数コマンドを1行として実行 |

#### 危険コマンド検出（デフォルト）

| パターン | 危険度 |
|---------|-------|
| rm -rf | 🔴 高 |
| migrate:fresh | 🔴 高 |
| migrate:reset | 🔴 高 |
| db:wipe | 🔴 高 |
| drop database/table | 🔴 高 |
| chmod 777 | 🟡 中 |
| sudo | 🟡 中 |
| --force | 🟡 中 |

### B-5. 日本語IME対応設計

| 問題 | 解決策 |
|------|-------|
| IME候補ウィンドウが飛ぶ | 入力行をネイティブテキストエリアとして実装 |
| 変換中にカーソルが動く | composition中はターミナル再描画を抑制 |
| 確定時に文字化け | UTF-8のバイト境界を常にチェック |
| IMEモードが勝手に切り替わる | ターミナルタブごとにIME状態を保持・復元 |
| 半角/全角の切替が効かない | IME関連キーをショートカットより優先 |

アーキテクチャ: ターミナル入力の2層構造
- 出力表示 = PTY出力のレンダリング（従来のターミナルエミュレータ）
- 入力エリア = ネイティブのテキストコントロール（IMEはOSが正しくハンドリング）

### B-7. ターミナル設定項目（.tatara/terminal.toml）

```toml
[terminal]
default_shell = "wsl"
wsl_distro = "Ubuntu"

[terminal.input]
mode = "edit"
ctrl_c_behavior = "smart"
ctrl_v_behavior = "paste"

[terminal.paste]
multiline_confirm = true
dangerous_command_warn = true
default_paste_mode = "line_by_line"

[terminal.ime]
priority_over_shortcuts = true
preserve_state_per_tab = true
suppress_redraw_during_composition = true

[terminal.completion]
enabled = true
sources = ["history", "filepath", "artisan", "git", "npm", "docker"]

[terminal.appearance]
font = "JetBrains Mono"
font_size = 15
cursor_style = "block"
scrollback_lines = 10000
```

### B-8. RAWモード自動切替

| コマンド | 理由 |
|---------|------|
| vi / vim / nvim | フルスクリーンエディタ |
| nano | フルスクリーンエディタ |
| top / htop | インタラクティブ表示 |
| tmux / screen | マルチプレクサ |
| less / more | ページャー |
| mysql / psql | 対話型DBクライアント |
| php artisan tinker | 対話型REPL |
| node (引数なし) | 対話型REPL |
| ssh | リモート接続 |

---

## 📋 追補C: ターミナル実装技術メモ

### C-1. Rust側のクレート構成

| 用途 | クレート | 役割 |
|------|---------|------|
| PTY管理 | portable-pty | Windows + WSL の PTY 生成 |
| ターミナルエミュレーション | alacritty_terminal | VT100/xterm エスケープシーケンス解析 |
| IMEハンドリング | windows-rs (TSF API) | TSF 直接制御 |
| UTF-8処理 | encoding_rs | 文字コード変換 |
| クリップボード | arboard | クロスプラットフォーム クリップボード |

### C-2. フロントエンド推奨方式

**案C: Canvas描画 + IME Position API ★推奨★**
- ターミナル出力はCanvas上に描画
- 入力行だけ透明な<textarea>をオーバーレイ
- IME候補ウィンドウ位置はtextareaのカーソル位置に追従
- Alacritty / Wezterm がこの方式を採用
