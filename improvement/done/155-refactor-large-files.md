# Refactor Large Files to Improve Maintainability

## Overview

PhotoCloveには900〜1072行の大きなファイルが5つ存在し、保守性とテスト容易性を低下させています。このリファクタリングでは、これらのファイルをより小さく、焦点を絞ったモジュールに分割し、コードの重複を排除し、全体的な保守性を向上させます。

## User Impact

### 開発者への影響
- **保守性の向上**: 各ファイルが単一の責任を持つため、バグ修正や機能追加が容易
- **テスト容易性**: 小さなモジュールは独立してテストしやすい
- **コードレビュー**: 小さなファイルは変更の影響範囲が明確
- **新規開発者**: コードベースの理解が容易になる

### エンドユーザーへの影響
- パフォーマンスへの影響なし（リファクタリングのみ）
- 機能の変更なし（内部構造のみ変更）
- 長期的にはバグ修正が速くなり、新機能の追加が容易になる

## Current State Analysis

### 問題のあるファイル

| ファイル | 行数 | 主な責任 | 課題 |
|---------|------|---------|------|
| PhotosList.jsx | 1,072 | メインオーケストレーション、15+カスタムフック統合 | プロップドリリング、ハンドラー管理 |
| PhotoEditor.jsx | 980 | CSS編集、クロップ、画像処理 | コード重複（300行）、複雑なキャンバス処理 |
| PhotosListMini.jsx | 972 | サムネイル表示、ナビゲーション、削除操作 | 混在した関心事 |
| photo_commands.rs | 934 | 写真取得、10+検索タイプ | 巨大なmatch文（400行） |
| DirectoryMenu.jsx | 899 | 写真操作、アルバム/タグ操作、チュートリアル | 混在した操作ロジック |

**合計**: 4,857行のコードが5ファイルに集中

**注**: 2025-01 の EXIF orientation 修正により、PhotosListMini.jsx と photo_commands.rs の行数が増加。また、共通ユーティリティとして `src/utils/orientationUtils.js` (173行) が追加されています。

### コードの重複

1. **画像処理ロジック** (PhotoEditor.jsx): `saveAsCopy()`と`downloadStyled()`に同一のフィルター処理コード（約150行）
2. **モーダル管理パターン**: DirectoryMenu.jsx と PhotosListMini.jsx で同様のパターンを繰り返し
3. **Tauri呼び出し + エラーハンドリング**: 全フロントエンドファイルで繰り返されるパターン
4. **写真操作フロー**: 選択 → 確認 → バックエンド操作 → UI更新のパターンが複数箇所に

## Influence on Existing Features

### 互換性
- **破壊的変更なし**: 純粋なリファクタリング、APIやプロップインターフェースは維持
- **段階的移行**: ファイルごとに個別にリファクタリング可能
- **既存機能への影響**: なし（内部構造のみ変更）

### 関連機能
- すべての主要機能に影響（PhotosList関連）
- タグシステム（DirectoryMenu）
- 写真編集（PhotoEditor）
- サムネイル表示（PhotosListMini）

## Implementation Approach

### Phase 1: Backend Refactoring (High Priority)

#### 1. photo_commands.rs の分割 (~400行削減)

**現在の構造**:
```rust
// photo_commands.rs (920 lines)
pub async fn get_photos_unified(...) -> Result<String, ()> {
    match request {
        PhotoRequest::Search { search_type, .. } => {
            match search_type.as_str() {
                "recent" => { /* 50 lines */ },
                "date" => { /* 70 lines */ },
                "album_photos" => { /* 80 lines */ },
                "tag" => { /* 150 lines */ },
                "search" => { /* 120 lines */ },
                "trash" => { /* 120 lines */ },
                // ... etc
            }
        }
    }
}
```

**リファクタリング後の構造**:
```rust
// commands/photo_commands.rs (150 lines - ルーターのみ)
pub async fn get_photos_unified(...) -> Result<String, ()> {
    match request {
        PhotoRequest::Search { search_type, .. } => {
            match search_type.as_str() {
                "recent" => handlers::recent::handle(...).await,
                "date" => handlers::date::handle(...).await,
                "album_photos" => handlers::album::handle(...).await,
                "tag" => handlers::tag::handle(...).await,
                "search" => handlers::search::handle(...).await,
                "trash" => handlers::trash::handle(...).await,
                "all_albums" => handlers::collections::handle_albums(...).await,
                "all_tags" => handlers::collections::handle_tags(...).await,
                _ => Err(format!("Unsupported search type: {}", search_type)),
            }
        }
        // ... other request types
    }
}

// commands/photo_handlers/recent.rs (~50 lines)
pub async fn handle(
    state: &State,
    config: &Config,
    meta_db: &SQLite,
    params: RecentParams,
) -> Result<String, String> {
    // Recent photos logic only
}

// commands/photo_handlers/date.rs (~70 lines)
pub async fn handle(...) -> Result<String, String> {
    // Date-based search logic only
}

// ... 他のハンドラー
```

**新規ファイル構造**:
```
src-tauri/src/commands/
  ├── photo_commands.rs (150 lines - router)
  └── photo_handlers/
      ├── mod.rs (20 lines)
      ├── recent.rs (50 lines)
      ├── date.rs (70 lines)
      ├── album.rs (80 lines)
      ├── tag.rs (150 lines)
      ├── search.rs (120 lines)
      ├── trash.rs (120 lines)
      ├── collections.rs (50 lines)
      └── navigation.rs (100 lines - next/prev logic)
```

**メリット**:
- 各ハンドラーが独立してテスト可能
- 新しい検索タイプの追加が容易
- コードレビューが簡単（関連コードのみ）
- コンパイル時間の改善（変更されたモジュールのみ再コンパイル）

#### 2. photo_navigation.rs の抽出 (~100行削減)

`get_next_photo()`と`get_prev_photo()`はほぼ同一のロジックを持つため、統合：

```rust
// commands/photo_handlers/navigation.rs
enum Direction {
    Next,
    Previous,
}

pub async fn get_adjacent_photo(
    state: &State,
    direction: Direction,
    current_path: &str,
    search_params: SearchParams,
) -> Result<Option<Photo>, String> {
    // Unified navigation logic
}

// photo_commands.rs
#[tauri::command]
pub async fn get_next_photo(...) -> Result<Option<Photo>, ()> {
    navigation::get_adjacent_photo(state, Direction::Next, current_path, search_params).await
}

#[tauri::command]
pub async fn get_prev_photo(...) -> Result<Option<Photo>, ()> {
    navigation::get_adjacent_photo(state, Direction::Previous, current_path, search_params).await
}
```

### Phase 2: Frontend Component Refactoring (High Priority)

#### 3. PhotoEditor.jsx の分割 (~500行削減、重複排除)

**問題点**:
- `saveAsCopy()`と`downloadStyled()`に同一のフィルター処理コード（150行の重複）
- 複雑なクロップインタラクションロジック（150行）
- 大量の繰り返しコントロールJSX（200行）

**新規構造**:
```
src/App/PhotosList/PhotoOption/
  ├── PhotoEditor.jsx (300 lines - メインコンポーネント)
  └── PhotoEditor/
      ├── imageProcessing.js (200 lines - 画像処理ロジック)
      ├── CropTool.jsx (100 lines - クロップUI)
      ├── useCropInteractions.js (100 lines - マウスインタラクション)
      ├── EditorControl.jsx (50 lines - 再利用可能なコントロール)
      ├── cssUtils.js (既存)
      ├── cropUtils.js (既存)
      └── styleUtils.js (既存)
```

**imageProcessing.js**:
```javascript
// PhotoEditor/imageProcessing.js
export function applyImageFilters(canvas, ctx, editorStyles) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 共通のピクセル操作ロジック
    for (let i = 0; i < data.length; i += 4) {
        // Brightness
        data[i] = data[i] * (editorStyles.brightness / 100);
        data[i + 1] = data[i + 1] * (editorStyles.brightness / 100);
        data[i + 2] = data[i + 2] * (editorStyles.brightness / 100);

        // Contrast
        // ... etc
    }

    ctx.putImageData(imageData, 0, 0);
}

export function canvasToBlob(canvas, mimeType = 'image/jpeg') {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Canvas to blob failed')),
            mimeType,
            0.95
        );
    });
}
```

**EditorControl.jsx**:
```javascript
// PhotoEditor/EditorControl.jsx
export function EditorControl({
    label,
    value,
    min,
    max,
    step = 1,
    unit = '',
    onChange,
    onReset
}) {
    return (
        <div className="editor-control">
            <label>{label}</label>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <span>{value}{unit}</span>
            <button onClick={onReset}>Reset</button>
        </div>
    );
}
```

**PhotoEditor.jsx (簡略化)**:
```javascript
import { applyImageFilters, canvasToBlob } from './PhotoEditor/imageProcessing';
import { EditorControl } from './PhotoEditor/EditorControl';
import { CropTool } from './PhotoEditor/CropTool';

// saveAsCopy - 簡略化
async function saveAsCopy() {
    const canvas = createCanvas(mainImage);
    const ctx = canvas.getContext('2d');
    applyImageFilters(canvas, ctx, editorStyles);

    const blob = await canvasToBlob(canvas);
    await invoke('save_photo_copy', { blob, originalPath });
}

// downloadStyled - 簡略化（重複排除）
async function downloadStyled() {
    const canvas = createCanvas(mainImage);
    const ctx = canvas.getContext('2d');
    applyImageFilters(canvas, ctx, editorStyles);

    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, generateFilename());
}

// コントロール部分 - 簡略化
return (
    <div className="photo-editor">
        <EditorControl
            label="Brightness"
            value={editorStyles.brightness}
            min={0}
            max={200}
            unit="%"
            onChange={(v) => updateStyle('brightness', v)}
            onReset={() => resetSingleControl('brightness')}
        />
        <EditorControl
            label="Contrast"
            value={editorStyles.contrast}
            min={0}
            max={200}
            unit="%"
            onChange={(v) => updateStyle('contrast', v)}
            onReset={() => resetSingleControl('contrast')}
        />
        {/* ... 他のコントロール */}

        {cropMode && (
            <CropTool
                image={mainImage}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropMode(false)}
            />
        )}
    </div>
);
```

#### 4. PhotosListMini.jsx の分割 (~350行削減)

**新規構造**:
```
src/App/PhotosList/
  ├── PhotosListMini.jsx (400 lines - メインコンポーネント)
  └── PhotosListMini/
      ├── ThumbnailItem.jsx (200 lines - 再利用可能なサムネイル)
      ├── useDeletionOperations.js (150 lines - 削除ロジック)
      ├── usePhotoNavigation.js (100 lines - ナビゲーション)
      ├── usePhotoMetadataOperations.js (80 lines - スター/コメント)
      ├── photoUtils.js (既存)
      ├── useKeyboardShortcuts.js (既存)
      └── PhotoDisplay.jsx (既存)
```

**ThumbnailItem.jsx**:
```javascript
// PhotosListMini/ThumbnailItem.jsx
export function ThumbnailItem({
    photo,
    index,
    isSelected,
    isCurrent,
    onSelect,
    onClick,
    onError,
    importMode,
    showMetadata,
}) {
    const [imgSrc, setImgSrc] = useState(photo.thumbnailPath());
    const [hasError, setHasError] = useState(false);

    const handleError = () => {
        setHasError(true);
        if (onError) onError(photo, index);
    };

    return (
        <div
            className={`thumbnail-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
            onClick={() => onClick(photo, index)}
        >
            <img
                src={hasError ? '/img_error.png' : imgSrc}
                alt={photo.name}
                onError={handleError}
            />

            {showMetadata && (
                <div className="thumbnail-metadata">
                    {photo.star > 0 && <span className="star">★{photo.star}</span>}
                    {photo.comment && <span className="comment">💬</span>}
                    {photo.getTags().length > 0 && <span className="tags">🏷️{photo.getTags().length}</span>}
                </div>
            )}

            {importMode && (
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(photo)}
                />
            )}
        </div>
    );
}
```

**useDeletionOperations.js**:
```javascript
// PhotosListMini/useDeletionOperations.js
export function useDeletionOperations({ viewMode, onComplete }) {
    const [modalState, setModalState] = useState({
        removeFromAlbum: false,
        deleteFile: false,
        permanentDelete: false,
    });
    const [targetPhoto, setTargetPhoto] = useState(null);

    const showRemoveFromAlbumModal = useCallback((photo) => {
        setTargetPhoto(photo);
        setModalState({ ...modalState, removeFromAlbum: true });
    }, [modalState]);

    const handleConfirmRemoveFromAlbum = useCallback(async () => {
        if (!targetPhoto) return;

        await invoke('remove_from_album', {
            albumId: viewMode.albumId,
            photoPath: targetPhoto.path,
        });

        setModalState({ ...modalState, removeFromAlbum: false });
        if (onComplete) onComplete();
    }, [targetPhoto, viewMode, modalState, onComplete]);

    // ... 他の削除操作

    return {
        modalState,
        showRemoveFromAlbumModal,
        showDeleteFileModal,
        showPermanentDeleteModal,
        handleConfirmRemoveFromAlbum,
        handleConfirmDeleteFile,
        handleConfirmPermanentDelete,
        closeModal: () => setModalState({ removeFromAlbum: false, deleteFile: false, permanentDelete: false }),
    };
}
```

#### 5. DirectoryMenu.jsx の分割 (~450行削減)

**新規構造**:
```
src/App/PhotosList/
  ├── DirectoryMenu.jsx (450 lines - メインコンポーネント)
  └── DirectoryMenu/
      ├── photoOperations.js (200 lines - インポート/削除/復元)
      ├── collectionOperations.js (150 lines - アルバム/タグ)
      ├── dateOperations.js (100 lines - 日付メンテナンス)
      ├── FilterTab.jsx (既存)
      ├── SelectionTab.jsx (既存)
      └── tutorialContent.jsx (既存)
```

**photoOperations.js**:
```javascript
// DirectoryMenu/photoOperations.js
export function usePhotoImport({ onComplete }) {
    const importSelectedPhotos = useCallback(async (selectedPhotos, config) => {
        // Import logic
    }, [onComplete]);

    return { importSelectedPhotos };
}

export function useGooglePhotosUpload({ onComplete }) {
    const uploadToGooglePhotos = useCallback(async (selectedPhotos) => {
        // Upload logic
    }, [onComplete]);

    return { uploadToGooglePhotos };
}

export function useTrashOperations({ onComplete }) {
    const deleteFiles = useCallback(async (selectedPhotos) => {
        // Delete logic
    }, [onComplete]);

    const restoreSelectedFromTrash = useCallback(async (selectedPhotos) => {
        // Restore logic
    }, [onComplete]);

    const permanentDeleteSelected = useCallback(async (selectedPhotos) => {
        // Permanent delete logic
    }, [onComplete]);

    return {
        deleteFiles,
        restoreSelectedFromTrash,
        permanentDeleteSelected,
    };
}
```

### Phase 3: Cross-Cutting Concerns (Medium Priority)

#### 6. 共通パターンの抽出

**A. useModalState hook**:
```javascript
// hooks/useModalState.js
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

    return { modalState, openModal, closeModal };
}

// 使用例
const { modalState, openModal, closeModal } = useModalState([
    'deleteConfirm',
    'albumSelect',
    'tagBulkAdd',
]);
```

**B. TauriService (Invoke + エラーハンドリング)**:
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

// 使用例
import { invokeWithErrorHandling } from '../services/TauriService';

const result = await invokeWithErrorHandling(
    'get_photos_unified',
    { request: photoParams },
    'PhotosList',
    { correlationId }
);
```

**C. usePhotoOperationFlow hook**:
```javascript
// hooks/usePhotoOperationFlow.js
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
```

### Phase 4: PhotosList.jsx の更なる改善 (Low Priority)

PhotosList.jxは既に十分にリファクタリングされていますが、さらなる改善の余地があります：

**新規構造**:
```
src/App/
  ├── PhotosList.jsx (800 lines - オーケストレーション)
  └── PhotosList/
      ├── PhotoListContext.jsx (50 lines - Context Provider)
      ├── usePhotoListHandlers.js (150 lines - ハンドラー管理)
      ├── useViewModeHelpers.js (80 lines - ViewModeヘルパー)
      └── ... (既存のフォルダ構造)
```

**PhotoListContext.jsx**:
```javascript
// PhotosList/PhotoListContext.jsx
import { createContext, useContext } from 'react';

const PhotoListContext = createContext(null);

export function PhotoListProvider({ children, value }) {
    return (
        <PhotoListContext.Provider value={value}>
            {children}
        </PhotoListContext.Provider>
    );
}

export function usePhotoListContext() {
    const context = useContext(PhotoListContext);
    if (!context) {
        throw new Error('usePhotoListContext must be used within PhotoListProvider');
    }
    return context;
}

// PhotosList.jsx での使用
const photoListContext = useMemo(() => ({
    viewState: { viewModeObj, currentDate, currentAlbum, ... },
    filterState: { starFilter, hasCommentFilter, ... },
    selectionState: { photoSelection, selectAllPhotos, ... },
    displayState: { currentPhotoPath, showSideMenu, ... },
    searchState: { searchQuery, searchResults, ... },
    handlers,
}), [/* dependencies */]);

return (
    <PhotoListProvider value={photoListContext}>
        <PhotoDisplayWrapper />
        <PhotoListContent />
        <SideMenuWrapper />
    </PhotoListProvider>
);
```

## Dependencies & Risks

### 外部依存関係
- なし（既存のパッケージのみ使用）

### パフォーマンス
- **影響なし**: リファクタリングのみ、ロジック変更なし
- **潜在的な改善**: 小さなモジュールはバンドルサイズとツリーシェイキングに有利

### セキュリティ
- **リスクなし**: 既存のセキュリティモデルを維持

### リスク

1. **回帰リスク**: リファクタリング中のバグ混入
   - **緩和策**: 段階的リファクタリング、各フェーズ後に徹底的なテスト

2. **マージコンフリクト**: 大規模な変更による他の開発との競合
   - **緩和策**: ファイルごとに個別のブランチとPR、順次マージ

3. **開発時間**: 大規模なリファクタリングには時間がかかる
   - **緩和策**: 優先順位付け（High → Medium → Low）

## Testing Strategy

### 各フェーズのテスト

**Phase 1 (Backend)**:
1. 既存の機能テストスイートを実行
2. 各検索タイプが正しく動作することを確認
3. パフォーマンステスト（クエリ時間が変わらないこと）

**Phase 2 (Frontend Components)**:
1. 各コンポーネントの動作確認
   - PhotoEditor: すべての編集操作が機能する
   - PhotosListMini: ナビゲーション、削除、選択が機能する
   - DirectoryMenu: すべての操作が機能する
2. エッジケース:
   - 大量の写真（1000+）
   - エラーハンドリング
   - 異なるビューモード（アルバム、タグ、ゴミ箱、検索）

**Phase 3 (Cross-Cutting)**:
1. 新しいフックとサービスの統合テスト
2. エラーハンドリングの一貫性確認

**Phase 4 (PhotosList)**:
1. すべての機能の統合テスト
2. パフォーマンステスト（レンダリング時間）

### 手動テストチェックリスト

- [ ] すべての検索タイプが動作する（recent, date, album, tag, search, trash, all）
- [ ] 写真の表示、ナビゲーション、選択が機能する
- [ ] 写真編集（回転、フィルター、クロップ）が機能する
- [ ] サムネイル表示とエラーハンドリングが機能する
- [ ] アルバム/タグ操作（追加、削除）が機能する
- [ ] 削除/復元操作が機能する
- [ ] インポート/エクスポートが機能する
- [ ] 検索とフィルターが機能する

## Implementation Plan

### Phase 1: Backend (Week 1)
1. Day 1-2: photo_handlers/モジュール構造作成
2. Day 3-4: 各ハンドラーの抽出と移行
3. Day 5: navigation.rs 統合
4. Day 6-7: テストと修正

### Phase 2: PhotoEditor (Week 2)
1. Day 1-2: imageProcessing.js 抽出と重複排除
2. Day 3: CropTool.jsx + useCropInteractions.js
3. Day 4: EditorControl.jsx コンポーネント
4. Day 5-7: 統合、テスト、修正

### Phase 3: PhotosListMini (Week 3)
1. Day 1-2: ThumbnailItem.jsx コンポーネント
2. Day 3: useDeletionOperations.js
3. Day 4: usePhotoNavigation.js + usePhotoMetadataOperations.js
4. Day 5-7: 統合、テスト、修正

### Phase 4: DirectoryMenu (Week 4)
1. Day 1-2: photoOperations.js
2. Day 3: collectionOperations.js + dateOperations.js
3. Day 4-7: 統合、テスト、修正

### Phase 5: Cross-Cutting (Week 5)
1. Day 1-2: useModalState + TauriService
2. Day 3: usePhotoOperationFlow
3. Day 4-5: 既存コードへの統合
4. Day 6-7: テストと修正

### Phase 6: PhotosList (Week 6 - Optional)
1. Day 1-2: PhotoListContext + usePhotoListHandlers
2. Day 3: useViewModeHelpers
3. Day 4-7: 統合、全体テスト、修正

## Expected Outcomes

### 定量的改善

| メトリクス | 現在 | リファクタリング後 |
|-----------|------|-------------------|
| 最大ファイルサイズ | 1,072行 | ~800行 |
| 平均ファイルサイズ | ~965行 | ~400行 |
| 総ファイル数 | 5ファイル | 5メイン + 20モジュール |
| コード重複 | ~300行 | 0行 |

### 定性的改善

1. **保守性**: ファイルが小さく、焦点が絞られているため、変更が容易
2. **テスト容易性**: 各モジュールが独立してテスト可能
3. **可読性**: 各ファイルの責任が明確
4. **拡張性**: 新機能の追加が容易（新しいハンドラー/フックを追加するだけ）
5. **チーム開発**: 異なるファイルで並行作業が可能、コンフリクトが減少

## Open Questions

1. **Context vs Props**: PhotosList.jsx でContext Providerを使うべきか、それともprops drillingを維持すべきか？
   - Context: コードが簡潔、深い階層でも簡単
   - Props: 明示的、デバッグが容易
   - **推奨**: 段階的にContext導入、まずは深い階層のコンポーネントから

2. **テストの追加**: リファクタリングと同時にユニットテストを追加すべきか？
   - **推奨**: 可能であれば追加、特に複雑なロジック（画像処理、ナビゲーション）

3. **TypeScript移行**: リファクタリングと同時にTypeScriptに移行すべきか？
   - **推奨**: 別のタスクとして実施、リファクタリングを優先

4. **段階的移行 vs 一括移行**: フェーズごとにマージするか、全フェーズ完了後にマージするか？
   - **推奨**: フェーズごとにマージ、早期フィードバックとリスク軽減のため

## References

- `CLAUDE.md` - Development guidelines (DRY, file length limits)
- Existing refactoring examples:
  - `PhotosListMini/photoUtils.js`
  - `PhotoEditor/cssUtils.js`, `cropUtils.js`, `styleUtils.js`
  - `DirectoryMenu/FilterTab.jsx`, `SelectionTab.jsx`
- DDD patterns in PhotoClove codebase
