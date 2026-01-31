# コード品質: ファイルサイズ違反（600行超過）

## 概要

CLAUDE.md のガイドラインでは、各ファイルは600行以下に保つことが推奨されています。
本ドキュメントでは、600行を超えるファイルの一覧と、分割のための具体的な提案を記載します。

**重要度**: High（コードメンテナンス性への影響大）
**対応優先度**: Medium

---

## 対応方針

**行数の大きい順にすべて対応する**

1. ViewMode.test.js (754行)
2. PhotoEditor.jsx (734行)
3. PhotoCollection.js (719行)
4. ViewMode.js (656行)
5. usePhotoOperations.js (628行)

---

## 違反ファイル一覧

| ファイル | 行数 | 超過行数 | 重要度 |
|---------|------|----------|--------|
| `src/test/ViewMode.test.js` | 754 | +154 | High |
| `src/App/PhotosList/PhotoOption/PhotoEditor.jsx` | 734 | +134 | High |
| `src/domain/PhotoCollection.js` | 719 | +119 | High |
| `src/domain/ViewMode.js` | 656 | +56 | Medium |
| `src/hooks/usePhotoOperations.js` | 628 | +28 | Medium |
| `src/App/LogViewer.jsx` | 589 | -11 | Low* |
| `src/hooks/usePhotoLoader.js` | 587 | -13 | Low* |
| `src/App.jsx` | 540 | -60 | Low* |

*600行未満だが、将来的に超過する可能性があるため監視対象

---

## 詳細分析と分割提案

### 1. ViewMode.test.js（754行）

**現状の問題**:
- 単一のテストファイルにすべてのViewModeテストが集約
- テストケースの追加が困難
- 関連するテストを見つけにくい

**分割提案**:

```
src/test/
├── ViewMode/
│   ├── ViewMode.basic.test.js      # 基本的なViewMode操作テスト
│   ├── ViewMode.selection.test.js  # 選択関連のテスト
│   ├── ViewMode.navigation.test.js # ナビゲーション関連テスト
│   ├── ViewMode.filter.test.js     # フィルタリングテスト
│   └── ViewMode.integration.test.js # 統合テスト
```

**優先度**: High（テストの可読性と保守性向上）

---

### 2. PhotoEditor.jsx（734行）

**現状の問題**:
- 編集機能、UI、イベントハンドリングが混在
- 1つのコンポーネントに複数の責務
- メモリリークの問題も内在（別ドキュメント参照）

**分割提案**:

```
src/App/PhotosList/PhotoOption/
├── PhotoEditor/
│   ├── index.jsx                    # メインコンポーネント（エントリーポイント）
│   ├── PhotoEditor.jsx              # 主要UIコンポーネント
│   ├── PhotoEditorToolbar.jsx       # ツールバーUI
│   ├── PhotoEditorCanvas.jsx        # キャンバス操作
│   ├── hooks/
│   │   ├── usePhotoEditorState.js   # 状態管理フック
│   │   ├── usePhotoEditorActions.js # アクション関連フック
│   │   └── usePhotoEditorEffects.js # 副作用関連フック
│   └── utils/
│       ├── imageProcessing.js       # 画像処理ユーティリティ
│       └── downloadHelper.js        # ダウンロード処理ヘルパー
```

**抽出候補の関数**:

1. **downloadMessage関連のロジック**（493-505行付近）
   - `downloadHelper.js` に抽出
   - イベントリスナーのクリーンアップも同時に修正

2. **画像変換処理**
   - `imageProcessing.js` に抽出
   - サイズ変更、回転、フィルタ処理など

3. **状態管理ロジック**
   - カスタムフックに抽出
   - 関連する useState を統合

**優先度**: High（メモリリーク修正と合わせて対応）

---

### 3. PhotoCollection.js（719行）

**現状の問題**:
- ドメインオブジェクトとしては過大
- 複数の責務を持つ可能性
- テストが複雑になる

**分割提案**:

```
src/domain/
├── PhotoCollection/
│   ├── index.js                     # メインエクスポート
│   ├── PhotoCollection.js           # コアドメインロジック
│   ├── PhotoCollectionFilter.js     # フィルタリングロジック
│   ├── PhotoCollectionSort.js       # ソートロジック
│   ├── PhotoCollectionSelection.js  # 選択管理ロジック
│   └── PhotoCollectionValidator.js  # バリデーションロジック
```

**DDDの観点からの提案**:

1. **Value Objects の抽出**
   - `PhotoFilter` - フィルタ条件を表すValue Object
   - `SortCriteria` - ソート条件を表すValue Object
   - `SelectionState` - 選択状態を表すValue Object

2. **Domain Services の検討**
   - 複数のエンティティにまたがる操作はサービスに移動
   - 例: `PhotoCollectionQueryService`

**優先度**: High（DDDアーキテクチャの改善）

---

### 4. ViewMode.js（656行）

**現状の問題**:
- ビューモードの状態と操作が混在
- 拡張性に課題

**分割提案**:

```
src/domain/
├── ViewMode/
│   ├── index.js                # メインエクスポート
│   ├── ViewMode.js             # コアViewModeクラス
│   ├── ViewModeState.js        # 状態管理
│   ├── ViewModeTransitions.js  # 状態遷移ロジック
│   └── ViewModeConstants.js    # 定数定義
```

**優先度**: Medium

---

### 5. usePhotoOperations.js（628行）

**現状の問題**:
- 多くの操作が1つのフックに集約
- 依存関係が複雑
- テストが困難

**分割提案**:

```
src/hooks/
├── usePhotoOperations/
│   ├── index.js                    # 複合フックとしてエクスポート
│   ├── usePhotoSelection.js        # 選択操作
│   ├── usePhotoNavigation.js       # ナビゲーション操作
│   ├── usePhotoBatchActions.js     # バッチ操作（移動、削除等）
│   ├── usePhotoMetadata.js         # メタデータ操作
│   └── usePhotoFiltering.js        # フィルタリング操作
```

**複合フックパターン**:

```javascript
// src/hooks/usePhotoOperations/index.js
import { usePhotoSelection } from './usePhotoSelection';
import { usePhotoNavigation } from './usePhotoNavigation';
import { usePhotoBatchActions } from './usePhotoBatchActions';

export const usePhotoOperations = (options) => {
  const selection = usePhotoSelection(options);
  const navigation = usePhotoNavigation(options);
  const batchActions = usePhotoBatchActions(options);

  return {
    ...selection,
    ...navigation,
    ...batchActions,
  };
};
```

**優先度**: Medium

---

## 実装ガイドライン

### 分割時の注意点

1. **後方互換性の維持**
   - 既存のインポートパスは `index.js` で維持
   - 段階的な移行をサポート

2. **テストの同時更新**
   - 分割したファイルに対応するテストも分割
   - カバレッジの低下に注意

3. **循環依存の回避**
   - 分割時に循環依存が発生しないよう注意
   - 依存グラフを確認

4. **命名規則の統一**
   - ファイル名はPascalCase（コンポーネント）またはcamelCase（ユーティリティ）
   - フォルダ名はPascalCase

### 分割の優先順位

1. **PhotoEditor.jsx** - メモリリーク修正と合わせて対応
2. **PhotoCollection.js** - DDDアーキテクチャ改善の一環
3. **ViewMode.test.js** - テスト可読性向上
4. **usePhotoOperations.js** - フック複雑性の軽減
5. **ViewMode.js** - 必要に応じて

---

## 対応チェックリスト

- [ ] PhotoEditor.jsx の分割計画を策定
- [ ] PhotoCollection.js のドメイン分析
- [ ] ViewMode.test.js のテスト分割
- [ ] usePhotoOperations.js のフック分割
- [ ] 各ファイルの行数を600行以下に維持するCI/CDチェック追加

---

*作成日: 2025-01-13*
*元ファイル: 2026-01-13-code-review.md*
