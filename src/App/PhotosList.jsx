import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PhotosListMini from "./PhotosList/PhotosListMini.jsx";
import PhotoOption from "./PhotosList/PhotoOption.jsx";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import PhotoLoading from "./PhotosList/PhotoLoading.jsx";
import DirectoryMenu from "./PhotosList/DirectoryMenu.jsx";
import { openUrl } from '@tauri-apps/plugin-opener';
import { ImgCacheContext, AllPhotosContext } from "./ImgCacheContext.jsx";
import Scrollable from "../Scrollable.jsx";
import fileUrl from "../PathUtil.jsx";
import '../scrollable.css';
import { usePhoto } from "../context/PhotoContext.jsx";
import { useUI } from "../context/UIContext.jsx";
import { useSearch } from "../hooks/useSearch.js";
import { useError } from "../context/ErrorContext.jsx";
import SearchTools from "../components/SearchTools.jsx";
import TagChip from "../components/TagChip.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import { logger } from "../services/LoggerService.js";

function PhotosList(props) {
    const {
        dateList,
        datePage,
        updateDatePage,
        currentDate,
        updateCurrentDate,
        dateNum,
        updateDateNum,
        updateDateList,
        showPhotoDisplay,
        updateShowPhotoDisplay,
        setCurrentDateNum,
        recentPhotosMode,
        albumsList,
        currentAlbum,
        albumPhotos,
        updateAlbumsList,
        updateCurrentAlbum,
        updateAlbumPhotos
    } = usePhoto();
    
    logger.debug('PhotosList', 'component_render', 'PhotosList rendering', {
        recentPhotosMode,
        currentDate,
        propsCount: Object.keys(props).length
    });
    const { 
        addFooterMessage, 
        toggleSearchPage, 
        searchInitialQuery,
        showAlbumsList,
        currentAlbumId,
        viewMode,
        openAlbum,
    } = useUI();
    const { handleTauriError, addError } = useError();
    
    // Check current mode - moved before state declarations
    const isSearchMode = props.searchMode || false;
    const isAdvancedSearchMode = props.isAdvancedSearchMode || false;
    const isAlbumListMode = viewMode === 'album_list';
    const isAlbumMode = viewMode === 'album' && currentAlbumId;
    
    // Use search hook when in search mode
    const { searchResults, searchQuery, isSearching, performSearch, clearSearch: clearSearchHook } = useSearch();
    
    // Search state for the PhotosList component
    const [searchFilters, setSearchFilters] = useState({});
    const [currentSearchParams, setCurrentSearchParams] = useState(null);
    
    // Custom clear search function that also navigates back to home
    const clearSearch = useCallback(() => {
        clearSearchHook();
        setCurrentSearchParams(null);
        // Navigate back to home by toggling search page off
        toggleSearchPage(false);
    }, [clearSearchHook, toggleSearchPage]);
    
    // fetchConfig from props or generate from currentDate
    // For Advanced Search mode or Search mode, don't set initial fetchConfig to prevent auto-loading
    const fetchConfig = useMemo(() => {
        if (props.fetchConfig) return props.fetchConfig;
        if (isAdvancedSearchMode || isSearchMode) return null;
        
        return {
            fetch_method: recentPhotosMode ? "recent" : "date",
            value: recentPhotosMode ? "recent" : currentDate,
            title: recentPhotosMode ? "Recent Photos (60 most recent)" : currentDate,
            max_photos_per_fetch: recentPhotosMode ? 60 : undefined
        };
    }, [props.fetchConfig, isAdvancedSearchMode, isSearchMode, recentPhotosMode, currentDate]);

    // Debug logging
    logger.debug('PhotosList', 'fetchConfig_generation', 'FetchConfig debug', {
        recentPhotosMode,
        isSearchMode,
        currentDate,
        fetchConfig,
        propsMode: props.recentMode
    });
    
    // Create props compatibility layer for gradual migration
    const compatProps = {
        dateList: dateList || [],
        datePage: datePage || {},
        currentDate: currentDate || "",
        dateNum: dateNum || {},
        showPhotoDisplay: showPhotoDisplay || {},
        setDatePage: updateDatePage,
        setCurrentDate: updateCurrentDate,
        setShowPhotoDisplay: updateShowPhotoDisplay,
        setDateNum: updateDateNum,
        setDateList: updateDateList,
        setCurrentDateNum: setCurrentDateNum,
        addFooterMessage: addFooterMessage,
        ...props
    };
    const [iconSize, setIconSize] = useState(100);
    const [numOfPhoto, setNumOfPhoto] = useState(20);
    const [currentPhotoPath, setCurrentPhotoPath] = useState("");
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(undefined);
    const [photos, setPhotosList] = useState({ "photos": [] });
    // Removed scrollLock for infinite scroll implementation
    const [sortOfPhotos, setSort] = useState(0);
    const sortInitialized = useRef(false);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoSelection, setPhotoSelection] = useState([]);
    const [photoSelectionDict, setPhotoSelectionDict] = useState({});
    const [thumbnailStore, setThumbnailStore] = useState("");
    const [photosListMiniAllPhotos, setPhotosListMiniAllPhotos] = useState([]);
    const [photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex] = useState(0);
    const [photosListMiniReread, setPhotosListMiniReread] = useState(false);
    const [photosListImgSrc, setPhotosListImgSrc] = useState({});
    const [imgCacheMap, setImgCacheMap] = useState({});
    const [photoTags, setPhotoTags] = useState({}); // Cache for photo tags: { photoPath: [tags] }
    const [showSideMenu, setShowSideMenu] = useState(isSearchMode);
    
    // Infinite scroll state
    const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(true);
    const [displayedPhotoCount, setDisplayedPhotoCount] = useState(50);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // Store all photos for current fetch config (unfiltered)
    const [allPhotosForCurrentFetch, setAllPhotosForCurrentFetch] = useState([]);
    
    // Store configuration for photo fetch limits
    const [config, setConfig] = useState(null);
    const [isLimitedByConfig, setIsLimitedByConfig] = useState(false);
    const [configLimit, setConfigLimit] = useState(null);
    const [star, setStar] = useState([false, false, false, false, false]);
    const [starFilter, setStarFilter] = useState(0);
    const [hasCommentFilter, setHasCommentFilter] = useState(false);
    const [extensionFilter, setExtensionFilter] = useState("all");
    const [debugMessage, setDebugMessage] = useState("");
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);
    
    // Filter options caching state
    const [filterOptions, setFilterOptions] = useState(null);
    const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false);
    
    // Album state
    const [filteredAlbums, setFilteredAlbums] = useState([]);
    const [albumSearchTerm, setAlbumSearchTerm] = useState('');
    const [currentAlbumName, setCurrentAlbumName] = useState('');
    
    // Frontend filtering function - defined early to avoid temporal dead zone
    const applyFrontendFilters = (photos) => {
        // console.log(`[FILTER] Applying filters - star: ${starFilter}, hasComment: ${hasCommentFilter}, extension: ${extensionFilter}`);
        // console.log(`[FILTER] Input photos count: ${photos.length}`);
        
        const filtered = photos.filter(photo => {
            // Apply star filter
            if (starFilter > 0 && (!photo.star || photo.star < starFilter)) {
                return false;
            }
            
            // Apply comment filter
            if (hasCommentFilter && (!photo.comment || photo.comment.trim() === "")) {
                return false;
            }
            
            // Apply extension filter
            if (extensionFilter !== "all") {
                const extension = photo.file.name.split('.').pop().toLowerCase();
                const allowedExtensions = extensionFilter.split(',').map(ext => ext.trim().toLowerCase());
                if (!allowedExtensions.includes(extension)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // console.log(`[FILTER] Filtered photos count: ${filtered.length}`);
        return filtered;
    };
    
    // Filter options caching function
    const loadFilterOptions = useCallback(async () => {
        if (filterOptions || isFilterOptionsLoading) return filterOptions;
        
        setIsFilterOptionsLoading(true);
        try {
            const [cameras, lenses, extensions] = await Promise.all([
                invoke('get_filter_options', { filterType: 'cameras' }),
                invoke('get_filter_options', { filterType: 'lenses' }),
                invoke('get_filter_options', { filterType: 'extensions' })
            ]);

            const options = {
                cameras: JSON.parse(cameras),
                lenses: JSON.parse(lenses),
                extensions: JSON.parse(extensions)
            };
            setFilterOptions(options);
            return options;
        } catch (error) {
            console.error('Failed to load filter options:', error);
            handleTauriError(error, 'Load filter options');
            return null;
        } finally {
            setIsFilterOptionsLoading(false);
        }
    }, [filterOptions, isFilterOptionsLoading]);

    // Album loading functions
    const loadAlbums = useCallback(async () => {
        try {
            logger.info('PhotosList', 'load_albums_start', 'Loading albums list');
            const albums = await invoke("get_all_albums");
            
            const processedAlbums = albums.map(album => ({
                id: album[0],
                name: album[1],
                description: album[2],
                coverPhoto: album[3] || null,
                photoCount: album[4] || 0
            }));
            
            updateAlbumsList(processedAlbums);
            setFilteredAlbums(processedAlbums);
            
            logger.info('PhotosList', 'load_albums_complete', 'Albums loaded successfully', {
                albumCount: processedAlbums.length
            });
        } catch (error) {
            logger.error('PhotosList', 'load_albums_failed', 'Failed to load albums', {
                error: error.message
            });
            handleTauriError(error, 'Load albums');
        }
    }, [updateAlbumsList, handleTauriError]);

    const loadAlbumPhotos = useCallback(async (albumId) => {
        try {
            logger.info('PhotosList', 'load_album_photos_start', 'Loading album photos', { albumId });
            const albumPhotosJson = await invoke("get_album_photos_with_metadata", { albumId });
            const albumPhotos = JSON.parse(albumPhotosJson);
            
            updateAlbumPhotos(albumPhotos);
            setPhotosList({ photos: albumPhotos });
            
            logger.info('PhotosList', 'load_album_photos_complete', 'Album photos loaded', {
                albumId,
                photoCount: albumPhotos.length
            });
        } catch (error) {
            logger.error('PhotosList', 'load_album_photos_failed', 'Failed to load album photos', {
                albumId,
                error: error.message
            });
            handleTauriError(error, 'Load album photos');
        }
    }, [updateAlbumPhotos, handleTauriError]);

    // Handle album click to switch to album view
    const handleAlbumClick = useCallback((album) => {
        logger.info('PhotosList', 'album_click', 'User clicked on album', {
            albumId: album.id,
            albumName: album.name
        });
        
        // Switch to album view mode
        openAlbum(album.id);
        setCurrentAlbumName(album.name);
        
        // Load photos for this album
        loadAlbumPhotos(album.id);
    }, [openAlbum, loadAlbumPhotos]);

    // Filter albums by search term
    useEffect(() => {
        if (albumsList.length === 0) {
            setFilteredAlbums([]);
            return;
        }
        
        if (!albumSearchTerm.trim()) {
            setFilteredAlbums(albumsList);
            return;
        }
        
        const filtered = albumsList.filter(album =>
            album.name.toLowerCase().includes(albumSearchTerm.toLowerCase())
        );
        setFilteredAlbums(filtered);
    }, [albumsList, albumSearchTerm]);

    // Load albums when in album list mode
    useEffect(() => {
        if (isAlbumListMode) {
            logger.info('PhotosList', 'album_list_mode', 'Album list mode activated, loading albums');
            loadAlbums();
        }
    }, [isAlbumListMode, loadAlbums]);

    // Load album photos when album is selected
    useEffect(() => {
        if (isAlbumMode && currentAlbumId) {
            logger.info('PhotosList', 'album_mode', 'Album mode activated, loading album photos', { albumId: currentAlbumId });
            loadAlbumPhotos(currentAlbumId);
            
            // Set current album name if we have albums loaded
            const currentAlbum = albumsList.find(album => album.id === currentAlbumId);
            if (currentAlbum) {
                setCurrentAlbumName(currentAlbum.name);
            }
        } else {
            // Clear album name when not in album mode
            setCurrentAlbumName('');
        }
    }, [isAlbumMode, currentAlbumId, loadAlbumPhotos, albumsList]);

    // Search handlers (defined after state to ensure sortOfPhotos is available)
    const handleSearch = useCallback(async (query, type, filters) => {
        const params = { query, searchType: type, filters };
        logger.info('PhotosList', 'handle_search', 'Search triggered from UI', {
            query, 
            type, 
            filters,
            isSearchMode,
            searchResultsLength: searchResults.length
        });
        setCurrentSearchParams(params);
        
        // Map sortOfPhotos to backend sort field names with order
        const sortConfig = {
            0: { field: 'exif_date_time_original', order: 'desc' },  // Shot Time (desc)
            1: { field: 'exif_date_time_original', order: 'asc' },   // Shot Time (asc)
            2: { field: 'photo_date', order: 'desc' },               // Added Time (desc)
            3: { field: 'photo_date', order: 'asc' },                // Added Time (asc)
            4: { field: 'star', order: 'desc' },                     // Star Rating (desc)
            5: { field: 'star', order: 'asc' },                      // Star Rating (asc)
            6: { field: 'path', order: 'desc' },                     // File Name (desc)
            7: { field: 'path', order: 'asc' }                       // File Name (asc)
        };
        const config = sortConfig[sortOfPhotos] || sortConfig[0];
        const sortField = config.field;
        const sortOrder = config.order;
        
        await performSearch(query, type, filters, sortField, sortOrder);
    }, [performSearch, sortOfPhotos]);

    // Auto-execute search when coming from HOME with initial query
    useEffect(() => {
        if (isSearchMode && searchInitialQuery && searchInitialQuery.trim() && !searchQuery) {
            logger.info('PhotosList', 'auto_search_from_home', 'Executing auto-search from HOME', {
                searchInitialQuery,
                isSearchMode
            });
            handleSearch(searchInitialQuery, 'all', {});
        }
    }, [isSearchMode, searchInitialQuery, searchQuery, handleSearch]);

    const handleSearchClear = useCallback(() => {
        clearSearch();
    }, [clearSearch]);

    const handleSavedSearchSelect = useCallback((searchParams) => {
        setCurrentSearchParams(searchParams);
        
        // Update search filters state to reflect in UI
        if (searchParams.filters) {
            setSearchFilters(searchParams.filters);
        }
        
        // Map sortOfPhotos to backend sort field names with order
        const sortConfig = {
            0: { field: 'exif_date_time_original', order: 'desc' },  // Shot Time (desc)
            1: { field: 'exif_date_time_original', order: 'asc' },   // Shot Time (asc)
            2: { field: 'photo_date', order: 'desc' },               // Added Time (desc)
            3: { field: 'photo_date', order: 'asc' },                // Added Time (asc)
            4: { field: 'star', order: 'desc' },                     // Star Rating (desc)
            5: { field: 'star', order: 'asc' },                      // Star Rating (asc)
            6: { field: 'path', order: 'desc' },                     // File Name (desc)
            7: { field: 'path', order: 'asc' }                       // File Name (asc)
        };
        const config = sortConfig[sortOfPhotos] || sortConfig[0];
        const sortField = config.field;
        const sortOrder = config.order;
        
        performSearch(searchParams.query, searchParams.searchType, searchParams.filters, sortField, sortOrder);
    }, [performSearch, sortOfPhotos]);

    // Function to load tags for a photo
    const loadPhotoTags = useCallback(async (photoPath) => {
        if (photoTags[photoPath]) {
            return photoTags[photoPath]; // Return cached tags
        }
        
        try {
            const tags = await invoke('get_tags_for_photo', { photoPath });
            const formattedTags = tags.map(([id, name, color]) => ({ id, name, color }));
            
            setPhotoTags(prev => ({
                ...prev,
                [photoPath]: formattedTags
            }));
            
            return formattedTags;
        } catch (error) {
            logger.error('PhotosList', 'load_photo_tags_error', 'Failed to load photo tags', {
                photoPath,
                error: error.toString()
            });
            addError(error, 'Load photo tags', `loading tags for ${photoPath}`);
            return [];
        }
    }, [photoTags]);

    // Memoize filtered photos to avoid recalculating on every render
    const filteredPhotos = useMemo(() => {
        // Use album photos when in album mode, otherwise use regular photos
        const sourcePhotos = isAlbumMode ? albumPhotos : allPhotosForCurrentFetch;
        
        logger.debug('PhotosList', 'filtering_photos', 'Applying frontend filters', {
            isAlbumMode,
            sourcePhotosCount: sourcePhotos.length,
            starFilter,
            hasCommentFilter,
            extensionFilter
        });
        const result = applyFrontendFilters(sourcePhotos);
        logger.debug('PhotosList', 'filtered_result', 'Frontend filter result', {
            isAlbumMode,
            originalCount: sourcePhotos.length,
            filteredCount: result.length
        });
        return result;
    }, [isAlbumMode, albumPhotos, allPhotosForCurrentFetch, starFilter, hasCommentFilter, extensionFilter]);

    // Displayed photos for infinite scroll
    const displayedPhotos = useMemo(() => {
        logger.debug('PhotosList', 'display_photos', 'Calculating displayed photos', {
            filteredCount: filteredPhotos.length,
            displayedPhotoCount,
            infiniteScrollEnabled
        });
        if (infiniteScrollEnabled) {
            const result = filteredPhotos.slice(0, displayedPhotoCount);
            logger.debug('PhotosList', 'displayed_result', 'Displayed photos result', {
                filtered: filteredPhotos.length,
                displayCount: displayedPhotoCount,
                result: result.length
            });
            console.log(`[DISPLAYED_PHOTOS] Slice: filtered=${filteredPhotos.length}, displayCount=${displayedPhotoCount}, result=${result.length}`);
            return result;
        }
        logger.debug('PhotosList', 'displayed_all', 'Showing all filtered photos (infinite scroll disabled)', {
            count: filteredPhotos.length
        });
        return filteredPhotos; // Infinite scroll disabled shows all
    }, [filteredPhotos, displayedPhotoCount, infiniteScrollEnabled]);

    // Notify parent when menu state changes
    useEffect(() => {
        if (props.onRightMenuToggle) {
            props.onRightMenuToggle(showSideMenu);
        }
    }, [showSideMenu, props.onRightMenuToggle]);
    
    // Close side menu when transitioning from search mode to non-search mode
    useEffect(() => {
        if (!isSearchMode && showSideMenu) {
            // Only close if we were previously in search mode
            setShowSideMenu(false);
        }
    }, [isSearchMode]);

    // Re-execute search when sort changes (only if we have active search)
    useEffect(() => {
        // Skip initial render to avoid infinite loop
        if (!sortInitialized.current) {
            sortInitialized.current = true;
            return;
        }
        
        // Only re-execute if we're in search mode, have search params, and there are search results
        if (isSearchMode && currentSearchParams && searchResults.length > 0) {
            logger.info('PhotosList', 'sort_changed_reexecute', 'Re-executing search due to sort change', {
                sortOfPhotos,
                currentSearchParams
            });
            
            // Call performSearch directly to avoid dependency cycle
            const sortConfig = {
                0: { field: 'exif_date_time_original', order: 'desc' },
                1: { field: 'exif_date_time_original', order: 'asc' },
                2: { field: 'photo_date', order: 'desc' },
                3: { field: 'photo_date', order: 'asc' },
                4: { field: 'star', order: 'desc' },
                5: { field: 'star', order: 'asc' },
                6: { field: 'path', order: 'desc' },
                7: { field: 'path', order: 'asc' }
            };
            const config = sortConfig[sortOfPhotos] || sortConfig[0];
            
            performSearch(
                currentSearchParams.query, 
                currentSearchParams.searchType, 
                currentSearchParams.filters,
                config.field,
                config.order
            );
        }
    }, [sortOfPhotos, isSearchMode, currentSearchParams, performSearch]);

    // Load tags for displayed photos
    useEffect(() => {
        const loadTagsForPhotos = async () => {
            if (!filteredPhotos || filteredPhotos.length === 0) return;
            
            const visiblePhotos = filteredPhotos.slice(0, displayedPhotoCount);
            const photosNeedingTags = visiblePhotos.filter(photo => !photoTags[photo.file.path]);
            
            if (photosNeedingTags.length === 0) return;
            
            try {
                const tagPromises = photosNeedingTags.map(photo => 
                    loadPhotoTags(photo.file.path)
                );
                await Promise.all(tagPromises);
            } catch (error) {
                logger.error('PhotosList', 'load_tags_batch_error', 'Failed to load tags for photos', {
                    error: error.toString()
                });
                addError(error, 'Load photo tags (batch)', 'loading tags for multiple photos');
            }
        };

        loadTagsForPhotos();
    }, [filteredPhotos, displayedPhotoCount, loadPhotoTags]);

    const handleFiltersChange = useCallback((newFilters) => {
        // console.log('handleFiltersChange called with:', newFilters);
        setSearchFilters(newFilters);
        
        // Manual execution only - auto search removed per improvement #46
        // console.log('Filters updated. User needs to manually execute search.');
    }, []); // Removed dependencies for manual execution only
    
    // Infinite scroll handlers
    const loadMorePhotos = useCallback(() => {
        if (isLoadingMore) {
            return;
        }
        
        setIsLoadingMore(true);
        
        // Async batch addition to prevent UI blocking
        setTimeout(() => {
            setDisplayedPhotoCount(prev => {
                // Access current filtered photos length via the state updater function
                const currentFilteredPhotos = applyFrontendFilters(allPhotosForCurrentFetch);
                const newCount = Math.min(prev + 50, currentFilteredPhotos.length);
                console.log(`[INFINITE_SCROLL] Loading more: prev=${prev}, filtered=${currentFilteredPhotos.length}, newCount=${newCount}`);
                return newCount >= currentFilteredPhotos.length ? currentFilteredPhotos.length : newCount;
            });
            setIsLoadingMore(false);
        }, 100);
    }, [isLoadingMore, applyFrontendFilters, allPhotosForCurrentFetch]);
    
    const handleInfiniteScroll = useCallback((e) => {
        const scrollContainer = e.target;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        
        // Trigger load when 80% scrolled
        if (scrollTop + clientHeight >= scrollHeight * 0.8) {
            loadMorePhotos();
        }
    }, [loadMorePhotos]);
    
    // Notify parent when menu state changes

    // Create enhanced setStar function that updates photosListMiniAllPhotos
    const setStarWithUpdate = (newStar) => {
        setStar(newStar);
        
        // Calculate star value from array
        let starValue = 0;
        for (let i = 0; i < 5; i++) {
            if (newStar[i]) {
                starValue = i + 1;
            } else {
                break;
            }
        }
        
        // Update the star value in photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photo => {
            if (photo.file.path === currentPhotoPath) {
                return { ...photo, star: starValue };
            }
            return photo;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);
        
        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.file.path === currentPhotoPath) {
                return { ...photo, star: starValue };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    };
    
    // Create function to update comment in photo lists
    const updatePhotoComment = (photoPath, hasComment) => {
        // Update photosListMiniAllPhotos
        const updatedPhotos = photosListMiniAllPhotos.map(photo => {
            if (photo.file.path === photoPath) {
                return { ...photo, comment: hasComment ? "has comment" : null };
            }
            return photo;
        });
        setPhotosListMiniAllPhotos(updatedPhotos);
        
        // Also update allPhotosForCurrentFetch to trigger re-filtering
        const updatedAllPhotos = allPhotosForCurrentFetch.map(photo => {
            if (photo.file.path === photoPath) {
                return { ...photo, comment: hasComment ? "has comment" : null };
            }
            return photo;
        });
        setAllPhotosForCurrentFetch(updatedAllPhotos);
    };

    // Album management handlers
    const handleAlbumUpdate = () => {
        // Refresh album list and current album after update
        if (isAlbumListMode) {
            loadAlbums();
        }
        if (currentAlbumId) {
            loadAlbumPhotos(currentAlbumId);
        }
        logger.info('PhotosList', 'album_updated', 'Album refreshed after update', { currentAlbumId });
    };

    const handleAlbumDelete = (deletedAlbumId) => {
        // Handle album deletion - navigate back to album list
        if (deletedAlbumId === currentAlbumId) {
            // Navigate back to album list
            toggleAlbumListMode();
            logger.info('PhotosList', 'album_deleted', 'Navigated back to album list after deletion', { deletedAlbumId });
        }
        // Refresh album list if we're in album list mode
        if (isAlbumListMode) {
            loadAlbums();
        }
    };

    // Function to parse CSS style string and convert to style object
    const parseCssStyle = (cssString) => {
        if (!cssString) return {};
        
        const styles = {};
        const declarations = cssString.split(';').filter(decl => decl.trim());
        
        declarations.forEach(declaration => {
            const [property, value] = declaration.split(':').map(s => s.trim());
            if (property && value) {
                // Convert CSS property names to camelCase for React
                const camelCaseProperty = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                styles[camelCaseProperty] = value;
            }
        });
        
        return styles;
    };

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
            setConfig(json); // Store the full config including max_photos_per_fetch
        });
        
        // Cleanup function to cancel any pending photo loading on component unmount
        return () => {
            if (currentPhotoLoadingController) {
                currentPhotoLoadingController.abort();
            }
        };
    }, [])

    useEffect(() => {
        // Set CSS custom property for grid column sizing based on icon size
        // Use a more appropriate calculation for grid sizing
        const gridSize = Math.max(120, parseInt(iconSize) + 41);
        document.documentElement.style.setProperty('--photo-grid-size', `${gridSize}px`);
        
        // Cleanup function
        return () => {
            // Cancel any pending requests when component unmounts
            if (currentPhotoLoadingController) {
                currentPhotoLoadingController.abort();
            }
        };
    }, [iconSize])

    // Load photos when fetchConfig changes
    useEffect(() => {
        // console.log(`[FETCH_CONFIG_CHANGE] New fetchConfig:`, fetchConfig);
        
        // Skip if in album mode - album photos are managed separately
        if (isAlbumMode) {
            logger.debug('PhotosList', 'useEffect_skip_album', 'Skipping fetchConfig reload - in album mode');
            return;
        }
        
        // Skip if already loading to prevent race conditions
        if (photoLoading) {
            // console.log(`[FETCH_CONFIG_CHANGE] Already loading, skipping`);
            return;
        }
        
        setShowSideMenu(isSearchMode);
        
        // Cancel current photo loading if in progress
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }
        
        // Reset state for infinite scroll
        setPhotosList({ "photos": [] });
        setCurrentPhotoIndex(0);
        setPhotosListMiniCurrentIndex(0);
        setCurrentPhotoPath(undefined);
        
        // Load all photos based on fetch config (skip if fetchConfig is null for Advanced Search mode)
        logger.debug('PhotosList', 'useEffect_trigger', 'UseEffect triggered - loading photos', {
            fetchConfig,
            recentPhotosMode,
            willLoad: !!fetchConfig,
            fetchMethod: fetchConfig?.fetch_method,
            fetchValue: fetchConfig?.value
        });
        if (fetchConfig) {
            logger.debug('PhotosList', 'useEffect_load', 'Calling loadAllPhotosBasedOnFetchConfig');
            loadAllPhotosBasedOnFetchConfig(fetchConfig);
        } else {
            logger.debug('PhotosList', 'useEffect_skip', 'Not loading photos - fetchConfig is null/undefined');
        }
        
    }, [fetchConfig?.fetch_method, fetchConfig?.value, fetchConfig?.max_photos_per_fetch, isAlbumMode]);

    // Load filter options for Advanced Search mode
    useEffect(() => {
        if (isAdvancedSearchMode && !filterOptions && !isFilterOptionsLoading) {
            logger.info('PhotosList', 'advanced_search_init', 'Loading filter options for Advanced Search mode');
            loadFilterOptions();
        }
    }, [isAdvancedSearchMode, filterOptions, isFilterOptionsLoading, loadFilterOptions]);

    // Apply filters when filter settings change (infinite scroll version)
    useEffect(() => {
        if (filteredPhotos.length > 0 || allPhotosForCurrentFetch.length > 0) {
            // console.log(`[FILTER_CHANGE] Applying frontend filters: ${filteredPhotos.length} photos after filtering`);
            setPhotosListMiniAllPhotos(filteredPhotos);
            
            // Reset display count for infinite scroll when filters change
            if (infiniteScrollEnabled) {
                setDisplayedPhotoCount(Math.min(50, filteredPhotos.length));
            }
        }
    }, [filteredPhotos, infiniteScrollEnabled, allPhotosForCurrentFetch]);
    
    // Update photos list when displayedPhotos changes (for infinite scroll)
    useEffect(() => {
        if (displayedPhotos.length > 0) {
            setPhotosList({ photos: displayedPhotos, has_next: false, has_prev: false });
        }
    }, [displayedPhotos]);

    function displayPhoto(f, i) {
        setCurrentPhotoPath(f);
        setCurrentPhotoIndex(i);
        
        // Find the global index in the all photos array
        const globalIndex = photosListMiniAllPhotos.findIndex(photo => photo.file.path === f);
        if (globalIndex !== -1) {
            // console.log(`[DISPLAY_PHOTO] Found photo at global index: ${globalIndex} (total photos: ${photosListMiniAllPhotos.length})`);
            setPhotosListMiniCurrentIndex(globalIndex);
        } else {
            // console.log(`[DISPLAY_PHOTO] Photo not found in all photos array, using page-relative index: ${i}`);
            // Fallback: use the provided index if photo not found in all photos
            setPhotosListMiniCurrentIndex(i);
        }
        
        // Force a re-read to ensure thumbnails are properly initialized
        setPhotosListMiniReread(!photosListMiniReread);
        
        compatProps.setShowPhotoDisplay(true);
    }

    function addSelection(t, f) {
        const selection = photoSelection.concat();
        if (t) {
            if (!photoSelectionDict[f]) {
                selection.push(f);
                photoSelectionDict[f] = true;
            }
            changeTab(undefined, "#tab-selection");
        } else {
            delete photoSelectionDict[f];
            const i = selection.indexOf(f)
            if (i >= 0) {
                selection.splice(i, 1);
            }
        }
        setPhotoSelectionDict(photoSelectionDict);
        setPhotoSelection(selection);
    }

    function toggleSelection(f) {
        let t = true;
        if (photoSelectionDict[f]) {
            t = false;
        }
        addSelection(t, f);
        return t;
    }

    function isSelected(f) {
        return photoSelectionDict[f];
    }

    function clearPhotoSelection() {
        setPhotoSelectionDict({});
        setPhotoSelection([]);
    }

    function selectAllPhotoToSelection() {
        const selection = photoSelection.concat();
        const newSelectionDict = { ...photoSelectionDict };
        
        // For infinite scroll, select only displayed photos to avoid confusion
        const targetPhotos = infiniteScrollEnabled ? displayedPhotos : filteredPhotos;
        
        targetPhotos.forEach((photo) => {
            const path = photo.file.path;
            if (!newSelectionDict[path]) {
                selection.push(path);
                newSelectionDict[path] = true;
            }
        });
        
        setPhotoSelectionDict(newSelectionDict);
        setPhotoSelection(selection);
    }

    const [tabClass, setTabClass] = useState({
        'filter': !isSearchMode,
        'maintenance': false,
        'selection': false,
        'search': isSearchMode,
    });

    function changeTab(e, t) {
        if (e) e.preventDefault();
        const c = {
            'filter': false,
            'maintenance': false,
            'selection': false,
            'search': false,
        };
        c[t.replace(/^.*#tab-/, '')] = true;
        setTabClass(c);
    }

    // Remove photo from current view (for album removal)
    const removePhotoFromList = (indexToRemove) => {
        logger.info('PhotosList', 'remove_photo_from_list', 'Removing photo from current view', {
            index: indexToRemove,
            totalPhotos: photosListMiniAllPhotos.length
        });
        
        // Remove from photosListMiniAllPhotos
        const newAllPhotos = [...photosListMiniAllPhotos];
        newAllPhotos.splice(indexToRemove, 1);
        setPhotosListMiniAllPhotos(newAllPhotos);
        
        // Also remove from allPhotosForCurrentFetch and filteredPhotos
        const removedPath = photosListMiniAllPhotos[indexToRemove]?.file?.path;
        if (removedPath) {
            const newAllPhotosForFetch = allPhotosForCurrentFetch.filter(photo => photo.file.path !== removedPath);
            setAllPhotosForCurrentFetch(newAllPhotosForFetch);
        }
        
        // Adjust current index if needed
        if (indexToRemove >= newAllPhotos.length && newAllPhotos.length > 0) {
            // Last photo was removed, go to previous
            const newIndex = newAllPhotos.length - 1;
            setPhotosListMiniCurrentIndex(newIndex);
            setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
            setCurrentPhotoIndex(newIndex);
        } else if (newAllPhotos.length > 0) {
            // Stay at same index (now showing next photo)
            const newIndex = Math.min(indexToRemove, newAllPhotos.length - 1);
            setPhotosListMiniCurrentIndex(newIndex);
            setCurrentPhotoPath(newAllPhotos[newIndex].file.path);
            setCurrentPhotoIndex(newIndex);
        } else {
            // No photos left
            closePhotoDisplay();
        }
    };

    function moveToTrashCan(f) {
        // console.log("delete file: " + f)
        invoke("move_to_trash", { pathStr: f, sortValue: parseInt(sortOfPhotos) }).then((d) => {
            if (d) {
                const date = d
                const date_with_slash = d.replace(/-/g, "/");
                if (compatProps.dateNum[date] > 0) {
                    compatProps.dateNum[date] -= 1;
                    compatProps.setDateNum(compatProps.dateNum);
                    compatProps.setDateList(compatProps.dateList.concat());
                }

                // Always update thumbnail list when photo is deleted from current view
                if (photosListMiniAllPhotos.length > 0) {
                    const allPhotos = photosListMiniAllPhotos
                    // Create a new array instead of mutating the existing one to trigger React state update
                    const newAllPhotos = [...allPhotos];
                    newAllPhotos.splice(currentPhotoIndex, 1);
                    setPhotosListMiniAllPhotos(newAllPhotos);
                    // no photos are remaining after the deleted photo
                    // last photo
                    if (currentPhotoIndex >= newAllPhotos.length) {
                        const ci = currentPhotoIndex - 1;
                        // console.log("last photo!")
                        if (newAllPhotos[ci]) {
                            setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                            setCurrentPhotoPath(newAllPhotos[ci].file.path);
                            setCurrentPhotoIndex(ci);
                        }
                    }
                    // not last photo
                    else {
                        const ci = currentPhotoIndex;
                        // console.log("Not last photo!")
                        setPhotosListMiniReread(!photosListMiniReread);
                        setCurrentPhotoPath(newAllPhotos[ci].file.path);
                    }
                    if (newAllPhotos.length == 0) {
                        closePhotoDisplay();
                    }
                }
            }
        });
    }

    async function loadAllPhotosBasedOnFetchConfig(fetchConfig) {
        logger.info('PhotosList', 'load_photos_config', 'loadAllPhotosBasedOnFetchConfig called', {
            config: fetchConfig,
            hasConfig: !!fetchConfig
        });
        if (!fetchConfig) return;
        
        // Prevent duplicate loading
        if (photoLoading) {
            logger.info('PhotosList', 'loading_already_in_progress', 'Photo loading already in progress, skipping');
            return;
        }
        
        // Some fetch methods don't require a value (e.g., favorites, search with filters only, recent)
        if (fetchConfig.fetch_method !== "favorites" && fetchConfig.fetch_method !== "search" && fetchConfig.fetch_method !== "recent" && !fetchConfig.value) return;
        
        logger.info('PhotosList', 'load_all_start', 'Loading all photos', { 
            config, 
            isSearchMode, 
            searchResultsLength: searchResults.length,
            fetchMethod: fetchConfig?.fetch_method
        });
        
        // Show loading indicator
        setPhotoLoading(true);
        
        try {
            let result;
            
            logger.debug('PhotosList', 'load_all_switch', 'About to switch on fetch_method', { 
                fetch_method: fetchConfig.fetch_method 
            });
            switch (fetchConfig.fetch_method) {
                case "date":
                    // Note: We need to pass filter values that won't exclude any photos
                    // but will still cause the backend to include metadata
                    logger.info('PhotosList', 'date_case_start', 'About to call get_photos_with_filter for date', {
                        dateStr: fetchConfig.value,
                        sortValue: parseInt(sortOfPhotos)
                    });
                    result = await invoke("get_photos_with_filter", {
                        dateStr: fetchConfig.value,
                        sortValue: parseInt(sortOfPhotos),
                        page: 1,
                        num: Math.min(9999, config?.max_photos_per_fetch || 1000), // Limit based on config for performance
                        offset: 0,
                        star: -1, // -1 means no star filter but include star data
                        hasComment: false,
                        extension: "all"
                    });
                    logger.info('PhotosList', 'date_case_result', 'get_photos_with_filter result', {
                        resultType: typeof result,
                        resultLength: result ? result.length : 'null',
                        hasResult: !!result
                    });
                    break;
                    
                case "search":
                    // Use search results from the hook if available
                    logger.debug('PhotosList', 'search_mode_debug', 'Search mode debug information', {
                        isSearchMode,
                        searchResultsLength: searchResults.length,
                        searchResults: searchResults.slice(0, 3), // Log first 3 results for debugging
                        propsSearchMode: props.searchMode
                    });
                    
                    if (isSearchMode && searchResults.length > 0) {
                        logger.info('PhotosList', 'using_search_results', 'Using search results from hook');
                        result = JSON.stringify({ photos: searchResults });
                    } else {
                        // Fall back to date-based search for now
                        logger.warn('PhotosList', 'search_fallback', 'No search results available, falling back to date-based');
                        result = await invoke("get_photos_with_filter", {
                            dateStr: fetchConfig.value || compatProps.currentDate,
                            sortValue: parseInt(sortOfPhotos),
                            page: 1,
                            num: Math.min(9999, config?.max_photos_per_fetch || 1000), // Limit based on config for performance
                            offset: 0,
                            star: -1,
                            hasComment: false,
                            extension: "all"
                        });
                    }
                    break;
                    
                case "tag":
                    // Fall back to date-based search for now
                    console.warn("[LOAD_ALL] Tag API not implemented, falling back to date-based");
                    result = await invoke("get_photos_with_filter", {
                        dateStr: fetchConfig.value || compatProps.currentDate,
                        sortValue: parseInt(sortOfPhotos),
                        page: 1,
                        num: Math.min(9999, config?.max_photos_per_fetch || 1000), // Limit based on config for performance
                        offset: 0,
                        star: -1,
                        hasComment: false,
                        extension: "all"
                    });
                    break;
                    
                case "favorites":
                    // Fall back to date-based search for now
                    console.warn("[LOAD_ALL] Favorites API not implemented, falling back to date-based");
                    result = await invoke("get_photos_with_filter", {
                        dateStr: compatProps.currentDate,
                        sortValue: parseInt(sortOfPhotos),
                        page: 1,
                        num: Math.min(9999, config?.max_photos_per_fetch || 1000), // Limit based on config for performance
                        offset: 0,
                        star: -1,
                        hasComment: false,
                        extension: "all"
                    });
                    break;
                    
                case "recent":
                    const recentParams = {
                        limit: Math.min(60, config?.max_photos_per_fetch || 60),
                        sortValue: parseInt(sortOfPhotos),
                        star: -1,
                        hasComment: false,
                        extension: "all"
                    };
                    logger.info('PhotosList', 'recent_case_start', 'About to call get_recent_photos', {
                        limit: recentParams.limit,
                        sortValue: recentParams.sortValue
                    });
                    result = await invoke("get_recent_photos", recentParams);
                    logger.info('PhotosList', 'recent_case_result', 'get_recent_photos result', {
                        resultType: typeof result,
                        resultLength: result ? result.length : 'null',
                        hasResult: !!result
                    });
                    break;
                    
                default:
                    logger.error('PhotosList', 'load_all_unknown', 'Unknown fetch method', {
                        fetchMethod: fetchConfig.fetch_method
                    });
                    return;
            }
            
            logger.info('PhotosList', 'about_to_parse', 'About to parse result', {
                resultType: typeof result,
                resultLength: result ? result.length : 'null',
                hasResult: !!result
            });
            const data = JSON.parse(result);
            logger.info('PhotosList', 'parse_success', 'JSON parse successful', {
                hasPhotos: !!(data && data.photos),
                photoCount: data && data.photos ? data.photos.length : 'no photos key'
            });
            
            // Validate data structure before proceeding
            if (!data || !data.photos || !Array.isArray(data.photos)) {
                logger.error('PhotosList', 'invalid_data_structure', 'Invalid data structure from backend', {
                    hasData: !!data,
                    hasPhotos: !!(data && data.photos),
                    photosType: data && data.photos ? typeof data.photos : 'undefined',
                    isArray: data && data.photos ? Array.isArray(data.photos) : false
                });
                return;
            }
            
            logger.info('PhotosList', 'load_all_parsed', 'Photos loaded and parsed', {
                photoCount: data.photos.length,
                fetchMethod: config?.fetch_method || fetchConfig?.fetch_method || 'unknown',
                hasNext: data.has_next,
                hasPrev: data.has_prev
            });
            
            // Debug: Check if metadata is included
            if (data.photos.length > 0) {
                // console.log(`[LOAD_ALL] Sample photo data:`, data.photos[0]);
                // console.log(`[LOAD_ALL] Available properties:`, Object.keys(data.photos[0]));
                
                // Check different possible metadata locations
                if (data.photos[0].meta) {
                    // console.log(`[LOAD_ALL] Meta object:`, data.photos[0].meta);
                }
                if (data.photos[0].metadata) {
                    // console.log(`[LOAD_ALL] Metadata object:`, data.photos[0].metadata);
                }
            }
            
            // Check if we hit the configuration limit
            const effectiveLimit = config?.max_photos_per_fetch || 1000;
            const isLimited = data.photos.length >= effectiveLimit && (data.has_next || data.photos.length === effectiveLimit);
            setIsLimitedByConfig(isLimited);
            setConfigLimit(effectiveLimit);
            
            // Store all photos unfiltered
            logger.info('PhotosList', 'setting_photos', 'Setting allPhotosForCurrentFetch', {
                photoCount: data.photos.length,
                firstPhotoPath: data.photos[0]?.file?.path || 'no photos'
            });
            setAllPhotosForCurrentFetch(data.photos);
            logger.info('PhotosList', 'photos_set', 'allPhotosForCurrentFetch state updated');
            
            // Don't apply filters here - let the memoized filteredPhotos handle it
            // This ensures consistency between all components
            
            // Hide loading indicator
            setPhotoLoading(false);
            
        } catch (error) {
            console.error("[LOAD_ALL] Failed to load photos:", error);
            console.error("[LOAD_ALL] Config was:", config);
            
            // Reset to safe state
            setAllPhotosForCurrentFetch([]);
            setPhotosListMiniAllPhotos([]);
            setPhotosList({ photos: [], has_next: false, has_prev: false });
            setIsLimitedByConfig(false);
            setConfigLimit(null);
            
            // Hide loading indicator on error
            setPhotoLoading(false);
            
            // Use enhanced error handling
            handleTauriError(error, 'Load photos');
            
            // Fallback footer message
            compatProps.addFooterMessage && compatProps.addFooterMessage(`Failed to load photos: ${error.message || error}`);
        }
    }

    // Initialize search parameters when in search mode (moved after function definitions)
    useEffect(() => {
        if (isSearchMode && searchQuery && !currentSearchParams) {
            setCurrentSearchParams({
                query: searchQuery,
                searchType: "all",
                filters: searchFilters
            });
        }
    }, [isSearchMode, searchQuery, currentSearchParams, searchFilters]);
    
    // Perform initial search when component mounts with searchInitialQuery (moved after function definitions)
    useEffect(() => {
        if (isSearchMode && searchInitialQuery && !currentSearchParams) {
            handleSearch(searchInitialQuery, "all", {});
        }
    }, [isSearchMode, searchInitialQuery, currentSearchParams, handleSearch]);
    
    // Trigger photo loading when search results are available (moved after function definitions)
    useEffect(() => {
        logger.debug('PhotosList', 'search_results_effect', 'Search results effect triggered', {
            isSearchMode,
            searchResultsLength: searchResults.length,
            searchQuery,
            condition: isSearchMode && searchResults.length > 0,
            fetchMethod: fetchConfig?.fetch_method
        });
        
        // Only load search results if we're in search mode AND the fetchConfig is also for search
        // This prevents search results from overriding date-based loading when user switches from search to date
        if (isSearchMode && searchResults.length > 0) {
            logger.info('PhotosList', 'search_results_loading', 'Search results available, loading photos');
            loadAllPhotosBasedOnFetchConfig({
                fetch_method: "search",
                value: searchQuery,
                title: `Search: "${searchQuery}"`
            });
        }
    }, [isSearchMode, searchResults, searchQuery, fetchConfig?.fetch_method]);

    function closePhotoDisplay() {
        setShowSideMenu(false);
        compatProps.setShowPhotoDisplay(false);
        if (props.currentPhotoPath !== "") setCurrentPhotoPath("");
        // console.log("photos-list-close-photod-display -- getPhotos")
        
        // Cancel any existing photo loading before starting new request
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }
        
        const fetchPhotos = async () => getPhotos();
        fetchPhotos().catch(error => handleTauriError(error, 'Refresh photos after closing display'))
    }

    function closeRightColumn() {
        setShowSideMenu(false);
        compatProps.setShowPhotoDisplay(false);
    }

    async function getPhotos(e, isForward) {
        // For paginated display, use memoized filtered data
        if (filteredPhotos.length === 0) {
            setPhotoLoading(false);
            return;
        }
        
        setPhotoLoading(true);
        
        let date = recentPhotosMode ? "recent" : (isSearchMode ? "search_results" : compatProps.currentDate);
        let page = compatProps.datePage[date] || 1;
        
        if (!page || page == "NaN") {
            page = 1;
        }
        page = parseInt(page);
        
        // Calculate page boundaries
        const pageStart = (page - 1) * numOfPhoto;
        const pageEnd = pageStart + parseInt(numOfPhoto);
        
        // Get photos for current page from filtered data
        const pagePhotos = filteredPhotos.slice(pageStart, pageEnd);
        
        if (pagePhotos.length > 0) {
            setPhotosList({
                photos: pagePhotos,
                has_next: pageEnd < filteredPhotos.length,
                has_prev: pageStart > 0
            });
        } else {
            // If no photos on this page, go back one page
            page -= 1;
            compatProps.datePage[date] = page;
        }
        
        compatProps.datePage[date] = page;
        compatProps.setDatePage(compatProps.datePage);
        setPhotoLoading(false);
        // Removed scrollLock for infinite scroll
    };

    // Removed nextPhotosList function - replaced by infinite scroll

    // Album grid rendering functions

    const renderAlbumGrid = () => {
        if (filteredAlbums.length === 0) {
            return <div>No albums found!</div>;
        }

        return (
            <Scrollable className="albums">
                {filteredAlbums.map((album) => (
                    <div 
                        key={album.id}
                        className="album-tile"
                        onClick={() => handleAlbumClick(album)}
                        style={{
                            width: `${iconSize + 50}px`,
                            height: `${iconSize + 80}px`,
                            cursor: 'pointer',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            margin: '10px',
                            padding: '10px',
                            display: 'inline-block',
                            verticalAlign: 'top',
                            backgroundColor: 'var(--bg-elevated)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.boxShadow = 'none';
                        }}
                    >
                        <div className="album-cover" style={{
                            width: `${iconSize}px`,
                            height: `${iconSize}px`,
                            backgroundColor: '#374151',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '10px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            border: '1px solid var(--border)'
                        }}>
                            {album.coverPhoto ? (
                                <img 
                                    src={convertFileSrc(album.coverPhoto)} 
                                    alt={album.name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                            ) : (
                                <div style={{
                                    fontSize: `${iconSize * 0.3}px`,
                                    color: '#999'
                                }}>📚</div>
                            )}
                        </div>
                        <div className="album-info" style={{
                            textAlign: 'center',
                            fontSize: '12px'
                        }}>
                            <div className="album-name" style={{
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                wordWrap: 'break-word'
                            }}>
                                {album.name}
                            </div>
                            <div className="album-count" style={{
                                color: '#666'
                            }}>
                                {album.photoCount} photos
                            </div>
                        </div>
                    </div>
                ))}
            </Scrollable>
        );
    };

    const renderAlbumSearchFilter = () => (
        <div style={{ 
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '4px',
            border: '1px solid var(--border)'
        }}>
            <input 
                type="text"
                placeholder="Search albums..." 
                value={albumSearchTerm}
                onChange={(e) => setAlbumSearchTerm(e.target.value)}
                className="album-list-search-input"
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: '#374151',
                    color: 'var(--text)'
                }}
            />
        </div>
    );

    // Removed photosScroll function - replaced by handleInfiniteScroll

    return (
        <ErrorBoundary name="PhotosList" level="component">
            <>
        {photoLoading ?
            <div className="photoLoadingOnParent" style={{ display: photoLoading ? "block" : "none" }}>
                <PhotoLoading />
            </div>
            :
            <>
                <div id="photos-display-wrapper" style={{ display: (!photoLoading && compatProps.showPhotoDisplay && currentPhotoPath) ? "block" : "none" }}>
                    <AllPhotosContext.Provider value={{ photosListMiniAllPhotos, setPhotosListMiniAllPhotos }}>
                        <ImgCacheContext.Provider value={{ imgCacheMap, setImgCacheMap }}>
                            <div className="photo-display">
                                <PhotosListMini
                                    moveToTrashCan={moveToTrashCan}
                                    closePhotoDisplay={closePhotoDisplay}
                                    toggleSelection={toggleSelection}
                                    isSelected={isSelected}

                                    setShortCutNavigation={props.setShortCutNavigation}
                                    setShowPhotoDisplay={compatProps.setShowPhotoDisplay}
                                    shortCutNavigation={props.shortCutNavigation}
                                    getPhotos={getPhotos}
                                    currentPhotoPath={currentPhotoPath}
                                    setCurrentPhotoPath={setCurrentPhotoPath}
                                    sortOfPhotos={sortOfPhotos}
                                    currentDate={compatProps.currentDate}
                                    datePage={compatProps.datePage}
                                    num={numOfPhoto}
                                    currentPhotoIndex={currentPhotoIndex}
                                    setCurrentPhotoIndex={setCurrentPhotoIndex}
                                    setStar={setStarWithUpdate}
                                    hasCommentFilter={hasCommentFilter}
                                    starFilter={starFilter}
                                    extensionFilter={extensionFilter}
                                    hasNext={photos.has_next}

                                    reread={photosListMiniReread}
                                    currentIndex={photosListMiniCurrentIndex}
                                    setCurrentIndex={setPhotosListMiniCurrentIndex}
                                    setShowSideMenu={setShowSideMenu}
                                    showSideMenu={showSideMenu}
                                    centerDisplayClass={showSideMenu ? "centerDisplay" : "centerDisplayMax"}
                                    
                                    // Search mode props
                                    searchMode={isSearchMode}
                                    searchQuery={searchQuery}
                                    onClearSearch={clearSearch}
                                    recentPhotosMode={recentPhotosMode}
                                    
                                    // Album mode props
                                    albumId={currentAlbumId}
                                    albumName={currentAlbumName}
                                    removePhotoFromList={removePhotoFromList}
                                    addFooterMessage={compatProps.addFooterMessage}
                                    handleTauriError={handleTauriError}
                                />
                            </div>
                        </ImgCacheContext.Provider>
                    </AllPhotosContext.Provider>
                </div>
                <div className={(props.showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"} id="photoList"
                    style={{ display: (!photoLoading && (!compatProps.showPhotoDisplay || !currentPhotoPath)) ? "block" : "none" }}
                    data-date={recentPhotosMode ? "recent" : (isSearchMode ? "search_results" : (isAlbumListMode ? "albums" : (isAlbumMode ? `album_${currentAlbumId}` : compatProps.currentDate)))} 
                    data-page={recentPhotosMode ? (compatProps.datePage["recent"] || 1) : (isSearchMode ? (compatProps.datePage["search_results"] || 1) : 1)}>
                    <div>
                        {/* Album List Mode */}
                        {isAlbumListMode && (
                            <>
                                <div className="photo-list-header">
                                    <div className="photo-page-info">
                                        <span>Albums ({filteredAlbums.length} albums)</span>
                                    </div>
                                    <div className="photo-operation">
                                        Icon:<select name="icon_size" value={iconSize} onChange={(e) => setIconSize(parseInt(e.target.value))}>
                                            <option value={50}>small</option>
                                            <option value={100}>normal</option>
                                            <option value={200}>large</option>
                                            <option value={300}>huge</option>
                                        </select>
                                    </div>
                                </div>
                                {renderAlbumSearchFilter()}
                                {renderAlbumGrid()}
                            </>
                        )}
                        
                        {/* Regular Photo Display Mode */}
                        {!isAlbumListMode && (
                            <>
                        {displayedPhotos.length == 0 && isSearchMode && <div style={{float: "left", marginBottom: "10px"}}><a className="back-to-home" onClick={(e) => { e.preventDefault(); clearSearch(); }} href="#">Back to HOME</a></div>}
                        {displayedPhotos.length > 0 ?
                            <div className="photo-list-header">
                                <div className="photo-page-info">
                                    {isSearchMode ? (
                                        <><a className="back-to-home" href="#" onClick={(e)=>{ e.preventDefault(); clearSearch(); }}>Back to HOME</a> <span style={{marginLeft: "10px"}}>{fetchConfig?.title || 'Search Results'} ({filteredPhotos.length} photos)</span></>
                                    ) : (
                                        <span>{fetchConfig?.title || 'Photos'} ({filteredPhotos.length} photos)</span>
                                    )}
                                    {infiniteScrollEnabled && displayedPhotoCount < filteredPhotos.length && (
                                        <span style={{marginLeft: "10px", fontSize: "12px", color: "#666"}}> - Showing: {displayedPhotoCount} photos</span>
                                    )}
                                    {isLimitedByConfig && (
                                        <span style={{marginLeft: "10px", fontSize: "11px", color: "#f60", fontWeight: "bold"}}> (Limited by config)</span>
                                    )}
                                </div>
                                {/* Removed navigation - replaced by infinite scroll */}
                                <div className="photo-operation">
                                    Icon:<select name="icon_size" value={iconSize} onChange={(e) => setIconSize(parseInt(e.target.value))}>
                                        <option value={50}>small</option>
                                        <option value={100}>normal</option>
                                        <option value={200}>large</option>
                                        <option value={300}>huge</option>
                                    </select>
                                    Sort:<select name="sort" value={sortOfPhotos} onChange={(e) => setSort(parseInt(e.target.value))}>
                                        <option value={0}>Shot Time (desc)</option>
                                        <option value={1}>Shot Time (asc)</option>
                                        <option value={2}>Added Time (desc)</option>
                                        <option value={3}>Added Time (asc)</option>
                                        <option value={4}>Star Rating (desc)</option>
                                        <option value={5}>Star Rating (asc)</option>
                                        <option value={6}>File Name (desc)</option>
                                        <option value={7}>File Name (asc)</option>
                                    </select>
                                    {/* Num selector removed - not needed with infinite scroll */}
                                </div>
                            </div>
                            : <>{isSearchMode ? (isSearching ? <PhotoLoading /> : "No Search Result") : "No Photo Found!"}</>
                        }
                        <Scrollable f={handleInfiniteScroll} className="photos">
                            {/* Removed scroll indicators for infinite scroll */}
                            {displayedPhotos.map((l, i) => {
                                const image_for_not_found = "/img_error.png";
                                let thumbnailSrc = "";
                                if (l.has_thumbnail) {
                                    // Extract UUID from the full file path
                                    // Path format: /path/to/target/2025-07-01/[UUID]/image.jpg
                                    const pathParts = l.file.path.split('/');
                                    let uuid = null;
                                    
                                    // Find the date directory and the UUID directory after it
                                    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
                                    for (let j = 0; j < pathParts.length - 1; j++) {
                                        if (datePattern.test(pathParts[j]) && pathParts[j + 2] !== undefined) {
                                            uuid = pathParts[j + 1];
                                            break;
                                        }
                                    }
                                    
                                    // Always extract date from photo path for thumbnail generation
                                    let photoDate = null;
                                    // Extract date from the photo's path
                                    for (let j = 0; j < pathParts.length; j++) {
                                        if (datePattern.test(pathParts[j])) {
                                            photoDate = pathParts[j];
                                            break;
                                        }
                                    }
                                    
                                    if (uuid && photoDate) {
                                        // Build thumbnail path with UUID directory
                                        if (l.file.name.match(/(mp4|webm)$/i)) {
                                            thumbnailSrc = thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + uuid + '/' + l.file.name + ".jpg";
                                        } else {
                                            thumbnailSrc = (thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + uuid + '/' + l.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                                        }
                                    } else if (photoDate) {
                                        // Fallback to old behavior if UUID cannot be extracted
                                        if (l.file.name.match(/(mp4|webm)$/i)) {
                                            thumbnailSrc = thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + l.file.name + ".jpg";
                                        } else {
                                            thumbnailSrc = (thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + l.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                                        }
                                    }
                                    photosListImgSrc[l.file.path] = convertFileSrc(thumbnailSrc);
                                } else {
                                    photosListImgSrc[l.file.path] = convertFileSrc(l.file.path);
                                }
                                return (
                                    <>
                                        <div key={i} className={"row pict-" + iconSize} style={{ flex: "0 0 " + ((iconSize / 1) + 41) + "px", textAlign: "center", verticalAlign: "middle", position: "relative" }} >
                                            <div style={{ flexShrink: 0 }}>
                                                <a href="#" onClick={() => {
                                                    displayPhoto(l.file.path, i)
                                                }}>
                                                    {!l.has_thumbnail && l.file.path.match(/\.(mp4|webm)$/i)
                                                        ? <div className="photo-list-movie" style={{ minWidth: (iconSize - 20) + 'px', marginTop: (iconSize / 7) + "px" }}>
                                                            <span style={{ fontSize: (iconSize / 3) + 'px' }}>&#127909;</span>
                                                        </div>
                                                        : <div style={{ width: iconSize + 'px', height: iconSize + 'px', flexShrink: 0 }} >
                                                        <img loading="eager"
                                                            alt={l.file.path}
                                                            style={{ 
                                                                width: "97%",
                                                                ...parseCssStyle(l.css_style)
                                                            }}
                                                            src={photosListImgSrc[l.file.path]}
                                                            onLoad={(e) => {
                                                                let w = e.currentTarget.width;
                                                                let h = e.currentTarget.height;
                                                                if (w > h) {
                                                                    e.currentTarget.style.width = "97%";
                                                                    e.currentTarget.style.height = "auto";
                                                                } else {
                                                                    e.currentTarget.style.height = "97%";
                                                                    e.currentTarget.style.width = "auto";
                                                                }
                                                            }}
                                                            onError={(e) => {
                                                                /*
                                                                // To debug image load error on Windows
                                                                let url = e.currentTarget.src;
                                                                    fetch(url)
                                                                    .then(res => {
                                                                        setDebugMessage(l.file.path + ","+ url + ", " + res.statusText);
                                                                    })
                                                                    .catch(err => {
                                                                        setDebugMessage( url + ", Image load failed: ", l.file.path);
                                                                    });
                                                                */
                                                                if (e.currentTarget.src != image_for_not_found) {
                                                                    photosListImgSrc[l.file.path] = image_for_not_found;
                                                                    e.currentTarget.src = photosListImgSrc[l.file.path];
                                                                }
                                                            }}
                                                        />
                                                            {l.file.path.match(/\.(mp4|webm)$/i) && <div style={{ color: "white", position: "relative", top: iconSize / -3, fontSize: (iconSize / 6) + 'px' }}>&#x25b6;</div>}
                                                        </div>
                                                    }
                                                </a>
                                                
                                                {/* Metadata overlay - stars and comments */}
                                                {(l.star > 0 || l.comment) && (
                                                    <div style={{
                                                        position: "absolute",
                                                        bottom: "25px",
                                                        right: "42px",
                                                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                                                        color: "white",
                                                        padding: "1px 3px",
                                                        borderRadius: "3px",
                                                        fontSize: "10px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "2px"
                                                    }}>
                                                        {l.star > 0 && (
                                                            <span>⭐{l.star}</span>
                                                        )}
                                                        {l.comment && (
                                                            <span>💬</span>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Tags overlay */}
                                                {photoTags[l.file.path] && photoTags[l.file.path].length > 0 && (
                                                    <div style={{
                                                        position: "absolute",
                                                        bottom: "4px",
                                                        left: "4px",
                                                        right: "4px",
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: "2px",
                                                        maxHeight: "40px",
                                                        overflow: "hidden"
                                                    }}>
                                                        {photoTags[l.file.path].slice(0, 3).map(tag => (
                                                            <TagChip
                                                                key={tag.id}
                                                                tag={tag}
                                                                style={{
                                                                    fontSize: "8px",
                                                                    padding: "1px 4px",
                                                                    maxWidth: "60px"
                                                                }}
                                                            />
                                                        ))}
                                                        {photoTags[l.file.path].length > 3 && (
                                                            <span style={{
                                                                fontSize: "8px",
                                                                backgroundColor: "rgba(0, 0, 0, 0.5)",
                                                                color: "white",
                                                                padding: "1px 4px",
                                                                borderRadius: "8px"
                                                            }}>
                                                                +{photoTags[l.file.path].length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="photo-list-menu">
                                                <input type="checkbox"
                                                    id={"photo-checkbox-" + i}
                                                    checked={photoSelectionDict[l.file.path] ? "checked" : ""}
                                                    onChange={(e) => addSelection(e.target.checked, l.file.path)}
                                                />
                                                <label className={"checkbox-photo checkbox hover"} htmlFor={"photo-checkbox-" + i}></label>
                                                <a href="#" onClick={() => {
                                                    displayPhoto(l.file.path, i)
                                                    setShowSideMenu(true);
                                                }
                                                } >(&#8505;)</a>
                                                <a href="#" className="run-app" onClick={(e) => openUrl(fileUrl(l.file.path))}>&#128640;</a>
                                            </div>
                                        </div>
                                        {/* Removed scroll indicator for infinite scroll */}
                                    </>
                                )
                            })}
                            {/* Infinite scroll footer */}
                            {infiniteScrollEnabled && displayedPhotoCount < filteredPhotos.length && (
                                <div className="infinite-scroll-trigger" 
                                     style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gridColumn: '1 / -1' }}>
                                    {isLoadingMore ? (
                                        <div className="loading-spinner">Loading...</div>
                                    ) : (
                                        <div>Scroll to load more</div>
                                    )}
                                </div>
                            )}
                            
                            {/* Completion indicator */}
                            {displayedPhotoCount >= filteredPhotos.length && filteredPhotos.length > 0 && (
                                <div className="infinite-scroll-complete"
                                     style={{ textAlign: 'center', padding: '20px', width: '100%', gridColumn: '1 / -1', color: '#666' }}>
                                    {isLimitedByConfig ? (
                                        <div>
                                            <div>Showing {filteredPhotos.length} photos (limited by configuration)</div>
                                            <div style={{ fontSize: '12px', marginTop: '5px', color: '#999' }}>
                                                Display limit: {configLimit} photos. There may be more photos available.
                                            </div>
                                        </div>
                                    ) : (
                                        <div>All photos displayed ({filteredPhotos.length} photos)</div>
                                    )}
                                </div>
                            )}
                        </Scrollable>
                        <div className="debug" style={{ display: (debugMessage == "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                            {debugMessage}
                        </div>
                            </>
                        )}
                    </div>
                </div>
            </>
        }
        {/* Tabs positioned independently - only show when NOT in photo display mode */}
        {(!compatProps.showPhotoDisplay || !currentPhotoPath) && (
            <div className={`directory-vertical-tabs ${showSideMenu ? 'menu-open' : 'menu-closed'}`}>
            {isSearchMode && (
                <button 
                    className={tabClass['search'] ? "directory-vertical-tab-button active" : "directory-vertical-tab-button"}
                    onClick={(e) => {
                        changeTab(e, "#tab-search");
                        setShowSideMenu(true);
                    }}
                    title="Search Tools"
                >
                    <span className="directory-vertical-text">Search</span>
                </button>
            )}
            <button 
                className={tabClass['filter'] ? "directory-vertical-tab-button active" : "directory-vertical-tab-button"}
                onClick={(e) => {
                    changeTab(e, "#tab-filter");
                    setShowSideMenu(true);
                }}
                title="Filter Photos"
            >
                <span className="directory-vertical-text">Filter</span>
            </button>
            <button 
                className={tabClass['selection'] ? "directory-vertical-tab-button active" : "directory-vertical-tab-button"}
                onClick={(e) => {
                    changeTab(e, "#tab-selection");
                    setShowSideMenu(true);
                }}
                title="Photo Selection"
            >
                <span className="directory-vertical-text">Selection</span>
            </button>
            {!isSearchMode && (
                <button 
                    className={tabClass['maintenance'] ? "directory-vertical-tab-button active" : "directory-vertical-tab-button"}
                    onClick={(e) => {
                        changeTab(e, "#tab-maintenance");
                        setShowSideMenu(true);
                    }}
                    title="Maintenance Tools"
                >
                    <span className="directory-vertical-text">Maintenance</span>
                </button>
            )}
            {showSideMenu && (
                <button 
                    className="directory-vertical-tab-button directory-close-tab"
                    onClick={closeRightColumn}
                    title="Close Panel"
                >
                    ×
                </button>
            )}
        </div>
        )}

        {/* PhotoOption tabs - always visible in photo display mode */}
        {(compatProps.showPhotoDisplay && currentPhotoPath) && (
            <PhotoOption
                setShowSideMenu={setShowSideMenu}
                showSideMenu={showSideMenu}
                currentPhotoPath={currentPhotoPath}
                closePhotoDisplay={closePhotoDisplay}
                path={currentPhotoPath}
                
                // Search mode props
                searchMode={isSearchMode}
                searchQuery={searchQuery}
                searchResultsCount={displayedPhotos.length}
                onClearSearch={clearSearch}
                searchTools={props.searchTools}
                addFooterMessage={compatProps.addFooterMessage}
                imgCacheMap={imgCacheMap}
                setStar={setStarWithUpdate}
                star={star}
                onPhotosRefresh={getPhotos}
                onCommentUpdate={updatePhotoComment}
                onAlbumUpdate={handleAlbumUpdate}
                onAlbumDelete={handleAlbumDelete}
            />
        )}

        {showSideMenu && (
            <div className="rightMenu">
                <div style={{ display: (!compatProps.showPhotoDisplay || !currentPhotoPath) ? "block" : "none" }}>
                    <DirectoryMenu
                        addFooterMessage={compatProps.addFooterMessage}
                        tabClass={tabClass}
                        setTabClass={setTabClass}
                        changeTab={changeTab}
                        currentDate={compatProps.currentDate}
                        closeRightColumn={closeRightColumn}
                        photoSelection={photoSelection}
                        clearPhotoSelection={clearPhotoSelection}
                        selectAllPhotoToSelection={selectAllPhotoToSelection}
                        dateNum={compatProps.dateNum}
                        setCurrentDateNum={compatProps.setCurrentDateNum}
                        moveToTrashCan={moveToTrashCan}
                        setStarFilter={setStarFilter}
                        setHasCommentFilter={setHasCommentFilter}
                        starFilter={starFilter}
                        setExtensionFilter={setExtensionFilter}
                        extensionFilter={extensionFilter}
                        setShowSideMenu={setShowSideMenu}
                        
                        // Job Queue integration
                        setShowJobQueue={(show) => props.setShowJobQueueModal(show)}
                        
                        // Search mode props
                        searchMode={isSearchMode}
                        searchTools={isSearchMode ? (
                            <SearchTools
                                onSearch={handleSearch}
                                onClear={handleSearchClear}
                                searchResults={searchResults}
                                initialQuery={searchQuery}
                                onFiltersChange={handleFiltersChange}
                                initialFilters={searchFilters}
                                onSearchSelect={handleSavedSearchSelect}
                                currentSearch={currentSearchParams}
                                filterOptions={filterOptions}
                                onLoadFilterOptions={loadFilterOptions}
                                isFilterOptionsLoading={isFilterOptionsLoading}
                                isAdvancedSearchMode={isAdvancedSearchMode}
                            />
                        ) : null}
                    />
                </div>
            </div>
        )}
            </>
        </ErrorBoundary>
    );
}

export default PhotosList;
