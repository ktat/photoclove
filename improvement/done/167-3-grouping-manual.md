# 写真グルーピング: Phase 3 - 手動グループ操作

## Overview

Selection（複数選択）から手動でグループを作成・解除・編集する機能を実装する。

## タスク

- [ ] Selection から「グループ作成」
- [ ] Selection から「グループ解除」
- [ ] グループから写真を除外
- [ ] Tooltip コンポーネントの改善（操作説明の表示）

## 設計の要点

- **代表写真の手動設定は不要**: 代表写真はフィルタ条件内で最古の写真として動的に決定
- 手動グループは `is_manual = 1` でマーク
- ReCreateDB時に手動グループは維持される

## Backend Commands

### group_commands.rs

`src-tauri/src/commands/group_commands.rs`

```rust
use crate::app_state::AppState;
use crate::entity::burst_group::BurstGroup;
use crate::repository::MetaInfoDB;
use uuid::Uuid;

/// 選択した写真から手動グループを作成
#[tauri::command]
pub async fn create_burst_group(
    photo_paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    if photo_paths.len() < 2 {
        return Err("グループには2枚以上の写真が必要です".to_string());
    }

    let meta_db = &state.meta_db;

    // 既存グループから除外
    for path in &photo_paths {
        meta_db.clear_photo_burst_group(path)?;
    }

    // 新規グループ作成（手動フラグ付き）
    let group_id = Uuid::new_v4().to_string();
    let group = BurstGroup::new_manual(group_id.clone());

    meta_db.save_burst_group(&group)?;

    // 写真にグループIDを設定
    for path in &photo_paths {
        meta_db.update_photo_burst_group(path, &group_id)?;
    }

    log::info!(target: "group", "manual_group_created; group_id={}; photo_count={}", group_id, photo_paths.len());

    Ok(group_id)
}

/// グループを解除（写真は削除せず、グループ情報のみ削除）
#[tauri::command]
pub async fn dissolve_burst_group(
    group_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;

    // グループ内の全写真のburst_group_idをクリア
    meta_db.clear_burst_group_photos(&group_id)?;

    // グループを削除
    meta_db.delete_burst_group(&group_id)?;

    log::info!(target: "group", "group_dissolved; group_id={}", group_id);

    Ok(())
}

/// グループから写真を除外
#[tauri::command]
pub async fn remove_from_group(
    photo_paths: Vec<String>,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let meta_db = &state.meta_db;

    for path in &photo_paths {
        let photo = meta_db.get_photo_meta_by_path(path);
        if let Some(p) = photo {
            if let Some(group_id) = p.burst_group_id {
                meta_db.clear_photo_burst_group(path)?;

                // グループ内の残り写真数を確認
                let remaining_count = meta_db.count_photos_in_group(&group_id)?;

                // グループが1枚以下になったら自動解除
                if remaining_count <= 1 {
                    meta_db.clear_burst_group_photos(&group_id)?;
                    meta_db.delete_burst_group(&group_id)?;
                    log::info!(target: "group", "group_auto_dissolved; group_id={}; reason=insufficient_photos", group_id);
                }
            }
        }
    }

    log::info!(target: "group", "photos_removed_from_group; count={}", photo_paths.len());

    Ok(())
}

/// グループ内の写真を取得
#[tauri::command]
pub async fn get_group_photos(
    group_id: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<PhotoMeta>, String> {
    let meta_db = &state.meta_db;
    let photos = meta_db.get_photos_by_burst_group(&group_id)?;
    Ok(photos)
}
```

## Frontend Implementation

### SelectionActions への統合

`src/App/PhotosList/SelectionActions.jsx` の変更:

```jsx
import { invoke } from "@tauri-apps/api/core";

function SelectionActions({ selectedPhotos, onClearSelection, addFooterMessage }) {
    const [isProcessing, setIsProcessing] = useState(false);

    // 選択した写真が同じグループに属しているか
    const selectedGroups = useMemo(() => {
        const groups = new Set();
        selectedPhotos.forEach(p => {
            if (p.burst_group_id) groups.add(p.burst_group_id);
        });
        return groups;
    }, [selectedPhotos]);

    const isSingleGroup = selectedGroups.size === 1;
    const hasGroupedPhotos = selectedGroups.size > 0;

    const handleCreateGroup = async () => {
        if (selectedPhotos.length < 2) {
            addFooterMessage('selection', 'グループには2枚以上必要です', false, 3000);
            return;
        }

        setIsProcessing(true);
        try {
            const paths = selectedPhotos.map(p => p.path);
            const groupId = await invoke('create_burst_group', { photoPaths: paths });
            addFooterMessage('selection', `グループを作成しました`, false, 3000);
            onClearSelection();
            // 写真リストを更新
            window.dispatchEvent(new CustomEvent('photos-updated'));
        } catch (error) {
            addFooterMessage('selection', `エラー: ${error}`, false, 3000);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDissolveGroup = async () => {
        if (!isSingleGroup) return;

        const groupId = selectedPhotos[0].burst_group_id;
        setIsProcessing(true);
        try {
            await invoke('dissolve_burst_group', { groupId });
            addFooterMessage('selection', 'グループを解除しました', false, 3000);
            onClearSelection();
            window.dispatchEvent(new CustomEvent('photos-updated'));
        } catch (error) {
            addFooterMessage('selection', `エラー: ${error}`, false, 3000);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveFromGroup = async () => {
        if (!hasGroupedPhotos) return;

        setIsProcessing(true);
        try {
            const paths = selectedPhotos.filter(p => p.burst_group_id).map(p => p.path);
            await invoke('remove_from_group', { photoPaths: paths });
            addFooterMessage('selection', 'グループから除外しました', false, 3000);
            onClearSelection();
            window.dispatchEvent(new CustomEvent('photos-updated'));
        } catch (error) {
            addFooterMessage('selection', `エラー: ${error}`, false, 3000);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className={styles.selectionActions}>
            <span>{selectedPhotos.length}枚選択中</span>

            {/* グループ作成ボタン */}
            <button
                onClick={handleCreateGroup}
                disabled={selectedPhotos.length < 2 || isProcessing}
                title="選択した写真をグループ化"
            >
                グループ作成
            </button>

            {/* グループ解除ボタン（同一グループ選択時のみ） */}
            {isSingleGroup && (
                <button
                    onClick={handleDissolveGroup}
                    disabled={isProcessing}
                    title="グループを解除"
                >
                    グループ解除
                </button>
            )}

            {/* グループから除外ボタン */}
            {hasGroupedPhotos && (
                <button
                    onClick={handleRemoveFromGroup}
                    disabled={isProcessing}
                    title="選択した写真をグループから除外"
                >
                    グループから除外
                </button>
            )}

            {/* 既存のアクション */}
            {/* ... */}
        </div>
    );
}
```

## lib.rs への登録

```rust
// Tauri コマンド登録
.invoke_handler(tauri::generate_handler![
    // ... 既存コマンド
    create_burst_group,
    dissolve_burst_group,
    remove_from_group,
    get_group_photos,
])
```

## Tooltip コンポーネントの改善

### 現状の問題

- `Tooltip.jsx` はシンプルな表示のみ
- SelectionTab のドロップダウンには説明がない
- 新しいグループ操作の説明が必要

### 改善案

#### 1. Tooltip.jsx の拡張

`src/components/Tooltip.jsx`

```jsx
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

function Tooltip({
  show,
  text,
  position,
  variant = 'default',  // 'default' | 'info' | 'warning'
  maxWidth = 200
}) {
  if (!show) return null;

  return createPortal(
    <div
      className={`${styles.tooltip} ${styles[variant]} ${show ? styles.show : ''}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: `${maxWidth}px`
      }}
    >
      {/* Arrow */}
      <div className={styles.arrow} />
      {text}
    </div>,
    document.body
  );
}

export default Tooltip;
```

#### 2. Tooltip.module.css

```css
.tooltip {
  position: fixed;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  z-index: 10000;
  opacity: 0;
  transform: translateY(-5px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
}

.tooltip.show {
  opacity: 1;
  transform: translateY(0);
}

.tooltip.default {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip.info {
  background: var(--color-info-dark);
  color: white;
}

.tooltip.warning {
  background: var(--color-warning);
  color: var(--color-bg-base);
}

.arrow {
  position: absolute;
  top: -6px;
  left: 12px;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid var(--color-bg-elevated);
}

.info .arrow {
  border-bottom-color: var(--color-info-dark);
}
```

#### 3. SelectionTab へのグループ操作追加

`src/App/PhotosList/DirectoryMenu/SelectionTab.jsx` に追加:

```jsx
// グループ操作の説明
const GROUP_OPERATION_HINTS = {
  createGroup: "選択した写真を1つのグループにまとめます。連写以外の写真もグループ化できます。",
  dissolveGroup: "グループを解除し、写真を個別表示に戻します。写真は削除されません。",
  removeFromGroup: "選択した写真をグループから除外します。グループ内の他の写真は維持されます。"
};

// ドロップダウンに追加
{viewModeObj?.shouldShowGroupOperations() && (
  <>
    <option value="createGroup">Create Group</option>
    <option value="dissolveGroup">Dissolve Group</option>
    <option value="removeFromGroup">Remove from Group</option>
  </>
)}
```

#### 4. OperationHintTooltip コンポーネント（新規）

`src/components/OperationHintTooltip.jsx`

```jsx
import React, { useState } from 'react';
import Tooltip from './Tooltip';

const OPERATION_HINTS = {
  // 既存操作
  deleteFiles: "選択した写真をゴミ箱に移動します",
  createAlbum: "選択した写真で新しいアルバムを作成します",
  addToAlbum: "選択した写真を既存のアルバムに追加します",
  addTags: "選択した写真にタグを追加します",
  removeFromAlbum: "選択した写真をアルバムから削除します（写真自体は残ります）",
  restoreFromTrash: "選択した写真をゴミ箱から復元します",
  permanentDelete: "選択した写真を完全に削除します（復元できません）",
  uploadToGooglePhotos: "選択した写真をGoogleフォトにアップロードします",

  // グループ操作（新規）
  createGroup: "選択した写真を1つのグループにまとめます",
  dissolveGroup: "グループを解除します（写真は削除されません）",
  removeFromGroup: "選択した写真をグループから除外します",
};

function OperationHintTooltip({ operation, targetRef }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const hint = OPERATION_HINTS[operation];
  if (!hint) return null;

  const handleMouseEnter = () => {
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
      setShow(true);
    }
  };

  return (
    <>
      <span
        className="hint-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        style={{
          cursor: 'help',
          marginLeft: 'var(--space-1)',
          color: 'var(--color-text-muted)'
        }}
      >
        ?
      </span>
      <Tooltip
        show={show}
        text={hint}
        position={position}
        variant="info"
        maxWidth={250}
      />
    </>
  );
}

export default OperationHintTooltip;
```

### 関連ファイル

| ファイル | 変更内容 |
|----------|----------|
| `src/components/Tooltip.jsx` | variant、maxWidth追加 |
| `src/components/Tooltip.module.css` | 新規スタイル |
| `src/components/OperationHintTooltip.jsx` | 新規コンポーネント |
| `src/App/PhotosList/DirectoryMenu/SelectionTab.jsx` | グループ操作追加、ツールチップ統合 |

## Testing Strategy

- [ ] 2枚以上選択して「グループ作成」→ グループが作成される
- [ ] 1枚選択で「グループ作成」→ エラーメッセージ表示
- [ ] 同一グループの写真を選択して「グループ解除」→ グループが解除される
- [ ] グループ内写真を選択して「グループから除外」→ グループから除外される
- [ ] グループが1枚以下になる → 自動でグループ解除
- [ ] 操作ドロップダウンにホバー → ツールチップが表示される
- [ ] グループ操作にホバー → 説明が表示される
