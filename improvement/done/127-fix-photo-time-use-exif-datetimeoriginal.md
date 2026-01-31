# 127: Fix Photo.time to Use EXIF DateTimeOriginal (Shot Time)

## 問題

`Photo.embed_exif()` が `exif.date_time` を使用していますが、写真の撮影時刻には `exif.date_time_original` を使用すべきです。

### EXIF標準の定義

- **DateTime**: 画像が最後に変更された日時（編集・保存時刻）
- **DateTimeOriginal**: 画像が撮影された日時（撮影時刻）

### 現在の実装

**ファイル**: `src-tauri/src/entity/photo.rs:74-77`

```rust
pub fn embed_exif(&mut self, exif: exif::ExifData) {
    self.time = exif.date_time.clone();  // ❌ 編集時刻を使用
    self.meta_data = exif;
    self.is_exif_not_loaded = false;
}
```

### 影響範囲

1. **Import処理**: 写真のインポート先の日付フォルダ決定に使用（`import.rs:87`）
   - 編集済み写真の場合、編集日でフォルダ分けされてしまう

2. **PhotoMeta.photo_time()**: データベース保存時に使用（`photo_meta.rs:186, 188`）
   - ただし、データベースには `exif_date_time_original` も正しく保存されている

3. **created_date()系メソッド**: Photo.timeを基に日付を生成（`photo.rs:221, 227`）

### データベースは正しい

- データベースには `exif_date_time` と `exif_date_time_original` の両方が正しく保存されています（`metadata.rs:109-110`）
- 検索・ソート機能は `exif_date_time_original` を使用しているため、正しく動作します（`search.rs:217`）

### フォールバック処理の考慮

**ファイル**: `src-tauri/src/value/exif.rs:60-63`

EXIF解析が失敗した場合、ファイル作成日時から `date_time` のみが設定され、`date_time_original` は空文字列のままになります。

```rust
if !exif_data.is_ok() {
    let file_created_time = file.created_datetime();
    let re = regex::Regex::new(r"^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})").unwrap();
    data.date_time = re.replace(&file_created_time, "$1/$2/$3").to_string();
    // date_time_original は空文字列のまま
}
```

## 解決策

2つの修正が必要です。

### 1. EXIF解析失敗時のフォールバック（重要）

**ファイル**: `src-tauri/src/value/exif.rs:60-63`

**現在の実装**:
```rust
if !exif_data.is_ok() {
    let file_created_time = file.created_datetime();
    let re = regex::Regex::new(r"^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})").unwrap();
    data.date_time = re.replace(&file_created_time, "$1/$2/$3").to_string();
    // ❌ date_time_original は空のまま
}
```

**修正後**:
```rust
if !exif_data.is_ok() {
    let file_created_time = file.created_datetime();
    let re = regex::Regex::new(r"^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})").unwrap();
    let formatted_time = re.replace(&file_created_time, "$1/$2/$3").to_string();
    data.date_time = formatted_time.clone();
    data.date_time_original = formatted_time;  // ✅ 同じ値を設定
}
```

### 2. Photo.embed_exif()の修正

**ファイル**: `src-tauri/src/entity/photo.rs:74-77`

```rust
pub fn embed_exif(&mut self, exif: exif::ExifData) {
    // Prefer date_time_original (shot time) over date_time (modification time)
    self.time = if !exif.date_time_original.is_empty() {
        exif.date_time_original.clone()
    } else {
        exif.date_time.clone()
    };
    self.meta_data = exif;
    self.is_exif_not_loaded = false;
}
```

## メリット

1. **正確な撮影時刻**: 写真が編集されていても、撮影時刻で管理される
2. **正確なインポート**: 撮影日に基づいた正しい日付フォルダにインポートされる
3. **フォールバック**: EXIFがない場合でも、ファイル作成日時が使用される
4. **データ整合性**: `exif_date_time_original`が常に値を持つため、ソート・検索が安定する

## データベースの現状確認

```sql
SELECT path, exif_date_time, exif_date_time_original FROM photo_metadata LIMIT 2;

-- 結果:
-- .../ChatGPT Image....png|2025/12/12 22:50:38|
-- .../photoclove.png|2025/12/12 22:50:38|
```

→ `exif_date_time_original`が空！PNGファイルでEXIF解析が失敗し、date_time_originalが設定されていない。

## テスト観点

1. ✅ 通常の写真: DateTimeOriginalがある場合、それが使用される
2. ✅ 編集済み写真: DateTimeとDateTimeOriginalが異なる場合、DateTimeOriginalが優先される
3. ✅ EXIFなし写真: EXIF解析失敗時も、date_time_originalにファイル作成日時が設定される
4. ✅ PNG/EXIFなしファイル: date_time_originalがファイル作成日時で埋められる
5. ✅ インポート処理: 撮影日に基づいた正しいフォルダにインポートされる
6. ✅ ソート機能: exif_date_time_originalが常に値を持つため、安定して動作する
