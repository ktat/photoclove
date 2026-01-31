# 写真グルーピング: Phase 2 - フロントエンド表示

## Overview

グループ化された写真をViewModeベースで表示するUIを実装する。
既存のViewMode（DATE_VIEW, ALBUM_VIEW, TAG_VIEW等）のフィルタリングレイヤーとして機能する。

## タスク

- [ ] ViewMode追加: BURST_PHOTO_MODE, IN_BURST_GROUP_MODE
- [ ] unified_search に burst パターン追加
- [ ] PhotoCard にバーストバッジ表示（右上）
- [ ] グルーピング表示ON/OFF切り替え
- [ ] 元のViewModeへの戻り機能

## アーキテクチャ

### ViewModeベースのアプローチ

```
┌─────────────────────────────────────────────────────────────┐
│ 既存ViewMode + BurstPhotoMode (フィルタリングレイヤー)       │
│                                                             │
│  DATE_VIEW ──┬── 通常表示 (全写真)                          │
│              └── + BurstPhotoMode (代表+非グループ)          │
│                        ↓ クリック                           │
│              InBurstGroupMode (グループ内一覧)               │
│                        ↓ 戻る                               │
│              元のViewMode + BurstPhotoMode                   │
└─────────────────────────────────────────────────────────────┘
```

### 表示フロー

```
┌────────────────────────────────────────────────────────────┐
│ DATE_VIEW (2025-01-15)                                     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
│ │     │ │     │ │     │ │     │ │     │  ← 通常表示       │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                   │
│                    ↓ Toggle ON                             │
├────────────────────────────────────────────────────────────┤
│ DATE_VIEW + BurstPhotoMode                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
│ │     │ │┌+4┐ │ │     │ │┌+2┐ │ │     │  ← 代表+非グループ │
│ └─────┘ │└──┘ │ └─────┘ │└──┘ │ └─────┘     バッジ右上     │
│         └─────┘         └─────┘                            │
│              ↓ クリック                                     │
├────────────────────────────────────────────────────────────┤
│ InBurstGroupMode (group-id: xxx)                           │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                   │
│ │ ★   │ │     │ │     │ │     │ │     │  ← グループ内5枚   │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘     ★=代表(最古)   │
│              ↓ 戻る                                        │
│ DATE_VIEW + BurstPhotoMode に戻る                          │
└────────────────────────────────────────────────────────────┘
```

## 設計の要点

### 代表写真の決定

- **representative_path カラムは不要**
- 代表写真 = フィルタ条件内で一番古い写真（`ORDER BY time ASC LIMIT 1`）
- フィルタスコープ（日付、アルバム、タグ）によって代表が変わる可能性あり

### カウントの計算

- フィルタ条件を含めた動的計算
- 同じグループが複数日に跨る場合、日付ごとに別カウント

## unified_search 拡張

### 新規search_typeパターン

| search_type | 説明 | パラメータ |
|-------------|------|-----------|
| `burst_date` | 日付内の代表+非グループ写真 | date |
| `burst_album` | アルバム内の代表+非グループ写真 | album_id |
| `burst_tag` | タグ内の代表+非グループ写真 | tag_id |
| `burst_group` | 特定グループ内の全写真 | burst_group_id |

### SQLクエリ例

GROUP BY と JOIN を使用したシンプルで効率的なアプローチ:
- `IFNULL(burst_group_id, path)` で非グループ写真も統一的に扱う
- CTE で最古時刻とカウントを取得し、JOIN で写真データを取得

```sql
-- burst_date: 日付内の代表+非グループ写真（カウント付き）
WITH grouped AS (
    SELECT
        IFNULL(burst_group_id, path) AS group_key,
        MIN(time) AS min_time,
        MIN(path) AS min_path,  -- 同時刻の場合はパスでも絞る
        COUNT(*) AS burst_count
    FROM photo_metadata
    WHERE date = '2025-01-15'
    GROUP BY IFNULL(burst_group_id, path)
)
SELECT pm.*, g.burst_count
FROM photo_metadata pm
JOIN grouped g
    ON IFNULL(pm.burst_group_id, pm.path) = g.group_key
   AND pm.time = g.min_time
   AND pm.path = g.min_path
WHERE pm.date = '2025-01-15'
ORDER BY pm.time;

-- burst_album: アルバム内の代表+非グループ写真
WITH grouped AS (
    SELECT
        IFNULL(pm.burst_group_id, pm.path) AS group_key,
        MIN(pm.time) AS min_time,
        MIN(pm.path) AS min_path,
        COUNT(*) AS burst_count
    FROM photo_metadata pm
    JOIN photo_collection_items pci ON pm.path = pci.photo_path
    WHERE pci.collection_id = 'album-uuid'
    GROUP BY IFNULL(pm.burst_group_id, pm.path)
)
SELECT pm.*, g.burst_count
FROM photo_metadata pm
JOIN photo_collection_items pci ON pm.path = pci.photo_path
JOIN grouped g
    ON IFNULL(pm.burst_group_id, pm.path) = g.group_key
   AND pm.time = g.min_time
   AND pm.path = g.min_path
WHERE pci.collection_id = 'album-uuid'
ORDER BY pm.time;

-- burst_group: グループ内の全写真
SELECT pm.* FROM photo_metadata pm
WHERE pm.burst_group_id = 'group-uuid'
ORDER BY pm.time ASC;
```

## Frontend Implementation

### ViewMode 追加

`src/constants/viewModes.js`:

```javascript
export const VIEW_MODES = {
    // 既存
    DATE_VIEW: 'DATE_VIEW',
    RECENT_VIEW: 'RECENT_VIEW',
    ALBUM_VIEW: 'ALBUM_VIEW',
    TAG_VIEW: 'TAG_VIEW',
    SEARCH_VIEW: 'SEARCH_VIEW',
    IMPORT_VIEW: 'IMPORT_VIEW',
    // ...

    // 新規
    BURST_PHOTO_MODE: 'BURST_PHOTO_MODE',
    IN_BURST_GROUP_MODE: 'IN_BURST_GROUP_MODE',
};
```

### 状態管理

`UIContext` または ViewMode オブジェクトに履歴を保持:

```javascript
// 状態構造
{
    currentViewMode: 'IN_BURST_GROUP_MODE',
    burstModeEnabled: true,
    burstModeHistory: {
        originalViewMode: 'DATE_VIEW',
        originalViewParams: { date: '2025-01-15' },
        currentBurstGroupId: 'uuid-xxx'
    }
}
```

### PhotoCard バッジ表示

`src/App/PhotosList/PhotoCard.jsx` に追加:

```jsx
// バーストバッジ（右上）
{photo.burst_group_id && photo.burst_count > 1 && (
    <div className={styles.burstBadge}>
        +{photo.burst_count - 1}
    </div>
)}
```

### PhotoCard.module.css に追加

```css
.burstBadge {
    position: absolute;
    top: var(--space-1);
    right: var(--space-1);
    background: var(--color-primary);
    color: var(--color-text-primary);
    padding: 2px var(--space-1);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: bold;
    z-index: 4;
    min-width: 20px;
    text-align: center;
}
```

### グルーピングON/OFF切り替え

`src/context/PhotoContext.jsx` または `UIContext.jsx` に追加:

```jsx
const [burstModeEnabled, setBurstModeEnabled] = useState(false);

const toggleBurstMode = () => {
    setBurstModeEnabled(prev => !prev);
};

// Context value に追加
const value = {
    // ...
    burstModeEnabled,
    toggleBurstMode,
};
```

### ツールバーにトグルボタン追加

`src/App/PhotosList/PhotosToolbar.jsx`:

```jsx
<button
    className={classNames(styles.toolbarButton, { [styles.active]: burstModeEnabled })}
    onClick={toggleBurstMode}
    title={burstModeEnabled ? "グルーピング解除" : "グルーピング表示"}
>
    {burstModeEnabled ? "📚" : "📷"}
</button>
```

### InBurstGroupMode での戻るボタン

```jsx
// グループ内表示時のヘッダー
{viewMode === VIEW_MODES.IN_BURST_GROUP_MODE && (
    <div className={styles.groupHeader}>
        <button onClick={handleBackToBurstMode}>
            ← 戻る
        </button>
        <span>グループ内 ({photos.length}枚)</span>
    </div>
)}

const handleBackToBurstMode = () => {
    // burstModeHistory から元の状態を復元
    setViewMode(VIEW_MODES.BURST_PHOTO_MODE);
    // originalViewMode と originalViewParams を維持
};
```

## データフロー

```
1. ユーザーが Burst Mode をON
   ↓
2. unified_search("burst_date", { date: "2025-01-15" })
   ↓
3. Backend: 代表写真 + 非グループ写真 + burst_count を返却
   ↓
4. Frontend: PhotoGrid で表示、burst_count > 1 の写真にバッジ表示
   ↓
5. ユーザーがバースト写真をクリック
   ↓
6. unified_search("burst_group", { burst_group_id: "xxx" })
   ↓
7. InBurstGroupMode でグループ内写真を表示
```

## Testing Strategy

- [ ] Burst Mode ON で代表写真 + 非グループ写真が表示される
- [ ] バッジに正しい枚数（burst_count - 1）が表示される
- [ ] バッジ位置が右上に表示される
- [ ] バースト写真クリックでグループ内一覧が表示される
- [ ] 「戻る」で元の Burst Mode 一覧に戻る
- [ ] Burst Mode OFF で通常表示に戻る
- [ ] 日付跨ぎのグループが日付ごとに別カウントになる
- [ ] アルバム内の部分グループが正しくカウントされる
