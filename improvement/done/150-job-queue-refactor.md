# Improvement #149: job_queue_service.rs ファイルサイズ削減

## ステータス
**計画中** - 2025-12-30

## 概要
`src-tauri/src/domain_service/job_queue_service.rs` のファイルサイズをCLAUDE.mdガイドライン（1000行未満）に準拠させるため、モジュール分割を実施。

## 現状分析

### 現在のファイルサイズ
```
総行数: 1214行
目標:   1000行未満
削減必要: 214+行
```

### 既存のTODOコメント
ファイルの先頭に以下のリファクタリング提案が既に記載されている：
```rust
// TODO: This file is too large (1208 lines) and should be refactored into smaller modules:
// - job_queue/manager.rs: Core JobQueueManager struct and lifecycle methods
// - job_queue/submission.rs: Job submission methods
// - job_queue/executor.rs: Job processing and execution logic
// - job_queue/handlers.rs: Individual job type handlers
```

### セクション別行数分析

```
1. Imports + Struct定義 (1-32):           30行
2. Lifecycle methods (34-138):          105行
   - new, start, stop, reset, process_startup

3. Job処理オーケストレーション (139-520): 382行
   - process_new_jobs
   - process_specific_jobs_immediately
   - process_job
   - create_dependent_jobs

4. Job投入メソッド (205-320):          116行
   - submit_google_photos_upload_jobs
   - submit_import_jobs
   - get_job_progress

5. Jobハンドラー (521-1161):           641行
   - process_import_job (521-716):     196行 ★最大
   - process_thumbnail_job (718-810):   93行
   - process_create_db_job (811-887):   77行
   - copy_file_with_timestamp (888-924): 37行
   - get_or_create_source_uuid (925-963): 39行
   - emit_import_completion_events (965-1007): 43行
   - get_imported_dates_from_job_unit (1009-1050): 42行
   - process_google_photos_upload_job (1052-1161): 110行

6. 管理メソッド (1163-end):             52行
   - get_all_job_units, retry_job, delete_job, cleanup

────────────────────────────────────────
合計:                                  1214行
```

## リファクタリング計画

### 方針
既存のTODOコメントの提案に従い、以下の4つのモジュールに分割：

1. **manager.rs** - コアマネージャー構造とライフサイクル
2. **submission.rs** - ジョブ投入メソッド
3. **executor.rs** - ジョブ処理とオーケストレーション
4. **handlers/** - 個別のジョブタイプハンドラー（サブモジュール）

### フェーズ1: handlers/モジュール分割 (-550行見込み)

#### 構造
```
src-tauri/src/domain_service/
├── job_queue_service.rs (残: ~450行)
└── job_queue/
    ├── mod.rs (新規: モジュール定義)
    ├── manager.rs (新規: ~140行)
    ├── submission.rs (新規: ~120行)
    ├── executor.rs (新規: ~150行)
    └── handlers/
        ├── mod.rs (新規: 公開インターフェース)
        ├── import.rs (新規: ~240行)
        ├── thumbnail.rs (新規: ~100行)
        ├── create_db.rs (新規: ~85行)
        └── google_photos.rs (新規: ~115行)
```

#### 抽出詳細

**1.1 handlers/import.rs (~240行)**
```rust
// 抽出するもの:
- process_import_job (196行)
- copy_file_with_timestamp (37行)
- 必要な use文とヘルパー

// 依存関係:
- Arc<SQLite>, tauri::AppHandle
- job_queue::QueuedJob, job_queue::Photo
- file モジュール
```

**1.2 handlers/thumbnail.rs (~100行)**
```rust
// 抽出するもの:
- process_thumbnail_job (93行)
- 必要な use文

// 依存関係:
- Arc<SQLite>, tauri::AppHandle
- job_queue::QueuedJob
```

**1.3 handlers/create_db.rs (~85行)**
```rust
// 抽出するもの:
- process_create_db_job (77行)
- 必要な use文

// 依存関係:
- Arc<SQLite>, tauri::AppHandle
- job_queue::QueuedJob
```

**1.4 handlers/google_photos.rs (~115行)**
```rust
// 抽出するもの:
- process_google_photos_upload_job (110行)
- 必要な use文

// 依存関係:
- Arc<SQLite>, tauri::AppHandle
- job_queue::QueuedJob, job_queue::GooglePhotosUploadJob
```

**1.5 handlers/mod.rs (新規: ~20行)**
```rust
// 役割: ハンドラーの公開インターフェース
mod import;
mod thumbnail;
mod create_db;
mod google_photos;

pub use import::process_import_job;
pub use thumbnail::process_thumbnail_job;
pub use create_db::process_create_db_job;
pub use google_photos::process_google_photos_upload_job;
```

**期待される削減**: 元ファイルから ~550行削減（ハンドラー関連コード）

### フェーズ2: executor.rs 抽出 (-150行見込み)

**executor.rs (~150行)**
```rust
// 抽出するもの:
- process_new_jobs
- process_specific_jobs_immediately
- process_job (ディスパッチャー)
- create_dependent_jobs

// 依存関係:
- Arc<SQLite>, tauri::AppHandle
- job_queue モジュール
- handlers モジュール (各ハンドラーを呼び出し)

// 公開API:
pub fn process_new_jobs(...)
pub(crate) fn process_specific_jobs_immediately(...)
```

**期待される削減**: 元ファイルから ~150行削減

### フェーズ3: submission.rs 抽出 (-120行見込み)

**submission.rs (~120行)**
```rust
// 抽出するもの:
- submit_google_photos_upload_jobs
- submit_import_jobs
- get_job_progress

// 依存関係:
- Arc<SQLite>, tauri::AppHandle
- job_queue モジュール
- executor (process_specific_jobs_immediatelyを呼び出し)

// 公開API:
pub fn submit_google_photos_upload_jobs(...)
pub fn submit_import_jobs(...)
pub fn get_job_progress(...)
```

**期待される削減**: 元ファイルから ~120行削減

### フェーズ4: manager.rs + ユーティリティ抽出 (-150行見込み)

**manager.rs (~140行)**
```rust
// 抽出するもの:
- JobQueueManager struct定義
- new, start_background_processing, stop_background_processing
- reset_running_jobs_to_pending
- process_startup_jobs
- get_all_job_units, get_all_jobs
- retry_job, delete_job, delete_job_unit, cleanup_completed_jobs

// 依存関係:
- Arc<SQLite>
- submission モジュール (publicメソッドで使用)
- executor モジュール (publicメソッドで使用)

// 公開API: JobQueueManager全体
```

**utilities.rs (新規: ~160行)**
```rust
// 抽出するもの:
- get_or_create_source_uuid (39行)
- emit_import_completion_events (43行)
- get_imported_dates_from_job_unit (42行)
- その他のヘルパー関数

// 公開API:
pub(crate) fn get_or_create_source_uuid(...)
pub(crate) fn emit_import_completion_events(...)
pub(crate) fn get_imported_dates_from_job_unit(...)
```

**期待される削減**: 元ファイルから ~150行削減

### フェーズ5: 最終調整とクリーンアップ (-10行見込み)

- 不要なコメント削除
- use文の整理
- 空行の削減

## 最終的なモジュール構造

```
src-tauri/src/domain_service/
├── job_queue_service.rs (公開API、再エクスポート: ~20行)
└── job_queue/
    ├── mod.rs (モジュール定義: ~30行)
    ├── manager.rs (コア構造: ~140行)
    ├── submission.rs (投入ロジック: ~120行)
    ├── executor.rs (実行ロジック: ~150行)
    ├── utilities.rs (ヘルパー関数: ~160行)
    └── handlers/
        ├── mod.rs (ハンドラーAPI: ~20行)
        ├── import.rs (インポート処理: ~240行)
        ├── thumbnail.rs (サムネイル処理: ~100行)
        ├── create_db.rs (DB作成処理: ~85行)
        └── google_photos.rs (Google Photos: ~115行)
```

## 期待される結果

```
現在:                           1214行 (1ファイル)
フェーズ1 (handlers分割):        664行 (-550行)
フェーズ2 (executor抽出):        514行 (-150行)
フェーズ3 (submission抽出):      394行 (-120行)
フェーズ4 (manager抽出):         244行 (-150行)
フェーズ5 (最終調整):            234行 (-10行)
────────────────────────────────────────
最終目標:                      ~240行 (元ファイル)

新規ファイル合計:             ~1160行 (10ファイル)
全体管理行数:                 ~1400行
削減効果:                      各ファイル1000行未満 ✓
```

## 実装上の注意点

### Rustモジュールシステム
1. **可視性の管理**
   - `pub(crate)`: クレート内部でのみ使用
   - `pub`: 外部APIとして公開

2. **循環依存の回避**
   - executor → handlers (OK)
   - submission → executor (OK)
   - manager → submission, executor (OK)
   - handlers → executor (NG - 避ける)

3. **依存関係の明確化**
   - 各モジュールの use文を最小限に
   - Arc<SQLite> は各モジュールで受け取る
   - tauri::AppHandle も同様

### テスト戦略
1. **段階的な移行**
   - 各フェーズ後に `cargo check` でビルド確認
   - `cargo test` でテスト実行

2. **統合テスト**
   - 既存の動作が変わらないことを確認
   - ジョブキュー全体の動作テスト

## リスク管理

### 潜在的な問題
1. **循環依存**: モジュール間の依存関係設計ミス
   - **対策**: 依存グラフを事前に設計、単方向のみ許可

2. **可視性エラー**: privateメソッドへのアクセス
   - **対策**: 必要に応じて pub(crate) を使用

3. **テスト失敗**: モジュール分割後の動作不良
   - **対策**: 各フェーズで段階的にテスト実行

4. **複雑さの増加**: ファイル数増加による管理コスト
   - **対策**: 明確な命名規則、mod.rs での整理

### ロールバック戦略
- 各フェーズごとにコミット
- 問題発生時は前のコミットに戻す
- git で段階的に管理

## 実装順序

### 推奨アプローチ
1. **フェーズ1から順番に実施** (handlers → executor → submission → manager)
2. **各フェーズ後にテスト**: cargo check && cargo test
3. **段階的コミット**: 各フェーズ完了時にコミット

### 代替アプローチ
1. **ボトムアップ**: handlers から先に抽出（依存が少ない）
2. **トップダウン**: manager から抽出（全体構造が見えやすい）

**推奨**: ボトムアップ（handlers → executor → submission → manager）
- 理由: 依存関係が少ない部分から抽出、リスク低減

## 関連する改善

- #148: DirectoryMenu.jsx ファイルサイズ削減 (完了)
- #147: PhotosList.jsx props統合 (完了)
- 同様のファイルサイズ削減・モジュール分割パターン

## 次のステップ

1. このプランをレビュー
2. 実装アプローチを決定（段階的 or 一括）
3. フェーズ1から実装開始
4. 各フェーズ後にテスト・コミット

## メモ

- 既存のTODOコメントが良い指針を提供している
- Rustのモジュールシステムの理解が重要
- JavaScript/Reactのリファクタリングとは異なり、コンパイラが多くのエラーを検出
- 型安全性により、リファクタリングの安全性が高い
- 各ハンドラーは独立性が高く、抽出が容易
