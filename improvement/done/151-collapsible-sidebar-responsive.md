# 151: Collapsible Sidebar for Responsive UI

## 概要

画面幅が狭い場合、左サイドメニュー（LeftMenu）をアイコンのみ表示に縮小し、マウスホバーで全幅展開してセンターカラムの上に重なって表示する機能の実装。

## 背景

### 現在の実装
- **ファイル**: `src/App/LeftMenu.css:166-169`
- **動作**: 画面幅1000px以下で`display: none`（完全に非表示）
- **問題**:
  - ナビゲーションアイコンが使用できなくなる
  - DateListにアクセスできなくなる
  - モバイル/タブレットでの使い勝手が悪い

### 目標
- 画面幅が狭くても基本的なナビゲーションを維持
- ホバー時に全機能にアクセス可能
- センターカラム（PhotosList）の表示領域を最大化

## 設計方針

### アプローチ選択

**採用: アプローチA - CSS主体の実装**

理由:
1. JavaScriptコード変更が最小限
2. パフォーマンスが良好（CSS transitionのみ）
3. メンテナンスが容易
4. 段階的な改善が可能

将来的にユーザーフィードバックに基づいてReact State管理（アプローチB）に移行可能。

## 詳細設計

### 1. レスポンシブブレークポイント

```css
@media screen and (max-width: 1000px) {
  /* 既存のブレークポイントを活用 */
}
```

### 2. 縮小状態（Collapsed State）

#### 2.1 基本レイアウト
```css
.leftMenu {
  min-width: 60px;
  max-width: 60px;
  transition: max-width 0.3s ease, box-shadow 0.3s ease;
  overflow-x: hidden; /* 横スクロール防止 */
  position: relative; /* z-indexのベース */
}
```

**寸法の根拠**:
- 60px: ナビゲーションアイコン（28px）+ パディング（16px × 2）
- 最小限の幅でアイコンを快適にタップ可能

#### 2.2 アイコンレイアウト調整
```css
.leftMenu .navigation-icons {
  flex-direction: column; /* 縦並びに変更 */
  gap: 12px; /* 縦方向のスペース増加 */
  padding: 12px 0;
}

.leftMenu .navigation-icons a {
  min-width: 36px;  /* タッチ対応サイズ */
  min-height: 36px;
}
```

**変更理由**:
- 横幅60pxに収めるため縦並びが必須
- タッチデバイス対応（最小44×44px推奨）

#### 2.3 コンテンツの非表示
```css
.leftMenu:not(:hover) .dateList,
.leftMenu:not(:hover) .row {
  display: none;
}
```

### 3. 展開状態（Expanded State - Hover時）

#### 3.1 オーバーレイ表示
```css
.leftMenu:hover {
  max-width: 230px; /* 元の幅に戻す */
  position: absolute;
  top: 0;
  left: 0;
  height: calc(100vh - 30px);
  z-index: 1000; /* PhotosListの上に表示 */
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
}
```

**z-index階層**:
- PhotosList: デフォルト（z-index未設定 = 0）
- 展開したLeftMenu: 1000
- モーダル: 2000以上（既存）

#### 3.2 アイコン配置を戻す
```css
.leftMenu:hover .navigation-icons {
  flex-direction: row; /* 横並びに戻す */
  gap: 8px;
  padding: 6px 0;
}

.leftMenu:hover .navigation-icons a {
  min-width: 28px;
  min-height: 28px;
}
```

#### 3.3 コンテンツ表示
```css
.leftMenu:hover .dateList,
.leftMenu:hover .row {
  display: block; /* 再表示 */
}
```

### 4. アニメーション

#### 4.1 展開/縮小のトランジション
```css
.leftMenu {
  transition:
    max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.3s ease;
}
```

**イージング関数**:
- `cubic-bezier(0.4, 0, 0.2, 1)`: Material Design標準
- スムーズな加速/減速

#### 4.2 コンテンツフェードイン
```css
.leftMenu:hover .dateList {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### 5. センターカラムとの関係

#### 5.1 現在のレイアウト構造
```
.inner-container (flex)
├── .leftMenu (flex: 1, max-width: 230px)
└── PhotosList (flex: 1)
```

#### 5.2 レスポンシブ時のレイアウト
```
.inner-container (flex)
├── .leftMenu (max-width: 60px)
│   └── :hover時 → position: absolute で通常フロー外
└── PhotosList (flex: 1) ← 幅は変わらない
```

**重要**:
- `position: absolute`により、ホバー時もPhotosList領域は変化しない
- センターカラムのレイアウトシフトなし（CLS対策）

### 6. アクセシビリティ

#### 6.1 キーボードナビゲーション
```css
.leftMenu:focus-within {
  max-width: 230px;
  position: absolute;
  z-index: 1000;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
}
```

**`:focus-within`**:
- キーボードでナビゲーション時に自動展開
- タブキーでの操作に対応

#### 6.2 ARIAラベル
```jsx
<div
  id="leftMenu"
  className="leftMenu"
  aria-label="Main navigation sidebar"
  role="navigation"
>
```

### 7. タッチデバイス対応

#### 7.1 問題点
- `:hover`はタッチデバイスでは使いづらい
- タップで展開→別の場所タップで閉じる動作が必要

#### 7.2 対策（Phase 2での実装）
```jsx
// App.jsx - 将来的な拡張
const [sidebarExpanded, setSidebarExpanded] = useState(false);

// タッチデバイス判定
const isTouchDevice = 'ontouchstart' in window;

<div
  className={`leftMenu ${sidebarExpanded ? 'expanded' : ''}`}
  onClick={() => isTouchDevice && setSidebarExpanded(!sidebarExpanded)}
>
```

**Phase 1では**:
- CSS `:hover`のみで実装
- タッチデバイスではホバーと同等の動作（一度タップで固定展開）

## 実装ファイル

### 変更対象ファイル

#### 1. `src/App/LeftMenu.css`
- **行数**: 166-169行目を置き換え
- **変更箇所**: `@media screen and (max-width: 1000px)`ブロック
- **影響範囲**: レスポンシブ表示のみ（デスクトップ表示は変更なし）

### 変更内容

```css
/* Before */
@media screen and (max-width: 1000px) {
  .leftMenu {
    display: none;
  }
}

/* After */
@media screen and (max-width: 1000px) {
  /* Collapsed state - icon-only sidebar */
  .leftMenu {
    min-width: 60px;
    max-width: 60px;
    transition: max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 0.3s ease;
    overflow-x: hidden;
    position: relative;
  }

  /* Vertical icon layout in collapsed state */
  .leftMenu:not(:hover):not(:focus-within) .navigation-icons {
    flex-direction: column;
    gap: 12px;
    padding: 12px 0;
  }

  .leftMenu:not(:hover):not(:focus-within) .navigation-icons a {
    min-width: 36px;
    min-height: 36px;
  }

  /* Hide content in collapsed state */
  .leftMenu:not(:hover):not(:focus-within) .dateList,
  .leftMenu:not(:hover):not(:focus-within) .row {
    display: none;
  }

  /* Expanded state - overlay on hover/focus */
  .leftMenu:hover,
  .leftMenu:focus-within {
    max-width: 230px;
    position: absolute;
    top: 0;
    left: 0;
    height: calc(100vh - 30px);
    z-index: 1000;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.5);
  }

  /* Restore horizontal icon layout when expanded */
  .leftMenu:hover .navigation-icons,
  .leftMenu:focus-within .navigation-icons {
    flex-direction: row;
    gap: 8px;
    padding: 6px 0;
  }

  .leftMenu:hover .navigation-icons a,
  .leftMenu:focus-within .navigation-icons a {
    min-width: 28px;
    min-height: 28px;
  }

  /* Show content when expanded */
  .leftMenu:hover .dateList,
  .leftMenu:hover .row,
  .leftMenu:focus-within .dateList,
  .leftMenu:focus-within .row {
    display: block;
    animation: fadeIn 0.2s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}
```

## テスト計画

### 1. 機能テスト

#### 1.1 デスクトップ（> 1000px）
- [ ] 左メニューが常に230px幅で表示される
- [ ] ナビゲーションアイコンが横並びで表示される
- [ ] DateListが常に表示される
- [ ] レイアウトに変化がない（既存動作維持）

#### 1.2 タブレット/モバイル（≤ 1000px）
- [ ] 初期状態で60px幅のアイコンのみ表示
- [ ] ナビゲーションアイコンが縦並びで表示される
- [ ] DateListが非表示
- [ ] ホバー時に230px幅に展開
- [ ] 展開時にDateListが表示される
- [ ] 展開時にPhotosList領域の上に重なる（レイアウトシフトなし）
- [ ] マウスアウト時に60px幅に戻る

#### 1.3 キーボードナビゲーション
- [ ] Tab キーでナビゲーションアイコンにフォーカス可能
- [ ] フォーカス時に自動展開
- [ ] フォーカスアウト時に縮小

### 2. パフォーマンステスト

#### 2.1 アニメーションパフォーマンス
- [ ] 60fps維持（Chrome DevTools Performance）
- [ ] レイアウトシフト（CLS）が発生しない
- [ ] リペイント範囲が最小限

#### 2.2 メモリ使用量
- [ ] 展開/縮小を繰り返してもメモリリークがない

### 3. ブラウザ互換性テスト

#### 対象ブラウザ
- [ ] Chrome/Edge (Chromium) - 最新版
- [ ] Firefox - 最新版
- [ ] Safari - 最新版（macOS）

#### 確認項目
- [ ] CSS transitions が正常動作
- [ ] `:focus-within` が動作（Safari 10.1+で対応）
- [ ] `cubic-bezier`イージングが適用される

### 4. レスポンシブテスト

#### テスト解像度
- [ ] 1920×1080（デスクトップ）- 変更なし
- [ ] 1366×768（小型ノートPC）- 変更なし
- [ ] 1024×768（タブレット横）- 縮小モード
- [ ] 768×1024（タブレット縦）- 縮小モード
- [ ] 375×667（iPhone SE）- 縮小モード

### 5. アクセシビリティテスト

- [ ] キーボードのみで全機能にアクセス可能
- [ ] スクリーンリーダーでナビゲーション可能（NVDA/VoiceOver）
- [ ] フォーカスインジケーターが明確に表示される
- [ ] カラーコントラスト比が十分（WCAG AA基準）

## 実装手順

### Phase 1: CSS実装（本リリース）

1. **準備**
   - [ ] ブランチ作成: `feature/151-collapsible-sidebar`
   - [ ] 現在の動作を確認（スクリーンショット）

2. **CSS変更**
   - [ ] `src/App/LeftMenu.css` 166-169行目を新しいコードに置き換え
   - [ ] fadeInアニメーションを追加

3. **テスト**
   - [ ] デスクトップ表示確認（変更なし）
   - [ ] レスポンシブ表示確認（1000px以下）
   - [ ] アニメーション動作確認
   - [ ] キーボードナビゲーション確認

4. **調整**
   - [ ] アニメーション速度調整（必要に応じて）
   - [ ] 影の濃さ調整（必要に応じて）
   - [ ] 最小幅の微調整（必要に応じて）

5. **コミット**
   - [ ] `cargo check` でビルド確認
   - [ ] コミット作成
   - [ ] プッシュ

### Phase 2: React State管理（将来の拡張）

ユーザーフィードバックに基づき、必要に応じて実装:

1. **State追加**
   - App.jsxに`sidebarExpanded` state追加
   - タッチデバイス判定ロジック

2. **トグル機能**
   - ハンバーガーメニューボタン追加
   - クリック/タップでトグル

3. **永続化**
   - LocalStorageに展開状態を保存
   - アプリ起動時に復元

## パフォーマンス考慮事項

### 1. CSS Transform vs Width

**現在の実装**: `max-width`変更

**代替案**: `transform: translateX()`
```css
.leftMenu {
  width: 230px;
  transform: translateX(-170px); /* 60pxのみ表示 */
}
.leftMenu:hover {
  transform: translateX(0);
}
```

**採用しない理由**:
- `transform`の方が高速だが、レイアウトフローに影響
- `position: absolute`と併用すると複雑化
- 現在の`max-width`実装で十分なパフォーマンス

### 2. Willchange

ホバー頻度が高い場合、最適化を検討:
```css
.leftMenu {
  will-change: max-width, box-shadow;
}
```

**現時点では不要**:
- ホバー時のみの変更で頻度は低い
- 常時適用するとメモリ消費増加

## 既知の制限事項

### 1. タッチデバイスでのUX

**問題**:
- `:hover`はタッチデバイスで「タップ→固定」動作
- 閉じるには別の場所をタップが必要

**対策**:
- Phase 2でReact State管理を実装
- ハンバーガーメニューボタン追加

### 2. 非常に狭い画面（< 400px）

**問題**:
- 60px幅でも画面を圧迫する可能性

**対策案**:
```css
@media screen and (max-width: 400px) {
  .leftMenu {
    min-width: 48px;
    max-width: 48px;
  }
}
```

### 3. DateListの長さ

**問題**:
- DateListが非常に長い場合、展開時にスクロールが必要

**現状**:
- `.leftMenu .dateList`に既に`overflow-y: auto`が設定済み
- 問題なし

## CSS詳細仕様

### セレクター詳細度

```
.leftMenu:not(:hover):not(:focus-within) .navigation-icons
                                           ^^^^^^^^^^^^^^^^^^^
詳細度: 0-3-0 (IDs-Classes/Attributes-Elements)
- :not() = 0
- :hover/:focus-within = 1×2
- .leftMenu/.navigation-icons = 1×2
```

既存のスタイルより優先度が高いことを確認済み。

### ブラウザプレフィックス

不要な理由:
- `transition`: 全モダンブラウザで対応
- `:focus-within`: Safari 10.1+, Chrome 60+, Firefox 52+
- `cubic-bezier`: 全ブラウザで対応
- `@keyframes`: 全ブラウザで対応

Tauriの最小要件（Chromium 90+相当）を満たしている。

## レイアウトシフト（CLS）対策

### 問題の可能性
- ホバー時に`position: absolute`に変更
- 通常フローから外れることでレイアウトシフトの可能性

### 対策
1. **初期状態でスペース確保**
   ```css
   .inner-container {
     /* 60px分のスペースは常に確保 */
   }
   ```

2. **PhotosListは影響を受けない**
   - `position: absolute`により、PhotosList領域は固定
   - Flexboxレイアウトは60px幅のままを維持

3. **測定**
   - Chrome DevToolsのLighthouseでCLS測定
   - 目標: CLS < 0.1（Good）

## ユーザー設定（将来の拡張）

Phase 2以降で検討:

```yaml
# ~/.photoclove.yml
ui:
  sidebar:
    auto_collapse: true          # 自動縮小有効
    collapse_width: 60           # 縮小時の幅（px）
    expand_on_hover: true        # ホバーで展開
    persist_state: false         # 状態を保存しない
```

## 参考資料

### 類似実装例
- **Discord**: アイコンのみサイドバー
- **VS Code**: アクティビティバーの折りたたみ
- **Slack**: サイドバーの自動非表示

### CSS技術
- [MDN: :focus-within](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-within)
- [MDN: cubic-bezier()](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function)
- [CSS Tricks: Overlay Pattern](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)

## まとめ

### 実装の利点
1. **ユーザビリティ向上**: 狭い画面でもナビゲーション可能
2. **画面スペース効率**: PhotosList表示領域を最大化
3. **シンプルな実装**: CSS変更のみ、JavaScriptコード変更なし
4. **パフォーマンス**: 高速なCSS transitionのみ使用
5. **アクセシビリティ**: キーボードナビゲーション対応

### 次のステップ
1. Phase 1実装（このドキュメント）
2. ユーザーフィードバック収集
3. Phase 2検討（React State管理）

---

**作成日**: 2025-12-31
**バージョン**: 1.0
**ステータス**: Design Complete - Ready for Implementation
