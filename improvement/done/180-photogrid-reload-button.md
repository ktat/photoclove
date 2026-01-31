# PhotoGrid Reload Button

## Overview

PhotoGrid表示のすべてのViewModeで、日付やアルバム名などのタイトル隣にリロードボタンを設置する。クリックすると、現在のPhotoGridが再読み込みされる。

---

## User Impact

### Who benefits?
- すべてのPhotoCloveユーザー

### How does it improve workflow?
- 写真をインポートした後、手動でリフレッシュできる
- 外部ツールで写真を編集した後、変更を確認できる
- データベースの同期問題が発生した場合の回復手段
- サムネイル生成完了後の確認

### Pain points solved
- 現在はビューを切り替えないとリロードできない
- 自動リフレッシュが効かない場面での手動回復手段がない

---

## Influence on Existing Features

### Compatibility
- 既存機能への影響なし（新規ボタン追加のみ）
- 既存の `refreshPhotosOnly` 関数を再利用

### Related Features
- **StatusBar** (`src/App/PhotosList/StatusBar.jsx`) - タイトル表示コンポーネント
- **PhotosToolbar** (`src/App/PhotosList/PhotosToolbar.jsx`) - ツールバー（別オプション）
- **PhotoListContent** (`src/App/PhotosList/PhotoListContent.jsx`) - 親コンポーネント
- **usePhotoLoader** (`src/hooks/usePhotoLoader.js`) - 写真読み込みロジック

---

## Implementation Approach

### Architecture

フロントエンドのみの変更。バックエンドやデータベースの変更は不要。

### Source Code Changes

**Frontend:**

1. `src/App/PhotosList/StatusBar.jsx`
   - `onRefresh` propを追加
   - タイトル横にリロードボタンを配置

2. `src/App/PhotosList/PhotoListContent.jsx`
   - `StatusBar`に`onRefresh`ハンドラを渡す

3. `src/App/PhotosList/StatusBar.module.css` (または既存CSS)
   - リロードボタンのスタイル追加

### UI Design

```
┌─────────────────────────────────────────────────────────────┐
│  2024-01-15 [🔄]                    [Icon▼][Sort▼][Filter]  │
│  ← Back to Album List                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Photo Grid...]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**ボタン仕様:**
- アイコン: `↻` または `🔄`
- サイズ: 小さめ（タイトルと同じ行に収まる）
- ホバー時: 背景色変更
- クリック時: 回転アニメーション（オプション）
- Tooltip: "Reload photos"

### ViewMode対応

| ViewMode | 表示 |
|----------|------|
| DATE | `2024-01-15 [🔄]` |
| RECENT | `Recent Photos [🔄]` |
| ALBUM | `My Album [🔄]` |
| TAG | `My Tag [🔄]` |
| SEARCH | `Search Results [🔄]` |
| TRASH | `Trash [🔄]` |
| IN_BURST_GROUP | `Album (Burst Group) [🔄]` |

---

## Dependencies & Risks

### External Dependencies
- なし（既存コードのみ使用）

### Performance
- 影響なし（既存の`refreshPhotosOnly`を使用）

### Security
- 影響なし

---

## Testing Strategy

### Manual Testing
1. 各ViewModeでリロードボタンが表示されることを確認
2. ボタンクリックで写真が再読み込みされることを確認
3. フィルター適用中にリロードしてもフィルターが維持されることを確認
4. ソート順がリロード後も維持されることを確認

### Edge Cases
- 写真が0件の場合
- 読み込み中にボタンをクリックした場合
- IN_BURST_GROUP モードでのリロード

---

## Open Questions

1. **ボタン位置**: StatusBar（タイトル横）vs PhotosToolbar（右側）
   - **推奨**: StatusBar（タイトル横）- より直感的

2. **ローディング表示**: リロード中にボタンを無効化するか？
   - **推奨**: ボタンを回転アニメーションで表示、連打防止

3. **キーボードショートカット**: `Ctrl+R` や `F5` を割り当てるか？
   - **推奨**: 初期実装では不要、後で追加可能
