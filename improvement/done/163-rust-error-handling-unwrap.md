# Rustエラーハンドリング: unwrap/expect の問題

## 概要

Rustコードにおける `.unwrap()` や `.expect()` の不適切な使用は、予期せぬパニックを引き起こし、アプリケーションのクラッシュにつながります。

本ドキュメントでは、発見された問題箇所と適切なエラーハンドリングへの修正方法を記載します。

**重要度**: Medium（静的パターンは安全、動的データ処理部分のみ注意）
**対応優先度**: Medium
**依存**: `164-recovery-queue.md` を先に実装すること（エラー時の受け皿が必要）

---

## 問題の分類

| カテゴリ | 件数 | 重要度 | 備考 |
|---------|------|--------|------|
| Regex コンパイルでの unwrap | 15+ | **対応不要** | 静的パターンのみ、外部入力なし |
| キャプチャグループでのチェーン unwrap | 6+ | MEDIUM | 入力データ依存 |
| パス操作での unwrap | 5+ | MEDIUM | エッジケースで問題の可能性 |
| Option/Result での unwrap | 8+ | LOW | if let で改善可能 |

---

## 第1部: Regex コンパイルのパニック（対応不要）

### 問題箇所一覧

| ファイル | 行番号 |
|---------|--------|
| `src-tauri/src/value/file.rs` | 116, 131 |
| `src-tauri/src/value/date.rs` | 154-155, 212 |
| `src-tauri/src/value/exif.rs` | 62, 212 |
| `src-tauri/src/entity/photo.rs` | 101, 117, 156, 159, 240, 247 |
| `src-tauri/src/domain_service/repository_dir_service.rs` | 7 |
| `src-tauri/src/domain_service/thumbnail_service.rs` | 15 |
| `src-tauri/src/domain_service/photo_service.rs` | 67 |
| `src-tauri/src/repository/dir.rs` | 42, 78 |

### 問題のコード例

```rust
// file.rs:116
let re = Regex::new(r"pattern").unwrap();
```

### 考慮事項: 静的パターンは実質安全

PhotoCloveのRegexパターンはすべてコード内にハードコードされた**静的パターン**です。

| パターンの種類 | リスク | 理由 |
|---------------|--------|------|
| 静的パターン（ハードコード） | **LOW** | 開発/テスト時に不正なら即パニックで発見。本番で突然パニックしない |
| 動的パターン（外部入力） | HIGH | 予期せぬ入力でパニックの可能性 |

**結論**:
- 静的パターンの`unwrap()`は許容される
- `lazy_static`/`once_cell`への移行は**パフォーマンス最適化**として検討（毎回コンパイルしない）
- 対応優先度: **LOW**

### 修正方法（パフォーマンス最適化として検討）

**lazy_static または once_cell を使用**

```rust
use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    static ref DATE_PATTERN: Regex = Regex::new(
        r"(\d{4})[/-](\d{2})[/-](\d{2})"
    ).expect("DATE_PATTERN regex is invalid");

    static ref TIME_PATTERN: Regex = Regex::new(
        r"(\d{2}):(\d{2}):(\d{2})"
    ).expect("TIME_PATTERN regex is invalid");
}

// 使用時
if let Some(captures) = DATE_PATTERN.captures(input) {
    // ...
}
```

**代替: once_cell を使用**

```rust
use once_cell::sync::Lazy;
use regex::Regex;

static DATE_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(\d{4})[/-](\d{2})[/-](\d{2})")
        .expect("DATE_PATTERN regex is invalid")
});
```

**利点**:
- コンパイル時に近い形でパターンを検証（起動時に一度だけ実行）
- パニック時のエラーメッセージが明確
- 毎回コンパイルしないためパフォーマンス向上

---

## 第2部: キャプチャグループでのチェーン unwrap

### 問題箇所一覧

| ファイル | 行番号 | 対応方針 |
|---------|--------|----------|
| `src-tauri/src/value/file.rs` | 120-122, 135-137 | エラーハンドリング改善 |
| `src-tauri/src/domain_service/dir_service.rs` | 75-77 | **対応済み** (`unwrap_or(0)` 使用) |
| `src-tauri/src/domain_service/job_queue/handlers/import.rs` | 88-104 | **ロジック削除** |

---

### import.rs: ファイル名からの日付抽出ロジック（削除対象）

**対応方針**: unwrap 修正ではなく、**ロジック自体を削除**

#### 現状のコード（88-104行目）

```rust
// Pattern for filenames like IMG_20250710_xxxxxx.jpg
if let Some(captures) = Regex::new(r"(\d{4})(\d{2})(\d{2})")
    .unwrap()
    .captures(&filename)
{
    let year = captures.get(1).unwrap().as_str().parse::<i32>().unwrap();
    let month = captures.get(2).unwrap().as_str().parse::<u32>().unwrap();
    let day = captures.get(3).unwrap().as_str().parse::<u32>().unwrap();
    // ...
}
```

#### 削除理由

1. **汎用性の問題**: `IMG_20250710_...` のようなファイル名パターンは一部のスマホ/カメラでしか使われない
2. **情報の欠落**: 日付のみで時間情報が取得できない
3. **既存のフォールバック**: ファイルの更新日時を使うフォールバックが既に存在する（106-123行目）

#### 修正方針

EXIFデータがない場合は、ファイル名パターンを試さずに直接ファイルの作成/更新日時を使用する。

```rust
// 修正後: EXIFがない場合は直接ファイルの日時を使用
let date = if !photo.time().is_empty() {
    photo.created_date()
} else {
    // ファイルの更新日時を使用（ファイル名パターンは試さない）
    let metadata = std::fs::metadata(file_path)
        .map_err(|e| format!("Cannot get file metadata: {}", e))?;
    let modified = metadata
        .modified()
        .map_err(|e| format!("Cannot get file modification time: {}", e))?;
    let datetime = chrono::DateTime::<chrono::Utc>::from(modified);

    crate::value::date::Date::new(datetime.year(), datetime.month(), datetime.day())
        .ok_or_else(|| "Failed to create date from file modification time".to_string())?
};
```

---

### file.rs, dir_service.rs: エラーハンドリング改善

#### 問題のコード例

```rust
// file.rs:120-122
let year = captures.get(1).unwrap().as_str().parse::<i32>().unwrap();
let month = captures.get(2).unwrap().as_str().parse::<u32>().unwrap();
let day = captures.get(3).unwrap().as_str().parse::<u32>().unwrap();
```

#### リスク

1. `captures.get(n)` が `None` を返す可能性
   - 正規表現のマッチに失敗した場合
   - キャプチャグループの数が想定と異なる場合

2. `parse()` が `Err` を返す可能性
   - 数値以外の文字列がマッチした場合
   - 整数の範囲外の値の場合

#### エラー時の挙動

- **スキップして続行**: パース失敗時はその処理をスキップし、`None` または `Err` を返す
- ログに記録して呼び出し元で適切に処理

#### 修正方法

**オプション1: 明示的なエラーハンドリング（推奨）**

```rust
fn parse_date_from_captures(
    captures: &regex::Captures
) -> Result<(i32, u32, u32), String> {
    let year = captures.get(1)
        .ok_or("Year capture group not found")?
        .as_str()
        .parse::<i32>()
        .map_err(|e| format!("Invalid year: {}", e))?;

    let month = captures.get(2)
        .ok_or("Month capture group not found")?
        .as_str()
        .parse::<u32>()
        .map_err(|e| format!("Invalid month: {}", e))?;

    let day = captures.get(3)
        .ok_or("Day capture group not found")?
        .as_str()
        .parse::<u32>()
        .map_err(|e| format!("Invalid day: {}", e))?;

    Ok((year, month, day))
}
```

**オプション2: and_then チェーン**

```rust
fn parse_date_from_captures(
    captures: &regex::Captures
) -> Option<(i32, u32, u32)> {
    let year = captures.get(1)
        .and_then(|m| m.as_str().parse::<i32>().ok())?;
    let month = captures.get(2)
        .and_then(|m| m.as_str().parse::<u32>().ok())?;
    let day = captures.get(3)
        .and_then(|m| m.as_str().parse::<u32>().ok())?;

    Some((year, month, day))
}
```

**オプション3: ? 演算子を使用した簡潔な形式**

```rust
fn parse_date_from_filename(filename: &str) -> Option<NaiveDate> {
    let captures = DATE_PATTERN.captures(filename)?;

    let year: i32 = captures.get(1)?.as_str().parse().ok()?;
    let month: u32 = captures.get(2)?.as_str().parse().ok()?;
    let day: u32 = captures.get(3)?.as_str().parse().ok()?;

    NaiveDate::from_ymd_opt(year, month, day)
}
```

---

## 第3部: パス操作での危険な unwrap

### 問題箇所

**ファイル**: `src-tauri/src/domain_service/file_service.rs`
**行**: 17, 48, 78

### 呼び出し箇所

`file_service.rs` は `trash_commands.rs` から呼び出されている：

| 関数 | 呼び出し箇所 | 用途 |
|------|-------------|------|
| `move_to_trash` | 54行目 | 写真をゴミ箱へ移動 |
| `restore_from_trash` | 138行目 | ゴミ箱から復元 |
| `remove_from_trash_permanently` | 224行目, 299行目 | 完全削除 |

**呼び出し側のエラーハンドリング**: 既に `match` や `is_ok()` で適切に処理されている

```rust
// trash_commands.rs:54
match file_service::move_to_trash(file, trash.clone()) {
    Ok(_) => { /* 成功時: DB更新、カウント減少 */ }
    Err(e) => { /* 失敗時: ログ出力、失敗カウント、スキップ */ }
}

// trash_commands.rs:299
if file_service::remove_from_trash_permanently(file, trash).is_ok() {
    /* 成功時のみ処理、失敗時はスキップ */
}
```

**結論**: `file_service.rs` が `Err` を返せば、呼び出し側でスキップして次のファイルに進む設計。
現状の unwrap でパニックすると、1ファイルの問題で処理全体がクラッシュしてしまう。

### 問題のコード例

```rust
// file_service.rs:17
let parent_path = target_file.parent().unwrap().strip_prefix("/").unwrap();
```

### リスク

1. `parent()` が `None` を返す可能性
   - ルートディレクトリの場合
   - 相対パスで親がない場合

2. `strip_prefix()` が `Err` を返す可能性
   - パスがプレフィックスで始まらない場合
   - Windows パスで "/" が存在しない場合

### 修正方法

```rust
fn get_relative_parent(target_file: &Path) -> Result<PathBuf, std::io::Error> {
    let parent = target_file.parent()
        .ok_or_else(|| std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Cannot get parent directory"
        ))?;

    parent.strip_prefix("/")
        .map(|p| p.to_path_buf())
        .map_err(|e| std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Path strip prefix failed: {}", e)
        ))
}

// 使用時
let parent_path = get_relative_parent(&target_file)?;
```

**クロスプラットフォーム対応版**:

```rust
fn get_relative_parent(target_file: &Path) -> Option<PathBuf> {
    let parent = target_file.parent()?;

    // Windowsの場合はプレフィックス処理が異なる
    #[cfg(windows)]
    {
        // Windows固有の処理
        Some(parent.to_path_buf())
    }

    #[cfg(not(windows))]
    {
        parent.strip_prefix("/")
            .map(|p| p.to_path_buf())
            .ok()
            .or_else(|| Some(parent.to_path_buf()))
    }
}
```

---

## 第4部: Option/Result での不適切な unwrap

### 問題箇所

**ファイル**: `src-tauri/src/repository/db/directory.rs`
**行**: 104-107
**関数**: `get_photos_in_date` - 指定日付の写真一覧を取得

### 問題のコード例

```rust
let mut conf: config::Config = config::Config::template();
let has_opt = opt_conf.is_some();
if has_opt {
    conf = opt_conf.unwrap();
}
```

### 呼び出し箇所

| 呼び出し元 | 渡す値 | 用途 |
|-----------|-------|------|
| `commands/photo_handlers/date.rs:51` | `Some(ctx.config.clone())` | 日付で写真を取得するコマンド |
| `directory.rs:447` | `Option::None` | 次の写真を取得 |
| `directory.rs:490` | `Option::None` | 前の写真を取得 |

### リスク評価

**実際のパニックリスク: 低い**
- `is_some()` でチェック後に `unwrap()` しているので論理的にはパニックしない
- `None` の場合は `config::Config::template()` がフォールバックとして使われる

**ただし**: Rust のイディオムとしては `if let` を使うべき（コード品質の問題）

### 修正方法

```rust
// 改善案1: if let（推奨）
let conf = if let Some(c) = opt_conf {
    c
} else {
    config::Config::template()
};

// 改善案2: unwrap_or_else
let conf = opt_conf.unwrap_or_else(config::Config::template);
```

---

## エラーハンドリングのベストプラクティス

### 1. Result 型を積極的に使用

```rust
// 良い例
fn process_photo(path: &str) -> Result<Photo, PhotoError> {
    let file = File::open(path)?;
    let metadata = file.metadata()?;
    // ...
}

// 悪い例
fn process_photo(path: &str) -> Photo {
    let file = File::open(path).unwrap(); // パニックの可能性
    // ...
}
```

### 2. カスタムエラー型の定義

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum PhotoError {
    #[error("Failed to read file: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Invalid date format in filename: {0}")]
    InvalidDateFormat(String),

    #[error("Regex capture group not found: {0}")]
    CaptureNotFound(String),
}
```

### 3. ? 演算子の活用

```rust
// 簡潔なエラー伝播
fn load_photo_metadata(path: &str) -> Result<Metadata, PhotoError> {
    let content = fs::read_to_string(path)?;
    let parsed = serde_json::from_str(&content)?;
    Ok(parsed)
}
```

---

## 対応チェックリスト

### 中優先度（コード品質向上）

- [ ] `import.rs` のファイル名日付抽出ロジックを削除（88-104行目）→ ファイル更新日時のみ使用
- [ ] `file_service.rs` のパス操作 unwrap を修正（エラー時: `Err` を返す）
- [ ] `file.rs` のキャプチャグループ unwrap を修正（エラー時: `None` を返す）
- [ ] `directory.rs` の Option unwrap を if let に変更（エラー時: デフォルト値を使用）

### 対応済み

- [x] `dir_service.rs` のキャプチャグループ → `unwrap_or(0)` で対応済み

### 対応不要

- [x] Regex パターンの unwrap → 静的パターンのみ、外部入力なし（code-reviewスキルに記録済み）

### 将来検討

- [ ] カスタムエラー型の導入を検討
- [ ] エラーハンドリングパターンの統一

---

## エラー時挙動まとめ

| 箇所 | エラー時の挙動 | 理由 | 状態 |
|------|---------------|------|------|
| `import.rs` 日付抽出 | ロジック削除 | ファイル名パターンは汎用的でない | 未対応 |
| `file_service.rs` パス操作 | `Err` を返す | 呼び出し元で適切にハンドリング | 未対応 |
| `dir_service.rs` キャプチャ | `unwrap_or(0)` でフォールバック | 1ファイルの失敗で全体を止めない | **対応済み** |
| `file.rs` キャプチャ | `None` を返す | 呼び出し元でフォールバック処理 | 未対応 |
| `directory.rs` Option | デフォルト値 | 設定がなければデフォルトで動作 | 未対応 |

### 確認コマンド

```bash
# unwrap 使用箇所を検索
grep -rn "\.unwrap()" src-tauri/src/ --include="*.rs"

# expect 使用箇所を検索
grep -rn "\.expect(" src-tauri/src/ --include="*.rs"
```

---

*作成日: 2025-01-13*
*元ファイル: 2026-01-13-code-review.md*
