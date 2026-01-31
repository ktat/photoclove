# Phase 5: Cross-Cutting Concerns Refactoring

## Overview

複数のコンポーネントで繰り返されるパターンを共通フック・サービスとして抽出し、コードの重複を排除します。

## Target Structure

```
src/
  ├── hooks/
  │   ├── useModalState.js (新規)
  │   └── usePhotoOperationFlow.js (新規)
  ├── services/
  │   └── TauriService.js (新規)
  └── utils/
      └── orientationUtils.js (既存 - 173行, 2025-01追加)
```

**注**: `orientationUtils.js` は EXIF orientation 処理の共通ユーティリティとして 2025-01 に追加されました。このパターンに従って、他の共通処理も utils/ に抽出していきます。

## Implementation Details

### useModalState.js

複数のモーダル状態を管理する共通フック:

```javascript
// hooks/useModalState.js
import { useState, useCallback } from 'react';

export function useModalState(modalNames) {
    const initialState = modalNames.reduce((acc, name) => {
        acc[name] = false;
        return acc;
    }, {});

    const [modalState, setModalState] = useState(initialState);

    const openModal = useCallback((name) => {
        setModalState({ ...initialState, [name]: true });
    }, [initialState]);

    const closeModal = useCallback(() => {
        setModalState(initialState);
    }, [initialState]);

    const isOpen = useCallback((name) => modalState[name], [modalState]);

    return { modalState, openModal, closeModal, isOpen };
}

// 使用例
const { modalState, openModal, closeModal } = useModalState([
    'deleteConfirm',
    'albumSelect',
    'tagBulkAdd',
]);

// モーダルを開く
openModal('deleteConfirm');

// 状態を確認
if (modalState.deleteConfirm) { ... }

// すべて閉じる
closeModal();
```

### TauriService.js

Tauri呼び出しとエラーハンドリングを統一:

```javascript
// services/TauriService.js
import { invoke } from '@tauri-apps/api/core';
import { logger } from './LoggerService';

export async function invokeWithErrorHandling(
    command,
    args = {},
    context = 'TauriService',
    options = {}
) {
    const { silent = false, correlationId } = options;

    if (!silent) {
        logger.info(context, `${command}_request`, `Invoking ${command}`, args);
    }

    try {
        const result = await invoke(command, args);

        if (!silent) {
            logger.info(context, `${command}_success`, `${command} completed successfully`);
        }

        return result;
    } catch (error) {
        logger.error(context, `${command}_failed`, `${command} failed`, {
            error: error.toString(),
            args,
            correlationId,
        });

        throw error;
    }
}

// バッチ操作用
export async function invokeWithProgress(
    command,
    items,
    argBuilder,
    options = {}
) {
    const { onProgress, context = 'TauriService' } = options;
    const results = [];

    for (let i = 0; i < items.length; i++) {
        const result = await invokeWithErrorHandling(
            command,
            argBuilder(items[i]),
            context,
            { silent: true }
        );
        results.push(result);

        if (onProgress) {
            onProgress(i + 1, items.length);
        }
    }

    return results;
}

// 使用例
import { invokeWithErrorHandling } from '../services/TauriService';

const result = await invokeWithErrorHandling(
    'get_photos_unified',
    { request: photoParams },
    'PhotosList',
    { correlationId }
);
```

### usePhotoOperationFlow.js

写真操作の共通フロー（選択 → 確認 → 実行 → UI更新）:

```javascript
// hooks/usePhotoOperationFlow.js
import { useState, useCallback } from 'react';

export function usePhotoOperationFlow({ onSuccess, onError }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmation, setConfirmation] = useState(null);

    const executeOperation = useCallback(async (
        operation,
        photos,
        confirmationMessage
    ) => {
        // 1. 確認が必要な場合
        if (confirmationMessage) {
            setConfirmation({
                message: confirmationMessage,
                onConfirm: async () => {
                    setConfirmation(null);
                    await performOperation(operation, photos);
                },
                onCancel: () => setConfirmation(null),
            });
            return;
        }

        // 2. 確認不要な場合、直接実行
        await performOperation(operation, photos);
    }, []);

    const performOperation = async (operation, photos) => {
        setIsProcessing(true);
        try {
            const result = await operation(photos);
            if (onSuccess) onSuccess(result);
        } catch (error) {
            if (onError) onError(error);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        executeOperation,
        isProcessing,
        confirmation,
        clearConfirmation: () => setConfirmation(null),
    };
}

// 使用例
const { executeOperation, isProcessing, confirmation } = usePhotoOperationFlow({
    onSuccess: () => refreshPhotos(),
    onError: (error) => showError(error.message),
});

// 削除操作
await executeOperation(
    (photos) => invoke('delete_photos', { paths: photos.map(p => p.path) }),
    selectedPhotos,
    `${selectedPhotos.length}枚の写真を削除しますか？`
);

// JSX での確認ダイアログ表示
{confirmation && (
    <ConfirmationDialog
        message={confirmation.message}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel}
    />
)}
```

## Implementation Steps

1. `useModalState.js` フックを作成
2. `TauriService.js` サービスを作成
3. `usePhotoOperationFlow.js` フックを作成
4. 既存コンポーネントを新しいフック・サービスを使用するように更新:
   - DirectoryMenu.jsx
   - PhotosListMini.jsx
   - PhotoEditor.jsx
5. テストと動作確認

## Usage Migration Examples

### Before (DirectoryMenu.jsx)

```javascript
// 各モーダルの状態を個別に管理
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [showAlbumSelect, setShowAlbumSelect] = useState(false);
const [showTagBulkAdd, setShowTagBulkAdd] = useState(false);

// invoke呼び出しごとにエラーハンドリング
try {
    logger.info('DirectoryMenu', 'delete_photos_request', 'Deleting photos');
    await invoke('delete_photos', { paths });
    logger.info('DirectoryMenu', 'delete_photos_success', 'Photos deleted');
} catch (error) {
    logger.error('DirectoryMenu', 'delete_photos_failed', 'Delete failed', { error });
}
```

### After (DirectoryMenu.jsx)

```javascript
// モーダル状態を一元管理
const { modalState, openModal, closeModal } = useModalState([
    'deleteConfirm',
    'albumSelect',
    'tagBulkAdd',
]);

// 統一されたinvoke呼び出し
await invokeWithErrorHandling(
    'delete_photos',
    { paths },
    'DirectoryMenu'
);
```

## Testing Checklist

### useModalState
- [ ] 複数のモーダルを管理できる
- [ ] openModal() で特定のモーダルが開く
- [ ] closeModal() で全モーダルが閉じる
- [ ] 一度に1つのモーダルのみ開く

### TauriService
- [ ] invokeWithErrorHandling が正常に動作する
- [ ] 成功時にログが出力される
- [ ] エラー時にログが出力される
- [ ] silent オプションでログを抑制できる
- [ ] invokeWithProgress が進捗を報告する

### usePhotoOperationFlow
- [ ] 確認メッセージありの操作が動作する
- [ ] 確認メッセージなしの操作が動作する
- [ ] isProcessing が正しく更新される
- [ ] onSuccess コールバックが呼ばれる
- [ ] onError コールバックが呼ばれる

## Expected Outcome

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| モーダル状態管理の重複 | 15+ 箇所 | 0 |
| Tauri呼び出しパターンの重複 | 30+ 箇所 | 0 |
| 操作フローの重複 | 10+ 箇所 | 0 |
| 新規共通モジュール | 0 | 3ファイル |
