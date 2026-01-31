# Unknown Faces Management (未知の顔管理)

## Overview

ViewMode=FACE_LIST（顔一覧）で、名前が割り当てられていない「Unknown」な顔を一覧表示し、一括で管理（削除・既存人物への割り当て）できる機能。

現在、`detected_faces`テーブルで`person_id = NULL`の顔は「Unknown」として扱われるが、それらを効率的に管理するUIが存在しない。

## User Impact

### Who benefits?
- 大量の写真から顔を検出したユーザー
- 家族や友人の写真を整理したいユーザー
- 誤検出（偽陽性）を整理したいユーザー

### How does it improve their workflow?
- 未割り当ての顔を一覧で確認できる
- 複数の顔をまとめて同一人物に割り当てられる
- 誤検出を一括削除できる

### What pain points does it solve?
- 現状、Unknown顔を個別に処理する必要があり非効率
- どの顔が未処理かわからない
- 同一人物の顔を1つずつ割り当てるのが面倒

## Influence on Existing Features

### Compatibility
- 既存機能との互換性：✅ 問題なし
- 既存の`FacesList`コンポーネントを拡張
- 既存のバックエンドコマンド（`assign_face_to_person`等）を活用

### Related Features
- **FacesList** (`src/App/PhotosList/FacesList.jsx`) - 顔一覧表示
- **FaceThumbnail** (`src/components/FaceThumbnail.jsx`) - 顔サムネイル
- **ViewMode** (`src/domain/ViewMode.js`) - FACE_LIST, PERSON モード
- **Selection機能** - ViewMode対応のチェックボックス選択（既実装）

## Implementation Approach

### Architecture

#### 表示モード
FacesListに2つの表示モードを追加：
1. **Persons View** (現在のデフォルト) - 人物単位の一覧
2. **Unknown Faces View** (新規) - 未割り当て顔の一覧

#### データフロー
```
Unknown Faces View:
┌──────────────────────────────────────────────────────────┐
│  [Persons] [Unknown (45)]  ← タブ切り替え               │
├──────────────────────────────────────────────────────────┤
│  ☐ 顔1  ☐ 顔2  ☐ 顔3  ☐ 顔4  ← チェックボックス付き   │
│  ☐ 顔5  ☐ 顔6  ☐ 顔7  ☐ 顔8                           │
├──────────────────────────────────────────────────────────┤
│  [Delete Selected] [Assign to Person ▼]                  │
└──────────────────────────────────────────────────────────┘
```

### Source Code Changes

**Frontend**:

| File | Changes |
|------|---------|
| `src/App/PhotosList/FacesList.jsx` | タブUI追加、Unknown顔表示モード |
| `src/App/PhotosList/UnknownFacesList.jsx` (新規) | Unknown顔専用コンポーネント |
| `src/services/FaceDetectionService.js` | 新しいAPI呼び出し追加 |
| `src/hooks/usePhotosState.js` | unknownFaces状態追加 |

**Backend**:

| File | Changes |
|------|---------|
| `src-tauri/src/commands/face_detection_commands.rs` | 新コマンド追加 |
| `src-tauri/src/repository/meta_db/sqlite/face_detection.rs` | クエリ追加 |

**新規Tauriコマンド**:

```rust
// 1. Unknown顔の一覧取得
#[tauri::command]
pub fn get_unknown_faces(
    state: State<AppState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<Vec<UnknownFaceRecord>, String>

// 2. Unknown顔の数を取得
#[tauri::command]
pub fn get_unknown_faces_count(
    state: State<AppState>,
) -> Result<i32, String>

// 3. 複数の顔を一括で人物に割り当て
#[tauri::command]
pub fn assign_faces_to_person(
    state: State<AppState>,
    face_ids: Vec<i32>,
    person_id: i32,
) -> Result<(), String>

// 4. 複数の顔を一括削除
#[tauri::command]
pub fn delete_detected_faces(
    state: State<AppState>,
    face_ids: Vec<i32>,
) -> Result<(), String>

// 5. 類似したUnknown顔を取得（Phase 2）
#[tauri::command]
pub fn get_similar_unknown_faces(
    state: State<AppState>,
    face_id: i32,
    threshold: Option<f32>,  // デフォルト: 0.5
    limit: Option<u32>,      // デフォルト: 20
) -> Result<Vec<SimilarFaceRecord>, String>
// SimilarFaceRecord: { face_id, similarity, bbox, photo_path }
```

**Database**:
- スキーマ変更なし
- 新規インデックス追加を検討: `detected_faces` の `person_id IS NULL` 用部分インデックス

```sql
CREATE INDEX IF NOT EXISTS idx_detected_faces_unknown
ON detected_faces(id) WHERE person_id IS NULL;
```

### UI Design

#### タブ切り替え
```jsx
<div className="faces-tabs">
  <button
    className={viewType === 'persons' ? 'active' : ''}
    onClick={() => setViewType('persons')}
  >
    Persons
  </button>
  <button
    className={viewType === 'unknown' ? 'active' : ''}
    onClick={() => setViewType('unknown')}
  >
    Unknown ({unknownCount})
  </button>
</div>
```

#### Unknown顔の表示
- グリッドレイアウト（現在のFacesListと同様）
- 各顔にチェックボックス
- 顔をクリックすると元の写真を表示（PhotoViewerへ遷移）
- 写真パス情報も表示（どの写真から検出されたか）

#### アクションバー
選択した顔に対するアクション：
1. **Delete Selected** - 選択した顔を削除（誤検出対応）
2. **Assign to Person** - ドロップダウンで既存人物を選択、または新規作成

## Dependencies & Risks

### External Dependencies
- なし（既存のライブラリで対応可能）

### Performance
- 無限スクロール実装（PhotoGridと同様のパターン）
- limit/offsetでバックエンドから段階的に取得
- サムネイル読み込みの遅延ローディング（Intersection Observer）

### Security
- 入力値バリデーション（face_id, person_idの整数チェック）
- SQLインジェクション対策（rusqliteのパラメータバインド使用済み）

## Testing Strategy

### Manual Testing
1. 顔検出を実行し、Unknown顔を生成
2. FacesList → Unknownタブに切り替え
3. 複数の顔を選択
4. 既存人物に割り当て → Personsタブで確認
5. 別の顔を選択して削除 → 一覧から消えることを確認

### Edge Cases
- Unknown顔が0件の場合の表示
- 全てのUnknown顔を選択して操作
- 割り当て先の人物を検索・フィルタリング

## Design Decisions

1. **ソート順**: 検出日時順（新しい順）で表示
2. **類似顔サジェスト**: 必要 → Phase 2で実装
3. **自動クラスタリング**: Phase 3以降で検討（`cluster_id`フィールドは既存）
4. **スクロール方式**: 無限スクロール（PhotoGridと同様の実装）

## Implementation Phases

### Phase 1: 基本機能
- [ ] `get_unknown_faces` コマンド実装（検出日時順ソート、limit/offset対応）
- [ ] `get_unknown_faces_count` コマンド実装
- [ ] FacesListにタブUI追加（Persons / Unknown）
- [ ] UnknownFacesListコンポーネント作成（無限スクロール、PhotoGrid同様）
- [ ] 単一の顔を選択して既存人物に割り当て

### Phase 2: 一括操作 + 類似顔サジェスト
- [ ] `assign_faces_to_person` コマンド実装
- [ ] `delete_detected_faces` コマンド実装
- [ ] 複数選択UI
- [ ] アクションバー（Delete / Assign to Person）
- [ ] `get_similar_unknown_faces` コマンド実装
- [ ] 類似顔サジェストUI（選択した顔に似た他のUnknown顔をハイライト/自動選択）

### Phase 3: 自動クラスタリング
- [ ] 検索/フィルター機能
- [ ] 自動クラスタリング（`cluster_id`フィールド活用）
- [ ] クラスタ単位での一括割り当てUI

---

## 関連ドキュメント

- `docs/terms.md` - ViewMode, FacesList等の用語
- `src-tauri/src/repository/meta_db/migrations/008-010_*.sql` - 顔検出スキーマ
