# S3 Backup Feature

## Overview

Amazon S3へのフォトバックアップ機能を追加する。ユーザーが指定したS3バケットに写真をアップロードし、バックアップURLを管理できるようにする。

## User Impact

- **対象ユーザー**: クラウドバックアップを必要とするユーザー、特にAWSを使用している技術者や企業ユーザー
- **ワークフロー改善**: Google Photosに加えて、よりカスタマイズ可能なバックアップオプションを提供
- **解決する課題**:
  - Google Photosの容量制限やプライバシー懸念
  - 自前のストレージでの写真管理
  - 複数のバックアップ先の選択肢

## Influence on Existing Features

### Compatibility

- **既存機能との互換性**: 完全な互換性を維持
- **Google Photos連携との共存**: 同じ写真を両方にバックアップ可能
- **データベーススキーマ**: 新規カラム追加のみ（既存データに影響なし）

### Related Features

| 関連機能 | ファイル | 影響 |
|----------|----------|------|
| Google Photos連携 | `src/services/firebase/auth.js` | パターン参考 |
| Preferences | `src/App/Preferences.jsx` | S3設定タブ追加 |
| Selection Operations | `src/App/DirectoryMenu.jsx` | S3アップロード操作追加 |
| Config | `src-tauri/src/entity/config.rs` | S3設定フィールド追加 |
| JobQueue | `src-tauri/src/entity/job_queue.rs` | S3アップロードジョブ追加 |

## Implementation Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      S3 Backup Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  Frontend                                                    │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │   Preferences   │  │ DirectoryMenu│  │   S3Service    │ │
│  │  (S3 Config)    │  │ (Upload Btn) │  │ (Upload Logic) │ │
│  └─────────────────┘  └──────────────┘  └────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Backend (Rust)                                              │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  S3Service      │  │   Config     │  │   MetaDB       │ │
│  │ (aws-sdk-s3)    │  │ (S3 Config)  │  │ (s3_url column)│ │
│  └─────────────────┘  └──────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 設計ポイント

1. **S3 Bucket URI保存**:
   - Config (`~/.photoclove.yml`) に `s3_bucket_uri` を保存
   - 例: `s3://my-photo-bucket/backup/`

2. **認証方式の選択肢**:
   - AWS CLI credentials (`~/.aws/credentials`) を使用
   - または、Access Key ID / Secret Access Key を直接入力
   - IAM Role (EC2/ECS環境用)

3. **アップロード済みURL保存**:
   - `photo_metadata` テーブルに `s3_url` カラム追加
   - Google Photos URLと同様のパターン

### Source Code Changes

**Frontend**:

| ファイル | 変更内容 |
|----------|----------|
| `src/App/Preferences.jsx` | S3設定タブ追加 (Bucket URI, Region, 認証方式) |
| `src/App/DirectoryMenu.jsx` | "Upload to S3" 操作追加 |
| `src/services/S3Service.js` (新規) | S3アップロードAPI呼び出し |

**Backend**:

| ファイル | 変更内容 |
|----------|----------|
| `src-tauri/src/entity/config.rs` | S3Config構造体追加 |
| `src-tauri/src/domain_service/s3_service.rs` (新規) | S3アップロードロジック |
| `src-tauri/src/commands/s3_commands.rs` (新規) | Tauriコマンド定義 |
| `src-tauri/src/lib.rs` | 新規コマンド登録 |

**Database**:

```sql
-- Migration: 005_add_storage_sync.sql
ALTER TABLE photo_metadata ADD COLUMN storage_sync TEXT DEFAULT NULL;
-- JSON format for multiple storage providers
```

### storage_sync JSONスキーマ

```json
{
  "aws_s3": {
    "url": "s3://my-bucket/2024-01-15/abc123/photo.jpg",
    "synced_at": "2024-01-15T10:30:00Z"
  },
  "wasabi": {
    "url": "s3://wasabi-bucket/2024-01-15/abc123/photo.jpg",
    "synced_at": "2024-01-15T11:00:00Z"
  }
}
```

**メリット**:
- JOINなしで同期状態を取得可能
- 複数プロバイダー対応

**同期判定**:
- `storage_sync`がNULL → 未同期
- `storage_sync`にプロバイダーのデータあり → 同期済み
- 写真ファイルはインポート後に変更されない（非破壊編集）のでetagは不要

### DBバックアップ

メタデータ（CSS編集、タグ、アルバム、コメント等）はSQLite DBに保存されているため、DBファイル自体をS3にバックアップ。

```
バックアップ対象:
├── 写真ファイル → s3://bucket/YYYY-MM-DD/[UUID]/photo.jpg
└── SQLite DB    → s3://bucket/.photoclove/photoclove.db
```

**DBバックアップの安全性**:

編集中のDBを直接コピーすると不整合が発生する可能性があるため、`VACUUM INTO`を使用。

```rust
// 排他ロック + VACUUM INTO でアトミックにバックアップ
fn backup_database(conn: &Connection, backup_path: &str) -> Result<(), Error> {
    conn.execute("BEGIN EXCLUSIVE TRANSACTION", [])?;
    conn.execute(&format!("VACUUM INTO '{}'", backup_path), [])?;
    conn.execute("COMMIT", [])?;
    Ok(())
}
```

**メリット**:
- アトミック（一貫性保証）
- シンプル
- VACUUMも同時実行（DBサイズ最適化）
- DBサイズは通常100MB以下なので短時間で完了

**バックアップフロー**:
```
1. VACUUM INTO でローカル一時ファイルにコピー
   ~/.photoclove/backup/photoclove_backup.db
       ↓
2. 一時ファイルをS3にアップロード
   s3://bucket/.photoclove/photoclove.db
       ↓
3. ローカル一時ファイルを削除
```

**DBバックアップのタイミング**:
- 写真Sync完了後に自動実行（`backup_db`が有効な場合）
- 手動実行も可能

### StorageSync エンティティ (Rust)

```rust
// src-tauri/src/entity/storage_sync.rs

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageSyncInfo {
    pub url: String,
    pub synced_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct StorageSync {
    #[serde(flatten)]
    pub providers: HashMap<String, StorageSyncInfo>,  // "aws_s3", "wasabi", etc.
}

impl StorageSync {
    pub fn is_synced(&self, provider: &str) -> bool {
        self.providers.contains_key(provider)
    }

    pub fn get_url(&self, provider: &str) -> Option<&str> {
        self.providers.get(provider).map(|info| info.url.as_str())
    }
}
```

### Config構造体の拡張案

```rust
// src-tauri/src/entity/config.rs

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct S3Config {
    pub enabled: bool,
    pub storage_type: S3StorageType,    // AWS S3 or S3互換ストレージ
    pub bucket_uri: String,             // s3://bucket-name/path/
    pub region: String,                 // ap-northeast-1
    pub auth_method: S3AuthMethod,      // Credentials | AccessKey | IAMRole
    pub profile: Option<String>,        // AWS profile name (AWS S3のみ)
    pub access_key_id: Option<String>,  // Access Key (keyringに保存)
    pub secret_access_key: Option<String>, // Secret Key (keyringに保存)
    pub custom_endpoint: Option<String>, // S3互換ストレージ用エンドポイント
    pub auto_sync: bool,                // Import完了時に自動Sync
    pub backup_db: bool,                // SQLite DBもバックアップするか
    pub max_file_size_mb: Option<u32>,  // Sync対象の最大ファイルサイズ (MB), Noneは無制限
    pub last_sync_at: Option<String>,   // 最終Sync時間 (自動Sync用)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum S3StorageType {
    AwsS3,          // Amazon S3
    MinIO,          // MinIO
    Wasabi,         // Wasabi
    CloudflareR2,   // Cloudflare R2
    DigitalOcean,   // DigitalOcean Spaces
    Custom,         // その他S3互換ストレージ
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum S3AuthMethod {
    // AWS S3専用
    AwsCredentials, // ~/.aws/credentials (profile選択可能)
    IAMRole,        // IAM Role (EC2/ECS環境)

    // 共通（AWS S3 & S3互換ストレージ両方で使用可能）
    AccessKey,      // Access Key ID + Secret Access Key 直接入力
}

// Configに追加
pub struct Config {
    // ... existing fields ...
    #[serde(default)]
    pub s3: Option<S3Config>,
}
```

### 認証方式の制約

| Storage Type | AwsCredentials | IAMRole | AccessKey |
|--------------|----------------|---------|-----------|
| AWS S3       | ✓              | ✓       | ✓         |
| MinIO        | -              | -       | ✓         |
| Wasabi       | -              | -       | ✓         |
| Cloudflare R2| -              | -       | ✓         |
| DigitalOcean | -              | -       | ✓         |
| Custom       | -              | -       | ✓         |

**注意**: S3互換ストレージのAccess Key/Secret Keyは各サービスのダッシュボードで発行されるもので、AWSの認証情報とは別物。

### 追加Tauriコマンド

```rust
// S3関連コマンド
#[tauri::command]
async fn list_aws_profiles() -> Result<Vec<String>, String>;

#[tauri::command]
async fn test_s3_connection(config: S3Config) -> Result<bool, String>;

// 増分Sync（last_sync_at以降にインポートされた写真を対象）
// 自動Syncで使用。効率的。
#[tauri::command]
async fn enqueue_s3_incremental_sync() -> Result<SyncEnqueueResult, String>;

// フルSync（storage_syncがNULLの全写真を対象）
// 手動実行で使用。漏れなくチェック。
#[tauri::command]
async fn enqueue_s3_full_sync() -> Result<SyncEnqueueResult, String>;

// 日付単位でSync
#[tauri::command]
async fn enqueue_s3_sync_by_date(date: String) -> Result<SyncEnqueueResult, String>;

// Sync状態の取得
#[tauri::command]
async fn get_s3_sync_stats() -> Result<SyncStats, String>;

#[derive(Serialize)]
pub struct SyncEnqueueResult {
    pub job_id: String,
    pub total_photos: u32,
    pub to_sync: u32,      // Sync対象の写真数
    pub already_synced: u32,
}

#[derive(Serialize)]
pub struct SyncStats {
    pub total_photos: u32,
    pub synced: u32,
    pub not_synced: u32,
    pub last_sync_at: Option<String>,
}
```

### JobQueue統合

```rust
// src-tauri/src/entity/job_queue.rs に追加

// JobType enumに追加
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobType {
    Import,
    Thumbnail,
    CreateDb,
    GooglePhotosUpload,
    S3Sync,  // 追加
}

// S3 Sync用のジョブデータ構造体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3SyncJobData {
    pub photo_paths: Vec<String>,
    pub provider: String,         // "aws_s3", "wasabi", etc.
}
```

### Handler追加

```rust
// src-tauri/src/domain_service/job_queue/handlers/s3_sync.rs (新規)

pub(crate) async fn process_s3_sync_job(
    job: &job_queue::QueuedJob,
    app_handle: &tauri::AppHandle,
    db: &Arc<SQLite>,
) -> Result<(), String> {
    // S3アップロード処理
    // エラー時はRecovery Queueに追加
}
```

### Recovery Queue統合

S3 Syncでエラーが発生した場合、Recovery Queueに追加して再試行可能にする。

```rust
// src-tauri/src/entity/recovery_queue.rs に追加

pub enum OperationType {
    MoveToTrash,
    Restore,
    Import,
    PermanentlyDelete,
    S3Sync,  // 追加
}

impl ToString for OperationType {
    fn to_string(&self) -> String {
        match self {
            // ... existing ...
            OperationType::S3Sync => "s3_sync".to_string(),
        }
    }
}
```

### エラーハンドリングフロー

```
┌─────────────────┐
│  S3 Sync 開始   │
└────────┬────────┘
         ▼
┌─────────────────┐
│  アップロード    │
└────────┬────────┘
         ▼
    ┌────┴────┐
    │ 成功？  │
    └────┬────┘
    Yes  │  No
    ▼    │    ▼
┌───────┐│┌─────────────────┐
│storage│││ Recovery Queue  │
│_sync  │││ に追加          │
│更新   ││└────────┬────────┘
└───────┘│         ▼
         │┌─────────────────┐
         ││ Footer通知      │
         ││ "1件失敗"       │
         │└─────────────────┘
         ▼
┌─────────────────────────────┐
│ RecoveryQueueModal で      │
│ ユーザーが再試行/破棄を選択 │
└─────────────────────────────┘
```

### Recovery Queue用の追加データ

S3 Syncエラー時は`error_reason`にプロバイダー情報も含める:

```json
{
  "provider": "wasabi",
  "error": "AccessDenied: Access Denied",
  "s3_key": "2024-01-15/abc123/photo.jpg"
}
```

### 進捗表示

S3 Syncの進捗は既存のJobQueue機能で表示:

1. **JobQueue UI** (`src/App/JobQueue.jsx`)
   - 他のジョブ（Import, Thumbnail生成）と同様に一覧表示
   - 進捗バー、完了/失敗件数

2. **Footerメッセージ**
   - 定期的な進捗通知: "S3 Sync: 50/100 photos uploaded..."
   - 完了通知: "S3 Sync completed: 100 photos synced"
   - エラー通知: "S3 Sync failed: Authentication error"

## Dependencies & Risks

### External Dependencies

**Rust Crates (Cargo.toml)**:
```toml
aws-config = "1.1"
aws-sdk-s3 = "1.15"
```

**npm packages**: なし (Tauriコマンド経由でRust側で処理)

### Performance

- **アップロード時間**: 大量写真のバッチアップロードは時間がかかる
  - 対策: JobQueueでバックグラウンド処理
- **メモリ使用量**: 大きなファイルのアップロードでメモリ増加
  - 対策: マルチパートアップロード使用

### Security

- **認証情報の保護**:
  - Access Key/Secret Keyはkeyringに保存（TokenStorageService参照）
  - 設定ファイルには保存しない
- **バケットアクセス権限**:
  - 最小権限原則: `s3:PutObject`, `s3:GetObject` のみ必要
- **HTTPS通信**: aws-sdk-s3はデフォルトでHTTPS使用

### Risks

| リスク | 影響 | 対策 |
|--------|------|------|
| AWSクレデンシャル漏洩 | 高 | keyringで暗号化保存 |
| バケット設定ミス | 中 | 接続テスト機能を提供 |
| 大量アップロードでコスト増 | 中 | アップロード前に確認ダイアログ |
| ネットワークエラー | 低 | リトライロジック実装 |

## Testing Strategy

### Manual Testing

1. **設定テスト**:
   - S3 Bucket URIの入力と保存
   - 認証方式の切り替え
   - 接続テストボタンの動作確認

2. **Syncテスト**:
   - 単一写真のSync
   - 複数写真のバッチSync
   - JobQueueでの進捗表示確認
   - Footerメッセージ通知確認

3. **エラーハンドリング**:
   - 無効なバケット名
   - 認証エラー
   - ネットワーク切断

### Edge Cases

- 同じ写真の再Sync（`storage_sync`で重複チェック、etagで変更検知）
- 非常に大きなファイル（100MB以上）→ マルチパートアップロード
- Sync中のアプリ終了 → JobQueueで管理、再起動後に再開可能

### Related Improvements

- **起動時のJobQueue通知**: 未完了のジョブがある場合、起動時にユーザーに通知する機能（別improvement #170として管理）

## UI Design

### Preferences - S3タブ

#### AWS S3選択時

```
┌─────────────────────────────────────────────────┐
│ S3 Backup                                       │
├─────────────────────────────────────────────────┤
│ ☑ Enable S3 Backup                              │
│                                                 │
│ ─── Storage Provider ───                        │
│                                                 │
│ Provider:                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Amazon S3                              ▼    │ │
│ │ ─────────────────────────────────────────── │ │
│ │ Amazon S3                                   │ │
│ │ MinIO                                       │ │
│ │ Wasabi                                      │ │
│ │ Cloudflare R2                               │ │
│ │ DigitalOcean Spaces                         │ │
│ │ Other (Custom Endpoint)                     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─── Storage Settings ───                        │
│                                                 │
│ Bucket URI:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ s3://my-bucket/photos/                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Region:                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ ap-northeast-1                        ▼     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─── Authentication ───                          │
│                                                 │
│ ○ Use AWS CLI credentials (~/.aws/credentials) │
│   Profile: ┌──────────────────────────────┐    │
│            │ default                   ▼  │    │
│            └──────────────────────────────┘    │
│                                                 │
│ ○ Enter Access Key manually                    │
│   Access Key ID:     [________________]        │
│   Secret Access Key: [________________]        │
│                                                 │
│ ○ Use IAM Role (EC2/ECS)                       │
│                                                 │
│ ─── Sync Options ───                            │
│                                                 │
│ ☑ Auto sync on import                          │
│                                                 │
│ ☑ Backup database (metadata, tags, edits)      │
│                                                 │
│ Max file size:                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ No limit                               ▼    │ │
│ │ ─────────────────────────────────────────── │ │
│ │ No limit                                    │ │
│ │ 50 MB                                       │ │
│ │ 100 MB                                      │ │
│ │ 200 MB                                      │ │
│ │ 500 MB                                      │ │
│ └─────────────────────────────────────────────┘ │
│ (Files larger than this will be skipped)       │
│                                                 │
│ ─── Sync Status ───                             │
│                                                 │
│ Total: 5,000 | Synced: 4,800 | Pending: 200    │
│ Last sync: 2024-01-15 10:30                    │
│                                                 │
│ [Test Connection]                               │
│                                                 │
│ Manual Sync:                                    │
│ [Incremental Sync]  [Full Sync]                 │
│                                                 │
│ • Incremental: last_sync_at以降の写真をSync     │
│ • Full: 未Syncの全写真をチェックしてSync        │
└─────────────────────────────────────────────────┘
```

#### S3互換ストレージ選択時（例: Wasabi）

```
┌─────────────────────────────────────────────────┐
│ S3 Backup                                       │
├─────────────────────────────────────────────────┤
│ ☑ Enable S3 Backup                              │
│                                                 │
│ ─── Storage Provider ───                        │
│                                                 │
│ Provider:                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ Wasabi                                 ▼    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─── Storage Settings ───                        │
│                                                 │
│ Endpoint: (auto-filled based on region)        │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://s3.ap-northeast-1.wasabisys.com     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Bucket URI:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ s3://my-wasabi-bucket/photos/               │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Region:                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ ap-northeast-1                        ▼     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─── Authentication ───                          │
│ (Wasabi credentials from dashboard)            │
│                                                 │
│ Access Key ID:                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ WASABI_ACCESS_KEY_ID                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Secret Access Key:                              │
│ ┌─────────────────────────────────────────────┐ │
│ │ ••••••••••••••••••••                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─── Sync Options ───                            │
│                                                 │
│ ☑ Sync edited photos (CSS applied)             │
│                                                 │
│ [Test Connection]  [Sync Now]                   │
│                                                 │
│ Status: ✓ Connected | Last sync: 2024-01-15    │
└─────────────────────────────────────────────────┘
```

#### Custom (Other) 選択時

```
┌─────────────────────────────────────────────────┐
│ ─── Storage Settings ───                        │
│                                                 │
│ Custom Endpoint:                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://minio.example.com:9000              │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Bucket URI:                                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ s3://my-bucket/photos/                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Region: (optional for some providers)          │
│ ┌─────────────────────────────────────────────┐ │
│ │ us-east-1                                   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ─── Authentication ───                          │
│                                                 │
│ Access Key ID:     [________________]          │
│ Secret Access Key: [________________]          │
└─────────────────────────────────────────────────┘
```

### Sync実行方法

S3 Syncは以下の3つの方法で実行可能:

#### 1. 自動同期（設定でON/OFF）

既存の`create_dependent_jobs`関数を拡張。Import完了時にThumbnail/CreateDbと同様にS3 Syncジョブを自動作成。

```rust
// src-tauri/src/domain_service/job_queue/executor.rs

fn create_dependent_jobs(
    db: &Arc<SQLite>,
    job_unit_id: &str,
    imported_files: Vec<String>,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    // 既存: Thumbnail job
    let thumbnail_job = job_queue::Job::new(...);

    // 既存: CreateDb job
    let create_db_job = job_queue::Job::new(...);

    // 追加: S3 Sync job (設定で有効な場合のみ)
    let state = app_handle.state::<crate::AppState>();
    if let Some(s3_config) = &state.config.s3 {
        if s3_config.enabled && s3_config.auto_sync {
            let s3_sync_job = job_queue::Job::new(
                job_unit_id.to_string(),
                job_queue::JobType::S3Sync,
                imported_files.clone(),
            );
            // ... queue the job
        }
    }
}
```

```
Import Job完了
    ↓
create_dependent_jobs() 呼び出し
    ↓
┌─────────────────────────────────────┐
│ 1. Thumbnail job 作成               │
│ 2. CreateDb job 作成                │
│ 3. S3 Sync job 作成 (auto_sync時)   │
└─────────────────────────────────────┘
```

#### 2. 手動実行（全体Sync）

Preferences > S3タブの「Sync Now」ボタンで全体Sync。

```
┌─────────────────────────────────────────────────┐
│ [Sync Now]                                      │
├─────────────────────────────────────────────────┤
│ Total photos: 5,000                             │
│ Already synced: 4,800                           │
│ To sync: 200 photos                             │
│                                                 │
│              [Cancel]  [Start Full Sync]        │
└─────────────────────────────────────────────────┘
```

#### 3. Maintenanceから日付単位でSync

Maintenance機能から特定の日付を選択してSync。

```
┌─────────────────────────────────────────────────┐
│ Maintenance - S3 Sync                           │
├─────────────────────────────────────────────────┤
│ Date: 2024-01-15                                │
│ Photos: 50                                      │
│ Synced: 45 | Not synced: 5                      │
│                                                 │
│ [Sync This Date]                                │
└─────────────────────────────────────────────────┘
```

### PhotoInfo - バックアップ情報表示

PhotoInfoタブ（写真詳細）にバックアップ状態を表示。URLは長いのでコピーボタンで対応。

```
┌─────────────────────────────────────────────────┐
│ Photo Info                                      │
├─────────────────────────────────────────────────┤
│ Filename: IMG_1234.jpg                          │
│ Date: 2024-01-15 10:30                          │
│ Size: 4.2 MB                                    │
│ Dimensions: 4032 x 3024                         │
│ Camera: iPhone 15 Pro                           │
│ ...                                             │
│                                                 │
│ ─── Cloud Backup ───                            │
│                                                 │
│ ☁️ AWS S3: ✓ Synced (2024-01-15)                │
│    📋 Copy URL                                  │
│                                                 │
│ ☁️ Wasabi: ✓ Synced (2024-01-15)                │
│    📋 Copy URL                                  │
│                                                 │
│ 📤 Google Photos: ✓ Uploaded                    │
│    📋 Copy URL                                  │
└─────────────────────────────────────────────────┘
```

**未同期の場合:**

```
│ ─── Cloud Backup ───                            │
│                                                 │
│ ☁️ AWS S3: ⏳ Not synced                         │
│                                                 │
│ 📤 Google Photos: - Not uploaded                │
```

**コピー時の動作:**
- クリックでクリップボードにURLをコピー
- Footer通知: "S3 URL copied to clipboard"

## Design Decisions

1. **Sync方式**:
   - **増分Sync**: `last_sync_at`以降にインポートされた写真のみ対象。自動Syncで使用。効率的。
   - **フルSync**: `storage_sync`がNULLの全写真をチェック。手動実行で漏れなく確認。
   - 自動Syncは全体がSync済みの前提で動作し、`last_sync_at`を更新
   - 何らかの問題でSyncできなかった場合も、次回以降の増分Syncで補完可能

2. **認証情報の保存場所**:
   - AWS CLIのcredentials (`~/.aws/credentials`) を優先使用
   - **Profile選択機能**: 複数profileがある場合は選択可能に
   - なければkeyringでAccess Key保存

3. **アップロード先のパス構造**:
   - **ローカル構造と同じ**: `s3://bucket/YYYY-MM-DD/[UUID]/filename`
   - PhotoCloveの内部構造 (`import_to/`) と一致させる

4. **同期モード**:
   - **ローカルとのSync**: ローカルにある写真をS3と同期
   - 一方向（ローカル → S3）だがsync方式
   - 既にS3にあるファイルはスキップ（差分同期）

5. **S3互換ストレージ対応**:
   - **対応する**: カスタムエンドポイント設定で対応
   - MinIO、Wasabi、Cloudflare R2、DigitalOcean Spacesなど

6. **バックアップ対象**:
   - **写真ファイル**: オリジナル写真のみ（CSS編集は非破壊）
   - **SQLite DB**: メタデータ、CSS編集情報、タグ、アルバム等を含む
   - DBバックアップは `s3://bucket/.photoclove/photoclove.db` に保存

## Implementation Phases

### Phase 1: 基盤構築
- Config拡張（S3Config構造体追加）
- DBマイグレーション（s3_url追加）
- AWS profile一覧取得コマンド (`list_aws_profiles`)

### Phase 2: バックエンド実装
- aws-sdk-s3統合
- S3Service実装（認証、アップロード、同期）
- カスタムエンドポイント対応（S3互換ストレージ）
- Tauriコマンド追加

### Phase 3: フロントエンド - 設定UI
- Preferences UI（S3タブ）
  - Bucket URI入力
  - Region選択
  - 認証方式選択
  - Profile選択ドロップダウン
  - カスタムエンドポイント入力
- 接続テスト機能

### Phase 4: Sync機能実装
- JobQueueにS3 Syncジョブ追加 (`JOB_TYPE_S3_SYNC`)
- 差分同期ロジック（既存ファイルスキップ）
- 編集済み写真の同期オプション
- Recovery Queue統合（エラー時）
- Footerメッセージでの進捗通知

### Phase 5: Sync実行方法
- **全体Sync**: Preferences > S3タブの「Sync Now」
- **自動Sync**: Import完了時に自動実行（設定でON/OFF）
- **日付単位Sync**: Maintenanceから日付選択してSync

### Phase 6: PhotoInfo表示
- PhotoInfoタブにバックアップ情報を表示
- 各プロバイダーのSync状態とURL表示

### Phase 7: 拡張機能
- Sync履歴・ログ表示
- S3上の写真一覧表示（将来）
