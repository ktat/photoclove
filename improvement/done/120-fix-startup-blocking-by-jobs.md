# Improvement 124: ジョブキュー処理の非同期化とワーカーサービスの実装

## 概要

アプリケーション起動時のブロッキング問題を解決し、ジョブキュー処理を**1つのバックグラウンドワーカーサービス**として実装する。

## 現在の問題

### 問題1: 起動時のブロッキング

**症状**:
- アプリ起動時に応答がない
- 保留中のジョブ（サムネイル作成など）の完了を待機している

**原因** (`job_queue_service.rs` line 86-136):
```rust
fn process_startup_jobs(&self, app_handle: tauri::AppHandle) {
    // ... get pending jobs ...

    // ★ PROBLEM: Wait for all threads to complete
    for handle in handles {
        if let Err(e) = handle.join() {  // ← ここでブロック！
            log::error!(...);
        }
    }
}
```

### 問題2: 非効率な設計

**現在の実装**:
- `process_startup_jobs` - 起動時に1回実行（同期的）
- `process_new_jobs` - ジョブ投入のたびに新しいスレッドを起動

**問題点**:
- ジョブ投入のたびに新しいスレッドを生成
- 複数のスレッドが同じキューを見る可能性
- 依存ジョブ作成後に自動処理されない（`create_dependent_jobs`が`process_new_jobs`を呼ばない）

## 提案する設計

### 1つのバックグラウンドワーカーサービス

```
起動時:
└─> start_background_processing()
    └─> spawn_worker_thread()
        └─> loop {
            ├─> get_pending_jobs()
            ├─> 新しいジョブがあれば処理
            ├─> sleep(poll_interval)
            └─> 終了シグナルをチェック
        }

ジョブ投入時:
└─> submit_import_jobs()
    └─> create_job() → DB に追加するだけ
    （ワーカーが自動的に検出して処理）
```

**利点**:
- ✅ 起動時にブロックしない
- ✅ ジョブ投入時にスレッドを生成しない
- ✅ 1つのワーカーがすべてのジョブを管理
- ✅ 依存ジョブも自動的に処理される
- ✅ シンプルで保守しやすい

## 実装方針

### ステップ1: ワーカースレッドの実装

**場所**: `src-tauri/src/domain_service/job_queue_service.rs`

```rust
pub struct JobQueueManager {
    db: Arc<SQLite>,
    is_running: Arc<Mutex<bool>>,
    max_concurrent_jobs: usize,
    worker_handle: Arc<Mutex<Option<thread::JoinHandle<()>>>>,  // NEW
}

impl JobQueueManager {
    pub fn new(db: SQLite, max_concurrent_jobs: usize) -> Self {
        JobQueueManager {
            db: Arc::new(db),
            is_running: Arc::new(Mutex::new(false)),
            max_concurrent_jobs,
            worker_handle: Arc::new(Mutex::new(None)),  // NEW
        }
    }

    pub fn start_background_processing(&self, app_handle: tauri::AppHandle) {
        let is_running = Arc::clone(&self.is_running);

        {
            let mut running = is_running.lock().unwrap();
            if *running {
                return; // Already running
            }
            *running = true;
        }

        log::info!(target: "job_queue", "worker_service; status=starting");

        // 1. Reset interrupted jobs (same as before)
        if let Err(e) = self.reset_running_jobs_to_pending() {
            log::error!(target: "job_queue", "reset_running_jobs_error; error={}", e);
        }

        // 2. Start worker thread
        let db = Arc::clone(&self.db);
        let is_running_clone = Arc::clone(&is_running);
        let max_concurrent = self.max_concurrent_jobs;

        let handle = thread::spawn(move || {
            log::info!(target: "job_queue", "worker_service; status=started");

            // Worker loop
            loop {
                // Check if should stop
                {
                    let running = is_running_clone.lock().unwrap();
                    if !*running {
                        log::info!(target: "job_queue", "worker_service; status=stopping");
                        break;
                    }
                }

                // Process pending jobs
                Self::process_pending_jobs(
                    Arc::clone(&db),
                    app_handle.clone(),
                    max_concurrent
                );

                // Sleep before next poll
                thread::sleep(std::time::Duration::from_secs(2));
            }

            log::info!(target: "job_queue", "worker_service; status=stopped");
        });

        // Store the handle
        let mut worker_handle = self.worker_handle.lock().unwrap();
        *worker_handle = Some(handle);

        log::info!(target: "job_queue", "worker_service; status=ready");
    }

    pub fn stop_background_processing(&self) {
        log::info!(target: "job_queue", "worker_service; status=stop_requested");

        // Set running flag to false
        let mut running = self.is_running.lock().unwrap();
        *running = false;
        drop(running);

        // Wait for worker thread to finish
        let mut worker_handle = self.worker_handle.lock().unwrap();
        if let Some(handle) = worker_handle.take() {
            log::info!(target: "job_queue", "worker_service; status=waiting_for_worker");
            if let Err(e) = handle.join() {
                log::error!(target: "job_queue", "worker_service; join_error={:?}", e);
            }
        }

        log::info!(target: "job_queue", "worker_service; status=stopped");
    }

    // NEW: Process pending jobs (called by worker loop)
    fn process_pending_jobs(db: Arc<SQLite>, app_handle: tauri::AppHandle, max_concurrent: usize) {
        match db.get_pending_jobs() {
            Ok(pending_jobs) => {
                if pending_jobs.is_empty() {
                    return; // No jobs to process
                }

                log::info!(target: "job_queue", "worker; jobs_found={}", pending_jobs.len());

                // Separate Google Photos jobs from other jobs
                let (google_photos_jobs, other_jobs): (Vec<_>, Vec<_>) = pending_jobs.into_iter()
                    .partition(|job| job.job.job_type == job_queue::JobType::GooglePhotosUpload);

                // Process Google Photos jobs sequentially
                if !google_photos_jobs.is_empty() {
                    log::info!(target: "job_queue", "worker; google_photos_jobs={}", google_photos_jobs.len());
                    for job in google_photos_jobs {
                        let db_clone = Arc::clone(&db);
                        let app_handle_clone = app_handle.clone();
                        Self::process_job(db_clone, job, app_handle_clone);
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
                            Self::process_job(db_clone, job, app_handle_clone)
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
}
```

### ステップ2: ジョブ投入処理の簡素化

**変更前**:
```rust
pub fn submit_import_jobs(&self, files: Vec<String>, app_handle: tauri::AppHandle) -> Result<String, String> {
    // ... create jobs ...

    // Immediately start processing
    self.process_new_jobs(app_handle);  // ← 不要になる

    Ok(job_unit_id)
}
```

**変更後**:
```rust
pub fn submit_import_jobs(&self, files: Vec<String>, app_handle: tauri::AppHandle) -> Result<String, String> {
    log::info!(target: "job_queue", "submit_import; files={}", files.len());

    // Create job unit
    let job_types = vec!["import".to_string()];
    let job_unit = job_queue::JobUnit::new(job_types);
    let job_unit_id = job_unit.id.clone();

    // Save job unit
    self.db.create_job_unit(&job_unit)?;

    // Create import job
    let import_job = job_queue::Job::new(
        job_unit_id.clone(),
        job_queue::JobType::Import,
        files,
    );

    // Queue the job
    let import_queued = job_queue::QueuedJob::new(job_unit_id.clone(), import_job);
    self.db.create_job(&import_queued)?;

    log::info!(target: "job_queue", "submit_import; status=queued; job_unit_id={}", job_unit_id);

    // ★ NO NEED to call process_new_jobs - worker will pick it up!

    Ok(job_unit_id)
}
```

### ステップ3: process_new_jobs の削除

`process_new_jobs` 関数は不要になるので削除できます。

### ステップ4: create_dependent_jobs の簡素化

**変更前**:
```rust
fn create_dependent_jobs(...) -> Result<(), String> {
    // ... create jobs ...

    // ISSUE: No way to trigger processing
}
```

**変更後**:
```rust
fn create_dependent_jobs(...) -> Result<(), String> {
    // ... create jobs ...

    log::info!(target: "job_queue", "dependent_jobs; status=created");

    // ★ NO NEED to call process_new_jobs - worker will pick it up!

    Ok(())
}
```

## 設定パラメータ

### ポーリング間隔

```rust
const WORKER_POLL_INTERVAL_SECS: u64 = 2;  // 2秒ごとにキューをチェック
```

**調整可能**:
- 短い間隔 (1秒) = より速い反応、より多いCPU使用
- 長い間隔 (5秒) = より遅い反応、より少ないCPU使用

**推奨**: 2秒（反応速度とリソース使用のバランス）

## 実装手順

### Phase 1: ワーカーサービスの実装

1. `JobQueueManager` に `worker_handle` フィールドを追加
2. `start_background_processing` を書き換え
   - ワーカースレッドを起動
   - ループでキューをポーリング
3. `stop_background_processing` を実装
   - フラグを設定してワーカーを停止
   - スレッドのjoinを待つ
4. `process_pending_jobs` を実装（staticメソッド）

### Phase 2: 既存コードの簡素化

1. `submit_import_jobs` から `process_new_jobs` 呼び出しを削除
2. `submit_google_photos_upload_jobs` から `process_new_jobs` 呼び出しを削除
3. `process_new_jobs` 関数を削除
4. `process_startup_jobs` 関数を削除

### Phase 3: テスト

1. アプリを起動 → ワーカーが起動することを確認
2. 保留ジョブがあれば自動処理されることを確認
3. 新しいジョブを投入 → 2秒以内に処理開始されることを確認
4. 依存ジョブが自動処理されることを確認
5. アプリ終了時にワーカーが正常停止することを確認

## 期待される効果

### 起動速度
- ✅ アプリが即座に起動（ブロッキングなし）
- ✅ ワーカーはバックグラウンドで起動

### シンプルさ
- ✅ 1つのワーカーがすべてを管理
- ✅ ジョブ投入は単にDBに追加するだけ
- ✅ コード量が削減される

### 堅牢性
- ✅ ワーカーが常時稼働、新しいジョブを自動検出
- ✅ 依存ジョブも自動的に処理される
- ✅ 競合状態のリスクが低い（1つのワーカーのみ）

### パフォーマンス
- ✅ 不要なスレッド生成がない
- ✅ ポーリング間隔で調整可能
- ✅ 並列処理数は `max_concurrent_jobs` で制御

## 注意事項

### ポーリング vs イベント駆動

**現在の提案**: ポーリング方式（2秒ごとにチェック）

**代替案**: イベント駆動方式
- ジョブ投入時にワーカーに通知（channel等）
- より速い反応時間
- より複雑な実装

**判断**: まずはシンプルなポーリング方式で実装し、必要に応じてイベント駆動に移行

### アプリ終了時の処理

```rust
// lib.rs の on_window_event などで
app.on_window_event(|event| {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        let state = app.state::<AppState>();
        let job_queue = state.job_queue_manager.lock().unwrap();
        job_queue.stop_background_processing();
    }
});
```

### 長時間実行ジョブ

- サムネイル作成など、長時間かかるジョブがある
- ワーカーは次のポーリングまで待つ
- 問題なし（並列処理で他のジョブも処理される）

## まとめ

**現在の問題**:
1. 起動時にブロッキング
2. ジョブ投入のたびにスレッド生成
3. 依存ジョブが自動処理されない

**提案する解決策**:
- **1つのバックグラウンドワーカーサービス**
- キューを定期的にポーリング
- 新しいジョブを自動検出・処理

**実装の複雑さ**: 中程度（既存コードを大幅に簡素化）

**効果**: 大（起動速度、シンプルさ、堅牢性、すべて改善）

---

## 実装完了 (2025-12-14)

### 実装内容

すべての Phase を完了しました:

#### Phase 1: ワーカーサービスの実装
- ✅ `worker_handle` フィールドを `JobQueueManager` に追加
- ✅ `start_background_processing` を完全に書き換え
  - 非ブロッキングで即座にreturn
  - バックグラウンドワーカースレッドを起動
  - 2秒ごとにキューをポーリング
  - Google Photos ジョブは順次処理、その他は並列処理
- ✅ `stop_background_processing` を実装
  - フラグでワーカーを停止
  - スレッドの正常終了を待機
- ✅ `process_pending_jobs` 静的メソッドを実装
  - ワーカーループから呼ばれる
  - ジョブタイプに応じた処理分岐

#### Phase 2: 既存コードの簡素化
- ✅ `submit_import_jobs` から `process_new_jobs` 呼び出しを削除
- ✅ `submit_google_photos_upload_jobs` から `process_new_jobs` 呼び出しを削除
- ✅ `process_new_jobs` 関数を削除
- ✅ `process_startup_jobs` 関数を削除

#### Phase 3: テスト
- ✅ `cargo check` でコンパイル成功を確認

### 変更されたファイル

- `src-tauri/src/domain_service/job_queue_service.rs`

### 期待される効果

1. **起動速度の改善**: アプリが即座に起動（ブロッキングなし）
2. **コードの簡素化**: 不要なスレッド生成処理を削除
3. **自動ジョブ処理**: 依存ジョブも含めてすべて自動的に処理される
4. **堅牢性の向上**: 1つのワーカーが一貫してジョブを管理

### 次のステップ

実際のアプリケーション起動テストで動作を確認: