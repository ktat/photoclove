# 写真グルーピング: Phase 1 - DB・バックエンド基盤

## Overview

グルーピング機能のDB設計とバックエンド基盤を実装する。Import時・ReCreateDB時にグループIDを自動割り振り。

## タスク

- [ ] マイグレーション追加（burst_groups テーブル、burst_group_id カラム）
- [ ] BurstGroup エンティティ作成
- [ ] grouping_service 実装（自動グルーピングロジック）
- [ ] ReCreateDB にグルーピング処理追加
- [ ] Import にグルーピング処理追加
- [ ] unified_search に burst パターン追加

## Database Schema

### 設計方針

- **シンプルな設計**: `burst_groups` テーブルは最小限の情報のみ保持
- **representative_path は不要**: 代表写真はフィルタ条件内で最古の写真として動的に決定
- **photo_count は不要**: フィルタ条件を含めて動的にカウント

### マイグレーションファイル

`src-tauri/src/repository/meta_db/migrations/006_create_burst_groups.sql`

```sql
-- burst_groups テーブル（最小限の設計）
CREATE TABLE IF NOT EXISTS burst_groups (
    id TEXT PRIMARY KEY,
    is_manual INTEGER DEFAULT 0,  -- 手動作成フラグ (0=自動, 1=手動)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- photo_metadata にカラム追加
ALTER TABLE photo_metadata ADD COLUMN burst_group_id TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_burst_group_id ON photo_metadata(burst_group_id);
```

## Backend Implementation

### BurstGroup エンティティ

`src-tauri/src/entity/burst_group.rs`

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BurstGroup {
    pub id: String,
    pub is_manual: bool,
    pub created_at: String,
}

impl BurstGroup {
    pub fn new(id: String) -> Self {
        Self {
            id,
            is_manual: false,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn new_manual(id: String) -> Self {
        Self {
            id,
            is_manual: true,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn is_auto_generated(&self) -> bool {
        !self.is_manual
    }
}
```

### グルーピングサービス

`src-tauri/src/domain_service/grouping_service.rs`

```rust
use crate::entity::burst_group::BurstGroup;
use crate::entity::photo::Photo;
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

const DEFAULT_BURST_THRESHOLD_SECONDS: i64 = 2;
const MIN_GROUP_SIZE: usize = 2;

pub struct GroupingService {
    burst_threshold: Duration,
    min_group_size: usize,
}

impl GroupingService {
    pub fn new(threshold_seconds: i64, min_size: usize) -> Self {
        Self {
            burst_threshold: Duration::seconds(threshold_seconds),
            min_group_size: min_size,
        }
    }

    pub fn default() -> Self {
        Self::new(DEFAULT_BURST_THRESHOLD_SECONDS, MIN_GROUP_SIZE)
    }

    /// 写真リストをグルーピングし、グループIDを割り振る
    pub fn assign_group_ids(&self, photos: &mut [Photo]) -> Vec<BurstGroup> {
        if photos.is_empty() {
            return vec![];
        }

        // 撮影時刻でソート
        photos.sort_by(|a, b| a.time().cmp(&b.time()));

        let mut groups: Vec<BurstGroup> = vec![];
        let mut current_group_photos: Vec<usize> = vec![]; // インデックスを保持
        let mut current_camera: Option<String> = None;
        let mut last_time: Option<DateTime<Utc>> = None;

        for (i, photo) in photos.iter().enumerate() {
            let camera = format!("{} {}", photo.meta_data.make, photo.meta_data.model);
            let photo_time = parse_photo_time(&photo.time());

            let should_start_new_group = match (&current_camera, &last_time, &photo_time) {
                (Some(cur_cam), Some(last), Some(cur)) => {
                    cur_cam != &camera || (*cur - *last) > self.burst_threshold
                }
                _ => true,
            };

            if should_start_new_group {
                // 前のグループを確定
                if current_group_photos.len() >= self.min_group_size {
                    let group = BurstGroup::new(Uuid::new_v4().to_string());
                    for &idx in &current_group_photos {
                        photos[idx].burst_group_id = Some(group.id.clone());
                    }
                    groups.push(group);
                }
                current_group_photos.clear();
            }

            current_group_photos.push(i);
            current_camera = Some(camera);
            last_time = photo_time;
        }

        // 最後のグループを確定
        if current_group_photos.len() >= self.min_group_size {
            let group = BurstGroup::new(Uuid::new_v4().to_string());
            for &idx in &current_group_photos {
                photos[idx].burst_group_id = Some(group.id.clone());
            }
            groups.push(group);
        }

        groups
    }
}

fn parse_photo_time(time_str: &str) -> Option<DateTime<Utc>> {
    // EXIF形式 "2025:01:15 14:32:05" をパース
    chrono::NaiveDateTime::parse_from_str(time_str, "%Y:%m:%d %H:%M:%S")
        .ok()
        .map(|dt| DateTime::from_naive_utc_and_offset(dt, Utc))
}
```

### Import処理への統合

`src-tauri/src/domain_service/job_queue/handlers/import.rs` に追加:

```rust
use crate::domain_service::grouping_service::GroupingService;

// インポート完了後にグルーピング処理
pub async fn process_imported_photos(photos: &mut [Photo], meta_db: &impl MetaInfoDB) {
    let grouping_service = GroupingService::default();
    let groups = grouping_service.assign_group_ids(photos);

    // グループをDBに保存
    for group in groups {
        meta_db.save_burst_group(&group);
    }

    // 写真のburst_group_idをDBに更新
    for photo in photos {
        if let Some(group_id) = &photo.burst_group_id {
            meta_db.update_photo_burst_group(&photo.file.path, group_id);
        }
    }
}
```

### ReCreateDB処理への統合

`src-tauri/src/commands/database_commands.rs` に追加:

```rust
// ReCreateDB時にグルーピングを再計算
pub async fn recreate_db_with_grouping(state: &AppState) -> Result<(), String> {
    // 1. 既存のDB再作成処理
    // ...

    // 2. 手動グループを保持
    let manual_groups = state.meta_db.get_manual_burst_groups();

    // 3. 自動グループをクリア
    state.meta_db.clear_auto_burst_groups()?;

    // 4. 全写真を取得
    let mut all_photos = get_all_photos(&state.config)?;

    // 5. 自動グルーピング実行
    let grouping_service = GroupingService::default();
    let new_groups = grouping_service.assign_group_ids(&mut all_photos);

    // 6. グループをDBに保存
    for group in new_groups {
        state.meta_db.save_burst_group(&group)?;
    }

    // 7. 手動グループを復元（is_manual=1 は維持）
    for group in manual_groups {
        state.meta_db.save_burst_group(&group)?;
    }

    Ok(())
}
```

### unified_search 拡張

`src-tauri/src/commands/search_commands.rs` に追加:

```rust
// search_type の追加パターン
match search_type.as_str() {
    // 既存
    "date" => { ... }
    "recent" => { ... }
    "album" => { ... }
    "tag" => { ... }
    "search" => { ... }

    // 新規: Burst代表写真モード
    "burst_date" => {
        // params.date を使用
        search_burst_by_date(&params.date, meta_db)
    }
    "burst_album" => {
        // params.album_id を使用
        search_burst_by_album(&params.album_id, meta_db)
    }
    "burst_tag" => {
        // params.tag_id を使用
        search_burst_by_tag(&params.tag_id, meta_db)
    }

    // 新規: グループ内写真
    "burst_group" => {
        // params.burst_group_id を使用
        get_photos_by_burst_group(&params.burst_group_id, meta_db)
    }
}
```

### Burst検索のSQL実装

GROUP BY と JOIN を使用したシンプルで効率的なアプローチ:

```rust
fn search_burst_by_date(date: &str, meta_db: &impl MetaInfoDB) -> Result<Vec<PhotoWithBurstCount>, String> {
    let sql = r#"
        -- CTE でグループごとの最古時刻とカウントを取得
        WITH grouped AS (
            SELECT
                IFNULL(burst_group_id, path) AS group_key,
                MIN(time) AS min_time,
                MIN(path) AS min_path,  -- 同時刻の場合はパスでも絞る
                COUNT(*) AS burst_count
            FROM photo_metadata
            WHERE date = ?1
            GROUP BY IFNULL(burst_group_id, path)
        )
        SELECT pm.*, g.burst_count
        FROM photo_metadata pm
        JOIN grouped g
            ON IFNULL(pm.burst_group_id, pm.path) = g.group_key
           AND pm.time = g.min_time
           AND pm.path = g.min_path
        WHERE pm.date = ?1
        ORDER BY pm.time
    "#;

    meta_db.query_photos_with_burst_count(sql, &[date])
}

fn search_burst_by_album(album_id: &str, meta_db: &impl MetaInfoDB) -> Result<Vec<PhotoWithBurstCount>, String> {
    let sql = r#"
        WITH grouped AS (
            SELECT
                IFNULL(pm.burst_group_id, pm.path) AS group_key,
                MIN(pm.time) AS min_time,
                MIN(pm.path) AS min_path,
                COUNT(*) AS burst_count
            FROM photo_metadata pm
            JOIN photo_collection_items pci ON pm.path = pci.photo_path
            WHERE pci.collection_id = ?1
            GROUP BY IFNULL(pm.burst_group_id, pm.path)
        )
        SELECT pm.*, g.burst_count
        FROM photo_metadata pm
        JOIN photo_collection_items pci ON pm.path = pci.photo_path
        JOIN grouped g
            ON IFNULL(pm.burst_group_id, pm.path) = g.group_key
           AND pm.time = g.min_time
           AND pm.path = g.min_path
        WHERE pci.collection_id = ?1
        ORDER BY pm.time
    "#;

    meta_db.query_photos_with_burst_count(sql, &[album_id])
}

fn get_photos_by_burst_group(group_id: &str, meta_db: &impl MetaInfoDB) -> Result<Vec<Photo>, String> {
    let sql = r#"
        SELECT pm.* FROM photo_metadata pm
        WHERE pm.burst_group_id = ?1
        ORDER BY pm.time ASC
    "#;

    meta_db.query_photos(sql, &[group_id])
}
```

## Repository Layer

### burst_groups.rs

`src-tauri/src/repository/meta_db/sqlite/burst_groups.rs`

```rust
use crate::entity::burst_group::BurstGroup;
use rusqlite::{params, Connection};

pub trait BurstGroupRepository {
    fn save_burst_group(&self, group: &BurstGroup) -> Result<(), String>;
    fn get_burst_group(&self, id: &str) -> Option<BurstGroup>;
    fn get_manual_burst_groups(&self) -> Vec<BurstGroup>;
    fn delete_burst_group(&self, id: &str) -> Result<(), String>;
    fn clear_auto_burst_groups(&self) -> Result<(), String>;
    fn update_photo_burst_group(&self, photo_path: &str, group_id: &str) -> Result<(), String>;
    fn clear_photo_burst_group(&self, photo_path: &str) -> Result<(), String>;
    fn clear_burst_group_photos(&self, group_id: &str) -> Result<(), String>;
}

impl BurstGroupRepository for SQLite {
    fn save_burst_group(&self, group: &BurstGroup) -> Result<(), String> {
        let conn = self.get_connection()?;
        conn.execute(
            "INSERT OR REPLACE INTO burst_groups (id, is_manual, created_at)
             VALUES (?1, ?2, ?3)",
            params![
                group.id,
                group.is_manual as i32,
                group.created_at,
            ],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn get_manual_burst_groups(&self) -> Vec<BurstGroup> {
        let conn = self.get_connection().ok()?;
        let mut stmt = conn.prepare(
            "SELECT id, is_manual, created_at FROM burst_groups WHERE is_manual = 1"
        ).ok()?;

        stmt.query_map([], |row| {
            Ok(BurstGroup {
                id: row.get(0)?,
                is_manual: row.get::<_, i32>(1)? == 1,
                created_at: row.get(2)?,
            })
        }).ok()?.filter_map(|r| r.ok()).collect()
    }

    fn clear_auto_burst_groups(&self) -> Result<(), String> {
        let conn = self.get_connection()?;

        // 自動グループに属する写真のburst_group_idをクリア
        conn.execute(
            "UPDATE photo_metadata SET burst_group_id = NULL
             WHERE burst_group_id IN (SELECT id FROM burst_groups WHERE is_manual = 0)",
            [],
        ).map_err(|e| e.to_string())?;

        // 自動グループを削除
        conn.execute(
            "DELETE FROM burst_groups WHERE is_manual = 0",
            [],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    fn update_photo_burst_group(&self, photo_path: &str, group_id: &str) -> Result<(), String> {
        let conn = self.get_connection()?;
        conn.execute(
            "UPDATE photo_metadata SET burst_group_id = ?1 WHERE path = ?2",
            params![group_id, photo_path],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn clear_photo_burst_group(&self, photo_path: &str) -> Result<(), String> {
        let conn = self.get_connection()?;
        conn.execute(
            "UPDATE photo_metadata SET burst_group_id = NULL WHERE path = ?1",
            params![photo_path],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn clear_burst_group_photos(&self, group_id: &str) -> Result<(), String> {
        let conn = self.get_connection()?;
        conn.execute(
            "UPDATE photo_metadata SET burst_group_id = NULL WHERE burst_group_id = ?1",
            params![group_id],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ... 他のメソッド実装
}
```

## PhotoWithBurstCount 構造体

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoWithBurstCount {
    #[serde(flatten)]
    pub photo: Photo,
    pub burst_count: u32,
}
```

## Testing Strategy

- [ ] グルーピングロジックの単体テスト
  - 同一カメラ・2秒以内 → 同じグループ
  - 異なるカメラ → 別グループ
  - 時間差2秒超 → 別グループ
  - 1枚のみ → グループ化されない
- [ ] Import後にburst_group_idが設定される
- [ ] ReCreateDB後にグルーピングが再計算される
- [ ] 手動グループ(is_manual=1)がReCreateDBで維持される
- [ ] unified_search("burst_date") で代表写真 + burst_count が返る
- [ ] unified_search("burst_group") でグループ内写真が返る
