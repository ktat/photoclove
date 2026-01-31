# 国際化（i18n）対応

## Overview

PhotoCloveの多言語対応を実装し、日本語・英語（将来的に他言語も）でUIを利用可能にする。

**現状**: UIテキストはすべてハードコーディングされており、i18nライブラリは未導入。
**規模**: 約200-250の翻訳対象文字列

## User Impact

- **日本語ユーザー**: 母国語でアプリを使用可能に
- **グローバルユーザー**: 言語の壁なくアプリを利用可能
- **アクセシビリティ向上**: 言語設定に応じた適切なテキスト表示

### 解決する課題
- 現在の英語のみのUIは日本語話者には使いにくい
- 日付・数値フォーマットが`en-CA`にハードコードされている箇所がある
- 複数形の処理が手動で散在している

## Influence on Existing Features

### Compatibility
- **既存機能への影響**: なし（テキストのラップのみ）
- **マイグレーション**: 不要
- **ユーザー設定**: Preferences に言語選択を追加

### Related Features
- `Preferences` - 言語設定の追加
- `DateList` - 日付フォーマットのローカライズ
- すべてのモーダル・UI要素 - テキスト翻訳

### 翻訳対象の内訳

| カテゴリ | 概数 |
|---------|------|
| ボタンラベル | 40+ |
| プレースホルダー | 21 |
| 確認メッセージ | 30+ |
| モーダルタイトル | 20+ |
| エラーメッセージ | 20+ |
| ステータスメッセージ | 15+ |
| ツールチップ | 45+ |
| その他 | 20+ |

## Implementation Approach

### Architecture

#### ライブラリ選定

**推奨: i18next + react-i18next**

| 項目 | i18next | react-intl |
|------|---------|------------|
| エコシステム | 最も人気、成熟 | Yahoo製、堅牢 |
| 学習コスト | 低 | 中 |
| 複数形対応 | 優秀 | 優秀 |
| バンドルサイズ | 小さめ | 大きめ |
| TypeScript | 良好 | 良好 |

#### ディレクトリ構造

```
src/
├── i18n/
│   ├── index.js           # i18n設定
│   ├── locales/
│   │   ├── en/            # English (default/fallback)
│   │   │   ├── common.json     # 共通（ボタン等）
│   │   │   ├── modals.json     # モーダル
│   │   │   ├── messages.json   # メッセージ
│   │   │   └── errors.json     # エラー
│   │   ├── ja/            # 日本語
│   │   │   └── ...
│   │   ├── fr/            # Français
│   │   │   └── ...
│   │   └── de/            # Deutsch
│   │       └── ...
│   └── utils/
│       ├── formatDate.js   # 日付フォーマット
│       └── formatNumber.js # 数値フォーマット
```

#### 翻訳ファイル例

```json
// en/common.json
{
  "button": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "create": "Create"
  },
  "photo": {
    "count_one": "{{count}} photo",
    "count_other": "{{count}} photos"
  }
}
```

```json
// ja/common.json
{
  "button": {
    "cancel": "キャンセル",
    "save": "保存",
    "delete": "削除",
    "create": "作成"
  },
  "photo": {
    "count": "{{count}}枚の写真"
  }
}
```

### Source Code Changes

**Frontend**:

| ファイル | 変更内容 |
|---------|---------|
| `src/i18n/index.js` | i18n設定（新規） |
| `src/i18n/locales/**/*.json` | 翻訳ファイル（新規） |
| `src/main.jsx` | i18n初期化 |
| `src/context/AppContext.jsx` | 言語設定のstate追加 |
| `src/App/Preferences.jsx` | 言語選択UI追加 |
| 全UIコンポーネント | `useTranslation`フック使用 |

**変換パターン例**:

```jsx
// Before
<button>Cancel</button>

// After
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();
<button>{t('button.cancel')}</button>
```

**日付フォーマット**:

```javascript
// Before (DateList.jsx)
const formattedDate = date.toLocaleDateString('en-CA');

// After
import { formatDate } from '../i18n/utils/formatDate';
const formattedDate = formatDate(date, i18n.language);
```

**Backend**:
- 基本的にバックエンドの変更は不要
- エラーメッセージはフロントエンドで翻訳

**Database**:
- `preferences`テーブルに`language`カラムを追加（既存の設定保存の仕組みを使用）

### 高優先度コンポーネント

翻訳文字列が多いコンポーネント：

1. `ContextualDeleteModal.jsx` - 8+ strings
2. `AlbumCreationModal.jsx` - 6+ strings
3. `Welcome.jsx` - 7+ strings
4. `SavedSearches.jsx` - 10+ strings
5. `RandomMessages.jsx` - 9 strings（写真のヒント）
6. `AdvancedFilters.jsx` - フィルター関連
7. `Preferences.jsx` - 設定ラベル

## Dependencies & Risks

### External Dependencies

**新規パッケージ**:
```json
{
  "i18next": "^23.x",
  "react-i18next": "^14.x",
  "i18next-browser-languagedetector": "^7.x"
}
```

### Performance
- **初期ロード**: 翻訳ファイルは小さい（各言語10-20KB程度）
- **遅延ロード**: 必要に応じてnamespaceごとに分割可能
- **メモリ**: 現在の言語のみロード

### Security
- リスクなし（静的な翻訳文字列のみ）

### 注意点
- 絵文字付きテキスト（"📚 Create Album"等）の扱い
- Tauri の `ask`/`confirm` ダイアログのラップ関数が必要
- ログメッセージは翻訳対象外（開発者向け）

## Testing Strategy

### Manual Testing
- [ ] 言語切り替えでUIが即座に更新される
- [ ] すべてのモーダル・ダイアログのテキストが翻訳される
- [ ] 日付フォーマットが言語に応じて変わる
- [ ] 複数形が正しく表示される（1 photo / 2 photos）
- [ ] プレースホルダーテキストが翻訳される
- [ ] ツールチップが翻訳される

### Edge Cases
- 翻訳キーが見つからない場合のフォールバック
- 非常に長い翻訳テキストでのレイアウト崩れ
- RTL言語（将来対応時）

## Implementation Phases

### Phase 1: 基盤構築
- [ ] i18next のセットアップ
- [ ] 翻訳ファイル構造の作成（en/ja/fr/de）
- [ ] 初回起動時の言語選択画面（Welcome.jsx を拡張）
- [ ] Preferences に言語設定追加
- [ ] 日付・数値フォーマットユーティリティ

#### 初回言語選択UI

Welcome画面の最初のステップとして言語選択を追加：

```
┌─────────────────────────────────────┐
│                                     │
│     🌐 Select Your Language         │
│                                     │
│     ┌─────────────────────────┐     │
│     │  🇺🇸  English           │     │
│     └─────────────────────────┘     │
│     ┌─────────────────────────┐     │
│     │  🇯🇵  日本語             │     │
│     └─────────────────────────┘     │
│     ┌─────────────────────────┐     │
│     │  🇫🇷  Français           │     │
│     └─────────────────────────┘     │
│     ┌─────────────────────────┐     │
│     │  🇩🇪  Deutsch            │     │
│     └─────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

- 言語選択後、設定を保存して通常のWelcome画面へ進む
- 選択した言語で以降のUIが表示される

### Phase 2: 主要UI翻訳
- [ ] モーダル類
- [ ] ボタン・ラベル
- [ ] メッセージ・エラー

### Phase 3: 完全対応
- [ ] ツールチップ
- [ ] プレースホルダー
- [ ] 動的テキスト
- [ ] Tauriダイアログ

## Decisions

| 項目 | 決定 |
|------|------|
| 初期対応言語 | 英語、日本語、フランス語、ドイツ語 |
| 言語選択 | 初回起動時に選択画面を表示 |
| 翻訳管理 | JSONファイル直接編集 |
| フォールバック | 英語 |

## Notes

- **日付フォーマット**: Preferencesで選択可能にする（言語設定とは独立）
  - 選択肢例: `2026-01-16` (ISO), `01/16/2026` (US), `16/01/2026` (EU), `2026/01/16` (JP)
  - デフォルトは選択した言語に応じたフォーマット
  - 翻訳ファイルへの影響なし
