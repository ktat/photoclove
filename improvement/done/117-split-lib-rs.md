# Improvement 117: Split lib.rs into Command Modules

## 概要

`src-tauri/src/lib.rs` (3339行、86個の関数) を機能ごとの Tauri コマンドモジュールに分割し、コードの保守性と可読性を向上させる。

## 背景

現在の `lib.rs` は以下の問題を抱えている：

1. **ファイルサイズが大きすぎる**: 3339行、86個の関数が1ファイルに集中
2. **すべての Tauri コマンドが混在**: 写真、検索、コレクション、インポート、設定など
3. **責務が不明確**: どの関数がどの機能に属するか分かりにくい

## 目的

- Tauri コマンドを機能ごとにモジュール化
- ファイルサイズを適切に分割（各ファイル300-800行程度）
- コードの保守性と可読性を向上

## 実装方針

### ディレクトリ構造

```
src-tauri/src/
├── lib.rs                # アプリケーションエントリポイント (約300行)
├── commands/
│   ├── mod.rs           # コマンドモジュール定義
│   ├── photos.rs        # 写真関連コマンド (約800行)
│   ├── search.rs        # 検索コマンド (約400行)
│   ├── collections.rs   # コレクション/アルバム (約500行)
│   ├── import.rs        # インポート関連 (約500行)
│   ├── settings.rs      # 設定関連 (約300行)
│   ├── jobs.rs          # ジョブキュー (約300行)
│   └── image.rs         # 画像処理 (約300行)
└── state.rs             # アプリケーション状態 (約100行)
```

### 1. lib.rs (エントリポイント)

**内容**:
- Tauri アプリケーションの初期化
- 状態管理の初期化
- プラグイン設定
- コマンド登録

**行数**: 約300行

```rust
mod commands;
mod state;
// その他の既存モジュール

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(/* ... */)
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // commands モジュールから公開された関数を登録
            commands::photos::get_photos,
            commands::photos::get_photo_info,
            commands::search::search_photos,
            // ...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 2. state.rs (アプリケーション状態)

**内容**:
- `AppState` 構造体の定義
- 状態の初期化ロジック

**行数**: 約100行

```rust
pub struct AppState {
    pub config: Arc<Mutex<Config>>,
    pub repo_db: RepoDB,
    pub meta_db: MetaDB,
    pub google_photos: Arc<Mutex<GooglePhotos>>,
    pub job_queue: Arc<Mutex<JobQueue>>,
}

impl AppState {
    pub fn new() -> Self {
        // 初期化ロジック
    }
}
```

### 3. commands/mod.rs

**内容**:
- サブモジュールの定義と再エクスポート

```rust
pub mod photos;
pub mod search;
pub mod collections;
pub mod import;
pub mod settings;
pub mod jobs;
pub mod image;
```

### 4. commands/photos.rs (写真関連コマンド)

**内容**:
- 写真一覧取得
- 写真情報取得・更新
- スター・コメント操作
- 写真の削除・復元
- サムネイル生成

**行数**: 約800行

**主な関数**:
```rust
use crate::state::AppState;

#[tauri::command]
pub fn get_photos(
    date_str: &str,
    window: tauri::Window,
    state: tauri::State<AppState>
) -> String { ... }

#[tauri::command]
pub fn get_photo_info(
    path_str: &str,
    window: tauri::Window,
    state: tauri::State<AppState>
) -> String { ... }

#[tauri::command]
pub fn save_star(
    window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    star_num: i32
) { ... }

#[tauri::command]
pub fn save_comment(
    window: tauri::Window,
    state: tauri::State<AppState>,
    path_str: &str,
    comment_str: &str
) { ... }

#[tauri::command]
pub async fn delete_photos(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    paths: Vec<String>
) -> Result<(), String> { ... }

#[tauri::command]
pub async fn create_thumbnails(
    window: tauri::Window,
    state: tauri::State<'_, AppState>
) -> Result<(), String> { ... }

// ... 他の写真関連コマンド
```

### 5. commands/search.rs (検索コマンド)

**内容**:
- 高度な検索
- フィルタリング
- ソート

**行数**: 約400行

**主な関数**:
```rust
#[tauri::command]
pub fn search_photos_advanced(
    state: tauri::State<'_, AppState>,
    query: &str,
    search_type: &str,
    filters: &str,
    sort_field: &str,
    sort_order: &str
) -> Result<String, String> { ... }

#[tauri::command]
pub fn get_search_suggestions(
    state: tauri::State<'_, AppState>,
    query: &str
) -> Result<Vec<String>, String> { ... }

// ... 他の検索関連コマンド
```

### 6. commands/collections.rs (コレクション/アルバム)

**内容**:
- コレクション/アルバムの CRUD
- 写真の追加・削除
- タグ操作

**行数**: 約500行

**主な関数**:
```rust
#[tauri::command]
pub fn create_collection(
    state: tauri::State<'_, AppState>,
    collection_type: &str,
    name: &str,
    description: Option<&str>,
    color: Option<&str>
) -> Result<i32, String> { ... }

#[tauri::command]
pub fn get_all_collections(
    state: tauri::State<'_, AppState>,
    collection_type: Option<&str>
) -> Result<String, String> { ... }

#[tauri::command]
pub fn add_photo_to_collection(
    state: tauri::State<'_, AppState>,
    collection_id: i32,
    photo_path: &str
) -> Result<(), String> { ... }

// ... 他のコレクション関連コマンド
```

### 7. commands/import.rs (インポート関連)

**内容**:
- インポート処理
- インポート進捗管理
- ディレクトリ選択

**行数**: 約500行

**主な関数**:
```rust
#[tauri::command]
pub async fn import_photos(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    paths: Vec<String>
) -> Result<String, String> { ... }

#[tauri::command]
pub fn get_import_progress(
    state: tauri::State<'_, AppState>
) -> String { ... }

#[tauri::command]
pub fn select_import_directory(
    state: tauri::State<'_, AppState>
) -> Result<Vec<String>, String> { ... }

// ... 他のインポート関連コマンド
```

### 8. commands/settings.rs (設定関連)

**内容**:
- 設定の取得・保存
- 認証設定
- ログ設定

**行数**: 約300行

**主な関数**:
```rust
#[tauri::command]
pub fn get_config(state: tauri::State<AppState>) -> String { ... }

#[tauri::command]
pub fn save_config(
    state: tauri::State<AppState>,
    config: Config
) -> String { ... }

#[tauri::command]
pub async fn authenticate_google(
    state: tauri::State<'_, AppState>
) -> Result<String, String> { ... }

// ... 他の設定関連コマンド
```

### 9. commands/jobs.rs (ジョブキュー)

**内容**:
- ジョブの作成・管理
- ジョブ進捗監視

**行数**: 約300行

**主な関数**:
```rust
#[tauri::command]
pub fn create_job(
    state: tauri::State<'_, AppState>,
    job_type: &str,
    params: serde_json::Value
) -> Result<i64, String> { ... }

#[tauri::command]
pub fn get_all_jobs(
    state: tauri::State<'_, AppState>
) -> Result<String, String> { ... }

#[tauri::command]
pub fn get_job_progress(
    state: tauri::State<'_, AppState>,
    job_unit_id: &str
) -> Result<String, String> { ... }

// ... 他のジョブ関連コマンド
```

### 10. commands/image.rs (画像処理)

**内容**:
- 画像リサイズ
- EXIF データ取得
- サムネイル生成

**行数**: 約300行

**主な関数**:
```rust
#[tauri::command]
pub async fn get_resized_image(
    path_str: &str,
    width: u32,
    height: u32,
    import_directory: Option<String>,
    state: tauri::State<'_, AppState>
) -> Result<String, String> { ... }

#[tauri::command]
pub fn get_exif_data(
    path_str: &str
) -> Result<String, String> { ... }

// ... 他の画像処理関連コマンド
```

## 移行手順

### Phase 1: ディレクトリ構造の作成

1. `src-tauri/src/commands/` ディレクトリを作成
2. `mod.rs` とサブモジュールファイルを作成
3. `state.rs` を作成

### Phase 2: 関数の移動（段階的に実施）

1. **settings.rs の分離**（最も独立性が高い）
2. **jobs.rs の分離**
3. **collections.rs の分離**
4. **search.rs の分離**
5. **import.rs の分離**
6. **image.rs の分離**
7. **photos.rs の分離**
8. **lib.rs のクリーンアップ**

### Phase 3: テストと検証

1. `cargo check` で型チェック
2. `cargo build` でビルド確認
3. フロントエンドとの連携確認
4. 手動テストで動作確認

## 注意点

1. **Tauri コマンドの登録**
   - `lib.rs` の `invoke_handler` ですべてのコマンドを登録
   - パス指定は `commands::photos::get_photos` の形式

2. **状態の共有**
   - すべてのコマンドが `AppState` を使用
   - `state.rs` で一元管理

3. **段階的な実施**
   - 一度にすべてを変更せず、機能ごとに段階的に移動
   - 各段階でビルド・テストを実施

## 期待される効果

1. **可読性の向上**: 各ファイルが300-800行程度になり、ナビゲーションが容易
2. **保守性の向上**: 機能ごとに分離され、変更の影響範囲が明確
3. **開発効率の向上**: 関連するコードが集約され、開発が容易
4. **テスタビリティの向上**: 各モジュールを個別にテスト可能

## 参考

- Tauri コマンドシステム: https://tauri.app/v1/guides/features/command
- Rust モジュールシステム: https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html
