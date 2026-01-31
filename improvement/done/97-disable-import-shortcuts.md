# Improvement #97: Disable DB-related keyboard shortcuts in import mode

## 問題

PhotosListMini（フルスクリーン表示）で、import modeでもDB関連のキーボードショートカットが有効になっている。

### 無効にすべきショートカット

- **s**: Star増加（DB操作）
- **d**: Star減少（DB操作）
- **f**: Favorite（選択+star、DB操作）
- **Del**: ファイル削除（import modeでは削除不可）

### 有効のままにすべきショートカット

- **矢印キー**: 写真移動
- **c**: 選択（import modeでも有効）
- **i**: Info表示
- **?**: ヘルプ表示
- **Ctrl+0**: Zoom reset
- **上下矢印**: サムネイル一覧の開閉

## 解決策

`useKeyboardShortcuts.js`で`isImportMode`フラグを受け取り、DB関連ショートカットを無効化。

### 実装方針

#### Phase 1: isImportModeフラグの伝播

**PhotosListMini.jsx → useKeyboardShortcuts**:
```javascript
const keyboardHandlers = useKeyboardShortcuts(
    {
        // ... handlers
    },
    {
        // ... state
        isImportMode: props.isImportMode  // 追加
    }
);
```

#### Phase 2: ショートカットの条件付き実行

**useKeyboardShortcuts.js** (line 52-93):
```javascript
} else if (e.keyCode === 83) { // s - increase star
    // Disable in import mode
    if (!state.isImportMode) {
        handlers.changeStar(true);
    }
} else if (e.keyCode === 68) { // d - decrease star
    // Disable in import mode
    if (!state.isImportMode) {
        handlers.changeStar(false);
    }
} else if (e.keyCode === 70) { // f - favorite
    // Disable in import mode
    if (!state.isImportMode) {
        let additionalMessage = "Photo is selected";
        if (state.isSelected(f)) {
            additionalMessage = "Photo is already selected";
        } else {
            state.toggleSelection(state.currentPhotoPath);
        }
        handlers.changeStar(true, additionalMessage);
    }
} else if (e.keyCode === 46) { // Del
    // Disable in import mode
    if (!state.isImportMode) {
        e.preventDefault();
        // ... existing delete logic
    }
}
```

### 変更ファイル

1. `src/App/PhotosList.jsx`: PhotosListMiniに`isImportMode`を渡す
2. `src/App/PhotosList/PhotosListMini.jsx`: useKeyboardShortcutsに`isImportMode`を渡す
3. `src/App/PhotosList/PhotosListMini/useKeyboardShortcuts.js`: 条件付きショートカット実行

### 期待される効果

- Import modeで無意味なDB操作ショートカットが無効化
- ユーザーの混乱を防ぐ
- 有用なショートカット（c, 矢印, i, ?など）は引き続き利用可能

### テスト項目

1. Import modeでs/d/f/Delキーが無効化される
2. Import modeでc（選択）、矢印キー、i、?が有効
3. 通常モードで全てのショートカットが正常動作
