# Improvement 116: Split sqlite.rs into Multiple Modules

## 概要

`src-tauri/src/repository/meta_db/sqlite.rs` (3433行) を機能ごとに複数のモジュールに分割し、コードの保守性と可読性を向上させる。

## 背景

現在の `sqlite.rs` は以下の問題を抱えている：

1. **ファイルサイズが大きすぎる**: 3433行は1ファイルとして大きすぎ、ナビゲーションが困難
2. **複数の責務が混在**: DB基本操作、メタデータ、ジョブキュー、コレクション、検索など
3. **impl ブロックが分散**: 3つの `impl SQLite` ブロックが存在し、構造が分かりにくい

## 目的

- ファイルサイズを適切に分割（各ファイル500-1000行程度）
- 機能ごとにモジュールを分離し、責務を明確化
- コードの保守性と可読性を向上

## 実装方針

### ディレクトリ構造

```
src-tauri/src/repository/meta_db/
├── mod.rs                 # モジュール定義
├── sqlite.rs             # 基本DB操作 (約600行)
├── migration.rs          # マイグレーション処理 (約400行)
├── migrations/           # SQL スキーマファイル
│   ├── schema.sql           # 基本スキーマ定義
│   ├── indexes.sql          # インデックス定義
│   └── README.md            # マイグレーション管理の説明
├── metadata.rs           # 写真メタデータ操作 (約1200行)
├── job_queue.rs          # ジョブキュー操作 (約400行)
├── collections.rs        # コレクション/アルバム操作 (約600行)
└── search.rs             # 検索機能 (約500行)
```

### 1. mod.rs の作成

```rust
mod sqlite;
mod migration;
mod metadata;
mod job_queue;
mod collections;
mod search;

pub use sqlite::SQLite;
```

### 2. sqlite.rs (基本DB操作)

**内容**:
- `SQLite` 構造体の定義
- `new()` コンストラクタ（migration.rs の `init_db()` を呼び出す）
- DB接続管理 (`get_connection()`)
- 基本的なクエリ実行
- 日付関連の操作 (`get_available_dates()`, `update_date_summary_for_date()`)
- トラッシュ操作 (`delete_photo_permanently_no_summary()`, `restore_photo_from_trash_no_summary()`)

**行数**: 約600行（init_db の移動により削減）

### 3. migration.rs (マイグレーション処理)

**内容**:
- `init_db()` 関数（全テーブルの初期化とマイグレーション）
- スキーマバージョン管理
- テーブル存在チェックとCREATE TABLE処理
- カラム追加などのスキーマ変更
- データマイグレーション処理
- インデックス作成

**行数**: 約400行

**実装方法**:
```rust
use super::sqlite::SQLite;
use rusqlite::{Connection, Result};

// SQL スキーマを別ファイルから読み込む
const SCHEMA_SQL: &str = include_str!("migrations/schema.sql");
const INDEXES_SQL: &str = include_str!("migrations/indexes.sql");

impl SQLite {
    /// データベースを初期化し、必要なマイグレーションを実行
    pub fn init_db(&self) -> Result<()> {
        let conn = self.get_connection()?;

        // 基本テーブルのマイグレーション
        self.migrate_photo_metadata_table(&conn)?;
        self.migrate_date_summary_table(&conn)?;
        self.migrate_collections_tables(&conn)?;
        self.migrate_job_queue_tables(&conn)?;

        Ok(())
    }

    /// photo_metadata テーブルのマイグレーション
    fn migrate_photo_metadata_table(&self, conn: &Connection) -> Result<()> {
        // テーブル存在チェック
        let table_exists = self.check_table_exists(conn, "photo_metadata")?;

        if table_exists {
            // カラム存在チェックとマイグレーション
            self.add_column_if_not_exists(conn, "photo_metadata", "created_at", "TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'")?;
            self.add_column_if_not_exists(conn, "photo_metadata", "updated_at", "TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'")?;
            // ... 他のカラム追加
        } else {
            // 新規作成
            conn.execute_batch(SCHEMA_SQL)?;
            conn.execute_batch(INDEXES_SQL)?;
        }

        Ok(())
    }

    /// date_summary テーブルのマイグレーション
    fn migrate_date_summary_table(&self, conn: &Connection) -> Result<()> {
        // ...
    }

    /// collections テーブルのマイグレーション
    fn migrate_collections_tables(&self, conn: &Connection) -> Result<()> {
        // photo_collections と photo_collection_items テーブルの作成
        // ...
    }

    /// job queue テーブルのマイグレーション
    fn migrate_job_queue_tables(&self, conn: &Connection) -> Result<()> {
        // job_unit と job_queue テーブルの作成
        // ...
    }

    /// テーブルが存在するかチェック
    fn check_table_exists(&self, conn: &Connection, table_name: &str) -> Result<bool> {
        conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
            .and_then(|mut stmt| {
                stmt.query_row([table_name], |row| {
                    let _name: String = row.get(0)?;
                    Ok(true)
                })
            })
            .or(Ok(false))
    }

    /// カラムが存在しない場合に追加
    fn add_column_if_not_exists(&self, conn: &Connection, table: &str, column: &str, definition: &str) -> Result<()> {
        // PRAGMA table_info でカラム存在確認
        // 存在しない場合は ALTER TABLE ADD COLUMN
        // ...
    }
}
```

### 4. migrations/ (SQL スキーマファイル)

**migrations/schema.sql** (基本スキーマ定義):
```sql
-- Photo metadata table
CREATE TABLE IF NOT EXISTS photo_metadata (
    path TEXT PRIMARY KEY,
    photo_date TEXT NOT NULL,
    star INTEGER NOT NULL DEFAULT 0,
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
    updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
    google_photos_url TEXT,
    exif_iso TEXT,
    exif_fnumber TEXT,
    exif_date_time TEXT,
    exif_date_time_original TEXT,
    exif_lens_model TEXT,
    exif_make TEXT,
    exif_lens_make TEXT,
    exif_model TEXT,
    exif_xresolution TEXT,
    exif_yresolution TEXT,
    exif_resolution_unit TEXT,
    exif_copyright TEXT,
    exif_exposure_time TEXT,
    exif_shutter_speed_value TEXT,
    exif_focal_length TEXT,
    exif_focal_length_in35mm_film TEXT,
    exif_digital_zoom_ratio TEXT,
    exif_exposure_mode TEXT,
    exif_white_balance_mode TEXT,
    exif_orientation TEXT,
    css_style TEXT,
    delete_flg INTEGER NOT NULL DEFAULT 0
);

-- Date summary table
CREATE TABLE IF NOT EXISTS date_summary (
    date TEXT PRIMARY KEY,
    photo_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00',
    updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'
);

-- Collections table (unified albums/tags)
CREATE TABLE IF NOT EXISTS photo_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('album', 'tag')),
    name TEXT NOT NULL,
    color TEXT,
    description TEXT,
    cover_photo_path TEXT,
    settings TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type),
    FOREIGN KEY (cover_photo_path) REFERENCES photo_metadata(path) ON DELETE SET NULL
);

-- Collection items table
CREATE TABLE IF NOT EXISTS photo_collection_items (
    collection_id INTEGER,
    photo_path TEXT,
    order_index INTEGER DEFAULT 0,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT DEFAULT '{}',
    PRIMARY KEY (collection_id, photo_path),
    FOREIGN KEY (collection_id) REFERENCES photo_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_path) REFERENCES photo_metadata(path) ON DELETE CASCADE
);

-- Job queue tables
CREATE TABLE IF NOT EXISTS job_unit (
    id TEXT PRIMARY KEY,
    jobs TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_unit_id TEXT NOT NULL,
    job TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT,
    FOREIGN KEY(job_unit_id) REFERENCES job_unit(id)
);
```

**migrations/indexes.sql** (インデックス定義):
```sql
-- Photo metadata indexes
CREATE INDEX IF NOT EXISTS idx_photo_date ON photo_metadata(photo_date);
CREATE INDEX IF NOT EXISTS idx_exif_date_time_original ON photo_metadata(exif_date_time_original);
CREATE INDEX IF NOT EXISTS idx_star ON photo_metadata(star);
CREATE INDEX IF NOT EXISTS idx_photo_metadata_delete_flg ON photo_metadata(delete_flg);
CREATE INDEX IF NOT EXISTS idx_photo_date_delete_flg ON photo_metadata(photo_date, delete_flg);
CREATE INDEX IF NOT EXISTS idx_search_composite ON photo_metadata(exif_date_time_original, star, photo_date);

-- Date summary indexes
CREATE INDEX IF NOT EXISTS idx_date_summary_date ON date_summary(date);

-- Collections indexes
CREATE INDEX IF NOT EXISTS idx_collections_type ON photo_collections(type);
CREATE INDEX IF NOT EXISTS idx_collections_name ON photo_collections(name);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON photo_collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_photo_path ON photo_collection_items(photo_path);
CREATE INDEX IF NOT EXISTS idx_collection_items_order ON photo_collection_items(collection_id, order_index);

-- Job queue indexes
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_unit_id ON job_queue(job_unit_id);
```

**migrations/README.md** (マイグレーション管理の説明):
```markdown
# Database Migrations

## Overview

This directory contains SQL schema definitions for PhotoClove database.

## Files

- `schema.sql`: Base table definitions
- `indexes.sql`: Index definitions for query optimization

## Migration Strategy

1. **New installations**: All tables and indexes are created from SQL files
2. **Existing installations**: `migration.rs` checks for table/column existence and adds missing elements
3. **Schema changes**: Add new migration logic to `migration.rs`

## Adding New Tables

1. Add CREATE TABLE statement to `schema.sql`
2. Add related indexes to `indexes.sql`
3. Add migration logic to `migration.rs` (`migrate_*_table()` function)
4. Test on both fresh and existing databases

## Adding New Columns

1. Add column to table definition in `schema.sql`
2. Add migration logic to `migration.rs` (`add_column_if_not_exists()`)
3. Test migration on existing database with old schema
```

### 5. metadata.rs (写真メタデータ操作)

**内容**:
- `impl MetaInfoDB for SQLite` の実装
- 写真メタデータの保存・取得
- スター・コメント操作
- EXIF データ操作
- タグ操作 (`get_tags_for_photo()`, `remove_all_tags_from_photo()`)
- Google Photos URL、CSS スタイル保存

**行数**: 約1200行

**実装方法**:
```rust
use super::sqlite::SQLite;

impl crate::repository::MetaInfoDB for SQLite {
    // 既存の MetaInfoDB 実装をここに移動
}

impl SQLite {
    // メタデータ関連の追加メソッド
    pub fn get_photo_created_at(&self, photo: &photo::Photo) -> String { ... }
    pub fn save_google_photos_url(&self, photo_path: &str, url: &str) -> Result<(), String> { ... }
    // ...
}
```

### 6. job_queue.rs (ジョブキュー操作)

**内容**:
- ジョブキューの CRUD 操作
- `create_job()`, `get_pending_jobs()`, `update_job_status()`
- ジョブユニット操作
- ジョブ進捗管理
- クリーンアップ処理

**行数**: 約400行

**実装方法**:
```rust
use super::sqlite::SQLite;

impl SQLite {
    pub fn create_job_unit(&self, job_unit: &crate::entity::job_queue::JobUnit) -> Result<(), String> { ... }
    pub fn create_job(&self, queued_job: &crate::entity::job_queue::QueuedJob) -> Result<i64, String> { ... }
    pub fn get_pending_jobs(&self) -> Result<Vec<crate::entity::job_queue::QueuedJob>, String> { ... }
    // ...
}
```

### 7. collections.rs (コレクション/アルバム操作)

**内容**:
- コレクションの CRUD 操作
- アルバム操作
- タグ操作（コレクション関連）
- 写真とコレクションの関連付け
- 並び替え操作

**行数**: 約600行

**実装方法**:
```rust
use super::sqlite::SQLite;

impl SQLite {
    pub fn create_collection(&self, collection_type: &str, name: &str, description: Option<&str>, color: Option<&str>) -> Result<i32, String> { ... }
    pub fn get_all_collections(&self, collection_type: Option<&str>, config: config::Config) -> Result<Vec<serde_json::Value>, String> { ... }
    pub fn add_photo_to_collection(&self, collection_id: i32, photo_path: &str) -> Result<(), String> { ... }
    // ...
}
```

### 8. search.rs (検索機能)

**内容**:
- 高度な検索機能 (`search_photos()`)
- フィルタリング処理
- ソート処理
- 検索結果の集計

**行数**: 約500行

**実装方法**:
```rust
use super::sqlite::SQLite;

impl SQLite {
    pub fn search_photos(
        &self,
        query: &str,
        search_type: &str,
        filters: &str,
        sort_field: &str,
        sort_order: &str,
        max_photos_per_fetch: u32
    ) -> Result<String, String> { ... }

    // 検索ヘルパー関数
    fn build_search_query(...) -> String { ... }
    fn apply_filters(...) { ... }
}
```

## 移行手順

### Phase 1: モジュール構造の作成

1. `src-tauri/src/repository/meta_db/` ディレクトリに新規ファイルを作成
2. `mod.rs` でモジュールを定義
3. 各ファイルに基本構造を作成

### Phase 2: 機能の移動（段階的に実施）

1. **migrations/ ディレクトリの作成とSQL分離**
   - `migrations/schema.sql` を作成（CREATE TABLE 文を移動）
   - `migrations/indexes.sql` を作成（CREATE INDEX 文を移動）
   - `migrations/README.md` を作成

2. **migration.rs の分離**（マイグレーション処理を分離）
   - `init_db()` 関数を移動
   - テーブル存在チェック、カラム追加ロジックを移動
   - SQL ファイルを `include_str!()` で読み込み

3. **job_queue.rs の分離**（最も独立性が高い）

4. **collections.rs の分離**

5. **search.rs の分離**

6. **metadata.rs の分離**

7. **sqlite.rs のクリーンアップ**

### Phase 3: テストと検証

1. `cargo check` で型チェック
2. `cargo build` でビルド確認
3. 既存のテストが通ることを確認
4. 手動テストで動作確認

## 注意点

1. **公開 API の維持**
   - `pub use sqlite::SQLite;` で外部からのアクセスを維持
   - 既存のコードに影響を与えない

2. **循環参照の回避**
   - すべてのモジュールが `SQLite` 構造体を使用するが、相互参照しない
   - 必要に応じてヘルパー関数を別モジュールに

3. **段階的な実施**
   - 一度にすべてを変更せず、機能ごとに段階的に移動
   - 各段階でビルド・テストを実施

## 期待される効果

1. **可読性の向上**: 各ファイルが500-1000行程度になり、ナビゲーションが容易
2. **保守性の向上**: 機能ごとに分離され、変更の影響範囲が明確
3. **テスタビリティの向上**: 各モジュールを個別にテスト可能
4. **開発効率の向上**: 関連するコードが集約され、開発が容易

## 参考

- Rust モジュールシステム: https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
- DDD（Domain-Driven Design）の原則に基づいた責務分離

---

## 実装ステータス (2025-12-12)

### 完了した作業

#### Phase 1: migrations/ ディレクトリ作成 ✅
- `migrations/schema.sql` 作成（全テーブル定義）
- `migrations/indexes.sql` 作成（全インデックス定義）
- `migrations/README.md` 作成（マイグレーション管理ドキュメント）

#### Phase 2: モジュール分離 ✅
1. **migration.rs** (452行) - Commit: `bb9dd79`
   - `init_db()` 関数を sqlite.rs から移動
   - SQL ファイルを `include_str!()` で読み込み
   - テーブル・カラム存在チェックロジック実装
   - マイグレーション関数: migrate_photo_metadata_table, migrate_date_summary_table, migrate_collections_tables, migrate_delete_flg_column, migrate_job_queue_tables

2. **job_queue.rs** (340行) - Commit: `906e433`
   - 12個のジョブキュー関連関数を抽出
   - 抽出した関数: create_job_unit, create_job, get_pending_jobs, update_job_status, get_job_unit_progress, update_job_unit_status_if_complete, cleanup_completed_jobs, get_jobs_for_unit, reset_running_jobs_to_pending, get_all_jobs, delete_job, delete_job_unit

3. **collections.rs** (427行) - Commit: `7d58f2c`
   - 13個のコレクション/タグ関連関数を抽出
   - 抽出した関数: remove_all_tags_from_photo, get_tags_for_photo, get_photos_with_tags, get_album_photos, get_album_photos_with_metadata, reorder_album_photos, create_collection, get_all_collections, update_collection, delete_collection, add_photo_to_collection, remove_photo_from_collection, get_collection_photos

4. **search.rs** (597行) - Commit: `e871b19`
   - 5個の検索関連関数を抽出
   - 抽出した関数: search_photos, add_advanced_filters, get_camera_options, get_lens_options, get_extension_options
   - 高度な検索機能とフィルタリングロジックを含む

5. **metadata.rs** (935行) - Commit: `bf145f1`
   - MetaInfoDB トレイト実装全体を抽出
   - 写真メタデータのCRUD操作
   - EXIF データ管理、スター・コメント操作、削除・復元機能
   - sqlite.rs の4つのヘルパーメソッドを pub(super) に変更してアクセス可能に

#### ファイルサイズの推移
- **開始時**: 3433行 (migration.rs抽出前)
- **migration.rs抽出後**: 2820行 (-613行, 18%削減)
- **job_queue.rs抽出後**: 2500行 (-320行, 11%削減)
- **collections.rs抽出後**: 2096行 (-403行, 16%削減)
- **search.rs抽出後**: 1513行 (-583行, 28%削減)
- **metadata.rs抽出後**: 590行 (-923行, 61%削減)
- **総削減**: 2843行 (元の83%を削減)

### Phase 2 完了 ✅

すべてのモジュール抽出が完了しました：
- ✅ migration.rs (452行)
- ✅ job_queue.rs (340行)
- ✅ collections.rs (427行)
- ✅ search.rs (597行)
- ✅ metadata.rs (935行)

**最終結果**: sqlite.rs は 3433行 → 590行 に削減（83%削減）

### 次のステップ

#### Phase 3: 最終検証とクリーンアップ
1. **コードレビュー**
   - 各モジュールの責務が適切に分離されているか確認
   - 重複コードがないか確認

2. **ドキュメント更新**
   - README.md の更新（必要に応じて）
   - コードコメントの追加・修正

3. **最終検証**
   - `cargo check` && `cargo build` による検証
   - 全機能の動作確認

### 検証ステータス
- ✅ Phase 1: 完了（migrations/ ディレクトリ作成）
- ✅ Phase 2: 完了（全5モジュール抽出完了）
- ✅ cargo check: 成功（エラーなし、警告94件は既存のもの）
- ✅ 全コミットが improvement-116-split-sqlite-rs ブランチに記録済み

keep context
