# 写真グルーピング: Phase 4 - 設定・拡張機能

## Overview

グルーピング設定のカスタマイズ、グループ一括操作、パフォーマンス最適化を実装する。

## タスク

- [ ] Preferences でグルーピング設定（閾値など）
- [ ] グループ一括操作（削除、アルバム追加、タグ付け）
- [ ] パフォーマンス最適化

## Preferences 設定UI

### 設定項目

| 設定 | デフォルト | 説明 |
|------|------------|------|
| グルーピング有効 | ON | 自動グルーピング表示 |
| 時間閾値 | 2秒 | 連写と判定する時間差 |
| 最小グループサイズ | 2枚 | グループ化する最小枚数 |

### Preferences.jsx への追加

```jsx
// グルーピング設定セクション
<section className={styles.section}>
    <h3>写真グルーピング</h3>

    <div className={styles.row}>
        <label>
            <input
                type="checkbox"
                checked={groupingEnabled}
                onChange={(e) => setGroupingEnabled(e.target.checked)}
            />
            連写を自動グループ化して表示
        </label>
    </div>

    <div className={styles.row}>
        <label>時間閾値（秒）</label>
        <input
            type="number"
            min="1"
            max="10"
            value={burstThreshold}
            onChange={(e) => setBurstThreshold(parseInt(e.target.value))}
        />
        <span className={styles.hint}>
            この時間以内に撮影された写真を連写と判定
        </span>
    </div>

    <div className={styles.row}>
        <label>最小グループサイズ</label>
        <input
            type="number"
            min="2"
            max="10"
            value={minGroupSize}
            onChange={(e) => setMinGroupSize(parseInt(e.target.value))}
        />
        <span className={styles.hint}>
            この枚数以上でグループ化
        </span>
    </div>

    <div className={styles.row}>
        <button onClick={handleRecalculateGroups}>
            グルーピングを再計算
        </button>
        <span className={styles.hint}>
            設定変更後に再計算が必要です
        </span>
    </div>
</section>
```

### 設定の永続化

`src-tauri/src/entity/config.rs` に追加:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupingConfig {
    pub enabled: bool,
    pub burst_threshold_seconds: u32,
    pub min_group_size: u32,
}

impl Default for GroupingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            burst_threshold_seconds: 2,
            min_group_size: 2,
        }
    }
}
```

## グループ一括操作

### グループ全体の削除

InBurstGroupMode 内での操作:

```jsx
// グループ内表示時のヘッダーにアクション追加
{viewMode === VIEW_MODES.IN_BURST_GROUP_MODE && (
    <div className={styles.groupHeader}>
        <button onClick={handleBackToBurstMode}>← 戻る</button>
        <span>グループ内 ({photos.length}枚)</span>
        <div className={styles.groupActions}>
            <button onClick={() => handleDeleteGroup(currentBurstGroupId)}>
                グループ全体を削除
            </button>
            <button onClick={() => handleAddGroupToAlbum(currentBurstGroupId)}>
                アルバムに追加
            </button>
            <button onClick={() => handleTagGroup(currentBurstGroupId)}>
                タグ付け
            </button>
        </div>
    </div>
)}

const handleDeleteGroup = async (groupId) => {
    const confirmed = await confirm(
        `このグループ内の${photos.length}枚を全て削除しますか？`
    );
    if (!confirmed) return;

    try {
        await invoke('delete_group_photos', { groupId });
        addFooterMessage('group', 'グループを削除しました', false, 3000);
        // BurstPhotoMode に戻る
        handleBackToBurstMode();
    } catch (error) {
        addFooterMessage('group', `エラー: ${error}`, false, 3000);
    }
};
```

### グループをアルバムに追加

```jsx
const handleAddGroupToAlbum = async (groupId) => {
    // アルバム選択ダイアログを表示
    const albumId = await showAlbumSelector();
    if (!albumId) return;

    try {
        const photos = await invoke('get_group_photos', { groupId });
        const paths = photos.map(p => p.path);
        await invoke('add_photos_to_album_bulk', {
            albumId,
            photoPaths: paths
        });
        addFooterMessage('group', 'アルバムに追加しました', false, 3000);
    } catch (error) {
        addFooterMessage('group', `エラー: ${error}`, false, 3000);
    }
};
```

### グループにタグ付け

```jsx
const handleTagGroup = async (groupId) => {
    // タグ選択ダイアログを表示
    const tagId = await showTagSelector();
    if (!tagId) return;

    try {
        const photos = await invoke('get_group_photos', { groupId });
        for (const photo of photos) {
            await invoke('add_tag_to_photo', {
                photoPath: photo.path,
                tagId
            });
        }
        addFooterMessage('group', 'タグを追加しました', false, 3000);
    } catch (error) {
        addFooterMessage('group', `エラー: ${error}`, false, 3000);
    }
};
```

## Backend Commands

```rust
/// グループ内の全写真を削除
#[tauri::command]
pub async fn delete_group_photos(
    group_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;

    // グループ内の写真パスを取得
    let photos = meta_db.get_photos_by_burst_group(&group_id)?;
    let paths: Vec<String> = photos.iter().map(|p| p.path.clone()).collect();

    // 写真を削除（既存の削除処理を使用）
    for path in &paths {
        // move_to_trash または delete_photo
    }

    // グループを削除
    meta_db.delete_burst_group(&group_id)?;

    Ok(())
}

/// グルーピング設定を保存
#[tauri::command]
pub async fn save_grouping_config(
    config: GroupingConfig,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    // 設定ファイルに保存
    state.config.grouping = config;
    save_config(&state.config)?;
    Ok(())
}

/// グルーピングを再計算
#[tauri::command]
pub async fn recalculate_grouping(
    state: tauri::State<'_, AppState>,
) -> Result<u32, String> {
    let meta_db = &state.meta_db;
    let config = &state.config.grouping;

    // 手動グループを保持
    let manual_groups = meta_db.get_manual_burst_groups();

    // 自動グループをクリア
    meta_db.clear_auto_burst_groups()?;

    // 全写真を取得
    let mut photos = meta_db.get_all_photos()?;

    // 新しい設定でグルーピング
    let grouping_service = GroupingService::new(
        config.burst_threshold_seconds as i64,
        config.min_group_size as usize,
    );
    let groups = grouping_service.assign_group_ids(&mut photos);

    // 保存
    for group in &groups {
        meta_db.save_burst_group(group)?;
    }

    // 写真のburst_group_idを更新
    for photo in &photos {
        if let Some(group_id) = &photo.burst_group_id {
            meta_db.update_photo_burst_group(&photo.file.path, group_id)?;
        }
    }

    // 手動グループを復元
    for group in manual_groups {
        meta_db.save_burst_group(&group)?;
    }

    log::info!(target: "grouping", "recalculated; new_groups={}", groups.len());

    Ok(groups.len() as u32)
}
```

## パフォーマンス最適化

### インデックス追加

```sql
-- 複合インデックス（カメラ + 時間）
CREATE INDEX IF NOT EXISTS idx_photo_camera_time
ON photo_metadata(exif_make, exif_model, exif_date_time_original);

-- burst_group_id インデックス（Phase 1で追加済み）
CREATE INDEX IF NOT EXISTS idx_burst_group_id ON photo_metadata(burst_group_id);
```

### グループ情報のキャッシュ

```rust
use std::collections::HashMap;
use std::time::{Duration, Instant};

// グループIDと写真パスのマッピングをキャッシュ
struct GroupCache {
    photo_to_group: HashMap<String, String>,  // photo_path -> group_id
    last_updated: Instant,
}

impl GroupCache {
    fn is_stale(&self) -> bool {
        self.last_updated.elapsed() > Duration::from_secs(60)
    }

    fn invalidate(&mut self) {
        self.photo_to_group.clear();
    }

    fn get_group_id(&self, photo_path: &str) -> Option<&String> {
        self.photo_to_group.get(photo_path)
    }
}
```

### 遅延読み込み

```jsx
// グループ内表示時にのみ詳細を取得
const handleEnterBurstGroup = async (groupId) => {
    // 履歴を保存
    setBurstModeHistory({
        originalViewMode: viewMode,
        originalViewParams: getCurrentViewParams(),
        currentBurstGroupId: groupId
    });

    // グループ内写真を取得
    const photos = await invoke('unified_search', {
        searchType: 'burst_group',
        params: { burst_group_id: groupId }
    });

    setPhotos(photos);
    setViewMode(VIEW_MODES.IN_BURST_GROUP_MODE);
};
```

## Testing Strategy

- [ ] Preferences でグルーピング設定が保存される
- [ ] 閾値変更後に「再計算」で反映される
- [ ] 手動グループ(is_manual=1)が再計算で維持される
- [ ] グループ全体を削除 → 全写真が削除される
- [ ] グループをアルバムに追加 → 全写真がアルバムに追加
- [ ] グループにタグ付け → 全写真にタグが付く
- [ ] 大量写真（1000枚以上）でのパフォーマンス確認

## 解決済みの設計判断

1. **グルーピング再計算の頻度**: 設定変更後にユーザーが明示的に「再計算」ボタンを押す
2. **キャッシュの無効化タイミング**: グループ作成/解除/写真削除時
3. **代表写真**: フィルタ条件内で最古の写真として動的に決定（設定不要）
4. **photo_count**: フィルタ条件を含めて動的にカウント（保存不要）
