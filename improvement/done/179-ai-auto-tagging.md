# AI Auto-Tagging - Built-in Image Classification

## Overview
写真に対して、ビルトインのAIモデルを使用して自動的にタグを付ける機能。
人、動物（鳥、魚、牛、馬、昆虫等）、海、山、植物、花などの基本的なカテゴリを検出し、自動でタグを割り当てる。

---

## ✅ Confirmed Decisions (2026-01-20)

以下の項目はディスカッション済みで決定済み：

### 1. モデル配布方法
**決定: アプリに同梱**
- ONNXモデルをアプリバイナリに含める
- 初回ダウンロード不要、オフラインで即使用可能
- アプリサイズは +15-50MB 程度増加

### 2. タグ命名規則
**決定: プレフィックス付き**
- 自動タグは `ai:` プレフィックスを付ける
- 例: `ai:person`, `ai:cat`, `ai:beach`
- 手動タグとの区別が明確になる
- 検索時に `ai:` でフィルタ可能

### 3. 分類カテゴリの粒度
**決定: Preferencesで選択可能**
- 有効にするカテゴリをユーザーが選択できる
- チェックボックスで各カテゴリのON/OFF

### 4. 既存写真の処理
**決定: 2つのトリガー方法を提供**
- **インポート時**: Preferencesで「インポート時に自動タグ付け」ON/OFF
- **既存写真**: Maintenanceタブから日付を指定して実行可能

### 5. 信頼度の扱い
**決定: metadataに保存 + 閾値設定**
- `photo_collection_items.metadata` に信頼度を保存
  ```json
  {"confidence": 0.85, "model": "mobilenet-v3", "classified_at": "2026-01-20T..."}
  ```
- Preferencesで閾値を設定可能（デフォルト: 0.7）
- 閾値以下の分類結果はタグ付けしない
- 信頼度の低いタグは表示上で視覚的に区別（薄い色など）

### 6. 優先度
**決定: 比較的高め**
- 主要機能として早期に実装

---

## User Impact
- **Who benefits**: すべてのユーザー。特に大量の写真を持つユーザー
- **Workflow improvement**: 手動でタグ付けする手間を大幅に削減
- **Pain points solved**:
  - 写真の整理・分類が自動化される
  - 「猫の写真」「海の写真」などで検索可能になる
  - 新しくインポートした写真も自動的に分類される

## 技術的アプローチの選択肢

### Option A: ONNX Runtime + MobileNet/EfficientNet（推奨）
**概要**: Rustで直接機械学習モデルを実行

**Pros**:
- 完全オフライン動作
- プライバシー保護（写真がローカルで処理される）
- 一度モデルをダウンロードすれば追加コストなし
- クロスプラットフォーム対応

**Cons**:
- アプリサイズ増加（モデル: 10-50MB程度）
- 初回セットアップ時にモデルダウンロードが必要
- GPUサポートの設定が複雑になる可能性

**Rust Crates**:
```toml
ort = "2.0"  # ONNX Runtime binding (旧 onnxruntime-rs)
```

### Option B: TensorFlow Lite (via C binding)
**概要**: TFLiteをRustから呼び出し

**Pros**:
- 軽量モデル向けに最適化
- モバイルでも使われる実績のある技術

**Cons**:
- FFI経由でのC bindingが必要
- ビルドが複雑になる
- クロスコンパイルが難しい

### Option C: Candle (Hugging Face純正Rust ML)
**概要**: Hugging FaceのRust純正MLフレームワーク

**Pros**:
- Pure Rust実装
- 最新のモデルにアクセスしやすい
- 活発な開発

**Cons**:
- 比較的新しいプロジェクト
- ドキュメントがまだ少ない

```toml
candle-core = "0.8"
candle-nn = "0.8"
candle-transformers = "0.8"
```

### Option D: 外部API連携（Google Vision, AWS Rekognition等）
**概要**: クラウドAIサービスを使用

**Pros**:
- 高精度
- セットアップが簡単
- モデル更新が自動

**Cons**:
- インターネット接続必須
- APIコストがかかる
- プライバシーの懸念
- Google Photosとの方向性の重複

## 推奨アプローチ: Option A (ONNX Runtime)

### 理由
1. PhotoCloveはオフラインファーストのアプリ
2. プライバシー重視（写真を外部送信しない）
3. 一般的な分類なら軽量モデルで十分
4. クロスプラットフォーム対応が必要

### 分類カテゴリ案

```rust
enum AutoTagCategory {
    // 人物
    Person,
    Face,
    Group,

    // 動物
    Dog,
    Cat,
    Bird,
    Fish,
    Horse,
    Cow,
    Insect,
    Wildlife,

    // 自然
    Sea,
    Beach,
    Mountain,
    Forest,
    River,
    Lake,
    Sky,
    Sunset,

    // 植物
    Flower,
    Tree,
    Plant,
    Garden,

    // シーン
    Food,
    Building,
    Street,
    Indoor,
    Outdoor,
    Night,

    // イベント
    Wedding,
    Birthday,
    Travel,
}
```

## Implementation Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Preferences │  │  JobQueue   │  │     PhotoTags       │ │
│  │ (設定)      │  │ (進捗表示) │  │ (自動タグ表示)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  AITaggingService                       ││
│  │  - load_model()                                         ││
│  │  - classify_image(path) -> Vec<(Category, f32)>        ││
│  │  - apply_auto_tags(photo_id, categories)               ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │   ONNXRuntime     │  │   JobQueueService │              │
│  │   (推論実行)      │  │   (バッチ処理)    │              │
│  └───────────────────┘  └───────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Source Code Changes

**Backend (New Files)**:
- `src-tauri/src/domain_service/ai_tagging/mod.rs` - AIタグ付けサービス（モジュール）
- `src-tauri/src/domain_service/ai_tagging/classifier.rs` - ONNX分類ロジック
- `src-tauri/src/domain_service/ai_tagging/categories.rs` - カテゴリ定義とマッピング
- `src-tauri/src/domain_service/job_queue/handlers/ai_tagging.rs` - ジョブハンドラ
- `src-tauri/src/entity/ai_config.rs` - AI設定エンティティ
- `src-tauri/models/` - ONNXモデルファイル格納ディレクトリ

**Backend (Modified)**:
- `src-tauri/Cargo.toml` - `ort = "2.0"` 追加
- `src-tauri/src/lib.rs` - 新規Tauriコマンド追加
  - `run_ai_tagging_for_date` - 日付指定でAI分類実行
  - `get_ai_tagging_status` - 処理状況取得
- `src-tauri/src/entity/job_queue.rs` - `JobType::AiTagging` 追加
- `src-tauri/src/entity/config.rs` - AI設定項目追加
- `src-tauri/src/domain_service/job_queue/handlers/mod.rs` - ai_taggingハンドラ登録
- `src-tauri/src/repository/meta_db/sqlite/tags.rs` - `ai:` プレフィックス付きタグ作成

**Frontend (Modified)**:
- `src/App/Preferences.jsx` - AI Auto-Taggingセクション追加
  - 有効/無効トグル
  - インポート時自動タグ付けON/OFF
  - 信頼度閾値スライダー
  - カテゴリ選択チェックボックス
  - モデルプリセット選択
- `src/App/Preferences/MaintenanceTab.jsx` - 日付指定AI分類ボタン追加
- `src/App/PhotosList/PhotoOption/PhotoTags.jsx` - 自動タグの表示
  - `ai:` プレフィックス付きタグの視覚的区別
  - 信頼度による色の濃淡
- `src/components/TagChip.jsx` - AIタグ用スタイル追加

**Database**:
- `photo_collection_items.metadata` に信頼度情報を保存（既存カラム活用）
  ```json
  {"confidence": 0.85, "model": "mobilenet-v3", "classified_at": "2026-01-20T..."}
  ```
- `photo_collections` の `ai:` プレフィックス付きタグは自動作成

### 処理フロー

1. **インポート時（自動）**:
   ```
   Photo Import → Thumbnail生成 → (設定ON時) AI分類ジョブをキューに追加
                                           ↓
                               JobQueue → AITaggingService.classify_image()
                                           ↓
                               信頼度 >= 閾値 → `ai:category` タグを作成
                                           ↓
                               photo_collection_items に保存（metadata含む）
   ```

2. **Maintenanceタブから（手動）**:
   ```
   ユーザーが日付を指定 → run_ai_tagging_for_date コマンド
                                ↓
                      指定日の全写真に対してAI分類ジョブを追加
                                ↓
                      JobQueueで順次処理（進捗表示）
   ```

3. **設定項目（Preferences）**:
   - **AI Auto-Tagging**: ON/OFF（機能全体の有効/無効）
   - **Auto-tag on import**: ON/OFF（インポート時の自動タグ付け）
   - **Confidence threshold**: 0.5〜0.9 スライダー（デフォルト: 0.7）
   - **Model preset**: Light / Standard / Accurate
   - **Enabled categories**: チェックボックスで各カテゴリのON/OFF

4. **タグの保存形式**:
   ```
   photo_collections:
     - name: "ai:person"
     - type: "tag"
     - color: (自動割り当て or デフォルト)

   photo_collection_items:
     - collection_id: (ai:person の ID)
     - photo_path: "/path/to/photo.jpg"
     - metadata: {"confidence": 0.85, "model": "mobilenet-v3", "classified_at": "..."}
   ```

## Dependencies & Risks

### External Dependencies
```toml
# Rust
ort = "2.0"  # ONNX Runtime
```

### Performance
- 1枚あたりの処理時間: CPU 50-200ms程度
- バックグラウンド処理なのでUIブロックなし

### 起動時間への影響と対策

#### 処理時間の目安
| 処理 | 時間 |
|------|------|
| ONNX Runtime初期化 | 100-300ms |
| モデル読み込み | 500ms-2s（モデルサイズ依存）|
| 1枚の分類 | 50-200ms |

#### 対策1: 遅延読み込み（Lazy Loading）- 推奨

起動時にはモデルを読み込まず、初回のタグ付け処理時にのみ読み込む。

```rust
use std::sync::OnceLock;

// 起動時: モデルは読み込まない
static MODEL: OnceLock<OrtModel> = OnceLock::new();

// 初回のタグ付け処理時にのみ読み込む
fn classify_image(path: &str) -> Result<Vec<Tag>> {
    let model = MODEL.get_or_init(|| {
        load_model()  // ここで初めて読み込み（1-2秒）
    });
    model.classify(path)
}
```

**効果**: 起動時間への影響ゼロ。初回分類時に1-2秒の遅延があるが、バックグラウンド処理なのでUIには影響しない。

#### 対策2: バックグラウンド先読み

UIが表示された後、別スレッドでモデルを先読みする。

```rust
// 起動後、別スレッドでモデルを先読み
pub fn preload_model_in_background() {
    tokio::spawn(async {
        // UIが表示されてから数秒後に読み込み開始
        tokio::time::sleep(Duration::from_secs(3)).await;
        let _ = MODEL.get_or_init(|| load_model());
        log::info!(target: "ai_tagging", "model_preloaded; status=ready");
    });
}
```

**効果**: UIはすぐ表示され、裏でモデルを準備。ユーザーが写真を閲覧している間に準備完了。

#### 対策3: JobQueueとの統合

現在のPhotocloveのJobQueueの仕組みをそのまま活用:

```
写真インポート → サムネイルジョブ追加 → AIタグ付けジョブ追加
                                        ↓
                              バックグラウンドで順次処理
                              （モデル読み込みもこのタイミング）
```

ユーザーは写真を見ている間に、裏でAI処理が走る。体感的な遅延は発生しない。

#### 結論

**起動時間は変わらない**設計が可能。遅延読み込み + バックグラウンド先読みの組み合わせで:
- アプリ起動: 影響なし
- 初回分類: JobQueueでバックグラウンド処理（UIブロックなし）
- 2回目以降: モデルはメモリに保持済み

### Security
- ローカル処理のみ、外部通信なし
- モデルファイルの署名検証（オプション）

### Model Distribution
**決定: アプリに同梱**

モデルファイルはアプリバイナリに含める。

#### 同梱方法

```
src-tauri/
├── models/
│   ├── mobilenet-v3-small.onnx   (~5MB)   - Light preset
│   ├── mobilenet-v3-large.onnx   (~15MB)  - Standard preset (default)
│   └── efficientnet-lite4.onnx   (~50MB)  - Accurate preset
├── build.rs  - モデルをバイナリに埋め込む設定
└── tauri.conf.json  - リソース設定
```

#### Rustでの埋め込み

```rust
// build.rs または tauri.conf.json の resources 設定で
// models/ ディレクトリをバンドルに含める

// 実行時のモデル読み込み
fn get_model_path(preset: ModelPreset) -> PathBuf {
    let app_dir = tauri::api::path::resource_dir();
    match preset {
        ModelPreset::Light => app_dir.join("models/mobilenet-v3-small.onnx"),
        ModelPreset::Standard => app_dir.join("models/mobilenet-v3-large.onnx"),
        ModelPreset::Accurate => app_dir.join("models/efficientnet-lite4.onnx"),
    }
}
```

#### メリット
- インターネット接続不要
- 初回起動時の待ち時間なし
- 配布の信頼性が高い

#### デメリット
- アプリサイズ増加（+15-70MB、プリセット数による）
- モデル更新にはアプリ更新が必要

#### 段階的アプローチ
- v1: Standard (MobileNetV3-Large) のみ同梱 (+15MB)
- v2: 全プリセット同梱、または選択ダウンロード方式を検討

### License Compliance

モデルを同梱・配布する場合、ライセンス表記が必要。

#### 対象ライセンス

| 項目 | ライセンス | 表記義務 |
|------|-----------|----------|
| MobileNetV3 | Apache 2.0 | LICENSE + NOTICE |
| EfficientNet | Apache 2.0 | LICENSE + NOTICE |
| ONNX Runtime | MIT | LICENSE |
| ImageNet labels | 確認必要 | モデル依存 |

#### ファイル構成

現在のライセンスファイル構成に `models.txt` を追加:

```
photoclove/
├── LICENSES/
│   ├── javascript.txt   # 既存
│   ├── rust.txt         # 既存
│   └── models.txt       # 新規追加（AIモデル用）
```

#### models.txt の例

```
================================================================================
AI Models used in PhotoClove
================================================================================

MobileNetV3
-----------
License: Apache License 2.0
Source: https://github.com/pytorch/vision
Copyright: Facebook, Inc. and its affiliates

ONNX Runtime
------------
License: MIT
Source: https://github.com/microsoft/onnxruntime
Copyright: Microsoft Corporation

ImageNet Labels (if used)
-------------------------
License: [要確認 - モデルによって異なる]
```

#### 実装時の確認事項

- [ ] 使用するモデルのライセンスを確認
- [ ] 必要なLICENSE/NOTICEファイルを収集
- [ ] models.txt に追記
- [ ] アプリ内の「About」や「ライセンス」画面に表示を追加

### User Model Selection

ユーザーがモデルを選択できるようにすることで、デバイス性能や用途に合わせた柔軟な運用が可能。

#### Option A: プリセット選択（推奨）

技術的な詳細を隠して、シンプルな選択肢を提供:

```
┌─────────────────────────────────────────┐
│ AI Auto-Tagging                         │
├─────────────────────────────────────────┤
│ Model:  ○ Light   (速い、基本的な分類)  │
│         ● Standard (バランス良い)       │
│         ○ Accurate (遅い、高精度)       │
│                                         │
│ Size: 15MB  |  Speed: ~100ms/photo      │
└─────────────────────────────────────────┘
```

**メリット**: ユーザーが迷わない、UIがシンプル

**プリセット対応表**:
| プリセット | モデル | サイズ | 速度 | 精度 |
|-----------|--------|--------|------|------|
| Light | MobileNetV3-Small | ~5MB | ~50ms | 中 |
| Standard | MobileNetV3-Large | ~15MB | ~100ms | 中〜高 |
| Accurate | EfficientNet-Lite4 | ~50MB | ~200ms | 高 |

#### Option B: 詳細選択（上級者向け）

モデル名を直接選択できるUI:

```
┌─────────────────────────────────────────┐
│ Model: [MobileNetV3-Small    ▼]         │
│        ├ MobileNetV3-Small (5MB)        │
│        ├ MobileNetV3-Large (15MB)       │
│        ├ EfficientNet-Lite0 (20MB)      │
│        └ EfficientNet-Lite4 (50MB)      │
└─────────────────────────────────────────┘
```

**メリット**: 上級者が細かく制御可能
**デメリット**: 初心者には分かりにくい

#### Option C: カスタムモデル対応（将来拡張）

```
┌─────────────────────────────────────────┐
│ Model: [Standard ▼]                     │
│                                         │
│ [+] Add Custom Model...                 │
│     └ Import .onnx file                 │
└─────────────────────────────────────────┘
```

ユーザーが独自に学習したモデルや、特定用途に特化したモデルをインポート可能。

**ユースケース**:
- 鳥の種類を細かく分類するモデル
- 特定の犬種を識別するモデル
- 料理の種類を分類するモデル

#### 段階的実装アプローチ

| フェーズ | 内容 | 複雑さ |
|----------|------|--------|
| v1 | デフォルトモデル1つのみ（MobileNetV3-Large） | 低 |
| v2 | プリセット選択（Light/Standard/Accurate） | 中 |
| v3 | カスタムモデルのインポート対応 | 高 |

最初はシンプルに始めて、ユーザーフィードバックを見ながら段階的に拡張する。

#### モデル管理の実装

```rust
// モデル設定
struct ModelConfig {
    preset: ModelPreset,  // Light, Standard, Accurate
    custom_path: Option<PathBuf>,  // カスタムモデルのパス
}

enum ModelPreset {
    Light,     // MobileNetV3-Small
    Standard,  // MobileNetV3-Large (default)
    Accurate,  // EfficientNet-Lite4
    Custom,    // ユーザー指定
}

// モデルのダウンロード・キャッシュ管理
// ~/.photoclove/models/
//   ├── mobilenet-v3-small.onnx
//   ├── mobilenet-v3-large.onnx
//   ├── efficientnet-lite4.onnx
//   └── custom/
//       └── user-model.onnx
```

## Open Questions (Remaining)

~~1. モデル選択~~ → MobileNetV3で開始、Preferencesでプリセット選択可能に
~~2. 自動タグの表示方法~~ → `ai:` プレフィックス + 信頼度による視覚的区別
~~3. 再分類~~ → Maintenanceタブから日付指定で実行可能
~~4. カスタムカテゴリ~~ → Preferencesでカテゴリの有効/無効を選択可能

### 残りの検討事項

1. **GPU対応**:
   - v1はCPU-onlyで実装
   - 将来的にCUDA/Metal対応を検討（ユーザーからの要望次第）

2. **モデルのバージョン管理**:
   - アプリ更新時にモデルも更新される
   - 旧モデルで付けたタグの扱い（そのまま維持？再分類推奨？）

3. **バッチ処理の優先度**:
   - サムネイル生成とAIタグ付けの優先順位
   - 提案: サムネイル → AIタグ付けの順（UIレスポンス優先）

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] `ort` crate追加、ビルド設定
- [ ] `AITaggingService` 基本構造
- [ ] モデルファイルの同梱設定
- [ ] `JobType::AiTagging` 追加

### Phase 2: Basic Classification
- [ ] MobileNetV3モデル統合
- [ ] 基本カテゴリ（15-20種類）の分類実装
- [ ] `ai:` プレフィックス付きタグの作成
- [ ] confidence のmetadata保存

### Phase 3: Job Queue Integration
- [ ] インポート時の自動タグ付けジョブ追加
- [ ] Maintenanceタブからの日付指定実行
- [ ] 進捗表示（JobQueue UI）

### Phase 4: Preferences UI
- [ ] AI Auto-Tagging セクション追加
- [ ] ON/OFF トグル
- [ ] 信頼度閾値スライダー
- [ ] カテゴリ選択チェックボックス
- [ ] モデルプリセット選択（Light/Standard/Accurate）

### Phase 5: Tag Display Enhancement
- [ ] PhotoTagsでの自動タグ表示
- [ ] 信頼度による視覚的区別（薄い色など）
- [ ] `ai:` タグのフィルタリング機能

---

## まとめ

技術的には実現可能です。ONNX Runtimeを使えば、Rustから直接推論を実行でき、完全オフラインで動作します。

### 決定済み実装方針

| 項目 | 決定内容 |
|------|----------|
| **技術スタック** | ONNX Runtime (`ort` crate) + MobileNetV3 |
| **モデル配布** | アプリに同梱（+15MB〜） |
| **タグ命名** | `ai:` プレフィックス付き（例: `ai:person`） |
| **トリガー** | インポート時自動 + Maintenanceタブから日付指定 |
| **信頼度** | metadata保存、閾値設定可能、低信頼度は視覚的区別 |
| **カテゴリ** | Preferencesで有効/無効を選択可能 |
| **優先度** | 高め |

### 実装ステップ

1. **Phase 1**: `ort` crateの導入、基本構造の実装
2. **Phase 2**: MobileNetV3モデル統合、基本分類の実装
3. **Phase 3**: JobQueue統合、インポート時・日付指定実行
4. **Phase 4**: Preferences UI（設定画面）
5. **Phase 5**: タグ表示の改善（視覚的区別、信頼度表示）

### 注意点

- クロスプラットフォームビルド（Linux/macOS/Windows）でのONNX Runtimeの動作確認が必要
- モデルサイズとアプリサイズのトレードオフを考慮
- v1はCPU-onlyで実装、GPU対応は将来検討
