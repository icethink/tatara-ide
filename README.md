# ⚒️ Tatara IDE

> **「コードを、鍛える。」** ── Rust で鍛えた、Laravel のための軽量IDE

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 概要

Tatara IDE は、**Laravel 初心者が迷わず開発を始められる**ことを最重要設計方針とした軽量IDEです。

PHPStorm の「最初にやるべき設定」が全てデフォルトで入っており、WSL統合・環境構築ウィザード・日本語ファーストクラスサポートを備えています。

### なぜ「たたら」？

「たたら」は日本古来の製鉄法。砂鉄と炭を炉で鍛えて玉鋼を生み出す技術です。

- ⚒️ **Rust（鉄）で鍛え上げた**軽量エディタ
- 🔥 コードを炉で鍛えるように、**最高の道具**を届ける
- 🏠 たたら場 = 職人の工房。**初心者も熟練者も集う場所**

## ✨ 特徴

| 特徴 | 説明 |
|------|------|
| 🚀 **爆速起動** | Rust + Tauri による100-200MBのメモリ使用量 |
| 🎯 **Laravel特化** | フレームワーク自動検出、artisan GUI、Blade/Vue サポート |
| 🪟 **WSLネイティブ** | WSLファイルシステム直接アクセス、パス自動変換 |
| 🧙 **環境構築ウィザード** | PHP/Composer/Node.js のチェック＆ワンクリックインストール |
| 📝 **スマートターミナル** | Ctrl+C/V対応、IME完全対応、複数行ペースト確認 |
| 🌐 **日本語ファーストクラス** | UI・エラーメッセージ・ドキュメントが最初から日本語対応 |
| 🎨 **8種のテーマ** | ダーク4種 + ライト3種 + ハイコントラスト、OS連動 |
| 🤖 **AI統合** | Claude / OpenAI / ローカルLLM 対応（Phase 4） |

## 🏗️ 技術スタック

| レイヤー | 技術 |
|---------|------|
| バックエンド | Rust (Tauri) |
| フロントエンド | TypeScript + React (WebView) |
| テキストバッファ | ropey |
| 構文解析 | tree-sitter |
| 検索 | ripgrep |
| PTY | portable-pty |
| ターミナルエミュレーション | alacritty_terminal |

## 📋 ロードマップ

### Phase 1 (MVP) — 「Laravel1年生が迷わず開発開始できる」
- [x] プロジェクト構造・設計書
- [ ] コアエディタ（tree-sitter + ropey）
- [ ] WSL統合（ファイルアクセス + パス変換）
- [ ] ファイルツリー + ファジーファインダー + 全文検索
- [ ] シンタックスハイライト（PHP/JS/HTML/CSS/Blade/Vue）
- [ ] ターミナル（エディットモード + IME対応）
- [ ] フレームワークプロファイル（Laravel基本）
- [ ] デフォルト設定（PHPStorm相当）

### Phase 2 — 「PHPStorm並みのコード補完」
- [ ] LSP統合（intelephense + Volar）
- [ ] 定義ジャンプ・参照検索
- [ ] 自動インポート・Emmet・スニペット
- [ ] コードフォーマッター（Pint + Prettier）

### Phase 3 — 「ツール全部入り」
- [ ] Git GUI（初心者ガイド付き）
- [ ] データベースビューア（.env自動接続）
- [ ] Docker / Laravel Sail 統合
- [ ] artisan コマンドパレット
- [ ] プロジェクト作成ウィザード

### Phase 4 — 「プロ仕様」
- [ ] デバッグ（Xdebug DAP）
- [ ] AI統合（インライン補完 + チャット）
- [ ] テスト実行（PHPUnit / Jest）
- [ ] vi キーバインド

## 🚀 開発環境セットアップ

### 前提条件

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/)

### セットアップ

```bash
# リポジトリクローン
git clone https://github.com/icethink/tatara-ide.git
cd tatara-ide

# フロントエンド依存関係
pnpm install

# 開発サーバー起動
pnpm tauri dev
```

### ビルド

```bash
pnpm tauri build
```

## 📁 プロジェクト構造

```
tatara-ide/
├── docs/                    # 設計書
│   ├── branding.md         # ブランディング
│   ├── design-v2.md        # メイン設計書
│   ├── addendum-*.md       # 追補
├── src/                     # フロントエンド（React + TypeScript）
│   ├── components/         # UIコンポーネント
│   ├── hooks/              # カスタムフック
│   ├── layouts/            # レイアウト
│   ├── pages/              # ページ
│   ├── styles/             # スタイル
│   ├── utils/              # ユーティリティ
│   └── i18n/               # 多言語対応
│       └── locales/        # 翻訳ファイル
├── src-tauri/               # バックエンド（Rust + Tauri）
│   └── src/                # Rustソースコード
├── themes/                  # テーマファイル
│   ├── ui/                 # UIテーマ（.toml）
│   └── syntax/             # シンタックステーマ（.toml）
├── snippets/                # スニペット定義
├── package.json
├── tsconfig.json
└── Cargo.toml (src-tauri/)
```

## 📖 設計書

詳細な設計書は [docs/](docs/) を参照してください：

- [ブランディング](docs/branding.md) — 名称・ロゴ・カラー
- [設計書 v2](docs/design-v2.md) — 機能一覧・UI設計・実装優先度
- [追補: フレームワーク & ターミナル](docs/addendum-framework-terminal.md) — プロファイルシステム・ターミナルUX
- [追補: 多言語 & テーマ](docs/addendum-i18n-themes.md) — i18n・ビジュアルテーマ

## 📝 ライセンス

MIT License — 詳細は [LICENSE](LICENSE) を参照。

---

<p align="center">
  <strong>⚒️ たたら場から、最高のコードを。</strong>
</p>
