# Face Thumbnail Cache (顔サムネイルキャッシュ)

## Overview

顔検出時に、検出された顔領域を事前にcropした画像を保存しておく機能。現在は表示のたびに元画像から動的にcropしているため、Unknown顔一覧のように大量の顔を表示する際にパフォーマンスが低下する問題を解決する。

## User Impact

### Who benefits?
- 大量の顔を持つフォトライブラリを管理するユーザー
- Unknown Faces一覧を頻繁に使用するユーザー
- 低スペックマシンを使用するユーザー

### How does it improve their workflow?
- 顔一覧の表示が高速化（元画像のfetch/decode/crop → 小さなJPEGの読み込み）
- スクロール時のカクつきが解消
- メモリ使用量の削減（元画像全体をメモリに展開しない）

### What pain points does it solve?
- Unknown顔一覧で数百の顔を表示する際の重さ
- 無限スクロールでの遅延ロード時のラグ
- 大きな元画像（10MB+のRAW/JPEG）から毎回cropする非効率さ

## Influence on Existing Features

### Compatibility
- 既存機能との互換性：✅ 完全互換
- キャッシュがない場合は現在の動的crop方式にフォールバック
- 既存の顔データのマイグレーション不要（キャッシュは段階的に生成可能）

### Related Features
- **FaceThumbnail** (`src/components/FaceThumbnail.jsx`) - 現在の動的crop表示
- **FacesList** (`src/App/PhotosList/FacesList.jsx`) - 人物一覧
- **UnknownFacesList** (`src/App/PhotosList/UnknownFacesList.jsx`) - Unknown顔一覧
- **FaceDetectionService** (`src-tauri/src/domain_service/face_detection/`) - 顔検出処理

## Implementation Approach

### Architecture

#### 保存場所
既存の`thumbnail_store`設定を使用（デフォルト: `~/.photoclove/thumbnail/`）：
```
{thumbnail_store}/
├── YYYY/MM/DD/photo.jpg      # 既存の写真サムネイル
└── faces/
    └── {face_id}.jpg         # 顔サムネイル（新規）
```

**メリット**:
- 設定変更時に一貫して動作
- 既存のサムネイル管理と統一
- バックアップ時に一緒に含まれる

#### データフロー
```
顔検出時:
1. 元画像から顔を検出
2. 各顔のbbox領域をcrop（正方形、padding 20%）
3. 150x150pxにリサイズ
4. JPEGで保存（品質85%）
   保存先: {thumbnail_store}/faces/{face_id}.jpg

表示時:
1. face_idからパスを導出: {thumbnail_store}/faces/{face_id}.jpg
2. ファイルが存在 → キャッシュ画像を読み込み
3. ファイルがない → 従来の動的crop（フォールバック）
```

**注**: `thumbnail_path`はDBに保存しない。`face_id`から導出可能なため。

### Source Code Changes

**Frontend**:

| File | Changes |
|------|---------|
| `src/components/FaceThumbnail.jsx` | `faceId`を受け取り、キャッシュ画像を優先使用 |

```jsx
// FaceThumbnail.jsx - 変更イメージ
function FaceThumbnail({ faceId, photoPath, bbox, size, borderRadius }) {
    // faceIdがあればキャッシュパスを導出
    // パスはバックエンドから取得した thumbnail_store を使用
    const cachePath = faceId ? `${thumbnailStore}/faces/${faceId}.jpg` : null;

    // キャッシュが存在すればそれを使用
    if (cachePath && cacheExists) {
        return <img src={convertFileSrc(cachePath)} ... />;
    }
    // なければ従来の動的crop
    return <canvas ...>;
}
```

**Backend**:

| File | Changes |
|------|---------|
| `src-tauri/src/domain_service/face_detection/service.rs` | `crop_and_save_thumbnail()` 関数追加 |
| `src-tauri/src/domain_service/face_detection/thumbnail.rs` (新規) | サムネイル生成ロジック |
| `src-tauri/src/commands/face_detection_commands.rs` | `regenerate_face_thumbnails` コマンド追加 |

**Database**:
- スキーマ変更なし
- `face_id`からパスを導出: `{thumbnail_store}/faces/{face_id}.jpg`

### 新規Tauriコマンド

```rust
// 1. 既存の顔のサムネイルを一括生成（バックグラウンドジョブ）
#[tauri::command]
pub fn regenerate_face_thumbnails(
    state: State<AppState>,
    face_ids: Option<Vec<i64>>, // None = 全ての顔
) -> Result<i32, String>  // 生成された数を返す

// 2. 単一の顔のサムネイルパスを取得（キャッシュなければ生成）
#[tauri::command]
pub fn get_or_create_face_thumbnail(
    state: State<AppState>,
    face_id: i64,
) -> Result<String, String>  // サムネイルのパスを返す
```

### サムネイル仕様

| 項目 | 値 |
|------|-----|
| サイズ | 設定可能（デフォルト: 150px、正方形） |
| 形式 | JPEG |
| 品質 | 85% |
| 余白 | bbox周囲20%のpadding |
| ファイルサイズ | 約10-20KB/顔（150pxの場合） |

### 設定項目（FaceDetectionConfig）

```rust
pub struct FaceDetectionConfig {
    // ... existing fields ...

    /// Face thumbnail size in pixels (default: 150)
    #[serde(default = "default_face_thumbnail_size")]
    pub face_thumbnail_size: u32,
}

fn default_face_thumbnail_size() -> u32 {
    150
}
```

### Job Queue連携

サムネイル再生成はJob Queueで実行：

```rust
// JobType に追加
pub enum JobType {
    // ... existing types ...
    FaceThumbnailRegenerate,  // 顔サムネイル再生成
}
```

**フロー**:
1. Preferencesで `face_thumbnail_size` を変更
2. 「Regenerate Face Thumbnails」ボタンをクリック
3. Job Queueにジョブ登録
4. バックグラウンドで全顔サムネイルを再生成

## Dependencies & Risks

### External Dependencies
- **image** crate - 既に使用中（cropとリサイズ）
- 新規crateは不要

### Performance

**メリット**:
- 顔一覧表示: 10倍以上高速化（20MBの元画像 → 15KBのJPEG）
- メモリ使用量: 大幅削減（元画像全体をデコードしない）
- スクロール体験: スムーズなローディング

**デメリット**:
- ストレージ使用量: 約15KB × 顔の数（1000顔で約15MB）
- 顔検出処理時間: 若干増加（crop+保存処理）

### Security
- ファイルパス: サニタイズ済み（face_idベースの命名）
- 書き込み先: アプリのキャッシュディレクトリのみ

## Testing Strategy

### Manual Testing
1. 顔検出を実行 → キャッシュディレクトリにファイル生成確認
2. FacesList/UnknownFacesListで表示 → キャッシュ画像が使用されていることを確認
3. キャッシュファイルを削除 → フォールバック動作確認
4. 大量の顔（100+）でスクロールパフォーマンス比較

### Edge Cases
- 元画像が削除された場合のサムネイル表示
- キャッシュディレクトリへの書き込み権限がない場合
- ディスク容量不足時のエラーハンドリング

## Implementation Phases

### Phase 1: 基本実装
- [ ] `thumbnail.rs` モジュール作成（crop + save ロジック）
- [ ] 顔検出時の自動サムネイル生成（`{thumbnail_store}/faces/{face_id}.jpg`）
- [ ] `FaceThumbnail.jsx` のキャッシュ対応（`faceId` propsでパス導出）

### Phase 2: 設定 + 再生成機能
- [ ] `FaceDetectionConfig`に`face_thumbnail_size`追加
- [ ] Preferencesにサイズ設定UI追加
- [ ] 「Regenerate Face Thumbnails」ボタン追加
- [ ] `FaceThumbnailRegenerate` Job Type追加
- [ ] Job Queueでのバックグラウンド再生成

### Phase 3: 最適化（オプション）
- [ ] サムネイルサイズの設定可能化
- [ ] WebP形式対応（さらなる容量削減）
- [ ] キャッシュクリーンアップ機能

## Design Decisions

1. **サイズ設定可能（デフォルト150px）**: 大画面ユーザーは200px等に変更可能
2. **JPEG形式**: 互換性が高く、品質/サイズのバランスが良い
3. **face_idベースのファイル名**: 一意性保証、DBにパス保存不要
4. **thumbnail_store配下**: 既存のサムネイル管理と統一、設定変更に追従
5. **Job Queue再生成**: サイズ変更後は明示的にボタン押下で再生成

## Open Questions

（すべて解決済み）

---

## 関連ドキュメント

- `improvement/pending/181-unknown-faces-management.md` - Unknown顔管理（この機能が恩恵を受ける）
- `src-tauri/src/domain_service/face_detection/` - 顔検出サービス
