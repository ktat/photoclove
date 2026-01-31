# サムネイルの向き補正（Thumbnail Orientation Correction）

## Overview

サムネイル画像がEXIFのOrientation情報と一致しない向きで表示される問題に対応する。
OS（特にLinux vs Windows）によってサムネイルの向き処理が異なるため、MetadataのOrientationを使用してCSS transformで向きを補正するオプション機能を追加する。

## User Impact

- **対象ユーザー**: Linuxユーザー、またはサムネイルが正しい向きで表示されないユーザー
- **改善点**: カメラの縦位置撮影など、本来の向きでサムネイルを表示できるようになる
- **解決する問題**: OS依存のサムネイル表示の不整合

## Influence on Existing Features

### Compatibility

- 既存機能への影響: なし（オプション設定のため、デフォルトOFFで後方互換性維持）
- Migration: 不要
- 既存のCSS Style（PhotoEditor）との関係: サムネイル表示のみに適用、編集プレビューには影響しない

### Related Features

- **PhotosList** (`src/App/PhotosList.jsx`): GridViewでのサムネイル表示
- **PhotosListMini** (`src/App/PhotosList/PhotosListMini.jsx`): ミニビューでのサムネイル表示
- **PhotoInfo** (`src/App/PhotosList/PhotoOption/PhotoInfo.jsx`): EXIF Orientationの表示（参照のみ）
- **Preferences** (`src/App/Preferences.jsx`): 設定画面
- **ExifData** (`src-tauri/src/value/exif.rs`): Orientation情報の取得元

## Implementation Approach

### Architecture

#### EXIF Orientation値とCSS transformのマッピング

EXIF Orientationは1-8の値を取る:

| Orientation | 説明 | CSS Transform |
|-------------|------|---------------|
| 1 | 正常 | なし |
| 2 | 左右反転 | `scaleX(-1)` |
| 3 | 180度回転 | `rotate(180deg)` |
| 4 | 上下反転 | `scaleY(-1)` |
| 5 | 左90度回転 + 左右反転 | `rotate(90deg) scaleX(-1)` |
| 6 | 右90度回転 | `rotate(90deg)` |
| 7 | 右90度回転 + 左右反転 | `rotate(-90deg) scaleX(-1)` |
| 8 | 左90度回転 | `rotate(-90deg)` |

### Source Code Changes

**Frontend**:

1. `src/App/Preferences.jsx`
   - Thumbnailタブに「Orientation補正を有効にする」Switchを追加
   - 設定値: `thumbnail_orientation_correction: boolean`

2. `src/App/PhotosList.jsx`
   - 写真のexif.orientationに応じてCSS transformを適用するユーティリティ関数を追加
   - GridView表示時にtransformを適用

3. `src/App/PhotosList/PhotosListMini.jsx`
   - 同様にOrientation補正を適用

4. `src/utils/orientationUtils.js` (新規作成)
   - Orientation値からCSS transformを返すユーティリティ関数

**Backend**:

1. `src-tauri/src/entity/config.rs`
   - `thumbnail_orientation_correction: bool` フィールドを追加

2. `src-tauri/src/repository/meta_db/sqlite/mod.rs` または config保存処理
   - 新しい設定値の保存・読み込み対応

**Database**:
- Schema変更: なし（configはYAMLファイルで管理）

## Dependencies & Risks

### External Dependencies
- 追加なし

### Performance
- CSS transformは軽量なため、パフォーマンスへの影響は最小限
- 補正が必要な画像のみにtransformを適用

### Security
- リスクなし（読み取り専用のメタデータを使用）

## Testing Strategy

### Manual Testing
1. 縦位置で撮影された写真をインポート
2. 設定でOrientation補正をONにする
3. GridView（PhotosList）で正しい向きで表示されることを確認
4. PhotosListMiniで正しい向きで表示されることを確認
5. 設定をOFFにして、元の表示に戻ることを確認

### Edge Cases
- Orientation情報がない写真（transform適用しない）
- 既にローテーション済みの写真
- 動画ファイル（対象外）

### 重要な考慮事項: PhotoEditor CSSとの合成

**前提**: PhotoEditorで設定したCSS（`transform: rotate(90deg)`等）はサムネイル表示にも適用される。
Orientation補正も`transform`を使用するため、両方の値を合算してCSSを生成する必要がある。

例:
- EXIF Orientation 6 → `rotate(90deg)` が必要
- PhotoEditorでユーザーが `rotate(90deg)` を設定済み
- 合算 → `rotate(180deg)` として適用

**実装方針**:
1. Orientation補正の角度を計算（0, 90, 180, 270度 + scaleX/scaleY）
2. PhotoEditor CSSから回転角度を取得（`parseCssToEditorValues`を利用可能）
3. 両方を合算して最終的なtransformを生成

**注意点**:
- `scaleX(-1)`（左右反転）はPhotoEditorの`rotate`とは別に処理が必要
- Orientation 2, 4, 5, 7 は反転を含むため、反転の合成も考慮する

**実装時の確認箇所**:
- `src/App/PhotosList/PhotoCard.jsx:241` - `parseCssStyle(photo.cssStyle)`
- `src/App/PhotosList/PhotosListMini.jsx:750` - `parseCssStyle(v.cssStyle)`
- `src/App/PhotosList/PhotoOption/PhotoEditor/cssUtils.js` - `parseCssToEditorValues`（既存の回転値抽出ロジック）

## Design Decisions

1. **PhotoEditor（編集画面）**: 適用しない（不要）
2. **デフォルト値**: OFF（既存の挙動を維持）
3. **PhotoViewerモード（全画面表示）**: 適用しない（大きい写真表示では問題なし）

→ **対象はサムネイル表示（GridView, PhotosListMini）のみ**

## 補足: 現在のOrientation関連実装

既にExif情報からOrientationを取得する実装は存在する:
- `src-tauri/src/value/exif.rs`: `orientation` フィールドで値を保持
- `src/App/PhotosList/PhotoOption/PhotoInfo.jsx`: PhotoInfoでOrientationを表示

この機能はOrientationの「取得」は既存実装を利用し、「表示への反映」を新たに追加するもの。
