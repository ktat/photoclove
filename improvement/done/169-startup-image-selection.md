# Startup Image Selection (起動画像選択機能)

## Overview

現在、起動時のスプラッシュ画像は `public/` フォルダ内の6枚の固定画像からランダムに選ばれる。
ユーザーが自分のお気に入りの写真を起動画像として設定できるようにする機能。

**現状の実装** (`src/WelcomeImage.jsx`):
- 固定の6枚: bird.jpg, mountain.jpg, raityou.jpg, midagahara.jpg, kamikochi.jpg, monkey.jpg
- ランダム選択
- Welcome画面とHome画面で使用

## User Impact

- **対象ユーザー**: PhotoCloveを日常的に使用するユーザー
- **改善点**:
  - 起動時に自分の好きな写真が表示されることで、パーソナライズされた体験
  - 思い出の写真を設定することで、アプリへの愛着向上
- **解決する問題点**:
  - 固定画像に飽きる
  - 自分の写真管理アプリなのに自分の写真が起動時に表示されない

## Influence on Existing Features

### Compatibility
- 既存のランダム画像機能は**デフォルト動作として維持**
- 設定がない場合は従来通りの動作
- 既存ユーザーへの影響なし

### Related Features
- **Preferences** (`src/App/Preferences.jsx`) - 設定UIの追加先
- **Welcome** (`src/Welcome.jsx`) - スプラッシュ表示
- **Home** (`src/App/Home.jsx`) - ホーム画面の背景画像
- **PhotoViewer** - 画像選択時のUI参考
- **Config** (`src-tauri/src/entity/config.rs`) - 設定の保存先

## Implementation Approach

### Architecture

**採用**: Option B - 複数画像プール（有効/無効/削除管理付き）

各画像に対して以下の状態管理が可能：
- **有効 (enabled)**: 起動時のランダム選択対象
- **無効 (disabled)**: 一時的に除外（後で有効に戻せる）
- **削除**: リストから完全に削除

### Data Structure

```typescript
// 起動画像の設定
interface StartupImageConfig {
  mode: 'default' | 'custom';  // デフォルト画像 or カスタム画像
  images: StartupImage[];       // カスタム画像リスト（日付の新しい順でソート）
}

interface StartupImage {
  path: string;        // 画像パス（import_toからの相対パス）
  enabled: boolean;    // 有効/無効
  photoDate: string;   // 写真の撮影日（ソート用）
}
```

**ソート**: `photoDate` の降順（新しい順）で表示

### Source Code Changes

**Frontend**:
- `src/App/Preferences.jsx` - 起動画像管理セクション追加
- `src/components/StartupImageManager.jsx` - 画像リスト管理コンポーネント（新規）
- `src/WelcomeImage.jsx` - configから有効な画像を取得してランダム選択
- `src/App/SelectionActions.jsx` - 「起動画像に追加」アクション追加
- `src/context/ConfigContext.jsx` - startupImages設定の追加

**Backend**:
- `src-tauri/src/entity/config.rs` - `startup_images: Option<StartupImageConfig>` フィールド追加

**Database**:
- 変更なし（configファイルに保存）

### UI Design

**Preferences内の設定**:
```
起動画像設定
┌───────────────────────────────────────────────────────┐
│ ○ デフォルト画像を使用                                 │
│ ○ カスタム画像を使用                                   │
│                                                       │
│ カスタム画像一覧: (日付の新しい順)                      │
│ ┌─────────────────────────────────────────────────┐   │
│ │ [サムネイル] 2024/12/25/photo1.jpg  ☑有効 [削除]│   │
│ │ [サムネイル] 2024/12/20/photo2.jpg  ☐無効 [削除]│   │
│ │ [サムネイル] 2024/11/15/photo3.jpg  ☑有効 [削除]│   │
│ └─────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

**PhotosListからの追加**:
- Selection（複数選択）状態から「起動画像に追加」アクション
- 既存のSelectionActionsに追加

## Dependencies & Risks

### External Dependencies
- なし（既存の機能のみ使用）

### Performance
- 起動時にconfig読み込み（既に実行済み）
- カスタム画像の場合、ファイル存在チェックが必要
- 画像が存在しない場合はデフォルトにフォールバック

### Security
- 画像パスのバリデーション必要
- import_toフォルダ内の画像のみ許可（決定済み）

### Edge Cases
- 設定した画像が削除された場合 → デフォルトにフォールバック
- 画像パスが無効な場合 → デフォルトにフォールバック
- 動画ファイルが設定された場合 → 画像のみ許可
- 全画像が無効の場合 → デフォルト画像にフォールバック
- カスタムモードだが画像リストが空の場合 → デフォルト画像にフォールバック

## Testing Strategy

1. 起動画像が正しく表示されることを確認
2. 設定がconfigに保存されることを確認
3. アプリ再起動後も設定が維持されることを確認
4. 画像削除時のフォールバック動作確認
5. 無効なパス設定時のエラーハンドリング確認
6. 有効/無効の切り替えが正しく動作することを確認
7. 全画像を無効にした場合のフォールバック（デフォルト画像表示）
8. 複数画像からランダム選択が偏りなく動作することを確認

## Decisions Made

| 項目 | 決定内容 |
|------|----------|
| 画像ソース | import_toフォルダ内のみ |
| 表示画像 | 元画像（サムネイルではなく） |
| 追加方法 | Selectionから（右クリックメニュー不要） |
| 画像上限 | 制限なし |
| 並び順 | 日付の新しい順（自動ソート、並び替え不要） |
| 設定UI配置 | Preferencesに新セクション「起動設定 (Startup)」を追加 |

## Open Questions

なし

## Priority

**Low-Medium** - 機能的な改善だが、コア機能ではない。ユーザー体験向上に寄与。
