# Unknown Face Photo Viewer Navigation (Unknown顔のPhotoViewer連携)

## Overview

Unknown顔一覧で顔をクリックした際に、その顔が含まれる写真をPhotoViewerで表示する機能。さらに、PhotoViewer内での「次へ/前へ」ナビゲーションは、Unknown顔のリストに基づいて移動する（通常の日付順ではなく）。

## User Impact

### Who benefits?
- Unknown顔を整理しているユーザー
- 顔の割り当て作業を効率的に行いたいユーザー
- 写真のコンテキストを確認しながら顔を判別したいユーザー

### How does it improve their workflow?
- 顔だけでなく、その顔が写っている写真全体を確認できる
- 写真のコンテキスト（場所、一緒に写っている人）から人物を特定しやすくなる
- Unknown顔を順番に確認しながら割り当て作業ができる

### What pain points does it solve?
- 顔サムネイルだけでは人物を特定しにくい
- 現在は写真を確認するために別途ファイルを開く必要がある
- Unknown顔を順番に処理する効率的な方法がない

## Influence on Existing Features

### Compatibility
- 既存機能との互換性：✅ 問題なし
- PhotoViewerの既存のナビゲーション機能を拡張
- 現在のUnknownFacesListの動作を変更

### Related Features
- **PhotoViewer** (`src/App/PhotosGrid/PhotoViewer.jsx`) - 写真表示コンポーネント
- **UnknownFacesList** (`src/App/PhotosList/UnknownFacesList.jsx`) - Unknown顔一覧
- **PhotosList** (`src/App/PhotosList.jsx`) - 写真一覧・ナビゲーション管理
- **usePhotosListHandlers** (`src/hooks/usePhotosListHandlers.js`) - 写真ハンドラー

## Implementation Approach

### Architecture

#### 現在の動作
```
UnknownFacesList
  └─ onFaceClick(face) → 未定義の動作
```

#### 提案する動作
```
UnknownFacesList
  └─ onFaceClick(face)
       └─ currentPhotoPath = face.photo_path
       └─ currentPhotoIndex = index in unknown faces list
       └─ PhotoViewer opens with face's photo
            └─ Next/Prev navigate through unknown faces' photos
```

### ナビゲーションリストの構築

Unknown顔の写真ナビゲーションは以下のロジックで構築：

```sql
SELECT photo_path, MAX(detected_at) as latest_detection
FROM detected_faces
WHERE person_id IS NULL
GROUP BY photo_path
ORDER BY latest_detection DESC
```

**ポイント**:
- `GROUP BY photo_path`: 同一写真に複数のUnknown顔があっても1回だけ表示
- `MAX(detected_at)`: 最新の検出時刻でソート（新しく検出された顔の写真が先）
- `ORDER BY DESC`: 新しい順に表示

### ナビゲーションモード

PhotoViewerに「ナビゲーションモード」の概念を導入：

| モード | 次へ/前への動作 | 使用場面 |
|--------|----------------|----------|
| `date` (デフォルト) | 日付順の写真リスト | 通常の写真閲覧 |
| `album` | アルバム内の写真 | アルバムモード |
| `unknown_faces` | Unknown顔を含む写真（検出時刻順） | Unknown顔一覧 |
| `person` | 特定人物の顔順 | 人物モード |

### Source Code Changes

### Unified Search Pattern

既存の `photo_handlers/person.rs` と同様のパターンで実装：

```
get_photos(search_type="unknown_faces")
  → photo_handlers::unknown_faces::handle()
    → meta_db.get_photos_for_unknown_faces_full()
      → SQL: GROUP BY photo_path, ORDER BY MAX(detected_at) DESC
```

**Backend**:

| ファイル | 変更内容 |
|---------|---------|
| `src-tauri/src/commands/photo_handlers/unknown_faces.rs` | 新規ハンドラー作成 |
| `src-tauri/src/commands/photo_handlers/mod.rs` | モジュール登録 |
| `src-tauri/src/commands/photo_commands.rs` | `"unknown_faces"` search_type追加 |
| `src-tauri/src/repository/meta_db/sqlite/face_detection/` | `get_photos_for_unknown_faces_full()` 実装 |

**Frontend**:

| ファイル | 変更内容 |
|---------|---------|
| `src/App/PhotosList/UnknownFacesList.jsx` | `onFaceClick`で`loadAllPhotosBasedOnViewMode`呼び出し |
| `src/domain/ViewMode.js` | `UNKNOWN_FACES`モード追加（または既存FACE_LISTを拡張） |
| `src/hooks/usePhotoLoader.js` | `search_type: "unknown_faces"` 対応 |

### 採用方針: Unified Search Pattern

既存の `person` ハンドラーと同様に、`search_type="unknown_faces"` でUnified Search Patternを使用。
これにより：
- 既存の `filteredPhotos` がUnknown顔写真リストに設定される
- PhotoViewerの既存ナビゲーションがそのまま動作
- ViewModeパターンとの整合性が保たれる

## Dependencies & Risks

### Performance
- Unknown顔のリストが大きい場合（1000+）のメモリ使用量
- 写真の先読み（preload）戦略

### Edge Cases
- Unknown顔が0件の場合
- Unknown顔の写真が削除されている場合
- 同じ写真に複数のUnknown顔がある場合

## Testing Strategy

### Manual Testing
1. Unknown顔一覧で顔をクリック → PhotoViewerで写真が表示される
2. 次へボタンをクリック → 次のUnknown顔の写真に移動
3. 前へボタンをクリック → 前のUnknown顔の写真に移動
4. 最後の顔で次へ → 適切な動作（ループ or 停止）
5. PhotoViewerを閉じる → Unknown顔一覧に戻る

### Edge Cases
- ~~同一写真に複数のUnknown顔がある場合の動作~~ → GROUP BYで解決
- Unknown顔リストが更新された場合（割り当て後）→ PhotoViewer閉じて再取得
- 写真ファイルが存在しない場合 → スキップして次の写真へ

## Open Questions

1. ~~**同一写真の複数顔**: 同じ写真に3つのUnknown顔がある場合、ナビゲーションで3回表示するか、1回だけにするか？~~ → **解決**: `GROUP BY photo_path` で1回のみ表示
2. **顔のハイライト**: PhotoViewerで現在のUnknown顔をハイライト表示するか？（Phase 2）
3. **割り当て操作**: PhotoViewer内から直接顔の割り当てができるようにするか？（将来的な拡張）
4. **Known顔一覧**: Known顔（Persons View）でも同様の機能が必要か？

## Implementation Phases

### Phase 1: 基本実装
- [ ] Unknown顔クリックでPhotoViewer表示
- [ ] Unknown顔リストに基づくナビゲーション

### Phase 2: UX改善
- [ ] 顔のハイライト表示
- [ ] PhotoViewer内での顔割り当てUI

---

## 関連ドキュメント

- `improvement/done/181-unknown-faces-management.md` - Unknown顔管理
- `docs/terms.md` - 用語集
