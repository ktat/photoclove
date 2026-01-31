# Editor: Exif保存・形式統一の修正

## Overview

Save as Copy時にExif情報が失われる問題、およびDownloadとSaveで保存形式が異なる問題を修正する。

## 問題一覧

| 優先度 | ファイル | 行 | 問題 |
|--------|----------|-----|------|
| 🟡 | photoExportUtils.js | 185, 207 | Download(PNG)とSave(JPEG)の形式不統一 |
| 🟡 | photoExportUtils.js, style_commands.rs | 91-105, 111-121 | Exif情報喪失 |

## 問題詳細

### 🟡 問題1: 保存形式の不統一

**ファイル**: `photoExportUtils.js`

```javascript
// Download: PNG (L185)
}, 'image/png');

// Save as Copy: JPEG (L207)
const base64Data = await canvasToBase64(canvas, 'image/jpeg', 0.95);
```

**問題**: 同じ編集でも出力形式が異なる

### 🟡 問題2: Exif情報の完全喪失

**原因1 - フロントエンド**: `photoExportUtils.js:91-105`

```javascript
canvas.toBlob(function(blob) {
    // Canvas.toBlob() はピクセルデータのみ出力
    // Exif情報は含まれない（Canvas APIの仕様）
}, mimeType, quality);
```

**原因2 - バックエンド**: `style_commands.rs:111-121`

```rust
// フロントエンドから受け取ったbase64をそのまま保存
let image_bytes = general_purpose::STANDARD.decode(image_data)?;
fs::write(&new_path, image_bytes)?;  // ← Exifなしのデータ

// 新しいファイルからExif読み取り（空になる）
new_photo.load_exif();
```

**失われる情報**:
- 撮影日時 (DateTimeOriginal)
- カメラ機種 (Make, Model)
- レンズ情報
- 露出設定 (シャッタースピード, 絞り, ISO)
- GPS位置情報
- 向き (Orientation)

## 修正方針

### Exif保存の実装

**バックエンド修正** (`style_commands.rs`):

```rust
use rexiv2::Metadata;  // または kamadak-exif

pub async fn save_styled_copy_from_frontend(
    original_photo_path: &str,
    css_style: &str,
    image_data: &str,
    rotate: i32,  // 追加: 回転角度
    state: tauri::State<'_, AppState>,
) -> Result<String, String> {
    // ... 既存のファイル保存処理 ...

    // 元画像からExifを読み取り
    let original_metadata = Metadata::new_from_path(original_photo_path)
        .map_err(|e| format!("Failed to read original EXIF: {}", e))?;

    // 新しいファイルにExifを書き込み
    let new_metadata = Metadata::new_from_path(&new_path)
        .map_err(|e| format!("Failed to open new file for EXIF: {}", e))?;

    // Exifタグをコピー（Orientation以外）
    copy_exif_tags(&original_metadata, &new_metadata)?;

    // Orientationを更新（回転後の状態に）
    let new_orientation = calculate_orientation(rotate);
    new_metadata.set_tag_numeric("Exif.Image.Orientation", new_orientation)?;

    new_metadata.save_to_file(&new_path)?;

    // ...
}
```

### 保存形式の統一

**Option A**: 元画像の形式を維持（推奨）

```javascript
// photoExportUtils.js
const originalFormat = getImageFormat(photoPath); // jpg, png, etc.
const mimeType = originalFormat === 'png' ? 'image/png' : 'image/jpeg';
```

**Option B**: 常にJPEG

```javascript
// Download も JPEG に統一
canvas.toBlob(callback, 'image/jpeg', 0.95);
```

### 修正箇所

**バックエンド**:
1. `Cargo.toml`: `rexiv2` クレート追加
2. `style_commands.rs`: Exifコピー処理追加
3. `style_commands.rs`: Orientation更新処理追加

**フロントエンド**:
1. `photoExportUtils.js`: 保存形式を統一
2. `photoExportUtils.js`: rotate値をバックエンドに送信

## Dependencies

### 新規依存クレート

```toml
# Cargo.toml
[dependencies]
rexiv2 = "0.10"  # Exif読み書き
# または
kamadak-exif = "0.5"  # 読み取り専用（軽量）
```

**注意**: `rexiv2` は `gexiv2` ライブラリに依存（システム依存）

## Testing Strategy

- [ ] Save as Copy → 保存された画像にExifが含まれる
- [ ] 撮影日時が元画像と一致
- [ ] カメラ情報が元画像と一致
- [ ] GPS情報が元画像と一致（存在する場合）
- [ ] 90度回転 → Orientation が更新される
- [ ] Download と Save as Copy で形式が一致

## Open Questions

1. **保存形式**: PNG統一かJPEG統一か、ユーザー選択か？
   - 推奨: 元画像の形式を維持

2. **Exifライブラリ選択**: `rexiv2` vs `kamadak-exif`？
   - `rexiv2`: 読み書き可能、システム依存あり
   - `kamadak-exif`: 読み取り専用、純Rust
   - 推奨: `rexiv2`（書き込みが必要なため）

3. **GPS情報の扱い**: プライバシー考慮で削除オプションを追加するか？
   - 将来的な改善として検討
