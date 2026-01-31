# Improvement 120: Split job_queue_service.rs into Modular Architecture

## 概要

`src-tauri/src/domain_service/job_queue_service.rs` (1208行) を機能ごとにモジュール化し、コードの保守性と可読性を向上させる。

## 背景

### 現在の実装状況（improvement-124 完了後）

現在の `job_queue_service.rs` は以下の構造になっている：

1. **ワーカーサービス**: イベント駆動型のバックグラウンドジョブ処理
2. **ジョブ投入**: `submit_import_jobs`, `submit_google_photos_upload_jobs`
3. **ジョブ実行**: `process_job`, `process_pending_jobs`
4. **ジョブハンドラ**: 各ジョブタイプの処理ロジック
   - Import job (約280行)
   - Thumbnail job (約100行)
   - CreateDb job (約90行)
   - GooglePhotosUpload job (約140行)

### 問題点

1. **ファイルサイズが大きい**: 1208行の単一ファイル
2. **複数の責務が混在**:
   - ワーカー管理（ライフサイクル）
   - ジョブ投入（API）
   - ジョブ実行（ディスパッチ）
   - ジョブハンドラ（ビジネスロジック）
3. **変更の影響範囲が不明確**: 1つのファイルに全てが集約

## 目的

- 責務ごとにモジュールを分離
- 各モジュールを300行以下に保つ
- コードの保守性と可読性を向上
- テスタビリティの向上

## 実装方針

### ディレクトリ構造

```
src-tauri/src/domain_service/job_queue/
├── mod.rs              # モジュール定義と JobQueueManager 構造体 (約100行)
├── manager.rs          # ワーカーライフサイクル管理 (約200行)
├── submission.rs       # ジョブ投入メソッド (約150行)
├── executor.rs         # ジョブ実行とディスパッチ (約250行)
└── handlers/
    ├── mod.rs          # ハンドラモジュール定義 (約20行)
    ├── import.rs       # インポートジョブ (約300行)
    ├── thumbnail.rs    # サムネイルジョブ (約100行)
    ├── create_db.rs    # DB作成ジョブ (約100行)
    └── google_photos.rs # Google Photosアップロードジョブ (約150行)
```

**総行数**: 約1370行（元の1208行 + モジュール定義のオーバーヘッド約162行）

### 1. mod.rs (モジュール定義と公開API)

**内容**:
- サブモジュールの定義
- `JobQueueManager` 構造体の定義
- 公開APIの再エクスポート

**行数**: 約100行

```rust
// src-tauri/src/domain_service/job_queue/mod.rs

mod manager;
mod submission;
mod executor;
mod handlers;

use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

/// Job Queue Manager
///
/// Manages background job processing with event-driven architecture.
/// Jobs are processed by a single worker thread that waits on a channel.
pub struct JobQueueManager {
    db: Arc<SQLite>,
    is_running: Arc<Mutex<bool>>,
    max_concurrent_jobs: usize,
    worker_handle: Arc<Mutex<Option<thread::JoinHandle<()>>>>,
    job_signal: Arc<Mutex<Option<mpsc::Sender<()>>>>,
}

impl JobQueueManager {
    pub fn new(db: SQLite, max_concurrent_jobs: usize) -> Self {
        JobQueueManager {
            db: Arc::new(db),
            is_running: Arc::new(Mutex::new(false)),
            max_concurrent_jobs,
            worker_handle: Arc::new(Mutex::new(None)),
            job_signal: Arc::new(Mutex::new(None)),
        }
    }

    // Worker lifecycle methods (delegated to manager.rs)
    pub fn start_background_processing(&self, app_handle: tauri::AppHandle) {
        manager::start_background_processing(self, app_handle)
    }

    pub fn stop_background_processing(&self) {
        manager::stop_background_processing(self)
    }

    // Job submission methods (delegated to submission.rs)
    pub fn submit_import_jobs(
        &self,
        files: Vec<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        submission::submit_import_jobs(self, files, app_handle)
    }

    pub fn submit_google_photos_upload_jobs(
        &self,
        photos: Vec<String>,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        submission::submit_google_photos_upload_jobs(self, photos, app_handle)
    }

    // Job management methods
    pub fn get_job_progress(&self, job_unit_id: &str) -> Result<job_queue::JobProgress, String> {
        self.db.get_job_unit_progress(job_unit_id)
    }

    pub fn get_all_job_units(&self) -> Result<Vec<job_queue::JobUnit>, String> {
        // ... existing implementation
    }

    pub fn get_jobs_for_unit(&self, job_unit_id: &str) -> Result<Vec<job_queue::QueuedJob>, String> {
        // ... existing implementation
    }

    pub fn retry_job(&self, job_id: i64, app_handle: tauri::AppHandle) -> Result<bool, String> {
        // ... existing implementation
    }

    pub fn delete_job(&self, job_id: i64) -> Result<bool, String> {
        // ... existing implementation
    }

    pub fn cleanup_completed_jobs(&self) -> Result<bool, String> {
        // ... existing implementation
    }
}
```

### 2. manager.rs (ワーカーライフサイクル管理)

**内容**:
- `start_background_processing` - ワーカースレッド起動とチャネル設定
- `stop_background_processing` - グレースフルシャットダウン
- `reset_running_jobs_to_pending` - 起動時のジョブリセット

**行数**: 約200行

```rust
// src-tauri/src/domain_service/job_queue/manager.rs

use super::JobQueueManager;
use super::executor;
use crate::repository::MetaInfoDB;
use std::sync::{mpsc, Arc};
use std::thread;
use tauri::AppHandle;

/// Start the background worker thread
///
/// Architecture:
/// 1. Reset interrupted jobs (from previous crash)
/// 2. Create mpsc channel for job notifications
/// 3. Spawn worker thread that:
///    - Processes startup jobs once
///    - Waits on channel for new job signals
///    - Processes jobs when signaled
///    - Periodic 30s fallback check
pub fn start_background_processing(manager: &JobQueueManager, app_handle: AppHandle) {
    let is_running = Arc::clone(&manager.is_running);

    {
        let mut running = is_running.lock().unwrap();
        if *running {
            return; // Already running
        }
        *running = true;
    }

    log::info!(target: "job_queue", "worker_service; status=starting");

    // 1. Reset interrupted jobs
    if let Err(e) = reset_running_jobs_to_pending(&manager.db) {
        log::error!(target: "job_queue", "reset_running_jobs_error; error={}", e);
    }

    // 2. Create channel for job notifications
    let (tx, rx) = mpsc::channel();

    // Store the sender so job submission methods can signal the worker
    {
        let mut signal = manager.job_signal.lock().unwrap();
        *signal = Some(tx);
    }

    // 3. Start worker thread
    let db = Arc::clone(&manager.db);
    let is_running_clone = Arc::clone(&is_running);
    let max_concurrent = manager.max_concurrent_jobs;

    let handle = thread::spawn(move || {
        log::info!(target: "job_queue", "worker_service; status=started");

        // Process any pending jobs from startup (only once)
        log::info!(target: "job_queue", "worker_service; checking_startup_jobs");
        executor::process_pending_jobs(Arc::clone(&db), app_handle.clone(), max_concurrent);

        // Worker loop - wait for signals
        loop {
            // Check if should stop
            {
                let running = is_running_clone.lock().unwrap();
                if !*running {
                    log::info!(target: "job_queue", "worker_service; status=stopping");
                    break;
                }
            }

            // Wait for job signal with timeout (30s periodic check as fallback)
            match rx.recv_timeout(std::time::Duration::from_secs(30)) {
                Ok(_) => {
                    // New job signal received
                    log::info!(target: "job_queue", "worker_service; signal=received");
                    executor::process_pending_jobs(Arc::clone(&db), app_handle.clone(), max_concurrent);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Periodic check (fallback)
                    log::debug!(target: "job_queue", "worker_service; periodic_check");
                    executor::process_pending_jobs(Arc::clone(&db), app_handle.clone(), max_concurrent);
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    // Channel closed, shutdown
                    log::info!(target: "job_queue", "worker_service; channel=disconnected");
                    break;
                }
            }
        }

        log::info!(target: "job_queue", "worker_service; status=stopped");
    });

    // Store the handle
    let mut worker_handle = manager.worker_handle.lock().unwrap();
    *worker_handle = Some(handle);

    log::info!(target: "job_queue", "worker_service; status=ready");
}

/// Stop the background worker thread gracefully
pub fn stop_background_processing(manager: &JobQueueManager) {
    log::info!(target: "job_queue", "worker_service; status=stop_requested");

    // Set running flag to false
    let mut running = manager.is_running.lock().unwrap();
    *running = false;
    drop(running);

    // Close the channel to signal worker shutdown
    {
        let mut signal = manager.job_signal.lock().unwrap();
        *signal = None; // Drop sender, causing channel to disconnect
    }

    // Wait for worker thread to finish
    let mut worker_handle = manager.worker_handle.lock().unwrap();
    if let Some(handle) = worker_handle.take() {
        log::info!(target: "job_queue", "worker_service; status=waiting_for_worker");
        if let Err(e) = handle.join() {
            log::error!(target: "job_queue", "worker_service; join_error={:?}", e);
        }
    }

    log::info!(target: "job_queue", "worker_service; status=stopped");
}

/// Reset any jobs that were "running" to "pending"
fn reset_running_jobs_to_pending(db: &Arc<SQLite>) -> Result<(), String> {
    log::info!(target: "job_queue", "reset_jobs; status=checking");
    match db.get_running_jobs() {
        Ok(running_jobs) => {
            if running_jobs.is_empty() {
                log::info!(target: "job_queue", "reset_jobs; status=no_running_jobs");
                return Ok(());
            }

            log::info!(target: "job_queue", "reset_jobs; count={}", running_jobs.len());
            for job in running_jobs {
                if let Some(job_id) = job.id {
                    db.update_job_status(
                        job_id,
                        &crate::entity::job_queue::JobStatus::Pending,
                        Some("Reset after app restart".to_string()),
                    )?;
                    log::info!(target: "job_queue", "reset_job; job_id={}", job_id);
                }
            }

            log::info!(target: "job_queue", "reset_jobs; status=completed");
            Ok(())
        }
        Err(e) => {
            log::error!(target: "job_queue", "reset_jobs_error; error={}", e);
            Err(e)
        }
    }
}
```

### 3. submission.rs (ジョブ投入メソッド)

**内容**:
- `submit_import_jobs` - インポートジョブの投入とシグナル送信
- `submit_google_photos_upload_jobs` - Google Photosアップロードジョブの投入とシグナル送信
- ジョブユニットとジョブの作成ロジック

**行数**: 約150行

```rust
// src-tauri/src/domain_service/job_queue/submission.rs

use super::JobQueueManager;
use crate::entity::job_queue;
use crate::repository::MetaInfoDB;
use tauri::AppHandle;

/// Submit import jobs to the queue
///
/// Creates a job unit with a single import job.
/// Dependent jobs (thumbnail, create_db) are created after import completes.
pub fn submit_import_jobs(
    manager: &JobQueueManager,
    files: Vec<String>,
    _app_handle: AppHandle,
) -> Result<String, String> {
    log::info!(target: "job_queue", "submit_import; files={}", files.len());

    // Create job unit - only list import initially
    let job_types = vec!["import".to_string()];
    let job_unit = job_queue::JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    log::info!(target: "job_queue", "job_unit_created; id={}", job_unit_id);

    // Save job unit
    manager.db.create_job_unit(&job_unit)?;
    log::info!(target: "job_queue", "job_unit_saved; status=success");

    // Create import job
    let import_job = job_queue::Job::new(
        job_unit_id.clone(),
        job_queue::JobType::Import,
        files,
    );

    // Queue the job
    let import_queued = job_queue::QueuedJob::new(job_unit_id.clone(), import_job);
    let import_id = manager.db.create_job(&import_queued)?;

    log::info!(target: "job_queue", "import_job_created; id={}", import_id);
    log::info!(target: "job_queue", "import_job; status=queued; job_unit_id={}", job_unit_id);

    // Signal worker to process new job
    send_job_signal(&manager.job_signal);

    Ok(job_unit_id)
}

/// Submit Google Photos upload jobs to the queue
///
/// Creates a job unit with multiple upload jobs (batched by BATCH_SIZE).
pub fn submit_google_photos_upload_jobs(
    manager: &JobQueueManager,
    photos: Vec<String>,
    _app_handle: AppHandle,
) -> Result<String, String> {
    const GOOGLE_PHOTOS_BATCH_SIZE: usize = 50;

    log::info!(
        target: "google_photos",
        "submit_jobs; total_photos={}; batch_size={}",
        photos.len(),
        GOOGLE_PHOTOS_BATCH_SIZE
    );

    let total_chunks = (photos.len() + GOOGLE_PHOTOS_BATCH_SIZE - 1) / GOOGLE_PHOTOS_BATCH_SIZE;

    // Create single job unit for all Google Photos upload jobs
    let job_types = vec!["google_photos_upload".to_string()];
    let job_unit = job_queue::JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit
    manager.db.create_job_unit(&job_unit)?;

    // Create multiple jobs within the single job unit
    for (chunk_index, chunk) in photos.chunks(GOOGLE_PHOTOS_BATCH_SIZE).enumerate() {
        let job_data = job_queue::GooglePhotosUploadJob {
            photo_paths: chunk.to_vec(),
            album_id: None,
            chunk_index,
            total_chunks,
        };

        let job_data_json = serde_json::to_string(&job_data)
            .map_err(|e| format!("Failed to serialize job data: {}", e))?;

        let upload_job = job_queue::Job::new(
            job_unit_id.clone(),
            job_queue::JobType::GooglePhotosUpload,
            vec![job_data_json],
        );

        let queued = job_queue::QueuedJob::new(job_unit_id.clone(), upload_job);
        let job_id = manager.db.create_job(&queued)?;

        log::info!(
            target: "google_photos",
            "job_created; job_unit_id={}; job_id={}; batch={}/{}",
            job_unit_id, job_id, chunk_index + 1, total_chunks
        );
    }

    log::info!(
        target: "google_photos",
        "submit_complete; job_unit_id={}; jobs_created={}",
        job_unit_id, total_chunks
    );

    // Signal worker to process new jobs
    send_job_signal(&manager.job_signal);

    Ok(job_unit_id)
}

/// Send signal to worker thread to process jobs
fn send_job_signal(job_signal: &Arc<Mutex<Option<mpsc::Sender<()>>>>) {
    if let Some(tx) = &*job_signal.lock().unwrap() {
        let _ = tx.send(()); // Ignore errors if worker is shutting down
        log::info!(target: "job_queue", "worker_signal; status=sent");
    }
}
```

### 4. executor.rs (ジョブ実行とディスパッチ)

**内容**:
- `process_pending_jobs` - 保留中のジョブ取得と並列処理
- `process_job` - 個別ジョブの実行とステータス管理
- `create_dependent_jobs` - 依存ジョブの作成
- ジョブタイプに応じたハンドラへのディスパッチ

**行数**: 約250行

```rust
// src-tauri/src/domain_service/job_queue/executor.rs

use super::handlers;
use crate::entity::job_queue;
use crate::repository::meta_db::sqlite::SQLite;
use crate::repository::MetaInfoDB;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

/// Process all pending jobs
///
/// Separates Google Photos jobs (sequential) from other jobs (parallel).
pub fn process_pending_jobs(db: Arc<SQLite>, app_handle: AppHandle, max_concurrent: usize) {
    match db.get_pending_jobs() {
        Ok(pending_jobs) => {
            if pending_jobs.is_empty() {
                return;
            }

            log::info!(target: "job_queue", "worker; jobs_found={}", pending_jobs.len());

            // Separate Google Photos jobs from other jobs
            let (google_photos_jobs, other_jobs): (Vec<_>, Vec<_>) = pending_jobs
                .into_iter()
                .partition(|job| job.job.job_type == job_queue::JobType::GooglePhotosUpload);

            // Process Google Photos jobs sequentially
            if !google_photos_jobs.is_empty() {
                log::info!(target: "job_queue", "worker; google_photos_jobs={}", google_photos_jobs.len());
                for job in google_photos_jobs {
                    let db_clone = Arc::clone(&db);
                    let app_handle_clone = app_handle.clone();
                    process_job(db_clone, job, app_handle_clone);
                }
            }

            // Process other jobs in parallel (up to max_concurrent)
            if !other_jobs.is_empty() {
                let batch_size = std::cmp::min(other_jobs.len(), max_concurrent);
                let mut handles = Vec::new();

                log::info!(target: "job_queue", "worker; processing_jobs={}; max_concurrent={}", batch_size, max_concurrent);

                for job in other_jobs.into_iter().take(batch_size) {
                    let db_clone = Arc::clone(&db);
                    let app_handle_clone = app_handle.clone();

                    let handle = thread::spawn(move || {
                        process_job(db_clone, job, app_handle_clone)
                    });
                    handles.push(handle);
                }

                // Wait for batch to complete
                for handle in handles {
                    if let Err(e) = handle.join() {
                        log::error!(target: "job_queue", "worker; job_error={:?}", e);
                    }
                }
            }

            // Cleanup completed jobs
            if let Err(e) = db.cleanup_completed_jobs() {
                log::error!(target: "job_queue", "worker; cleanup_error={}", e);
            }
        }
        Err(e) => {
            log::error!(target: "job_queue", "worker; get_pending_jobs_error={}", e);
        }
    }
}

/// Process a single job
///
/// Dispatches to appropriate handler based on job type.
pub fn process_job(db: Arc<SQLite>, job: job_queue::QueuedJob, app_handle: AppHandle) {
    let job_id = match job.id {
        Some(id) => id,
        None => {
            log::error!(target: "job_queue", "job_error; error=missing_job_id");
            return;
        }
    };

    // Update status to running
    if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Running, None) {
        log::error!(target: "job_queue", "status_update_error; job_id={}; error={}", job_id, e);
        return;
    }

    // Process the job based on type
    log::info!(target: "job_queue", "job_execution; job_id={}; job_type={:?}; status=starting", job_id, job.job.job_type);

    let result = match job.job.job_type {
        job_queue::JobType::Import => {
            handlers::import::process(&job, &app_handle)
                .and_then(|imported_files| {
                    // Create dependent jobs after import completes
                    create_dependent_jobs(&db, &job.job_unit_id, imported_files, &app_handle)
                })
        }
        job_queue::JobType::Thumbnail => {
            handlers::thumbnail::process(&job, &app_handle)
        }
        job_queue::JobType::CreateDb => {
            handlers::create_db::process(&job, &app_handle)
        }
        job_queue::JobType::GooglePhotosUpload => {
            tokio::runtime::Runtime::new().unwrap().block_on(
                handlers::google_photos::process(&job, &app_handle, &db)
            )
        }
    };

    // Update job status based on result
    match result {
        Ok(_) => {
            if let Err(e) = db.update_job_status(job_id, &job_queue::JobStatus::Completed, None) {
                log::error!(target: "job_queue", "job_status_error; job_id={}; error={}", job_id, e);
            }
            log::info!(target: "job_queue", "job_completed; job_id={}", job_id);

            // Emit completion events
            emit_job_completion(&db, &job, &app_handle);
        }
        Err(error_msg) => {
            if let Err(e) = db.update_job_status(
                job_id,
                &job_queue::JobStatus::Failed,
                Some(error_msg.clone()),
            ) {
                log::error!(target: "job_queue", "job_status_error; job_id={}; error={}", job_id, e);
            }
            log::error!(target: "job_queue", "job_failed; job_id={}; error={}", job_id, error_msg);

            // Emit error event
            if let Err(e) = app_handle.emit("job_failed", (&job.job_unit_id, &error_msg)) {
                log::error!(target: "job_queue", "event_emit_error; error={}", e);
            }
        }
    }
}

/// Create dependent jobs after import completes
fn create_dependent_jobs(
    db: &Arc<SQLite>,
    job_unit_id: &str,
    imported_files: Vec<String>,
    app_handle: &AppHandle,
) -> Result<(), String> {
    // ... existing implementation
}

/// Emit job completion events
fn emit_job_completion(
    db: &Arc<SQLite>,
    job: &job_queue::QueuedJob,
    app_handle: &AppHandle,
) {
    // ... existing implementation
}
```

### 5. handlers/ (ジョブハンドラ)

各ジョブタイプの処理ロジックを分離:

#### handlers/mod.rs (約20行)

```rust
// src-tauri/src/domain_service/job_queue/handlers/mod.rs

pub mod import;
pub mod thumbnail;
pub mod create_db;
pub mod google_photos;
```

#### handlers/import.rs (約300行)

- インポート処理
- ファイルコピー
- メタデータ記録
- UUID管理

#### handlers/thumbnail.rs (約100行)

- サムネイル生成
- 日付抽出
- Tokio runtime 管理

#### handlers/create_db.rs (約100行)

- DB エントリ作成
- 日付抽出
- メタデータ記録

#### handlers/google_photos.rs (約150行)

- Google Photos アップロード
- バッチ処理
- トークン管理
- エラーハンドリング

## 移行手順

### Phase 1: ディレクトリ構造の作成

```bash
mkdir -p src-tauri/src/domain_service/job_queue/handlers
```

### Phase 2: モジュールファイルの作成

1. `mod.rs` を作成し、JobQueueManager 構造体を移動
2. `manager.rs` を作成し、ライフサイクルメソッドを移動
3. `submission.rs` を作成し、ジョブ投入メソッドを移動
4. `executor.rs` を作成し、ジョブ実行ロジックを移動
5. `handlers/` 以下に各ハンドラを作成

### Phase 3: 段階的な移行

1. **handlers の分離**（最も独立性が高い）
   - `handlers/import.rs`
   - `handlers/thumbnail.rs`
   - `handlers/create_db.rs`
   - `handlers/google_photos.rs`

2. **executor の分離**
   - `process_pending_jobs`
   - `process_job`
   - 依存ジョブ関連

3. **submission の分離**
   - `submit_import_jobs`
   - `submit_google_photos_upload_jobs`

4. **manager の分離**
   - `start_background_processing`
   - `stop_background_processing`

5. **mod.rs の作成**
   - 構造体定義
   - 公開API

### Phase 4: テストと検証

1. `cargo check` で型チェック
2. `cargo build` でビルド確認
3. 各ジョブタイプの動作確認

## 期待される効果

### コードの可読性

- ✅ 各ファイルが100-300行程度で管理しやすい
- ✅ 責務が明確で、ナビゲーションが容易
- ✅ 変更の影響範囲が明確

### 保守性

- ✅ ジョブハンドラの追加・変更が容易
- ✅ ワーカー管理とビジネスロジックが分離
- ✅ テストが書きやすい

### 拡張性

- ✅ 新しいジョブタイプの追加が容易（handlers に追加するだけ）
- ✅ ジョブ実行ロジックの変更が他に影響しない

## 注意点

1. **公開APIの維持**: `mod.rs` で既存の公開APIを維持
2. **イベント駆動アーキテクチャの維持**: チャネルベースのシグナリングを保持
3. **ログ構造の維持**: structured logging の形式を統一
4. **エラーハンドリング**: 各モジュールで適切なエラーハンドリング

## 参考

- Rust モジュールシステム: https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
- improvement-124: ジョブキューのイベント駆動アーキテクチャ実装
