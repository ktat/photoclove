# 通知センター（Notification Center）実装計画

## Context

フッターがランダムメッセージと通知表示を兼任しており、通知が埋もれて気づけない・再確認できない問題を解決する。VerticalTabBar の一番下に通知ベルアイコン（バッジ付き）を常時表示し、クリックでモーダルを開いて通知一覧を確認できるようにする。

**決定事項**:
- 常に表示、一番下にアイコン設置
- localStorage に最大500件保存
- すべてのフッターメッセージ + エラーを蓄積
- 通知センター（モーダル）を開くまで未読、開いたら既読
- 既存のフッター・ErrorToast の動作はそのまま維持

---

## Step 1: useNotifications フック作成

**新規ファイル**: `src/hooks/useNotifications.js`

通知の状態管理と localStorage 永続化を担当するカスタムフック。

```javascript
// 機能:
// - notifications state (配列)
// - unreadCount (未読件数)
// - addNotification(category, message) - 通知追加
// - markAllAsRead() - モーダルを開いた時に呼ぶ
// - clearAll() - すべてクリア
// - localStorage 読み書き (キー: photoclove_notifications)
// - 最大500件制限 (古いものから自動削除)
```

**通知データ構造**:
```javascript
{
  id: string,          // crypto.randomUUID()
  category: string,    // 'album_op', 'tag_op', 'error' 等
  message: string,
  timestamp: string,   // ISO 8601
  type: 'info' | 'error'  // フッターメッセージ or エラー
}
```

既読管理は `lastReadTimestamp` で行う（通知センターを開いた時のタイムスタンプを保存し、それ以前の通知は既読扱い）。

---

## Step 2: UIContext に通知フック統合

**編集**: `src/context/UIContext.jsx`

- `useNotifications()` フックを呼び出し
- `addFooterMessage` 内で `addNotification` も呼ぶ
- 通知関連の値を Context value に追加: `notifications`, `unreadCount`, `addNotification`, `markAllAsRead`, `clearAllNotifications`

---

## Step 3: ErrorContext にも通知連携追加

**編集**: `src/context/ErrorContext.jsx`

- `addError` 内で、UIContext の `addNotification` を呼ぶ
- ただし ErrorContext は UIContext より外側の Provider なので、直接参照できない
- **対策**: `window.dispatchEvent(new CustomEvent('notification-add', { detail: { category, message, type } }))` のイベント方式で連携
- useNotifications フック側で `notification-add` イベントをリスンして追加

---

## Step 4: NotificationBell コンポーネント作成

**新規ファイル**: `src/components/NotificationBell.jsx`
**新規ファイル**: `src/components/NotificationBell.module.css`

ベルアイコン + 未読バッジ。クリックで通知センターモーダルを開く。

```
[🔔]  ← VerticalTabBar の一番下
 (3)  ← 未読件数バッジ (赤丸)
```

- VerticalTabBar のタブボタンと同じ幅(30px)で統一
- バッジは `--color-danger` 背景の小さな丸で未読件数表示
- 未読0件の時はバッジ非表示（ベルアイコンは常時表示）

---

## Step 5: NotificationCenterModal コンポーネント作成

**新規ファイル**: `src/components/NotificationCenterModal.jsx`
**新規ファイル**: `src/components/NotificationCenterModal.module.css`

BaseModal を使ったモーダル。

- ヘッダー: "Notifications" + 件数
- コンテンツ: 通知リスト（新しい順）
  - 各通知: カテゴリアイコン + メッセージ + タイムスタンプ(相対時間)
  - type='error' は左ボーダーに `--color-danger`
  - type='info' は左ボーダーに `--color-info`
- フッター: 「Clear All」ボタン
- **開いた瞬間に `markAllAsRead()` を呼ぶ** → 全て既読に

---

## Step 6: VerticalTabBar に NotificationBell 統合

**編集**: `src/components/VerticalTabBar.jsx`
**編集**: `src/components/VerticalTabBar.css`

- 閉じるボタン(×)の下に NotificationBell を配置
- props: `unreadCount`, `onNotificationClick`

**編集**: `src/App/PhotosList.jsx`

- VerticalTabBar に `unreadCount` と `onNotificationClick` を渡す
- モーダルの open/close state を管理
- NotificationCenterModal をレンダリング

---

## 変更ファイル一覧

| ファイル | 変更 |
|---------|------|
| `src/hooks/useNotifications.js` | **新規** - 通知管理フック |
| `src/context/UIContext.jsx` | 編集 - 通知フック統合 |
| `src/context/ErrorContext.jsx` | 編集 - エラー発生時に CustomEvent 発火 |
| `src/components/NotificationBell.jsx` | **新規** - ベルアイコン+バッジ |
| `src/components/NotificationBell.module.css` | **新規** - スタイル |
| `src/components/NotificationCenterModal.jsx` | **新規** - モーダル |
| `src/components/NotificationCenterModal.module.css` | **新規** - スタイル |
| `src/components/VerticalTabBar.jsx` | 編集 - ベル配置 |
| `src/components/VerticalTabBar.css` | 編集 - ベル用スタイル |
| `src/App/PhotosList.jsx` | 編集 - モーダル state + props 追加 |

---

## Verification

1. フッターメッセージ発生時（アルバム操作、タグ操作等）に通知が蓄積されることを確認
2. ErrorToast 表示時にも通知が蓄積されることを確認
3. VerticalTabBar 下部にベルアイコンが常時表示されることを確認
4. 未読通知がある場合にバッジに件数が表示されることを確認
5. ベルクリックでモーダルが開き、通知一覧が表示されることを確認
6. モーダルを開いたら未読がリセットされることを確認
7. 「Clear All」で全通知がクリアされることを確認
8. ブラウザリロード後も通知が localStorage から復元されることを確認
9. 500件を超えた場合に古い通知が自動削除されることを確認
10. `pnpm lint` が通ることを確認
