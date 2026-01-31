# Code Review: src以下の全体レビュー

**日付**: 2026-01-20
**対象**: PhotoClove フロントエンド (src/)
**レビュー観点**: CLAUDE.mdガイドライン準拠、コード品質、DRY原則

## 概要

src以下のフロントエンドコード（218ファイル、約34,000行）を対象にコードレビューを実施。
CSSハードコード値とコード重複が主な改善点として検出された。

## 問題点

### 1. ファイルサイズ制限（600行）違反

| ファイル | 行数 | 状態 |
|---------|------|------|
| `src/App/PhotosList/PhotosListMini.jsx` | 619行 | 要分割 |

**推奨対応**: ロジックとUIの分離、サブコンポーネント抽出

### 2. CSSハードコード値（CSS変数未使用）

#### 色のハードコード

| ファイル | 行 | 問題 | 修正案 |
|---------|-----|------|--------|
| `PhotosListMini.jsx` | 431 | `color: "white"` | `var(--color-text-primary)` |
| `ThumbnailItem.jsx` | 209 | `color: "white"` | `var(--color-text-primary)` |
| `PhotoListContent.jsx` | 347 | `backgroundColor: "white", color: "black"` | デバッグ用だが要改善 |

#### ピクセル値のハードコード（多数）

| ファイル | 行 | 問題 |
|---------|-----|------|
| `ErrorModal.jsx` | 120,138,143,148 | `marginBottom: '16px'`, `'8px'` |
| `ErrorFallback.jsx` | 47,133,147 | `fontSize: '32px'`, `marginBottom: '12px'` |
| `FilterPopover.jsx` | 77-273 | 多数の `marginBottom`, `gap` ハードコード |
| `AlbumCreationModal.jsx` | 119,150 | `marginBottom: '16px'`, `'24px'` |
| `BackNavigationLink.jsx` | 46 | `marginBottom: "10px"` |
| `AlbumTab.jsx` | 194 | `padding: '16px'` |
| `TutorialTooltip.jsx` | 85 | `marginBottom: '12px'` |
| `ErrorToast.jsx` | 107 | `marginRight: '24px'` |
| `ErrorDisplay.jsx` | 79,88,109 | 複数のマージン値 |

**推奨対応**: CSS変数への置換
- `'4px'` → `var(--space-1)`
- `'8px'` → `var(--space-2)`
- `'12px'` → `var(--space-3)`
- `'16px'` → `var(--space-4)`
- `'24px'` → `var(--space-6)`

### 3. コード重複（DRY違反）

`make check-duplicate-js` で検出された重複：

#### 高優先度（統合推奨）

| 重複箇所 | 重複行数 | 推奨対応 |
|---------|---------|---------|
| `usePhotoMetadataOperations.js` ↔ `useStarOperations.js` | 48行（3箇所） | 共通処理を抽出 |
| `PhotoEditor.jsx` 内スライダーUI | 72行（6箇所） | Sliderコンポーネント化 |
| `FilterTab.jsx` 内 | 30行 | 共通UIパターン抽出 |
| `imageProcessing.js` ↔ `photoExportUtils.js` | 24行 | 共通関数抽出 |

#### 中優先度

| 重複箇所 | 重複行数 | 推奨対応 |
|---------|---------|---------|
| `DirectoryMenu.jsx` ↔ `PhotoOption.jsx` | 23行（3箇所） | 共通パネルコンポーネント |
| `GenericListView.jsx` ↔ `TagCloudView.jsx` | 17行 | 基底コンポーネント抽出 |
| `UnifiedCollectionService.js` 内部 | 22行（2箇所） | 内部リファクタリング |
| `ThumbnailTab.jsx` 内 | 11行 | ループ/マップ処理に変更 |
| `PhotoDisplay.jsx` 内 | 15行 | 共通レンダリング関数 |
| `tutorialContent.jsx` 内 | 21行 | データ駆動に変更 |

### 4. console使用

| ファイル | 行 | 状態 |
|---------|-----|------|
| `debugStorage.js` | 63,177,196 | デバッグユーティリティのため許容可 |

**備考**: LoggerServiceへの移行を検討可能だが、優先度は低い

## 改善提案（任意）

### 1. PhotosListMini.jsx の分割

現在619行と制限超過。以下の分割を検討：
- 選択ロジック → `usePhotoSelection.js`
- キーボードショートカット → `useKeyboardNavigation.js`（既存あり）
- サムネイル表示 → `ThumbnailGrid.jsx`

### 2. CSS変数の一括適用

特に以下のファイルはハードコード値が多い：
1. `FilterPopover.jsx` - 最優先
2. `ErrorModal.jsx`
3. `ErrorFallback.jsx`

CSS Moduleへの移行と合わせて対応推奨。

### 3. Star/Metadata操作フックの統合

```javascript
// 現在: 重複した状態管理パターン
// usePhotoMetadataOperations.js と useStarOperations.js で同じパターン

// 提案: 共通フックを抽出
const usePhotoOperation = (operationFn, options) => {
  // 共通の状態管理、エラーハンドリング、ローディング処理
};
```

### 4. PhotoEditor スライダーの共通化

```jsx
// 現在: 6箇所で同じUIパターン
<div className={styles.adjustmentControl}>
  <label>...</label>
  <input type="range" ... />
  <span>...</span>
</div>

// 提案: AdjustmentSlider コンポーネント
<AdjustmentSlider
  label="Brightness"
  value={brightness}
  onChange={setBrightness}
  min={-100}
  max={100}
/>
```

## 良い点

### ロギング標準の遵守
- 58ファイルで `LoggerService` を適切にインポート・使用
- `console.*` の使用は最小限（debugStorage.jsのみ）

### アーキテクチャ
- **Context分離**: ErrorContext, UIContext, PhotoContext が適切に責務分離
- **ドメインモデル**: Photo, ViewMode, PhotoCollection などが整備
- **Hooks活用**: useViewMode, usePhotosQuery など再利用可能なフックが充実

### CSS Modules
- 新規コンポーネントで適切に採用（Preferences, PhotoGrid等）

### コード品質
- TypeScript型定義ファイル（`types/photo.types.js`）の整備
- テストファイルの存在（ViewMode.test.js等）

## 統計

| カテゴリ | 件数 |
|---------|------|
| ファイルサイズ違反 | 1件 |
| CSSハードコード（色） | 3件 |
| CSSハードコード（サイズ） | 10ファイル以上 |
| コード重複（高優先度） | 4箇所 |
| コード重複（中優先度） | 6箇所 |
| console使用 | 1ファイル（許容） |

## 推奨アクション優先度

### 高（すぐに対応）
1. `PhotosListMini.jsx` の分割（600行制限違反）

### 中（計画的に対応）
2. CSSハードコード値のCSS変数化（FilterPopover優先）
3. usePhotoMetadataOperations/useStarOperations の重複解消
4. PhotoEditor スライダーのコンポーネント化

### 低（余裕があれば）
5. その他のコード重複解消
6. debugStorage.js の logger 移行
