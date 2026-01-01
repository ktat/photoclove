/**
 * PageState Type Definitions
 *
 * Defines the structure of state groups used throughout PhotosList components.
 * These groups reduce prop drilling by organizing related state into cohesive objects.
 */

/**
 * @typedef {Object} ViewState
 * @property {string} mode - VIEW_MODES.DATE | ALBUM | TAG | etc
 * @property {string|null} currentDate - 現在表示中の日付 (YYYY-MM-DD)
 * @property {import('../domain/ViewMode.js').ViewMode} viewModeObj - ViewModeオブジェクト（全ての判別・データ取得に使用）
 *
 * Note: All mode checking (isSearchMode, isTagListMode, etc.) should be done via viewModeObj
 * Collection data (albumId/Name, tagId/Name) can be accessed via:
 * - viewModeObj.getCollectionId()
 * - viewModeObj.getCollectionName()
 * - viewModeObj.getCollectionType()
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
 * @property {string[]} photoList - 選択された写真パスの配列
 * @property {string[]} albums - 選択されたアルバムID配列
 * @property {string[]} tags - 選択されたタグID配列
 *
 * Note: Selection count can be derived from photoList.length
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
 * @property {number} numOfPhoto - 写真数
 */

/**
 * @typedef {Object} SearchState
 * @property {string} query - 検索クエリ
 * @property {Object} filters - 検索フィルター
 * @property {Array} results - 検索結果
 * @property {Object|null} currentParams - 現在の検索パラメータ
 *
 * Note: isSearchMode and isAdvancedSearchMode can be derived from viewModeObj
 * - viewModeObj.isSearchMode()
 * - viewModeObj.isAdvancedSearchMode()
 */

/**
 * @typedef {Object} PhotoDataState
 * @property {Array} displayed - 表示中の写真リスト（無限スクロール適用後）
 * @property {Array} filtered - フィルター適用後の写真リスト（全件）
 * @property {number} displayedCount - 表示中の写真数
 * @property {Array} allForCurrentFetch - 現在のフェッチで取得した全写真
 * @property {Function} setAllForCurrentFetch - allForCurrentFetchを更新する関数
 */

/**
 * PhotoListMini component state
 * @typedef {Object} PhotoListMiniState
 * @property {Array} allPhotos - All photos for mini display
 * @property {Function} setAllPhotos - Setter for all photos
 * @property {number} currentIndex - Current photo index
 * @property {Function} setCurrentIndex - Setter for current index
 * @property {boolean} reread - Force thumbnail re-read flag
 * @property {Function} setReread - Setter for reread flag
 */

/**
 * Cache state for images and thumbnails
 * @typedef {Object} CacheState
 * @property {Object} imgCache - Image cache map
 * @property {Function} setImgCache - Setter for image cache
 * @property {string} thumbnailStore - Thumbnail storage path
 * @property {Function} setThumbnailStore - Setter for thumbnail store
 */

/**
 * Navigation state
 * @typedef {Object} NavigationState
 * @property {boolean} shortCut - Shortcut navigation enabled
 * @property {Function} setShortCut - Setter for shortcut navigation
 */

/**
 * Configuration and app state
 * @typedef {Object} ConfigState
 * @property {Object} app - Application configuration
 * @property {Object} import - Import state
 * @property {Object} photos - Current photos list with metadata (has_next, etc.)
 */

/**
 * List view state (Albums/Tags)
 * @typedef {Object} ListState
 * @property {Object} albums - Album list state
 * @property {Array} albums.filtered - Filtered album list
 * @property {string} albums.searchTerm - Album search term
 * @property {Object} tags - Tag list state
 * @property {Array} tags.filtered - Filtered tag list
 * @property {string} tags.searchTerm - Tag search term
 */

/**
 * @typedef {Object} PageState
 * @property {ViewState} view
 * @property {FilterState} filters
 * @property {SelectionState} selection
 * @property {DisplayState} display
 * @property {SearchState} search
 * @property {PhotoDataState} photoData
 */

// Export for JSDoc usage (not actual export, just for documentation)
export {};
