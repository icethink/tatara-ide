# ⚒️ Tatara IDE ブランディング & 名称統一

## 🔥 名称

| 項目 | 内容 |
|------|------|
| 正式名称 | Tatara IDE |
| 読み | たたら あいでぃーいー |
| ロゴ表記 | Tatara IDE（T は大文字） |
| CLI名 | tatara（小文字） |
| 設定ディレクトリ | ~/.tatara/ |
| プロジェクト設定 | .tatara/ |
| パッケージ名 | tatara-ide |
| リポジトリ名 | tatara-ide |

## 🎌 名前の由来

「たたら」＝日本古来の製鉄法（たたら製鉄）
🔥 砂鉄 + 炭 → 炉で鍛える → 玉鋼（たまはがね）

- ⚒️ Rust（鉄）で鍛え上げた軽量エディタ
- 🔥 コードを炉で鍛えるように、最高の道具を届ける
- 🏠 たたら場＝職人の工房。初心者も熟練者も集う場所
- 🌿 もののけ姫のたたら場のような、温かく力強い空間

### ブランドメッセージ

> 「コードを、鍛える。」

サブメッセージ候補:
- 「Rust で鍛えた、Laravel のための軽量IDE」
- 「初心者にやさしく、プロに速い」
- 「たたら場から、最高のコードを」

## 🎨 ロゴコンセプト

デザイン要素:
- たたら製鉄の炉 or ふいご（送風装置）のシルエット
- 火花 / 炎のモチーフ
- Rust の歯車モチーフとの融合
- 和のテイスト（筆っぽさ or 家紋風）

カラー:
- メイン: 炎のオレンジ〜赤（#F38BA8 〜 #FAB387）
- サブ: 玉鋼のブルーグレー（#89B4FA）
- 背景: 炭のダークグレー（#1E1E2E）

フォント:
- ロゴタイプ: 和テイストのあるサンセリフ
- "IDE" 部分: 細めのモダンフォント

## 📂 設定ファイル名の変更対応表

| 旧（設計書中の表記） | 新（Tatara IDE） |
|--------------------|-------------------|
| ~/.laraforge/ | ~/.tatara/ |
| ~/.laraforge/settings.toml | ~/.tatara/settings.toml |
| ~/.laraforge/themes/ | ~/.tatara/themes/ |
| .ide/profile.toml | .tatara/profile.toml |
| .ide/terminal.toml | .tatara/terminal.toml |
| .ide/tasks.toml | .tatara/tasks.toml |

## 💻 CLI コマンド体系

```bash
# プロジェクト操作
tatara new my-app          # 新規Laravelプロジェクト作成
tatara open .              # カレントディレクトリを開く
tatara open ~/projects/app # 指定ディレクトリを開く

# IDE起動
tatara                     # 前回のプロジェクトを復元
tatara --version           # バージョン表示
tatara --help              # ヘルプ

# 設定
tatara config              # 設定ファイルを開く
tatara config --reset      # デフォルトに戻す
tatara theme midnight      # テーマ切替
tatara lang ja             # 言語切替
```
