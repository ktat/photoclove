import { useState, useRef } from 'react';

/**
 * PhotosList component state management hook
 * Consolidates all the scattered useState calls into organized groups
 */
export const usePhotosState = () => {
    // Core photo data state
    const [photos, setPhotosList] = useState({ "photos": [] });
    const [photoCollection, setPhotoCollection] = useState(null);
    const [allPhotosForCurrentFetch, setAllPhotosForCurrentFetch] = useState([]);
    const [currentPhotoPath, setCurrentPhotoPath] = useState("");
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(undefined);

    // UI state
    const [iconSize, setIconSize] = useState(100);
    const [numOfPhoto, setNumOfPhoto] = useState(20);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [showSideMenu, setShowSideMenu] = useState(false);

    // Selection state
    const [photoSelection, setPhotoSelection] = useState([]);
    const [photoSelectionDict, setPhotoSelectionDict] = useState({});

    // Infinite scroll state
    const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(true);
    const [displayedPhotoCount, setDisplayedPhotoCount] = useState(50);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Configuration limits
    const [isLimitedByConfig, setIsLimitedByConfig] = useState(false);
    const [configLimit, setConfigLimit] = useState(null);

    // Filter state
    const [star, setStar] = useState([false, false, false, false, false]);
    const [starFilter, setStarFilter] = useState(0);
    const [hasCommentFilter, setHasCommentFilter] = useState(false);
    const [hasTagFilter, setHasTagFilter] = useState(false);
    const [extensionFilter, setExtensionFilter] = useState("all");

    // PhotosListMini state
    const [photosListMiniAllPhotos, setPhotosListMiniAllPhotos] = useState([]);
    const [photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex] = useState(0);
    const [photosListMiniReread, setPhotosListMiniReread] = useState(false);

    // Cache and performance state
    const [photosListImgSrc, setPhotosListImgSrc] = useState({});
    const [imgCacheMap, setImgCacheMap] = useState({});
    const [thumbnailStore, setThumbnailStore] = useState("");

    // Debug and misc state
    const [debugMessage, setDebugMessage] = useState("");
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);

    // Sorting state
    const [sortOfPhotos, setSort] = useState(0);
    const sortInitialized = useRef(false);

    // Filter options state
    const [filterOptions, setFilterOptions] = useState(null);
    const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false);

    // Import state
    const [importState, setImportState] = useState(null);

    // Album state
    const [filteredAlbums, setFilteredAlbums] = useState([]);
    const [albumSearchTerm, setAlbumSearchTerm] = useState('');
    const [currentAlbumName, setCurrentAlbumName] = useState('');
    const [showAlbumCreationModal, setShowAlbumCreationModal] = useState(false);
    const [selectedAlbums, setSelectedAlbums] = useState([]);

    // Tag state
    const [tagsList, setTagsList] = useState([]);
    const [filteredTags, setFilteredTags] = useState([]);
    const [tagSearchTerm, setTagSearchTerm] = useState('');
    const [currentTagName, setCurrentTagName] = useState('');
    const [tagPhotos, setTagPhotos] = useState([]);
    const [trashPhotos, setTrashPhotos] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);

    // Filter popover state
    const [showFilterPopover, setShowFilterPopover] = useState(false);
    const [filterButtonRef, setFilterButtonRef] = useState(null);

    return {
        // Core photo data
        photos,
        setPhotosList,
        photoCollection,
        setPhotoCollection,
        allPhotosForCurrentFetch,
        setAllPhotosForCurrentFetch,
        currentPhotoPath,
        setCurrentPhotoPath,
        currentPhotoIndex,
        setCurrentPhotoIndex,

        // UI state
        iconSize,
        setIconSize,
        numOfPhoto,
        setNumOfPhoto,
        photoLoading,
        setPhotoLoading,
        showSideMenu,
        setShowSideMenu,

        // Selection state
        photoSelection,
        setPhotoSelection,
        photoSelectionDict,
        setPhotoSelectionDict,

        // Infinite scroll
        infiniteScrollEnabled,
        setInfiniteScrollEnabled,
        displayedPhotoCount,
        setDisplayedPhotoCount,
        isLoadingMore,
        setIsLoadingMore,

        // Configuration limits
        isLimitedByConfig,
        setIsLimitedByConfig,
        configLimit,
        setConfigLimit,

        // Filter state
        star,
        setStar,
        starFilter,
        setStarFilter,
        hasCommentFilter,
        setHasCommentFilter,
        hasTagFilter,
        setHasTagFilter,
        extensionFilter,
        setExtensionFilter,

        // PhotosListMini
        photosListMiniAllPhotos,
        setPhotosListMiniAllPhotos,
        photosListMiniCurrentIndex,
        setPhotosListMiniCurrentIndex,
        photosListMiniReread,
        setPhotosListMiniReread,

        // Cache and performance
        photosListImgSrc,
        setPhotosListImgSrc,
        imgCacheMap,
        setImgCacheMap,
        thumbnailStore,
        setThumbnailStore,

        // Debug and misc
        debugMessage,
        setDebugMessage,
        currentPhotoLoadingController,
        setCurrentPhotoLoadingController,

        // Sorting
        sortOfPhotos,
        setSort,
        sortInitialized,

        // Filter options
        filterOptions,
        setFilterOptions,
        isFilterOptionsLoading,
        setIsFilterOptionsLoading,

        // Import
        importState,
        setImportState,

        // Albums
        filteredAlbums,
        setFilteredAlbums,
        albumSearchTerm,
        setAlbumSearchTerm,
        currentAlbumName,
        setCurrentAlbumName,
        showAlbumCreationModal,
        setShowAlbumCreationModal,
        selectedAlbums,
        setSelectedAlbums,

        // Tags
        tagsList,
        setTagsList,
        filteredTags,
        setFilteredTags,
        tagSearchTerm,
        setTagSearchTerm,
        currentTagName,
        setCurrentTagName,
        tagPhotos,
        setTagPhotos,
        trashPhotos,
        setTrashPhotos,
        selectedTags,
        setSelectedTags,

        // Filter popover
        showFilterPopover,
        setShowFilterPopover,
        filterButtonRef,
        setFilterButtonRef
    };
};