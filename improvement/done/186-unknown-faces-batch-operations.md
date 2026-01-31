# Unknown Faces Batch Operations

## Overview
Unknown Faces一覧で複数の顔を選択した後、一括操作（削除・Assign）を可能にする機能。

現在、Unknown Facesを選択しても「Clear Selection」ボタンしか表示されず、実質的な操作ができない状態。

## User Impact
- **対象ユーザー**: 顔認識機能を使用するユーザー
- **改善されるワークフロー**:
  - 誤検出された顔を一括削除
  - 同一人物の顔を一括で既存/新規Personに割り当て
- **解決される課題**: 現在は個別にPhotoViewerを開いて操作する必要がある

## Influence on Existing Features

### Compatibility
- 既存機能への影響なし
- SelectionTabに新しいボタンを追加するのみ

### Related Features
- `UnknownFacesList` - 顔の選択UI（実装済み）
- `SelectionTab` - 選択済みアイテムの表示と操作
- `FaceDetectionService` - `deleteFace()`, `assignFaceToPerson()` が既に存在

## Implementation Approach

### Architecture
- 既存の `FaceDetectionService` の関数を利用
- バッチ処理用の新しいTauriコマンドは不要（既存のループ処理で対応可能）

### Source Code Changes

**Frontend**:

1. `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx`
   - Unknown Faces選択時のoperationボタンを追加:
     - 「Delete Selected」ボタン
     - 「Assign to Person」ドロップダウン

2. `src/hooks/usePhotoOperations.js` または新規hook
   - `deleteSelectedUnknownFaces(faceIds)` - 一括削除処理
   - `assignSelectedUnknownFaces(faceIds, personId)` - 一括Assign処理

**Backend**:
- `src-tauri/src/commands/face_detection_commands.rs`
  - `delete_detected_faces_batch(face_ids: Vec<i64>)` - 一括削除コマンド
  - `assign_faces_to_person_batch(face_ids: Vec<i64>, person_id: i64)` - 一括Assignコマンド

- `src-tauri/src/repository/meta_db/sqlite/face_detection/faces.rs`
  - `delete_detected_faces_batch()` - `WHERE id IN (?, ?, ...)` で一括削除
  - `assign_faces_to_person_batch()` - `UPDATE ... WHERE id IN (?, ?, ...)`

### UI Design

```
Selected Unknown Faces (3)

[Clear Selection] [Operation ▼]
                   ├── Assign to New Person
                   ├── Assign to Existing Person
                   └── Delete
```

※ 個別のFace IDリストは表示しない（件数のみ）

**操作フロー**:

1. **Assign to New Person**
   - 名前入力ダイアログを表示
   - 入力後、新規Person作成 → 選択した顔を割り当て

2. **Assign to Existing Person**
   - 右カラム内にPerson一覧を表示（FaceThumbnail使用）
   - 顔をクリックして選択 → 選択した顔を割り当て

3. **Delete**
   - 確認ダイアログ：「3件の顔を削除しますか？」
   - OK → 一括削除

## Dependencies & Risks

### External Dependencies
- なし（既存機能の組み合わせ）

### Performance
- 大量選択時（100+）の削除/Assignはプログレス表示が必要かもしれない
- バッチAPIがあれば高速化可能

### Security
- 削除は確認ダイアログを表示

## Testing Strategy
1. Unknown Facesを複数選択
2. Delete Selected → 確認ダイアログ → 削除実行 → リスト更新確認
3. Assign to Person → Person選択 → Assign実行 → Unknown一覧から消えることを確認
4. Create New Person経由でのAssign

## Design Decisions
1. **バッチAPI使用**: `WHERE id IN (?, ?, ...)` で一括処理
   - SQLite (bundled) の `SQLITE_MAX_VARIABLE_NUMBER` は 32766
   - Unknown Facesの選択数がこれを超えることはない
2. **プログレス表示**: 不要（IN句で瞬時に完了）
3. **操作後の更新**: Unknown一覧を自動リロード

## Open Questions
特になし
