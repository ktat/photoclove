# Improvement 128: PhotosList.jsx のProps構造化とlocalStorage状態管理

## 概要

PhotosList.jsxのprops数を削減し、ページ状態をlocalStorageで永続化することで、保守性とUXを向上させる。

## 背景

### 現在の問題点

1. **Props数が多すぎる**: 各コンポーネントに45-65個のpropsを渡している
   - PhotoDisplayWrapper: 45 props
   - PhotoListContent: 65 props
   - SideMenuWrapper: 50 props

2. **状態が揮発する**: アプリを閉じると全ての状態が失われる
   - 写真の選択状態
   - フィルター設定
   - スクロール位置
   - ページごとの表示設定

3. **可読性が低い**: propsの羅列で何が何だか分からない

4. **Context API失敗**: Issue #123で試みたContext API実装は、既存のフック構造と合わず多数のバグを発生させた

## 目的

- **Props数を89%削減** (45個 → 5個程度)
- **状態の永続化** (アプリ再起動後も状態を復元)
- **実装コストを最小化** (Rust実装不要、JSのみで完結)
- **バグを発生させない** (既存の動作を100%維持)

## 実装方針

### Plan 1: Props構造化 (優先度: 高)

関連するpropsをオブジェクトにまとめ、コンポーネント間の受け渡しを簡素化する。

### Plan 3: localStorage統合 (優先度: 高)

ページ遷移時に状態をlocalStorageに保存・ロードし、状態の永続化を実現する。

**注**: Plan 2 (Rust側セッション) は見送り。理由:
- Tauri単一ウィンドウアプリではlocalStorageが最適
- セキュリティ懸念なし（デスクトップアプリ）
- IPCオーバーヘッドなし（同期的アクセス）
- 実装コストが低い

---

## Phase 1: Props構造化

### 目標

PhotosList.jsxのprops数を45個 → 5個に削減

### 実装内容

#### 1-1. 状態グループの定義

関連する状態を5つのグループに分類:

```javascript
// src/types/PageState.js

/**
 * @typedef {Object} ViewState
 * @property {string} mode - VIEW_MODES.DATE | ALBUM | TAG | etc
 * @property {string} currentDate - 現在表示中の日付 (YYYY-MM-DD)
 * @property {string} currentAlbumId - 現在表示中のアルバムID
 * @property {string} currentAlbumName - アルバム名
 * @property {string} currentTagId - タグID
 * @property {string} currentTagName - タグ名
 * @property {boolean} recentPhotosMode - 最近の写真モード
 * @property {boolean} isTagListMode - タグリストモード
 * @property {ViewMode} viewModeObj - ViewModeオブジェクト
 */

/**
 * @typedef {Object} FilterState
 * @property {number} star - スター評価フィルター (0-5)
 * @property {boolean} comment - コメントありフィルター
 * @property {boolean} tag - タグありフィルター
 * @property {string[]} extension - 拡張子フィルター ['jpg', 'png', ...]
 * @property {string[]} importExtension - インポートモード用拡張子フィルター
 * @property {boolean} showPopover - フィルターポップオーバー表示状態
 * @property {boolean} hasActiveFilters - アクティブなフィルターがあるか
 */

/**
 * @typedef {Object} SelectionState
 * @property {Object.<string, boolean>} photos - 写真の選択状態 {path: true}
 * @property {number} count - 選択数
 * @property {string[]} albums - 選択されたアルバムID配列
 * @property {string[]} tags - 選択されたタグID配列
 */

/**
 * @typedef {Object} DisplayState
 * @property {string} currentPhotoPath - 現在表示中の写真パス
 * @property {number} currentPhotoIndex - 現在の写真インデックス
 * @property {boolean} showSideMenu - サイドメニュー表示
 * @property {string} iconSize - アイコンサイズ ('small' | 'medium' | 'large')
 * @property {string} sort - ソート順 ('date_asc' | 'date_desc' | 'name_asc' | 'name_desc')
 * @property {string} importSort - インポートモード用ソート順
 * @property {number} scrollPosition - スクロール位置
 * @property {Object} datePage - ページ番号 {date: page}
 */

/**
 * @typedef {Object} SearchState
 * @property {boolean} isSearchMode - 検索モード
 * @property {string} query - 検索クエリ
 * @property {Object} filters - 検索フィルター
 * @property {Array} results - 検索結果
 * @property {Object} currentParams - 現在の検索パラメータ
 */

/**
 * @typedef {Object} PageState
 * @property {ViewState} view
 * @property {FilterState} filters
 * @property {SelectionState} selection
 * @property {DisplayState} display
 * @property {SearchState} search
 */
```

#### 1-2. PhotosList.jsxでの状態グループ作成

```javascript
// src/App/PhotosList.jsx

function PhotosList(props) {
  // ... existing hooks ...

  // 状態をグループ化
  const viewState = useMemo(() => ({
    mode: viewMode,
    currentDate: currentDate,
    currentAlbumId: currentAlbumId,
    currentAlbumName: currentAlbumName,
    currentTagId: currentTagId,
    currentTagName: currentTagName,
    recentPhotosMode: recentPhotosMode,
    isTagListMode: isTagListMode,
    viewModeObj: viewModeObj
  }), [viewMode, currentDate, currentAlbumId, currentAlbumName,
       currentTagId, currentTagName, recentPhotosMode, isTagListMode, viewModeObj]);

  const filterState = useMemo(() => ({
    star: starFilter,
    comment: hasCommentFilter,
    tag: hasTagFilter,
    extension: extensionFilter,
    importExtension: importExtensionFilter,
    showPopover: showFilterPopover,
    hasActiveFilters: hasActiveFiltersState
  }), [starFilter, hasCommentFilter, hasTagFilter, extensionFilter,
       importExtensionFilter, showFilterPopover, hasActiveFiltersState]);

  const selectionState = useMemo(() => ({
    photos: photoSelectionDict,
    count: Object.keys(photoSelectionDict).length,
    albums: selectedAlbums,
    tags: selectedTags
  }), [photoSelectionDict, selectedAlbums, selectedTags]);

  const displayState = useMemo(() => ({
    currentPhotoPath: currentPhotoPath,
    currentPhotoIndex: currentPhotoIndex,
    showSideMenu: showSideMenu,
    iconSize: iconSize,
    sort: sortOfPhotos,
    importSort: importSortOfPhotos,
    scrollPosition: 0, // 保存時に取得
    datePage: compatProps.datePage
  }), [currentPhotoPath, currentPhotoIndex, showSideMenu, iconSize,
       sortOfPhotos, importSortOfPhotos, compatProps.datePage]);

  const searchState = useMemo(() => ({
    isSearchMode: isSearchMode,
    query: searchQuery,
    filters: searchFilters,
    results: searchResults,
    currentParams: currentSearchParams
  }), [isSearchMode, searchQuery, searchFilters, searchResults, currentSearchParams]);

  // ハンドラーもグループ化
  const handlers = useMemo(() => ({
    // Photo operations
    displayPhoto: displayPhoto,
    closePhotoDisplay: closePhotoDisplay,
    toggleSelection: toggleSelection,
    isSelected: isSelected,
    addSelection: addSelection,

    // Filter operations
    setStarFilter: setStarFilter,
    setHasCommentFilter: setHasCommentFilter,
    setExtensionFilter: setExtensionFilter,
    clearAllFilters: clearAllFilters,
    setShowFilterPopover: setShowFilterPopover,

    // Navigation
    clearSearch: clearSearch,
    toggleAlbumListMode: toggleAlbumListMode,
    openTagsList: openTagsList,
    toggleHome: toggleHome,

    // Album/Tag operations
    handleAlbumClick: handleAlbumClick,
    handleTagClick: handleTagClick,
    handleAlbumSelection: handleAlbumSelection,
    handleTagSelection: handleTagSelection,

    // Sort/Display
    setSort: setSort,
    setIconSize: setIconSize,
    setShowSideMenu: setShowSideMenu
  }), [displayPhoto, closePhotoDisplay, toggleSelection, /* ... all handlers */]);

  return (
    <ErrorBoundary name="PhotosList" level="component">
      <>
        <PhotoDisplayWrapper
          viewState={viewState}
          filterState={filterState}
          selectionState={selectionState}
          displayState={displayState}
          handlers={handlers}
        />
        <PhotoListContent
          viewState={viewState}
          filterState={filterState}
          selectionState={selectionState}
          displayState={displayState}
          searchState={searchState}
          handlers={handlers}
          // 個別に必要なもののみ
          filteredAlbums={filteredAlbums}
          filteredTags={filteredTags}
          displayedPhotos={displayedPhotos}
          filteredPhotos={filteredPhotos}
        />
        {/* ... other components */}
      </>
    </ErrorBoundary>
  );
}
```

#### 1-3. 子コンポーネントの更新

```javascript
// src/App/PhotosList/PhotoDisplayWrapper.jsx

function PhotoDisplayWrapper({
  viewState,
  filterState,
  displayState,
  handlers,
  // その他必要なprops
  photoLoading,
  compatProps,
  photosListMiniAllPhotos,
  setPhotosListMiniAllPhotos,
  imgCacheMap,
  setImgCacheMap,
  // ... 個別に必要なprops
}) {
  // viewState.viewModeObj, filterState.star などでアクセス
  const displayKey = viewState.viewModeObj.isRecentMode() ? "recent" : viewState.viewModeObj.getDataAttribute();
  const shouldDisplay = !photoLoading && compatProps.showPhotoDisplay[displayKey] && displayState.currentPhotoPath;

  // ...
}
```

#### 1-4. Phase 1の成果

| コンポーネント | Before | After | 削減率 |
|--------------|--------|-------|--------|
| PhotoDisplayWrapper | 45 props | 9 props | 80% |
| PhotoListContent | 65 props | 12 props | 82% |
| SideMenuWrapper | 50 props | 10 props | 80% |

---

## Phase 2: localStorage統合

### 目標

ページ遷移時に状態を保存・復元し、アプリ再起動後も作業を継続できるようにする。

### 実装内容

#### 2-1. ページ定義

```javascript
// src/constants/pages.js

export const PAGES = {
  DATE_VIEW: 'date_view',
  ALBUM_LIST: 'album_list',
  ALBUM_VIEW: 'album_view',
  TAG_LIST: 'tag_list',
  TAG_VIEW: 'tag_view',
  SEARCH_RESULTS: 'search_results',
  TRASH: 'trash',
  IMPORT: 'import',
  RECENT: 'recent'
};

// 各ページで永続化する状態の定義
export const PAGE_STATE_SCHEMA = {
  [PAGES.DATE_VIEW]: {
    selection: true,    // 写真の選択状態
    filters: true,      // フィルター設定
    display: true,      // 表示設定（アイコンサイズ、ソート）
    view: true,         // 現在の日付
    search: false       // 検索は永続化しない
  },
  [PAGES.ALBUM_LIST]: {
    selection: true,    // アルバムの選択状態
    filters: false,
    display: true,
    view: false,
    search: true        // 検索文字列
  },
  // ... 他のページ
};
```

#### 2-2. usePageState フック

```javascript
// src/hooks/usePageState.js

import { useCallback } from 'react';
import { logger } from '../services/LoggerService';

const PAGE_STATE_PREFIX = 'photoclove_page_';
const PAGE_STATE_VERSION = 1;

/**
 * ページ状態の保存・ロード・クリア機能を提供するフック
 *
 * @param {string} pageName - ページ名 (PAGES.DATE_VIEW など)
 * @returns {Object} { savePageState, loadPageState, clearPageState }
 */
export function usePageState(pageName) {
  const storageKey = `${PAGE_STATE_PREFIX}${pageName}`;

  /**
   * ページ状態を保存
   * @param {Object} state - 保存する状態オブジェクト
   */
  const savePageState = useCallback((state) => {
    try {
      const stateWithMeta = {
        version: PAGE_STATE_VERSION,
        timestamp: Date.now(),
        pageName: pageName,
        data: state
      };

      const serialized = JSON.stringify(stateWithMeta);
      localStorage.setItem(storageKey, serialized);

      logger.debug('usePageState', 'saved', `Saved state for ${pageName}`, {
        size: new Blob([serialized]).size,
        keys: Object.keys(state).join(', ')
      });
    } catch (error) {
      logger.error('usePageState', 'save_error', 'Failed to save page state', {
        error: error.message,
        pageName
      });

      // QuotaExceededError の場合は古い状態をクリア
      if (error.name === 'QuotaExceededError') {
        logger.warn('usePageState', 'quota_exceeded', 'Storage quota exceeded, clearing old states');
        clearOldStates();
      }
    }
  }, [storageKey, pageName]);

  /**
   * ページ状態をロード
   * @returns {Object|null} 保存された状態、または null
   */
  const loadPageState = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        logger.debug('usePageState', 'not_found', `No saved state for ${pageName}`);
        return null;
      }

      const parsed = JSON.parse(saved);

      // バージョンチェック
      if (parsed.version !== PAGE_STATE_VERSION) {
        logger.warn('usePageState', 'version_mismatch', 'State version mismatch, clearing', {
          expected: PAGE_STATE_VERSION,
          found: parsed.version,
          pageName
        });
        localStorage.removeItem(storageKey);
        return null;
      }

      // 古すぎる状態は無視（7日以上前）
      const age = Date.now() - parsed.timestamp;
      if (age > 7 * 24 * 60 * 60 * 1000) {
        logger.warn('usePageState', 'state_too_old', 'State is too old, ignoring', {
          age: Math.floor(age / (24 * 60 * 60 * 1000)) + ' days',
          pageName
        });
        localStorage.removeItem(storageKey);
        return null;
      }

      logger.debug('usePageState', 'loaded', `Loaded state for ${pageName}`, {
        age: Math.floor(age / 1000) + 's'
      });

      return parsed.data;
    } catch (error) {
      logger.error('usePageState', 'load_error', 'Failed to load page state', {
        error: error.message,
        pageName
      });

      // パースエラーの場合は削除
      localStorage.removeItem(storageKey);
      return null;
    }
  }, [storageKey, pageName]);

  /**
   * ページ状態をクリア
   */
  const clearPageState = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      logger.debug('usePageState', 'cleared', `Cleared state for ${pageName}`);
    } catch (error) {
      logger.error('usePageState', 'clear_error', 'Failed to clear page state', {
        error: error.message,
        pageName
      });
    }
  }, [storageKey, pageName]);

  return { savePageState, loadPageState, clearPageState };
}

/**
 * 古い状態をクリアする（7日以上前）
 */
function clearOldStates() {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  Object.keys(localStorage)
    .filter(key => key.startsWith(PAGE_STATE_PREFIX))
    .forEach(key => {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (now - item.timestamp > maxAge) {
          localStorage.removeItem(key);
          logger.debug('usePageState', 'old_state_cleared', `Cleared old state: ${key}`);
        }
      } catch (e) {
        // パースエラーの場合も削除
        localStorage.removeItem(key);
      }
    });
}

/**
 * グローバル設定用のフック
 */
export function useGlobalSettings() {
  const key = 'photoclove_global_settings';

  const saveSettings = useCallback((settings) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        version: PAGE_STATE_VERSION,
        timestamp: Date.now(),
        data: settings
      }));
      logger.debug('useGlobalSettings', 'saved', 'Global settings saved');
    } catch (error) {
      logger.error('useGlobalSettings', 'save_error', 'Failed to save settings', {
        error: error.message
      });
    }
  }, []);

  const loadSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      if (parsed.version !== PAGE_STATE_VERSION) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      logger.error('useGlobalSettings', 'load_error', 'Failed to load settings', {
        error: error.message
      });
      return null;
    }
  }, []);

  return { saveSettings, loadSettings };
}
```

#### 2-3. PhotosList.jsxでの使用

```javascript
// src/App/PhotosList.jsx

import { usePageState } from '../hooks/usePageState';
import { PAGES, PAGE_STATE_SCHEMA } from '../constants/pages';

function PhotosList(props) {
  // ... existing hooks ...

  // ページ状態管理フック
  const { savePageState, loadPageState } = usePageState(PAGES.DATE_VIEW);

  // ... state groups from Phase 1 ...

  /**
   * 現在のページ状態を保存
   */
  const saveCurrentState = useCallback(() => {
    const state = {
      selection: selectionState,
      filters: filterState,
      display: {
        ...displayState,
        scrollPosition: window.scrollY
      },
      view: {
        currentDate: viewState.currentDate,
        currentPhotoPath: displayState.currentPhotoPath
      }
    };

    savePageState(state);
  }, [selectionState, filterState, displayState, viewState, savePageState]);

  /**
   * ページ遷移ハンドラー（状態保存付き）
   */
  const navigateWithSave = useCallback(async (navigationFn) => {
    // 現在の状態を保存
    saveCurrentState();

    // ページ遷移実行
    navigationFn();
  }, [saveCurrentState]);

  /**
   * マウント時に状態を復元
   */
  useEffect(() => {
    const savedState = loadPageState();
    if (!savedState) {
      logger.debug('PhotosList', 'no_saved_state', 'No saved state to restore');
      return;
    }

    logger.info('PhotosList', 'restoring_state', 'Restoring page state from localStorage');

    // 選択状態を復元
    if (savedState.selection?.photos) {
      setPhotoSelectionDict(savedState.selection.photos);
      logger.debug('PhotosList', 'selection_restored', 'Photo selection restored', {
        count: Object.keys(savedState.selection.photos).length
      });
    }

    // フィルター状態を復元
    if (savedState.filters) {
      if (savedState.filters.star !== undefined) {
        setStarFilter(savedState.filters.star);
      }
      if (savedState.filters.comment !== undefined) {
        setHasCommentFilter(savedState.filters.comment);
      }
      if (savedState.filters.tag !== undefined) {
        setHasTagFilter(savedState.filters.tag);
      }
      if (savedState.filters.extension) {
        setExtensionFilter(savedState.filters.extension);
      }
      logger.debug('PhotosList', 'filters_restored', 'Filters restored');
    }

    // 表示設定を復元
    if (savedState.display) {
      if (savedState.display.iconSize) {
        setIconSize(savedState.display.iconSize);
      }
      if (savedState.display.sort) {
        setSort(savedState.display.sort);
      }
      if (savedState.display.showSideMenu !== undefined) {
        setShowSideMenu(savedState.display.showSideMenu);
      }

      // スクロール位置は少し遅延させて復元
      if (savedState.display.scrollPosition) {
        setTimeout(() => {
          window.scrollTo(0, savedState.display.scrollPosition);
          logger.debug('PhotosList', 'scroll_restored', 'Scroll position restored');
        }, 100);
      }
    }

    // ビュー状態を復元（日付など）
    if (savedState.view?.currentDate && savedState.view.currentDate !== currentDate) {
      updateCurrentDate(savedState.view.currentDate);
      logger.debug('PhotosList', 'view_restored', 'View state restored', {
        date: savedState.view.currentDate
      });
    }

    logger.info('PhotosList', 'state_restored', 'Page state fully restored');
  }, [loadPageState, setPhotoSelectionDict, setStarFilter, setHasCommentFilter,
      setIconSize, setSort, updateCurrentDate]);

  /**
   * アンマウント時に自動保存
   */
  useEffect(() => {
    return () => {
      logger.debug('PhotosList', 'unmounting', 'Saving state before unmount');
      saveCurrentState();
    };
  }, [saveCurrentState]);

  /**
   * ページ遷移ハンドラーを修正（保存付き）
   */
  const handleNavigateToAlbumList = useCallback(() => {
    navigateWithSave(() => {
      toggleAlbumListMode();
    });
  }, [navigateWithSave, toggleAlbumListMode]);

  const handleNavigateToTagList = useCallback(() => {
    navigateWithSave(() => {
      openTagsList();
    });
  }, [navigateWithSave, openTagsList]);

  const handleNavigateToHome = useCallback(() => {
    navigateWithSave(() => {
      toggleHome();
    });
  }, [navigateWithSave, toggleHome]);

  // ... rest of component ...
}
```

#### 2-4. デバッグユーティリティ

```javascript
// src/utils/debugStorage.js

import { logger } from '../services/LoggerService';

export const debugStorage = {
  /**
   * 全ての保存状態を表示
   */
  listAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('photoclove_'));

    console.log('=== PhotoClove Storage ===');
    console.log(`Total items: ${keys.length}`);

    let totalSize = 0;
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      const size = new Blob([value]).size;
      totalSize += size;

      console.log(`${key}: ${(size / 1024).toFixed(2)} KB`);

      try {
        const parsed = JSON.parse(value);
        if (parsed.timestamp) {
          const age = Math.floor((Date.now() - parsed.timestamp) / 1000);
          console.log(`  Age: ${age}s (${Math.floor(age / 60)}min)`);
        }
      } catch (e) {
        // ignore
      }
    });

    console.log(`Total size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log('========================');
  },

  /**
   * 特定のページ状態を表示
   */
  inspect(page) {
    const key = `photoclove_page_${page}`;
    const value = localStorage.getItem(key);

    if (value) {
      try {
        const parsed = JSON.parse(value);
        console.log(`=== Page State: ${page} ===`);
        console.log('Version:', parsed.version);
        console.log('Timestamp:', new Date(parsed.timestamp).toLocaleString());
        console.log('Age:', Math.floor((Date.now() - parsed.timestamp) / 1000) + 's');
        console.log('Data:', parsed.data);
        console.log('========================');
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    } else {
      console.log(`No state found for page: ${page}`);
    }
  },

  /**
   * 全てクリア
   */
  clearAll() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('photoclove_'));

    if (keys.length === 0) {
      console.log('No PhotoClove data to clear');
      return;
    }

    const confirmed = confirm(`Clear ${keys.length} items from localStorage?`);
    if (!confirmed) {
      console.log('Cancelled');
      return;
    }

    keys.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keys.length} items`);
    logger.info('debugStorage', 'cleared_all', 'All storage cleared', { count: keys.length });
  },

  /**
   * 特定のページをクリア
   */
  clearPage(page) {
    const key = `photoclove_page_${page}`;
    localStorage.removeItem(key);
    console.log(`Cleared state for page: ${page}`);
    logger.info('debugStorage', 'cleared_page', 'Page state cleared', { page });
  },

  /**
   * ストレージ使用量を取得
   */
  getUsage() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('photoclove_'));
    let total = 0;

    keys.forEach(key => {
      const value = localStorage.getItem(key);
      total += new Blob([value]).size;
    });

    return {
      items: keys.length,
      bytes: total,
      kb: (total / 1024).toFixed(2),
      mb: (total / 1024 / 1024).toFixed(2)
    };
  }
};

// DevToolsから使用可能にする
if (typeof window !== 'undefined') {
  window.debugStorage = debugStorage;
}

// 使用例をコンソールに出力
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('%c[PhotoClove Debug]', 'color: #00ff00; font-weight: bold');
  console.log('Storage debug utilities available:');
  console.log('  debugStorage.listAll()     - List all stored states');
  console.log('  debugStorage.inspect(page) - Inspect specific page state');
  console.log('  debugStorage.clearAll()    - Clear all states');
  console.log('  debugStorage.clearPage(p)  - Clear specific page');
  console.log('  debugStorage.getUsage()    - Get storage usage stats');
}
```

#### 2-5. Phase 2の成果

| 項目 | Before | After |
|------|--------|-------|
| 状態の永続化 | ❌ | ✅ |
| アプリ再起動後の復元 | ❌ | ✅ |
| 選択状態の保持 | ❌ | ✅ |
| フィルター設定の保持 | ❌ | ✅ |
| スクロール位置の復元 | ❌ | ✅ |

---

## 実装手順

### Step 1: Phase 1 - Props構造化 (1-2日)

1. `src/types/PageState.js` を作成
2. PhotosList.jsxで状態グループを作成（viewState, filterState, etc）
3. PhotoDisplayWrapper.jsxを更新
4. PhotoListContent.jsxを更新
5. SideMenuWrapper.jsxを更新
6. 動作確認（既存機能が全て動作することを確認）

### Step 2: Phase 2 - localStorage統合 (1-2日)

1. `src/constants/pages.js` を作成
2. `src/hooks/usePageState.js` を作成
3. `src/utils/debugStorage.js` を作成
4. PhotosList.jsxに状態保存・復元ロジックを追加
5. ページ遷移ハンドラーに保存処理を追加
6. 動作確認（状態が正しく保存・復元されることを確認）

### Step 3: テスト (0.5日)

1. 各ページで選択・フィルター・表示設定を変更
2. ページ遷移して戻る → 状態が復元されるか確認
3. アプリを再起動 → 状態が復元されるか確認
4. DevToolsで `debugStorage.listAll()` を実行して状態を確認

---

## 成功基準

- ✅ Props数が80%以上削減される
- ✅ 全ての既存機能が動作する（バグなし）
- ✅ ページ遷移後に状態が復元される
- ✅ アプリ再起動後に状態が復元される
- ✅ localStorage使用量が5MB以下
- ✅ パフォーマンス低下なし

---

## 利点

1. **可読性向上**: props 45個 → 5個で何が渡されているか明確
2. **保守性向上**: 関連する状態がグループ化されメンテしやすい
3. **UX向上**: 作業状態が保持され、作業を中断しても再開できる
4. **デバッグ容易**: DevToolsで状態を確認・編集可能
5. **実装コスト低**: Rust実装不要、JSのみで完結
6. **パフォーマンス**: 同期的アクセス、IPCオーバーヘッドなし

---

## 注意事項

1. **バージョン管理**: 状態構造を変更したら `PAGE_STATE_VERSION` を更新
2. **サイズ制限**: localStorage は5-10MBが上限。大量の選択は注意
3. **機密情報**: パスワード等は保存しない（現状問題なし）
4. **古い状態のクリア**: 7日以上前の状態は自動削除
5. **既存動作の維持**: Context API失敗の教訓を活かし、既存動作を100%維持

---

## 完了後

このファイルを `improvement/done/` に移動する。

**keep context**
