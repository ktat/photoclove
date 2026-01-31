# コード重複の解消

**検出日**: 2026-01-30
**ツール**: jscpd (make check-duplicate)

## 概要

コードベース全体で192件のクローン（重複コード）を検出。全体の重複率は3.02%。

## 進捗サマリ

| 指標 | 最初 | 現在 | 改善 |
|------|------|------|------|
| 合計クローン数 | 192 | 150 | **-42** |
| 合計重複率 | 3.02% | 2.15% | **-0.87%** |
| Rust 重複率 | 5.74% | 4.27% | **-1.47%** |
| JavaScript 重複率 | 1.79% | 1.26% | **-0.53%** |
| JSX 重複率 | 1.18% | 0.80% | **-0.38%** |
| CSS 重複率 | 1.92% | 1.03% | **-0.89%** |

## 完了済み

### ✅ 1. AI Tagging Backend - openclip.rs vs siglip.rs (完了)

**対応内容:**
- `clip_common.rs` に `ClipModelConfig` トレイトと `BaseClipClassifier<C>` ジェネリック構造体を追加
- `openclip.rs`: 403行 → 33行 (設定のみ)
- `siglip.rs`: 431行 → 34行 (設定のみ)
- 約770行削減、Rust重複率 5.74% → 4.85%

### ✅ 4. LicensesView vs DocumentViewer (完了)

**対応内容:**
- `BaseModal.jsx` + `BaseModal.module.css` を作成（共通モーダルコンポーネント）
- `LicensesView` と `DocumentViewer` を BaseModal を使うようにリファクタリング
- `LicensesView.module.css`: 191行 → 78行
- `DocumentViewer.module.css`: 163行 → 57行
- CSS重複率 1.92% → 1.03%

### ⏸ 2. Commands層 - album_commands.rs vs tag_commands.rs (スキップ)

**理由:**
- 各コマンドはTauri APIとして個別に公開される必要がある
- 各関数は6-10行程度でシンプル
- 共通化の労力に見合う効果が限定的
- 許容範囲の重複として判断

### ✅ 3. face_detection_commands.rs vs job_queue_commands.rs (完了)

**対応内容:**
- `job_helpers.rs` モジュールを作成（共通ヘルパー関数）
  - `is_image_file()` - 画像ファイル判定
  - `filter_image_paths()` - 写真リストから画像パスをフィルタリング
  - `create_and_start_job()` - ジョブ作成・開始の共通処理
  - `normalize_date()` - 日付正規化
  - `NO_PHOTOS_RESPONSE` / `NO_IMAGES_RESPONSE` - 定数レスポンス
- `face_detection_commands.rs`: `run_face_detection_for_date` を115行 → 60行に削減
- `job_queue_commands.rs`: 既にヘルパー使用に変換済み
- Rust重複率 4.85% → 4.46% (114クローン → 109クローン)

### ✅ 5. useViewMode.js - 内部重複 (完了)

**対応内容:**
- `TRANSITIONS` オブジェクトをリファクタリング
  - `BASE_TRANSITIONS` (共通遷移) を定義
  - `createTransitions(additions, exclusions)` ヘルパー関数を作成
  - 各モードの遷移定義を1行に簡略化 (200行 → 50行)
- `toggle*` 関数群をリファクタリング
  - `createToggle(mode)` ファクトリ関数を作成
  - 4つの類似関数を統一パターンで生成
- JavaScript重複率 1.79% → 1.51% (32クローン → 25クローン)

### ✅ 6. FilterPopover.jsx - 内部重複 (完了)

**対応内容:**
- `ToggleSwitch` コンポーネントを抽出
  - "Has Comment" と "Has Tag" の重複トグルスイッチを統一
  - 約90行のコードを1つの再利用可能なコンポーネントに
- `ExtensionFilter` コンポーネントを抽出
  - 拡張子フィルターのロジックを独立コンポーネント化
  - `toggleExtension()` ヘルパー関数で重複ロジックを統一
  - `EXTENSION_OPTIONS` 定数で設定を外部化
- JSX重複率 1.18% → 0.96% (17クローン → 14クローン)

### ✅ 7. ThumbnailItem.jsx vs ThumbnailRenderer.jsx (完了)

**対応内容:**
- `thumbnailUtils.js` に共通ユーティリティを抽出
  - `getImportDir()` - インポートディレクトリ取得
  - `initializeImageSource()` - 画像ソース初期化（キャッシュ対応）
  - `handleThumbnailError()` - エラーハンドリングとフォールバック
  - `isVideoFile()` - 動画ファイル判定
  - `metadataOverlayStyle` - 共通オーバーレイスタイル
- `ThumbnailItem.jsx`: 180行 → 70行に削減
- `ThumbnailRenderer.jsx`: 150行 → 90行に削減
- JSX重複率 0.96% → 0.80% (14クローン → 11クローン)

### ✅ 8. repository/db/directory.rs - 内部重複 (完了)

**対応内容:**
- 共通ヘルパー関数を追加
  - `parse_extension_filter()` - 拡張子フィルターのパース
  - `matches_extension_filter()` - 拡張子マッチング
  - `apply_pagination()` - ページネーション処理
  - `create_photo_from_metadata()` - メタデータからPhoto作成
- `get_photos_in_date()`: 重複コードを削減
- `get_recent_photos()`: 重複コードを削減、約40行削減
- Rust重複率 4.46% → 4.27% (109クローン → 107クローン)

---

## 低優先度 (許容範囲)

### SQLマイグレーション間の重複
- `001_initial_schema.sql` と `010_add_photo_id_and_face_mapping.sql`
- スキーマ移行のため許容

### テストファイル内の重複
- `ViewMode.test.js` 内の類似テストケース
- テストの可読性を優先

### CSSの類似スタイル定義
- `VerticalTabBar.css` と `PhotoOption.module.css`
- `TagInput.module.css` と `TagManager.module.css`

---

## 実行コマンド

```bash
# 全体チェック
make check-duplicate

# Rustのみ
make check-duplicate-rust

# JavaScriptのみ
make check-duplicate-js
```
