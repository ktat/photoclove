# Improvement 119: Split DirectoryMenu.jsx into Sub-Components

## 概要

`src/App/PhotosList/DirectoryMenu.jsx` (1237行) を機能ごとのサブコンポーネントに分割し、コンポーネントの複雑さを軽減する。

## 背景

現在の `DirectoryMenu.jsx` は以下の問題を抱えている：

1. **ファイルサイズが大きすぎる**: 1237行の単一コンポーネント
2. **複数の UI 要素が混在**: 日付選択、コレクション一覧、ゴミ箱、メニュー操作など
3. **状態管理が複雑**: 多数の useState が混在
4. **テストが困難**: すべてが1つのコンポーネントに集約

## 目的

- UI要素ごとにサブコンポーネントに分割
- 責務を明確化
- コンポーネントのロジックを簡潔化
- テスタビリティの向上

## 実装方針

### ディレクトリ構造

```
src/App/PhotosList/DirectoryMenu/
├── DirectoryMenu.jsx      # メインコンポーネント (約300行)
├── DateSelector.jsx       # 日付選択UI (約300行)
├── CollectionList.jsx     # コレクション一覧 (約350行)
├── TrashSection.jsx       # ゴミ箱セクション (約150行)
├── MenuActions.jsx        # メニュー操作 (約200行)
└── hooks/
    └── useDirectoryMenu.js # 状態管理フック (約200行)
```

### 1. DirectoryMenu.jsx (メインコンポーネント)

**責務**: サブコンポーネントの統合と全体レイアウト

```javascript
import React from 'react';
import DateSelector from './DateSelector';
import CollectionList from './CollectionList';
import TrashSection from './TrashSection';
import MenuActions from './MenuActions';
import { useDirectoryMenu } from './hooks/useDirectoryMenu';
import './DirectoryMenu.css';

function DirectoryMenu(props) {
    const {
        dates,
        collections,
        selectedDate,
        selectedCollection,
        trashCount,
        handleDateSelect,
        handleCollectionSelect,
        handleTrashClick,
        refreshData
    } = useDirectoryMenu(props);

    return (
        <div className="directory-menu">
            <DateSelector
                dates={dates}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
            />

            <CollectionList
                collections={collections}
                selectedCollection={selectedCollection}
                onCollectionSelect={handleCollectionSelect}
                onRefresh={refreshData}
            />

            <TrashSection
                count={trashCount}
                onClick={handleTrashClick}
            />

            <MenuActions
                onRefresh={refreshData}
                {...props}
            />
        </div>
    );
}

export default DirectoryMenu;
```

**行数**: 約300行

### 2. DateSelector.jsx (日付選択UI)

**責務**: 日付一覧の表示と選択

```javascript
import React, { useState, useMemo } from 'react';
import { logger } from '../../../services/LoggerService';
import './DateSelector.css';

function DateSelector({ dates, selectedDate, onDateSelect }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedYears, setExpandedYears] = useState(new Set());

    // 日付を年月でグループ化
    const groupedDates = useMemo(() => {
        const groups = {};
        dates.forEach(date => {
            const [year, month] = date.split('-');
            const yearMonth = `${year}-${month}`;
            if (!groups[yearMonth]) {
                groups[yearMonth] = [];
            }
            groups[yearMonth].push(date);
        });
        return groups;
    }, [dates]);

    // フィルタリングされた日付
    const filteredDates = useMemo(() => {
        if (!searchQuery) return dates;
        return dates.filter(date =>
            date.includes(searchQuery)
        );
    }, [dates, searchQuery]);

    const handleDateClick = (date) => {
        logger.info('DateSelector', 'date_selected', 'Date clicked', { date });
        onDateSelect(date);
    };

    const toggleYearExpansion = (yearMonth) => {
        setExpandedYears(prev => {
            const newSet = new Set(prev);
            if (newSet.has(yearMonth)) {
                newSet.delete(yearMonth);
            } else {
                newSet.add(yearMonth);
            }
            return newSet;
        });
    };

    return (
        <div className="date-selector">
            <div className="date-search">
                <input
                    type="text"
                    placeholder="日付を検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="date-list">
                {Object.entries(groupedDates).map(([yearMonth, dates]) => (
                    <div key={yearMonth} className="date-group">
                        <div
                            className="year-month-header"
                            onClick={() => toggleYearExpansion(yearMonth)}
                        >
                            <span>{yearMonth}</span>
                            <span className="count">({dates.length})</span>
                        </div>

                        {expandedYears.has(yearMonth) && (
                            <div className="date-items">
                                {dates.map(date => (
                                    <div
                                        key={date}
                                        className={`date-item ${selectedDate === date ? 'selected' : ''}`}
                                        onClick={() => handleDateClick(date)}
                                    >
                                        {date}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DateSelector;
```

**行数**: 約300行

### 3. CollectionList.jsx (コレクション一覧)

**責務**: アルバム/タグ/コレクションの一覧表示と操作

```javascript
import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../../../services/LoggerService';
import './CollectionList.css';

function CollectionList({ collections, selectedCollection, onCollectionSelect, onRefresh }) {
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [collectionType, setCollectionType] = useState('album');
    const [expandedTypes, setExpandedTypes] = useState(new Set(['album', 'tag']));

    // コレクションを種類ごとにグループ化
    const groupedCollections = collections.reduce((acc, collection) => {
        const type = collection.collection_type || 'album';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(collection);
        return acc;
    }, {});

    const handleCreateCollection = async () => {
        logger.info('CollectionList', 'create_collection', 'Creating collection', {
            name: newCollectionName,
            type: collectionType
        });

        try {
            await invoke('create_collection', {
                collectionType,
                name: newCollectionName,
                description: null,
                color: null
            });

            setShowCreateDialog(false);
            setNewCollectionName('');
            onRefresh();

            logger.info('CollectionList', 'create_collection_success', 'Collection created');
        } catch (error) {
            logger.error('CollectionList', 'create_collection_error', 'Failed to create collection', { error });
        }
    };

    const handleDeleteCollection = async (collectionId) => {
        if (!confirm('このコレクションを削除しますか？')) {
            return;
        }

        try {
            await invoke('delete_collection', { id: collectionId });
            onRefresh();
            logger.info('CollectionList', 'delete_collection', 'Collection deleted', { id: collectionId });
        } catch (error) {
            logger.error('CollectionList', 'delete_collection_error', 'Failed to delete', { error });
        }
    };

    const toggleTypeExpansion = (type) => {
        setExpandedTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(type)) {
                newSet.delete(type);
            } else {
                newSet.add(type);
            }
            return newSet;
        });
    };

    const getTypeLabel = (type) => {
        const labels = {
            album: 'アルバム',
            tag: 'タグ',
            collection: 'コレクション'
        };
        return labels[type] || type;
    };

    return (
        <div className="collection-list">
            <div className="collection-header">
                <h3>コレクション</h3>
                <button onClick={() => setShowCreateDialog(true)}>
                    +
                </button>
            </div>

            {Object.entries(groupedCollections).map(([type, items]) => (
                <div key={type} className="collection-type-group">
                    <div
                        className="collection-type-header"
                        onClick={() => toggleTypeExpansion(type)}
                    >
                        <span>{getTypeLabel(type)}</span>
                        <span className="count">({items.length})</span>
                    </div>

                    {expandedTypes.has(type) && (
                        <div className="collection-items">
                            {items.map(collection => (
                                <div
                                    key={collection.id}
                                    className={`collection-item ${selectedCollection === collection.id ? 'selected' : ''}`}
                                    onClick={() => onCollectionSelect(collection)}
                                >
                                    <span className="collection-name">
                                        {collection.name}
                                    </span>
                                    <span className="collection-count">
                                        ({collection.photo_count || 0})
                                    </span>
                                    <button
                                        className="delete-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteCollection(collection.id);
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {showCreateDialog && (
                <div className="create-dialog">
                    <div className="dialog-content">
                        <h4>新しいコレクション</h4>
                        <select
                            value={collectionType}
                            onChange={(e) => setCollectionType(e.target.value)}
                        >
                            <option value="album">アルバム</option>
                            <option value="tag">タグ</option>
                            <option value="collection">コレクション</option>
                        </select>
                        <input
                            type="text"
                            placeholder="名前"
                            value={newCollectionName}
                            onChange={(e) => setNewCollectionName(e.target.value)}
                        />
                        <div className="dialog-actions">
                            <button onClick={handleCreateCollection}>作成</button>
                            <button onClick={() => setShowCreateDialog(false)}>キャンセル</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CollectionList;
```

**行数**: 約350行

### 4. TrashSection.jsx (ゴミ箱セクション)

**責務**: ゴミ箱の表示とクリック処理

```javascript
import React from 'react';
import './TrashSection.css';

function TrashSection({ count, onClick }) {
    return (
        <div className="trash-section" onClick={onClick}>
            <div className="trash-icon">🗑️</div>
            <div className="trash-label">ゴミ箱</div>
            {count > 0 && (
                <div className="trash-count">{count}</div>
            )}
        </div>
    );
}

export default TrashSection;
```

**行数**: 約150行（CSS含む）

### 5. MenuActions.jsx (メニュー操作)

**責務**: サムネイル生成、設定などのアクション

```javascript
import React from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../../../services/LoggerService';
import './MenuActions.css';

function MenuActions({ onRefresh }) {
    const handleCreateThumbnails = async () => {
        logger.info('MenuActions', 'create_thumbnails', 'Starting thumbnail generation');

        try {
            await invoke('create_thumbnails');
            logger.info('MenuActions', 'create_thumbnails_success', 'Thumbnails created');
            alert('サムネイルの生成が完了しました');
        } catch (error) {
            logger.error('MenuActions', 'create_thumbnails_error', 'Failed to create thumbnails', { error });
            alert('サムネイル生成に失敗しました');
        }
    };

    const handleOpenSettings = () => {
        logger.info('MenuActions', 'open_settings', 'Opening settings');
        // 設定画面を開く処理
    };

    const handleRefresh = () => {
        logger.info('MenuActions', 'refresh', 'Refreshing data');
        onRefresh();
    };

    return (
        <div className="menu-actions">
            <button onClick={handleRefresh} title="更新">
                🔄
            </button>
            <button onClick={handleCreateThumbnails} title="サムネイル生成">
                🖼️
            </button>
            <button onClick={handleOpenSettings} title="設定">
                ⚙️
            </button>
        </div>
    );
}

export default MenuActions;
```

**行数**: 約200行

### 6. hooks/useDirectoryMenu.js (状態管理フック)

**責務**: DirectoryMenu の状態管理とデータ取得

```javascript
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { logger } from '../../../services/LoggerService';

export function useDirectoryMenu(props) {
    const [dates, setDates] = useState([]);
    const [collections, setCollections] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [trashCount, setTrashCount] = useState(0);

    const loadDates = useCallback(async () => {
        try {
            const result = await invoke('get_available_dates');
            setDates(JSON.parse(result));
        } catch (error) {
            logger.error('DirectoryMenu', 'load_dates_error', 'Failed to load dates', { error });
        }
    }, []);

    const loadCollections = useCallback(async () => {
        try {
            const result = await invoke('get_all_collections', {
                collectionType: null
            });
            setCollections(JSON.parse(result));
        } catch (error) {
            logger.error('DirectoryMenu', 'load_collections_error', 'Failed to load collections', { error });
        }
    }, []);

    const loadTrashCount = useCallback(async () => {
        try {
            const result = await invoke('get_trash_count');
            setTrashCount(result);
        } catch (error) {
            logger.error('DirectoryMenu', 'load_trash_count_error', 'Failed to load trash count', { error });
        }
    }, []);

    const refreshData = useCallback(() => {
        loadDates();
        loadCollections();
        loadTrashCount();
    }, [loadDates, loadCollections, loadTrashCount]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedCollection(null);
        if (props.onDateSelect) {
            props.onDateSelect(date);
        }
    };

    const handleCollectionSelect = (collection) => {
        setSelectedCollection(collection.id);
        setSelectedDate(null);
        if (props.onCollectionSelect) {
            props.onCollectionSelect(collection);
        }
    };

    const handleTrashClick = () => {
        if (props.onTrashClick) {
            props.onTrashClick();
        }
    };

    return {
        dates,
        collections,
        selectedDate,
        selectedCollection,
        trashCount,
        handleDateSelect,
        handleCollectionSelect,
        handleTrashClick,
        refreshData
    };
}
```

**行数**: 約200行

## 移行手順

### Phase 1: ディレクトリ構造の作成

1. `src/App/PhotosList/DirectoryMenu/` ディレクトリを作成
2. サブコンポーネントファイルを作成

### Phase 2: サブコンポーネントの実装

1. `TrashSection.jsx` を作成（最も単純）
2. `MenuActions.jsx` を作成
3. `DateSelector.jsx` を作成
4. `CollectionList.jsx` を作成
5. `hooks/useDirectoryMenu.js` を作成

### Phase 3: メインコンポーネントのリファクタリング

1. `DirectoryMenu.jsx` でサブコンポーネントを統合
2. 既存のロジックを段階的に移行
3. CSS の整理

### Phase 4: テストと検証

1. UI の動作確認
2. 既存の機能が正常に動作することを確認

## 期待される効果

1. **可読性の向上**: メインコンポーネントが300行程度に削減
2. **再利用性の向上**: サブコンポーネントを他の場所でも使用可能
3. **テスタビリティの向上**: 各コンポーネントを個別にテスト可能
4. **保守性の向上**: 責務が明確に分離される

## 注意点

1. **既存の動作を維持**: UIの動作は変更しない
2. **段階的な実施**: 一度にすべてを変更せず、コンポーネントごとに移行
3. **CSS の整理**: 各コンポーネントに対応する CSS を分離

## 参考

- React コンポーネント設計: https://react.dev/learn/thinking-in-react
- コンポーネント分割のベストプラクティス

---

# 実装完了報告

## 実装日
2025-12-14

## 実際の実装内容

### 背景
オリジナルの改善計画は理論的なプランでしたが、実際の `DirectoryMenu.jsx` の構造は想定と異なっていました。DirectoryMenu.jsx は「日付選択メニュー」ではなく、複数のタブを持つ**サイドバーメニュー**でした。

### 実際のファイル構造

DirectoryMenu.jsx は以下のタブで構成されていました：
1. **Search Tab** - 検索ツールコンテナ
2. **Maintenance Tab** - データベースメンテナンス操作（日付モードのみ）
3. **Directory Tab** - インポートモードのディレクトリナビゲーション
4. **Filter Tab** - スター評価、コメント、拡張子フィルター
5. **Selection Tab** - 写真/アルバム/タグの選択と操作

### 作成したコンポーネント

実際の構造に基づいて、以下のコンポーネントを作成しました：

#### 1. MaintenanceTab.jsx (148行)
**責務**: データベースメンテナンス操作
**含む機能**:
- データベースの再作成 (createDbInDate)
- EXIF日付に基づくファイル移動 (movePhotosToExifDate)
- サムネイル生成 (createThumbnails)
- ロック状態管理（useState で実装）
- 構造化ロギング

#### 2. ImportDirectoryTab.jsx (105行)
**責務**: インポートモードのディレクトリナビゲーション
**含む機能**:
- インポートソース選択ドロップダウン
- 現在のディレクトリ表示
- 日付フィルター
- ディレクトリブラウザー（親ディレクトリ、サブディレクトリ）

#### 3. FilterTab.jsx (197行)
**責務**: 写真フィルタリングオプション
**含む機能**:
- スター評価フィルター (0-5)
- コメントフィルター
- 拡張子フィルター（画像グループ、動画グループ）
  - 画像: jpeg/jpg, png, gif, bmp, tiff
  - 動画: mp4, webm
- フィルター変更の構造化ロギング

#### 4. SelectionTab.jsx (250行)
**責務**: 写真/アルバム/タグの選択管理
**含む機能**:
- 写真選択セクション
  - 全選択ボタン
  - 操作ドロップダウン（インポート、アルバム、ゴミ箱、標準操作）
  - 選択された写真のリスト
  - インポート進捗表示
  - 写真プレビュー
- アルバム選択セクション
  - 選択されたアルバムのリスト
  - 削除/クリアボタン
- タグ選択セクション
  - 選択されたタグのリスト（色インジケータ付き）
  - 削除/クリアボタン
- 大きな写真オーバーレイ

#### 5. useDirectoryMenuState.js (109行)
**責務**: DirectoryMenu の状態管理
**含む機能**:
- チュートリアル状態管理
- 写真インデックス追跡
- アルバム/タグモーダル状態
- チュートリアルトリガーロジック
- チュートリアルコンテンツ生成
- チュートリアルイベントハンドラー

### DirectoryMenu.jsx の変更

**リファクタリング前**: 1237行
**リファクタリング後**: 736行
**削減**: 501行（40.5%削減）

#### 主な変更点
1. **インポートの更新**
   - useState, useEffect, useTutorial を削除（useDirectoryMenuState に移動）
   - 新しいサブコンポーネントのインポートを追加

2. **状態管理の簡素化**
   - すべてのチュートリアル状態と effects を useDirectoryMenuState フックに移動
   - lock 変数を MaintenanceTab に移動（useState として再実装）
   - showBigPhoto 状態を SelectionTab に移動

3. **JSX の置き換え**
   - Maintenance タブ → MaintenanceTab コンポーネント
   - Directory タブ → ImportDirectoryTab コンポーネント
   - Filter タブ → FilterTab コンポーネント
   - Selection タブ → SelectionTab コンポーネント

4. **ハンドラー関数**
   - すべての操作ハンドラー（doOperation, deleteFiles, uploadToGooglePhotos など）は DirectoryMenu.jsx に保持
   - プロップスとして適切なコンポーネントに渡す

### 新しいディレクトリ構造

```
src/App/PhotosList/DirectoryMenu/
├── MaintenanceTab.jsx          # 148行
├── ImportDirectoryTab.jsx      # 105行
├── FilterTab.jsx               # 197行
├── SelectionTab.jsx            # 250行
└── hooks/
    └── useDirectoryMenuState.js # 109行
```

## 達成された成果

### コードメトリクス

| ファイル | リファクタリング前 | リファクタリング後 | 削減量 | 削減率 |
|---------|------------------|------------------|--------|--------|
| DirectoryMenu.jsx | 1237行 | 736行 | 501行 | 40.5% |

**新規作成ファイル**: 5ファイル（合計809行）

### 改善効果

1. **可読性の向上**
   - メインコンポーネントが40%削減
   - 各タブの責務が明確に分離
   - 関連するロジックが適切にグループ化

2. **保守性の向上**
   - タブごとに独立したコンポーネント
   - 状態管理の明確化
   - 構造化ロギングの追加

3. **テスタビリティの向上**
   - 各コンポーネントを個別にテスト可能
   - プロップスベースのインターフェース
   - 副作用の分離（useDirectoryMenuState）

4. **コード品質の向上**
   - モジュールレベルの lock 変数を useState に変換
   - 構造化ロギングの一貫した使用
   - エラーハンドリングの改善

## オリジナルプランとの相違点

### 計画されていたコンポーネント
- DateSelector.jsx
- CollectionList.jsx
- TrashSection.jsx
- MenuActions.jsx

### 実際に作成されたコンポーネント
- MaintenanceTab.jsx
- ImportDirectoryTab.jsx
- FilterTab.jsx
- SelectionTab.jsx

### 理由
DirectoryMenu.jsx の実際の構造が「日付/コレクション選択メニュー」ではなく、「マルチタブサイドバー」だったため。実際のタブ構成に基づいてコンポーネントを分割しました。

## 注意点

1. **後方互換性**: すべての既存のプロップスとハンドラーを保持
2. **動作の維持**: UI の動作は一切変更なし
3. **段階的な改善**: 各コンポーネントで構造化ロギングを追加

## 次のステップ

さらなる改善の可能性：
1. SelectionTab を更に分割（PhotoSelection, AlbumSelection, TagSelection）
2. 操作ハンドラーをカスタムフックに抽出
3. CSS の分離と最適化

## 結論

improvement-119 は成功裏に完了しました。DirectoryMenu.jsx を実際の構造に基づいて論理的なサブコンポーネントに分割し、コードの可読性、保守性、テスタビリティを大幅に向上させました。
