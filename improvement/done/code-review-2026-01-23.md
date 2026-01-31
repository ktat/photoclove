# Code Review 改善計画 (2026-01-23)

## 概要

2026-01-23のコードレビューで検出された中優先度以上の問題への対応計画。

## 高優先度

### 1. ファイルサイズ超過: collections.rs (771行) ✅ 完了

**ファイル**: `src-tauri/src/repository/meta_db/sqlite/collections.rs`

**問題**: 600行制限を大幅超過（771行）

**対応方針** (変更):
- `collections/` ディレクトリを作成し、機能別にモジュール分割
- `crud.rs`: CRUD操作 (237行)
- `items.rs`: コレクション-写真関係操作 (254行)
- `queries.rs`: クエリ操作 (293行)
- `mod.rs`: 再エクスポート (36行)

**完了**:
- [x] `collections/crud.rs` を作成
- [x] `collections/items.rs` を作成
- [x] `collections/queries.rs` を作成
- [x] `collections/mod.rs` を作成して再エクスポート
- [x] コンパイル確認

---

### 2. ファイルサイズ超過: mod.rs (623行) ✅ 完了

**ファイル**: `src-tauri/src/repository/meta_db/sqlite/mod.rs`

**問題**: 600行制限を超過（623行）

**対応方針** (実施):
- burst_groups のグルーピング関連メソッドを `burst_groups.rs` に移動
- `get_photos_for_grouping_internal`, `get_all_photos_for_grouping`, `get_photos_for_grouping_in_date`, `get_manual_group_photo_paths_in_date` を移動
- 結果: 623行 → 563行

**完了**:
- [x] グルーピング関数を `burst_groups.rs` に移動
- [x] `mod.rs` を委譲呼び出しに変更
- [x] コンパイル確認

---

### 3. ファイルサイズ超過 + コード重複: App.jsx (623行) ✅ 完了

**ファイル**: `src/App.jsx`

**問題**:
- 600行制限を超過（623行）
- searchPageのレンダリングロジック（408-489行）がメインレンダリング（493-620行）と重複

**対応方針** (実施):
- 別コンポーネント作成ではなく、重複コードの統合で解決
- `searchPage` 専用のレンダリングブロックを削除
- `shouldShowPhotosList` フラグを拡張して検索ページもカバー
- 結果: 623行 → 557行

**完了**:
- [x] 重複する `searchPage` レンダリングブロックを削除
- [x] メインレンダリングで検索ページを統合
- [x] ビルド確認

---

## 中優先度

### 4. ハードコード色: ContextualDeleteModal.jsx ✅ 完了

**ファイル**: `src/components/ContextualDeleteModal.jsx`

**問題**: 55, 65, 74, 83, 92行でハードコード色を使用

**完了**:
- [x] `#F59E0B` → `var(--color-warning)`
- [x] `#DC2626` → `var(--color-danger)`
- [x] `#10B981` → `var(--color-success)`
- [x] `#3B82F6` → `var(--color-primary)`
- [x] ビルド確認

---

### 5. ハードコード色: StartupImageManager.module.css ✅ 完了

**ファイル**: `src/components/StartupImageManager.module.css`

**問題**: 208行で `background-color: white` を使用

**完了**:
- [x] `base.css` に `--toggle-knob-color: #ffffff` を追加
- [x] `white` → `var(--toggle-knob-color)` に置換

---

### 6. ハードコード色: AdvancedFilters.css ✅ 完了

**ファイル**: `src/components/AdvancedFilters.css`

**問題**: 288行で `background-color: white` を使用（ダークテーマ違反）

**完了**:
- [x] `white` → `var(--toggle-knob-color)` に置換

---

### 7. ハードコード色: PhotoCard.module.css ✅ 完了

**ファイル**: `src/App/PhotosList/PhotoCard.module.css`

**問題**:
- 298行: `background-color: #e3e9f5`
- 320行: `background-color: rgba(255, 255, 255, 0.95)`

**完了**:
- [x] `base.css` に `--slide-mount-card-selected: #e3e9f5` を追加
- [x] `base.css` に `--lightbox-thumbnail-bg: rgba(255, 255, 255, 0.95)` を追加
- [x] 各テーマ用の変数も定義
- [x] PhotoCard.module.css をCSS変数に置換

---

### 8. unwrap()へのコメント追加: onnx.rs ✅ 完了

**ファイル**: `src-tauri/src/domain_service/ai_tagging/backend/onnx.rs`

**問題**: 328行の `unwrap()` に説明コメントがない

**完了**:
- [x] 安全性を説明するコメントを追加:
  ```rust
  // Safe: session existence is guaranteed by is_none() check at line 305
  let session = self.session.as_mut().unwrap();
  ```

---

## 完了状況

全8項目完了 (2026-01-23)

### 結果サマリー

| # | 項目 | 結果 |
|---|------|------|
| 1 | collections.rs 分割 | 771行 → 4ファイル (最大293行) |
| 2 | mod.rs 縮小 | 623行 → 563行 |
| 3 | App.jsx 重複削除 | 623行 → 557行 |
| 4 | ContextualDeleteModal.jsx | CSS変数化完了 |
| 5 | StartupImageManager.module.css | CSS変数化完了 |
| 6 | AdvancedFilters.css | CSS変数化完了 |
| 7 | PhotoCard.module.css | CSS変数化完了 |
| 8 | onnx.rs unwrap() | コメント追加完了 |

## 完了基準

- [x] すべてのファイルが600行以下
- [x] ハードコード色がCSS変数に置換
- [x] `cargo check` が成功
