# Job Queue Progress Display & Resume

## Overview
Job Queue画面で処理進捗を表示し、中断されたジョブを再開できる機能。

## Current State (実装済み: Phase 1)

### Phase 1: Progress Display ✅
- `processed_count` カラムを `job_queue` テーブルに追加
- 各ハンドラーで処理中に進捗をDB更新
- Job Queue画面で `10/150` 形式で進捗表示
- `pending` 状態のジョブに「Start」ボタン追加

---

## Phase 2: Resume Feature (設計)

### 課題
`processed_count = 50` だけでは「**どの**50件を処理したか」が分からない。

### 解決策: JobTypeConfig + チェック戦略

#### JobTypeConfig 構造体

```rust
/// ジョブタイプごとの設定
pub struct JobTypeConfig {
    /// Resume（途中から再開）をサポートするか
    pub resume_supported: bool,
    /// Restart（最初からやり直し）をサポートするか
    pub restart_supported: bool,
    /// 処理済み判定の戦略
    pub check_strategy: ProcessedCheckStrategy,
}

pub enum ProcessedCheckStrategy {
    // === 汎用チェック (2パターン) ===
    /// 汎用1: DBのid順で処理し、last_processed_id を記録
    /// - sequential処理向け（ほとんどのジョブ）
    /// - job_queue に last_processed_id カラムを追加
    LastProcessedId,
    /// 汎用2: ジョブ開始時刻以降に作成/更新されたファイルは処理済み
    /// - 並列処理に対応（Thumbnailのみ）
    /// - ファイルシステムの mtime を使用
    FileCreationTime,

    // === 個別チェック ===
    /// 個別: ジョブタイプ固有のロジック（ファイル存在、DBレコード存在等）
    Custom,
}
```

#### 各ジョブタイプの設定

| # | JobType | Resume | Restart | CheckStrategy | 備考 |
|---|---------|--------|---------|---------------|------|
| 1 | **Import** | ✅ | ✅ | `Custom` | 宛先ファイル存在チェック |
| 2 | **Thumbnail** | ✅ | ✅ | `FileCreationTime` | 唯一の並列処理 |
| 3 | **CreateDb** | ✅ | ✅ | `LastProcessedId` | photo id順 |
| 4 | **GooglePhotosUpload** | ✅ | ✅ | `Custom` | google_photos_url チェック |
| 5 | **RecalculateGrouping** | ✅ | ✅ | `LastProcessedId` | 時刻順 → photo id |
| 6 | **AiTagging** | ✅ | ✅ | `LastProcessedId` | photo id順 |
| 7 | **S3Sync** | ✅ | ✅ | `Custom` | storage_sync チェック |
| 8 | **FaceDetection** | ✅ | ✅ | `LastProcessedId` | photo id順 |
| 9 | **FaceThumbnailRegenerate** | ✅ | ✅ | `LastProcessedId` | face_id順 |

**CheckStrategy 分類:**

| Strategy | 対象JobType | 件数 |
|----------|------------|------|
| `LastProcessedId` | CreateDb, RecalculateGrouping, AiTagging, FaceDetection, FaceThumbnailRegenerate | 5 |
| `FileCreationTime` | Thumbnail | 1 |
| `Custom` | Import, GooglePhotosUpload, S3Sync | 3 |

### 汎用チェック1: LastProcessedId

DBのid順で処理し、最後に処理したidを記録。

```rust
// job_queue テーブルに last_processed_id カラムを追加
// ALTER TABLE job_queue ADD COLUMN last_processed_id INTEGER;

/// sequential処理の汎用チェック
fn filter_unprocessed_by_id(
    items: &[PhotoItem],  // id順にソート済み
    last_processed_id: Option<i64>,
) -> Vec<&PhotoItem> {
    match last_processed_id {
        Some(last_id) => items.iter()
            .filter(|item| item.id > last_id)
            .collect(),
        None => items.iter().collect(),
    }
}
```

**利点**:
- シンプルなロジック
- 処理対象をDBに記録不要（idだけ保存）
- 処理順序が保証される

**制約**: sequential処理専用（並列不可）

**適用**: CreateDb, RecalculateGrouping, AiTagging, FaceDetection, FaceThumbnailRegenerate (5件)

---

### 汎用チェック2: FileCreationTime

ジョブ開始後に作成されたファイルは処理済みと判定。

```rust
/// 並列処理対応の汎用処理済み判定
fn is_processed_by_file_time(
    output_path: &Path,
    job_started_at: &str,
) -> bool {
    if !output_path.exists() {
        return false;
    }

    let job_start = parse_datetime(job_started_at);
    let file_mtime = output_path.metadata()
        .and_then(|m| m.modified())
        .ok();

    match file_mtime {
        Some(mtime) => mtime > job_start,
        None => false,
    }
}
```

**利点**:
- 処理済みアイテムをDBに記録する必要がない
- 既存のファイルシステム情報を活用
- 並列処理でも正確に判定可能

**適用**: Thumbnail (1件)

### 個別チェック: Custom

各ジョブタイプ固有のロジックを実装:

```rust
trait ProcessedChecker {
    fn is_processed(&self, item: &str, job: &QueuedJob, db: &SQLite) -> bool;
}

// Import: 宛先ファイルが存在するか
impl ProcessedChecker for ImportChecker {
    fn is_processed(&self, source_path: &str, job: &QueuedJob, _db: &SQLite) -> bool {
        let dest_path = compute_destination_path(source_path, &job.import_to);
        std::path::Path::new(&dest_path).exists()
    }
}

// GooglePhotosUpload: DBに google_photos_url が設定済みか
impl ProcessedChecker for GooglePhotosUploadChecker {
    fn is_processed(&self, photo_path: &str, _job: &QueuedJob, db: &SQLite) -> bool {
        db.has_google_photos_url(photo_path).unwrap_or(false)
    }
}

// S3Sync: storage_sync レコードが存在するか
impl ProcessedChecker for S3SyncChecker {
    fn is_processed(&self, photo_path: &str, _job: &QueuedJob, db: &SQLite) -> bool {
        db.has_storage_sync(photo_path).unwrap_or(false)
    }
}
```

**適用**: Import, GooglePhotosUpload, S3Sync (3件)

---

## Implementation Plan

### Phase 2.1: JobTypeConfig 基盤
1. `src-tauri/src/entity/job_type_config.rs` 作成
2. 各ジョブタイプの設定を定義
3. `get_job_type_config(job_type)` 関数実装
4. Migration: `job_queue` に `last_processed_id` カラム追加

### Phase 2.2: 汎用チェック実装
1. `LastProcessedId` チェッカー実装
   - 適用: CreateDb, RecalculateGrouping, AiTagging, FaceDetection, FaceThumbnailRegenerate
2. `FileCreationTime` チェッカー実装
   - 適用: Thumbnail（唯一の並列処理）

### Phase 2.3: 個別チェック実装
1. `ProcessedChecker` trait 定義
2. Import, GooglePhotosUpload, S3Sync チェッカー実装

### Phase 2.4: UI更新
1. JobQueue.jsx に Resume/Restart ボタン追加
2. JobTypeConfig に基づいてボタン表示を制御
3. `resume_job` / `restart_job` コマンド呼び分け

### Phase 2.5: ハンドラー統合
1. 各ハンドラーの処理ループ前にチェッカー呼び出し
2. 処理済みアイテムをスキップ

---

## Source Code Changes

### New Files
| File | Description |
|------|-------------|
| `src-tauri/src/entity/job_type_config.rs` | JobTypeConfig 定義 |
| `src-tauri/src/domain_service/job_queue/checker.rs` | ProcessedChecker trait と実装 |

### Modified Files
| File | Change |
|------|--------|
| `src-tauri/src/entity/mod.rs` | job_type_config モジュール追加 |
| `src-tauri/src/commands/job_queue_commands.rs` | `resume_job`, `restart_job` 追加 |
| `src-tauri/src/domain_service/job_queue/manager.rs` | resume/restart ロジック |
| All `handlers/*.rs` | チェッカー呼び出し追加 |
| `src/App/JobQueue.jsx` | Resume/Restart ボタン |

---

## Open Questions

1. **started_at の精度**: 秒単位で十分か？ミリ秒が必要か？

2. **タイムゾーン**: ファイルの mtime と job.started_at のタイムゾーンは一致するか？

---

## Testing Strategy

1. **LastProcessedId チェック (CreateDb, FaceDetection, AiTagging等)**:
   - 100件中50件処理後にアプリ終了
   - Resume → id > last_processed_id の残り50件のみ処理
   - Restart → 100件全て再処理

2. **FileCreationTime チェック (Thumbnail)**:
   - 100件中50件サムネイル生成後にアプリ終了
   - Resume → mtime < started_at の残り50件のみ生成
   - Restart → 既存サムネイルを削除して全て再生成

3. **Custom チェック (Import)**:
   - 50件インポート後にアプリ終了
   - Resume → 宛先に存在しないファイルのみインポート
   - Restart → 全ファイル再インポート（上書き）

4. **Custom チェック (GooglePhotosUpload, S3Sync)**:
   - DBにレコードがある写真はスキップ
   - Resume → 未処理のみ処理

---

## Not in Scope (将来の検討事項)

- 処理中のジョブの一時停止機能
- ジョブの優先度変更
- 個別アイテムのリトライ（バッチ全体ではなく）
- 処理済みアイテムの詳細ログ表示
