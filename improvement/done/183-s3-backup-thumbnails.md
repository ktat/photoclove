# S3 Backup Thumbnails (S3バックアップにサムネイル含める)

## Overview

S3バックアップ機能に`thumbnail_store`ディレクトリのサムネイルを含める。現在は写真（`import_to`）とデータベースのみがバックアップ対象だが、サムネイルもバックアップすることで、リストア時に再生成の手間を省く。

## User Impact

### Who benefits?
- S3バックアップを使用するユーザー
- 複数デバイス間で同期したいユーザー
- ディザスタリカバリを重視するユーザー

### How does it improve their workflow?
- リストア後すぐにサムネイル表示が可能（再生成不要）
- 新規デバイスでのセットアップ時間短縮
- 完全なバックアップによる安心感

### What pain points does it solve?
- リストア後にサムネイル再生成が必要（大量の写真がある場合、時間がかかる）
- サムネイルがないと一時的にUIが遅くなる
- バックアップが不完全という不安

## Influence on Existing Features

### Compatibility
- 既存機能との互換性：✅ 完全互換
- `backup_thumbnails`オプションで有効/無効を選択可能
- デフォルトは有効（推奨）

### Related Features
- **S3Config** (`src-tauri/src/entity/config.rs`) - S3設定
- **S3Commands** (`src-tauri/src/commands/s3_commands.rs`) - S3操作コマンド
- **S3Service** (`src-tauri/src/domain_service/s3_service.rs`) - S3アップロードロジック
- **thumbnail_store** - サムネイル保存先設定

## Implementation Approach

### Architecture

#### バックアップ構造
```
S3バケット/
├── photos/           # import_to からコピー
│   └── YYYY/MM/DD/photo.jpg
├── thumbnails/       # thumbnail_store からコピー（新規）
│   ├── YYYY/MM/DD/photo.jpg
│   └── faces/
│       └── {face_id}.jpg
├── db/               # データベース（backup_db有効時）
│   └── photoclove.db
└── manifest.json     # バックアップメタデータ
```

### Source Code Changes

**Backend**:

| File | Changes |
|------|---------|
| `src-tauri/src/entity/config.rs` | `S3Config`に`backup_thumbnails: bool`追加 |
| `src-tauri/src/commands/s3_commands.rs` | サムネイルSync処理追加 |
| `src-tauri/src/domain_service/s3_service.rs` | サムネイルアップロードロジック |

**Frontend**:

| File | Changes |
|------|---------|
| `src/App/Preferences/S3BackupSection.jsx` | "Backup Thumbnails"チェックボックス追加 |

### Config変更

```rust
// S3Config に追加
pub struct S3Config {
    // ... existing fields ...

    /// Backup thumbnail directory
    #[serde(default = "default_backup_thumbnails")]
    pub backup_thumbnails: bool,
}

fn default_backup_thumbnails() -> bool {
    true  // デフォルト有効
}
```

### 同期ロジック

```rust
// サムネイル同期の流れ
1. 写真のパスから対応するサムネイルパスを計算
2. サムネイルが存在する場合のみアップロード
3. S3キー: thumbnails/{relative_path}
```

## Dependencies & Risks

### Performance
- **ストレージ使用量増加**: サムネイルは元画像の5-10%程度のサイズ
- **同期時間増加**: 写真数に比例して増加するが、サムネイルは小さいため影響は限定的
- **帯域使用量**: 初回フルバックアップ時は増加

### 推定サイズ
| 項目 | サイズ/枚 | 10,000枚の場合 |
|------|-----------|----------------|
| 写真（元） | 5MB | 50GB |
| サムネイル | 50KB | 500MB (+1%) |
| 顔サムネイル | 15KB × 顔数 | 150MB (10,000顔) |

## Testing Strategy

### Manual Testing
1. `backup_thumbnails: true`で S3 Full Sync実行
2. S3バケットに`thumbnails/`ディレクトリが作成されることを確認
3. リストア後、サムネイルが正しく復元されることを確認
4. `backup_thumbnails: false`で同期時、サムネイルがスキップされることを確認

### Edge Cases
- サムネイルが存在しない写真
- 顔サムネイル（`faces/`ディレクトリ）の同期
- 部分的なリストア（写真のみ / サムネイルのみ）

## Implementation Phases

### Phase 1: 基本実装
- [ ] `S3Config`に`backup_thumbnails`フィールド追加
- [ ] Preferences UIにチェックボックス追加
- [ ] 写真サムネイルのS3アップロード

### Phase 2: 顔サムネイル対応
- [ ] `faces/`ディレクトリのバックアップ
- [ ] リストアコマンドの実装

### Phase 3: 差分同期
- [ ] サムネイルの差分検出（ハッシュ比較またはタイムスタンプ）
- [ ] 増分バックアップの最適化

## Design Decisions

1. **デフォルト有効**: サムネイルは重要なキャッシュなので、デフォルトでバックアップ
2. **オプション提供**: ストレージ節約したいユーザー向けにオフにできる
3. **写真と連動**: 写真がバックアップされる時にサムネイルも一緒にアップロード

---

## 関連ドキュメント

- `improvement/177-s3-backup-feature.md` - S3バックアップ機能
- `improvement/pending/182-face-thumbnail-cache.md` - 顔サムネイルキャッシュ
