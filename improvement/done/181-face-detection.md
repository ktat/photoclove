# Face Detection Feature

## Status: In Progress

## 採用モデル: InsightFace

| 用途 | モデル | サイズ | 備考 |
|------|--------|--------|------|
| 顔検出 | SCRFD-10G | ~30MB | 高速・高精度 |
| 顔埋め込み | ArcFace-R50 | ~120MB | 512次元、業界標準 |

## Overview

写真内の顔を自動検出し、人物のタグ付け・グループ化を行う機能。既存のAI Auto-Tagging機能を拡張し、顔認識による人物管理を実現する。

## User Impact

### 対象ユーザー
- 家族写真を管理するユーザー
- イベント・結婚式などの写真を整理するフォトグラファー
- 人物ベースで写真を検索したいユーザー

### 解決する課題
- 特定の人物が写っている写真を手動で探す手間
- 人物ごとの写真整理の困難さ
- 大量の写真から特定の人物を見つける時間

### ワークフロー改善
1. インポート時に自動で顔を検出
2. 検出した顔をクラスタリング（同一人物をグループ化）
3. ユーザーが各クラスターに名前を付与
4. 人物名で写真を検索・フィルタリング

## Influence on Existing Features

### Compatibility
- **AI Auto-Tagging**: 拡張として統合可能（既存のタグ機能を活用）
- **Tag System**: 人物タグとして既存のタグシステムを利用可能
- **Search**: 人物名での検索を追加
- **Albums**: 人物ベースの自動アルバム生成が可能に

### Related Features
| Feature | Interaction |
|---------|-------------|
| AITaggingService | 顔検出をタギングパイプラインに統合 |
| TagCloudView | 人物タグの表示 |
| AdvancedSearch | 人物フィルター追加 |
| PhotoInfo | 検出された顔情報の表示 |

## Implementation Approach

### Phase 1: 顔検出 (Face Detection)
- 写真内の顔の位置（バウンディングボックス）を検出
- モデル候補:
  - **BlazeFace** (TensorFlow Lite) - 軽量・高速
  - **MTCNN** - 高精度
  - **RetinaFace** - 最高精度（重い）
  - **ONNX版 SCRFD** - バランス良好

### Phase 2: 顔埋め込み (Face Embedding)
- 検出した顔から特徴ベクトルを抽出
- モデル候補:
  - **FaceNet** - 128次元埋め込み
  - **ArcFace** - 512次元、高精度
  - **InsightFace** - ArcFaceベース、ONNX対応

### Phase 3: クラスタリング
- 顔埋め込みを使用して同一人物をグループ化
- アルゴリズム:
  - DBSCAN (密度ベース)
  - Chinese Whispers (グラフベース)

### Phase 4: 人物管理UI
- 検出された顔のレビュー・修正
- 人物への名前付け
- 誤検出の修正

## Architecture

### DDD Entities
```
entity/
├── face.rs           # Face (検出された顔)
├── person.rs         # Person (人物エンティティ)
└── face_cluster.rs   # FaceCluster (クラスタリング結果)
```

### Database Schema
```sql
-- 検出された顔
CREATE TABLE detected_faces (
    id INTEGER PRIMARY KEY,
    photo_path TEXT NOT NULL,
    bbox_x REAL NOT NULL,      -- バウンディングボックス
    bbox_y REAL NOT NULL,
    bbox_width REAL NOT NULL,
    bbox_height REAL NOT NULL,
    confidence REAL NOT NULL,
    embedding BLOB,            -- 顔埋め込みベクトル
    person_id INTEGER,         -- 紐付けられた人物
    created_at TEXT NOT NULL,
    FOREIGN KEY (photo_path) REFERENCES photo_metadata(file_path),
    FOREIGN KEY (person_id) REFERENCES persons(id)
);

-- 人物マスター
CREATE TABLE persons (
    id INTEGER PRIMARY KEY,
    name TEXT,                 -- ユーザーが付けた名前
    representative_face_id INTEGER,  -- 代表的な顔
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_faces_photo ON detected_faces(photo_path);
CREATE INDEX idx_faces_person ON detected_faces(person_id);
```

### Source Code Changes

**Frontend**:
- `src/App/PhotosList/PhotoOption/FaceInfo.jsx` - 顔検出結果の表示
- `src/App/Preferences/tabs/FaceDetectionTab.jsx` - 顔検出設定
- `src/App/PersonManager.jsx` - 人物管理画面
- `src/components/FaceOverlay.jsx` - 写真上の顔位置表示

**Backend**:
- `src-tauri/src/domain_service/face_detection/` - 顔検出サービス
  - `mod.rs`
  - `detector.rs` - 顔検出
  - `embedder.rs` - 顔埋め込み
  - `clusterer.rs` - クラスタリング
- `src-tauri/src/entity/face.rs` - 顔エンティティ
- `src-tauri/src/entity/person.rs` - 人物エンティティ
- `src-tauri/src/commands/face_commands.rs` - Tauriコマンド
- `src-tauri/src/repository/meta_db/sqlite/faces.rs` - DB操作

**Job Types**:
- `FaceDetection` - 顔検出ジョブ
- `FaceEmbedding` - 埋め込み生成ジョブ
- `FaceClustering` - クラスタリングジョブ

## Dependencies & Risks

### External Dependencies

**Rust Crates**:
```toml
# ONNX Runtime (既存)
ort = "2.0"

# 画像処理 (既存)
image = "0.24"

# クラスタリング
linfa = "0.7"
linfa-clustering = "0.7"
```

**Models** (src-tauri/models/):
- `scrfd_10g.onnx` (~30MB) - 顔検出
- `arcface_r100.onnx` (~250MB) - 顔埋め込み

### Performance
- 顔検出: ~50-100ms/画像
- 埋め込み生成: ~20-50ms/顔
- 大量の写真では初回処理に時間がかかる
- バックグラウンドジョブで非同期処理

### Privacy
- 顔データはローカルにのみ保存
- クラウド送信なし
- 顔埋め込みは元の顔画像を復元不可能

## Open Questions

1. **モデル選択**
   - 精度 vs 速度のトレードオフ
   - BlazeFace（高速）vs RetinaFace（高精度）

2. **クラスタリングタイミング**
   - インポート時に毎回？
   - 手動トリガー？
   - 閾値ベースで自動？

3. **UI/UX**
   - 顔のサムネイルをどこに表示？
   - 人物のマージ・分割操作

4. **既存タグとの統合**
   - 人物を通常のタグとして扱う？
   - 別システムとして管理？

5. **プライバシー設定**
   - 特定の人物を非表示にする機能
   - 顔検出を完全に無効化するオプション

## Implementation Phases

| Phase | 内容 | 優先度 |
|-------|------|--------|
| 1 | 顔検出（バウンディングボックス） | High |
| 2 | 顔埋め込み生成 | High |
| 3 | 自動クラスタリング | Medium |
| 4 | 人物管理UI | Medium |
| 5 | 検索統合 | Low |
| 6 | 自動アルバム生成 | Low |

## References

- 既存実装: `src-tauri/src/domain_service/ai_tagging/`
- ONNX Runtime: 既に統合済み
- docs/terms.md - 用語参照
