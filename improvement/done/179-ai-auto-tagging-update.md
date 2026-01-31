# AI Auto-Tagging Update - Multi-Model Support & Accuracy Improvement

## Overview

現在のAI Auto-Tagging機能の精度向上と、複数モデルからの選択機能を追加する。

---

## Problem Statement

### 現在の問題点

1. **精度が低い**
   - MobileNetV3はImageNet-1000クラスの**単一ラベル分類器**
   - 「犬と人が一緒に写っている写真」→ 最も確信度の高い1つのクラスのみ有効
   - マルチラベル分類ではないため、複数の被写体を同時に検出できない

2. **ImageNetマッピングの不備**
   - `Person`, `Face`, `Group` → ImageNetに該当クラスがない（未実装）
   - `Beach` → マッピングが抜けている
   - `Horse` → 誤ったクラスにマッピング（339は lesser_panda）
   - `Wedding`, `Birthday` → ImageNetでは検出不可能な高レベル概念

3. **モデル選択の柔軟性がない**
   - 現在は MobileNet プリセット（Light/Standard/Accurate）のみ
   - 用途に応じた最適なモデルを選択できない

---

## Proposed Solution

### マルチモデル対応アーキテクチャ

ユーザーが複数のAIモデルから選択できるようにする。

```
┌─────────────────────────────────────────────────────────────┐
│  AI Model Selection (Preferences)                            │
├─────────────────────────────────────────────────────────────┤
│  ○ MobileNet (ImageNet)                                      │
│    Fast classification with 32 predefined categories         │
│    License: Apache 2.0 | Size: 15MB | Speed: Fast            │
│                                                              │
│  ● OpenCLIP (Recommended)                                    │
│    Flexible tagging with custom labels, person detection     │
│    License: MIT | Size: 350MB | Speed: Medium                │
│                                                              │
│  ○ SigLIP                                                    │
│    Improved CLIP variant, better accuracy                    │
│    License: Apache 2.0 | Size: 400MB | Speed: Medium         │
│                                                              │
│  [Download Selected Model]  Status: Downloaded ✓             │
└─────────────────────────────────────────────────────────────┘
```

---

## Model Comparison

| モデル | ライセンス | サイズ | 速度 | 精度 | 特徴 |
|--------|-----------|--------|------|------|------|
| **MobileNet** | Apache 2.0 | ~15MB | ~100ms | ★★☆ | 固定32カテゴリ、高速 |
| **OpenCLIP** | MIT | ~350MB | ~200ms | ★★★★ | 任意ラベル対応、人物検出可 |
| **SigLIP** | Apache 2.0 | ~400MB | ~180ms | ★★★★★ | CLIP改良、多言語対応 |

### ライセンス互換性

PhotoCloveは**MIT License**のため、以下のモデルが互換:

| モデル | ライセンス | MIT互換 |
|--------|-----------|---------|
| MobileNetV3 | Apache 2.0 | ✅ |
| OpenCLIP | MIT | ✅ |
| SigLIP | Apache 2.0 | ✅ |
| YOLOv8 | AGPL-3.0 | ⚠️ プロジェクト全体のライセンス変更が必要 |

---

## Technical Design

### 1. Configuration Changes

```rust
// src-tauri/src/entity/config.rs

pub struct AiTaggingConfig {
    pub enabled: bool,
    pub auto_tag_on_import: bool,
    pub confidence_threshold: f32,
    pub max_tags_per_image: u32,

    // 変更: model_type を追加
    pub model_type: String,     // "mobilenet", "openclip", "siglip"
    pub model_preset: String,   // モデル固有のプリセット（mobilenetのみ使用）

    pub enabled_categories: Vec<String>,

    // 新規: OpenCLIP用のカスタムラベル
    pub custom_labels: Vec<String>,
}
```

### 2. Backend Architecture

```
src-tauri/src/domain_service/ai_tagging/backend/
├── mod.rs              # AIClassifierBackend trait（既存）
├── onnx.rs             # MobileNet backend（既存）
├── openclip.rs         # 新規: OpenCLIP backend
├── siglip.rs           # 新規: SigLIP backend
└── model_manager.rs    # 新規: モデルダウンロード・管理
```

### 3. OpenCLIP Backend

OpenCLIPの特徴:
- テキスト-画像のマッチングスコアを計算
- 任意のテキストラベルに対して信頼度を取得
- "a photo of a person" → 0.92 のようにスコアリング

```rust
// backend/openclip.rs

pub struct OpenClipClassifier {
    visual_session: Option<Session>,   // 画像エンコーダ
    text_session: Option<Session>,     // テキストエンコーダ
    text_embeddings: HashMap<String, Vec<f32>>,  // 事前計算済みラベル埋め込み
}

impl AIClassifierBackend for OpenClipClassifier {
    fn classify(
        &mut self,
        image_path: &Path,
        config: &ClassifierConfig,
    ) -> Result<Vec<ClassificationResult>, String> {
        // 1. 画像を埋め込みベクトルに変換
        let image_embedding = self.encode_image(image_path)?;

        // 2. 各ラベルとのコサイン類似度を計算
        let mut results = Vec::new();
        for (label, text_embedding) in &self.text_embeddings {
            let similarity = cosine_similarity(&image_embedding, text_embedding);
            if similarity >= config.confidence_threshold {
                results.push(ClassificationResult {
                    category: AutoTagCategory::from_label(label),
                    confidence: similarity,
                });
            }
        }

        // 3. 信頼度でソートして上位N件を返す
        results.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        results.truncate(config.max_tags_per_image);

        Ok(results)
    }
}
```

### 4. Model Download Manager

```rust
// backend/model_manager.rs

pub struct ModelManager {
    models_dir: PathBuf,  // ~/.local/share/photoclove/models/
}

impl ModelManager {
    /// 利用可能なモデル一覧を取得
    pub fn list_available_models() -> Vec<ModelInfo> {
        vec![
            ModelInfo {
                id: "mobilenet",
                name: "MobileNet (ImageNet)",
                license: "Apache 2.0",
                size_mb: 15,
                description: "Fast classification with 32 predefined categories",
                download_url: "https://...",
            },
            ModelInfo {
                id: "openclip",
                name: "OpenCLIP",
                license: "MIT",
                size_mb: 350,
                description: "Flexible tagging with custom labels",
                download_url: "https://...",
            },
            ModelInfo {
                id: "siglip",
                name: "SigLIP",
                license: "Apache 2.0",
                size_mb: 400,
                description: "Improved CLIP variant",
                download_url: "https://...",
            },
        ]
    }

    /// モデルがダウンロード済みかチェック
    pub fn is_model_downloaded(&self, model_id: &str) -> bool;

    /// モデルをダウンロード（進捗コールバック付き）
    pub async fn download_model(
        &self,
        model_id: &str,
        progress_callback: impl Fn(u64, u64),
    ) -> Result<PathBuf, String>;

    /// モデルを削除
    pub fn delete_model(&self, model_id: &str) -> Result<(), String>;
}
```

### 5. UI Changes

#### Preferences > AI Auto-Tagging Tab

```jsx
// src/App/Preferences/tabs/AITaggingTab.jsx

// 新規追加: モデル選択セクション
<div className={styles.section}>
  <h3>AI Model</h3>
  <div className={styles.modelList}>
    {models.map(model => (
      <ModelCard
        key={model.id}
        model={model}
        selected={selectedModel === model.id}
        downloaded={downloadedModels.includes(model.id)}
        onSelect={() => setSelectedModel(model.id)}
        onDownload={() => handleDownload(model.id)}
      />
    ))}
  </div>
</div>

// OpenCLIP選択時: カスタムラベル設定
{selectedModel === 'openclip' && (
  <div className={styles.section}>
    <h3>Custom Labels</h3>
    <p>Add custom labels for detection (e.g., "birthday party", "family dinner")</p>
    <TagInput
      tags={customLabels}
      onAdd={handleAddLabel}
      onRemove={handleRemoveLabel}
    />
  </div>
)}
```

---

## Default Labels for OpenCLIP/SigLIP

```rust
const DEFAULT_CLIP_LABELS: &[&str] = &[
    // People
    "a photo of a person",
    "a photo of people",
    "a photo of a face",
    "a group photo",

    // Animals
    "a photo of a dog",
    "a photo of a cat",
    "a photo of a bird",
    "a photo of fish",

    // Nature
    "a photo of the ocean",
    "a photo of a beach",
    "a photo of mountains",
    "a photo of a forest",
    "a photo of a sunset",
    "a photo of the sky",

    // Plants
    "a photo of flowers",
    "a photo of trees",
    "a photo of a garden",

    // Scenes
    "a photo of food",
    "a photo of a building",
    "a photo of a street",
    "an indoor photo",
    "an outdoor photo",
    "a night photo",

    // Events
    "a wedding photo",
    "a birthday party photo",
    "a travel photo",
];
```

---

## Implementation Phases

### Phase 1: Configuration & UI (Small)
- [ ] `AiTaggingConfig` に `model_type` フィールド追加
- [ ] Preferences UI にモデル選択カード追加
- [ ] モデル情報の表示（名前、ライセンス、サイズ、状態）

### Phase 2: Model Manager (Medium)
- [ ] `ModelManager` 実装
- [ ] モデルダウンロード機能
- [ ] ダウンロード進捗表示
- [ ] モデル削除機能

### Phase 3: OpenCLIP Backend (Medium)
- [ ] `OpenClipClassifier` 実装
- [ ] 画像エンコーダ統合
- [ ] テキストエンコーダ統合
- [ ] コサイン類似度計算
- [ ] デフォルトラベル定義

### Phase 4: SigLIP Backend (Small)
- [ ] `SigLipClassifier` 実装（OpenCLIPと類似構造）
- [ ] SigLIP固有の最適化

### Phase 5: Custom Labels UI (Small)
- [ ] OpenCLIP/SigLIP選択時のカスタムラベル入力UI
- [ ] ラベルの保存・読み込み

### Phase 6: MobileNet Mapping Fix (Small)
- [ ] ImageNetマッピングの修正
  - Beach (956) マッピング追加
  - Horse 正しいクラスにマッピング
  - 不足しているマッピングを追加

---

## Migration Strategy

### 既存ユーザーへの影響

1. **デフォルトモデル**: MobileNet（現行と同じ）
2. **既存タグ**: そのまま維持
3. **モデル変更時**: 再タグ付けを推奨（任意）

### 設定マイグレーション

```yaml
# Before (.photoclove.yml)
ai_tagging:
  model_preset: "standard"

# After
ai_tagging:
  model_type: "mobilenet"      # 新規フィールド
  model_preset: "standard"     # MobileNet用プリセット
```

---

## Model Files

### ダウンロードURL（予定）

| モデル | ファイル | サイズ | URL |
|--------|----------|--------|-----|
| MobileNet | mobilenet-v3-large.onnx | ~15MB | ONNX Model Zoo |
| OpenCLIP | openclip-vit-b-32.onnx | ~350MB | Hugging Face |
| SigLIP | siglip-base.onnx | ~400MB | Hugging Face |

### ファイル配置

```
~/.local/share/photoclove/models/
├── mobilenet-v3-large.onnx     # 現行（同梱可能）
├── openclip/
│   ├── visual.onnx             # 画像エンコーダ
│   └── text.onnx               # テキストエンコーダ
└── siglip/
    ├── visual.onnx
    └── text.onnx
```

---

## License Compliance

### models.txt への追記

```
================================================================================
AI Models used in PhotoClove
================================================================================

MobileNetV3
-----------
License: Apache License 2.0
Source: https://github.com/pytorch/vision
Copyright: Facebook, Inc. and its affiliates

OpenCLIP
--------
License: MIT
Source: https://github.com/mlfoundations/open_clip
Copyright: LAION and contributors

SigLIP
------
License: Apache License 2.0
Source: https://github.com/google-research/big_vision
Copyright: Google Research

ONNX Runtime
------------
License: MIT
Source: https://github.com/microsoft/onnxruntime
Copyright: Microsoft Corporation
```

---

## Open Questions

1. **モデルのバンドル vs ダウンロード**
   - MobileNet: バンドル（現行通り）
   - OpenCLIP/SigLIP: 初回ダウンロード（サイズが大きいため）

2. **OpenCLIPのONNXエクスポート**
   - 公式にONNXエクスポートがサポートされているか確認が必要
   - 必要に応じて自前でエクスポートスクリプトを作成

3. **テキストエンコーダの事前計算**
   - ラベル変更時のみ再計算
   - 起動時間への影響を最小化

---

## Success Metrics

| 指標 | 現状 | 目標 |
|------|------|------|
| Person検出 | 不可 | 可能（OpenCLIP使用時） |
| マルチラベル検出 | 不可 | 可能 |
| カスタムラベル | 不可 | 可能 |
| 検出精度（主観評価） | 低 | 中〜高 |

---

## References

- [OpenCLIP GitHub](https://github.com/mlfoundations/open_clip)
- [SigLIP Paper](https://arxiv.org/abs/2303.15343)
- [ONNX Model Zoo](https://github.com/onnx/models)
- [現行実装: 179-ai-auto-tagging.md](./179-ai-auto-tagging.md)
