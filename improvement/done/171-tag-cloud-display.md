# Tag Cloud Display Mode

## Overview

タグの表示方法にタグクラウド形式を追加する。現在のリスト表示は維持しつつ、切り替えオプションとしてタグクラウド表示を提供する。タグクラウドでは写真数が多いタグほど大きく表示され、タグの使用頻度を視覚的に把握できる。

## User Impact

- **誰が利益を得るか**: タグを積極的に活用しているユーザー
- **どのようにワークフローが改善されるか**:
  - よく使うタグが一目で分かる
  - タグの使用傾向を視覚的に把握できる
  - スペース効率が良くなる（リストより多くのタグを一度に表示可能）
- **解決する課題**:
  - タグが多い場合にリスト表示ではスクロールが必要
  - タグの重要度（使用頻度）がリストでは把握しにくい

## Influence on Existing Features

### Compatibility

- 既存機能への影響なし（新しい表示モードの追加のみ）
- リスト表示は維持、ユーザーが表示モードを切り替え可能
- 既存のタグデータ構造の変更不要

### Related Features

| 関連機能 | 影響度 | 説明 |
|---------|-------|------|
| TagManager | 中 | 表示モード切替UI追加が必要 |
| TagChip | 低 | サイズバリエーション追加 |
| TagSelector | なし | ドロップダウン形式のため影響なし |
| BulkTagSelectorModal | なし | モーダル内チェックボックス形式のため影響なし |

## Implementation Approach

### Architecture

- **DDD pattern**: 表示ロジックのみ、ドメインエンティティへの変更不要
- **State management**: TagManager内のローカルステート（viewMode）で管理
- **Backend**: 変更不要（photoCountは既に取得済み）

### UI/UX Design

#### 表示モード切替

```
┌──────────────────────────────────────────────────┐
│ Tags                              [List] [Cloud] │  ← 右上にトグルボタン
├──────────────────────────────────────────────────┤
```

#### タグクラウドレイアウト

写真数が多いタグほど大きく、中心に配置される：

```
┌─────────────────────────────────────────────┐
│     食べ物      建築           ペット       │  ← 小さいタグ（外側）
│                                             │
│         イベント    2024     仕事           │  ← 中程度のタグ
│                                             │
│              旅行    家族                   │  ← 大きいタグ（中心）
│                                             │
│           風景     ポートレート             │  ← 中程度のタグ
│                                             │
│      写真       記念日          散歩        │  ← 小さいタグ（外側）
└─────────────────────────────────────────────┘
```

**中心配置アルゴリズム**:
1. タグを写真数で降順ソート
2. 大きいタグから順に中央→外側へ配置
3. フレックスボックス + `justify-content: center` でラップ
4. 行ごとに中央揃え

#### サイズ計算

```javascript
// 写真数に基づくフォントサイズ計算
const minSize = 12;  // px
const maxSize = 28;  // px
const maxPhotoCount = Math.max(...tags.map(t => t.photoCount));
const minPhotoCount = Math.min(...tags.map(t => t.photoCount));

const calculateSize = (photoCount) => {
  if (maxPhotoCount === minPhotoCount) return (minSize + maxSize) / 2;
  const ratio = (photoCount - minPhotoCount) / (maxPhotoCount - minPhotoCount);
  return minSize + ratio * (maxSize - minSize);
};
```

#### タグクラウドアイテムの表示

- 背景色: `--color-bg-surface`
- テキスト色: `--color-text-primary`
- ホバー時: 背景を `--color-bg-muted` に変更、カーソルをポインターに
- クリック: タグ検索を実行（既存動作と同じ）
- 写真数: タグ名の横に小さく表示 `(42)`

### Source Code Changes

**Frontend**:

| ファイル | 変更内容 |
|---------|---------|
| `src/components/TagManager.jsx` | 表示モード切替UI追加、TagCloud表示ロジック追加 |
| `src/components/TagManager.module.css` | タグクラウド用スタイル追加 |

**Backend**:
- 変更不要

**Database**:
- 変更不要

## Dependencies & Risks

### External Dependencies

- 新しい依存関係なし

### Performance

- **影響**: 軽微
- タグクラウドはCSSフレックスボックスで実装、特別な計算負荷なし
- 既存のphotoCountデータを使用

### Security

- 新たなセキュリティリスクなし

## Testing Strategy

### Manual Testing

1. TagManagerでCloud表示モードに切り替え
2. タグが写真数に応じたサイズで表示されることを確認
3. タグクリックで検索が動作することを確認
4. List表示に戻せることを確認
5. タグが0件の場合も正常表示されることを確認
6. 多数のタグ（50件以上）でのレイアウト確認

### Edge Cases

- タグが1件のみの場合
- 全タグの写真数が同じ場合
- タグ名が非常に長い場合
- タグ数が非常に多い場合（100件以上）

## Decisions

- **表示モードの永続化**: LocalStorageに保存（キー: `photoclove-tag-view-mode`）

## Implementation Estimate

- コンポーネント修正: TagManager.jsx（約100行追加）
- スタイル追加: TagManager.module.css（約50行追加）
- 影響範囲が限定的で、既存機能への影響なし
