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
import SearchTools from "../components/SearchTools.jsx";
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
        recentPhotosMode
    } = usePhoto();
    
    logger.debug('PhotosList', 'component_render', 'PhotosList rendering', {
        recentPhotosMode,
        currentDate,
        propsCount: Object.keys(props).length
    });
    const { addFooterMessage, toggleSearchPage, searchInitialQuery } = useUI();
    
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
    
    // Check if we're in search mode
    const isSearchMode = props.searchMode || false;
    const isAdvancedSearchMode = props.isAdvancedSearchMode || false;
    
    // fetchConfig from props or generate from currentDate
    // For Advanced Search mode, don't set initial fetchConfig to prevent auto-loading
    const fetchConfig = props.fetchConfig || 
        (isAdvancedSearchMode ? null : {
            fetch_method: recentPhotosMode ? "recent" : (isSearchMode ? "search" : "date"),
            value: recentPhotosMode ? "recent" : (isSearchMode ? searchQuery : currentDate),
            title: recentPhotosMode ? "Recent Photos (60 most recent)" : (isSearchMode ? `Search: "${searchQuery}"` : currentDate),
            max_photos_per_fetch: recentPhotosMode ? 60 : undefined
        });

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
    const [showSideMenu, setShowSideMenu] = useState(isSearchMode);
    
    // Infinite scroll state
    const [infiniteScrollEnabled, setInfiniteScrollEnabled] = useState(true);
    const [displayedPhotoCount, setDisplayedPhotoCount] = useState(50);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // Store all photos for current fetch config (unfiltered)
    const [allPhotosForCurrentFetch, setAllPhotosForCurrentFetch] = useState([]);
    
    // Store configuration for photo fetch limits
    const [config, setConfig] = useState(null);
    const [star, setStar] = useState([false, false, false, false, false]);
    const [starFilter, setStarFilter] = useState(0);
    const [hasCommentFilter, setHasCommentFilter] = useState(false);
    const [extensionFilter, setExtensionFilter] = useState("all");
    const [debugMessage, setDebugMessage] = useState("");
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);
    
    // Filter options caching state
    const [filterOptions, setFilterOptions] = useState(null);
    const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false);
    
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
            return null;
        } finally {
            setIsFilterOptionsLoading(false);
        }
    }, [filterOptions, isFilterOptionsLoading]);
    
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
    // State declarations moved to top of component
    
    // All state declarations moved to top of component
    
    // Frontend filtering function
    const applyFrontendFilters = useCallback((photos) => {
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
    }, [starFilter, hasCommentFilter, extensionFilter]);
    
    // Memoize filtered photos to avoid recalculating on every render
    const filteredPhotos = useMemo(() => {
        return applyFrontendFilters(allPhotosForCurrentFetch);
    }, [allPhotosForCurrentFetch, applyFrontendFilters]);
    
    // Displayed photos for infinite scroll
    const displayedPhotos = useMemo(() => {
        if (infiniteScrollEnabled) {
            return filteredPhotos.slice(0, displayedPhotoCount);
        }
        return filteredPhotos; // Infinite scroll disabled shows all
    }, [filteredPhotos, displayedPhotoCount, infiniteScrollEnabled]);

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
        
    }, [fetchConfig?.fetch_method, fetchConfig?.value, recentPhotosMode]);

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
            
            // Update photos list for backward compatibility
            const displayPhotos = infiniteScrollEnabled ? displayedPhotos : filteredPhotos;
            setPhotosList({ photos: displayPhotos, has_next: false, has_prev: false });
        }
    }, [filteredPhotos, infiniteScrollEnabled, displayedPhotos])

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

                // exists photo before the deleted photo
                if (date_with_slash === compatProps.currentDate) {
                    const allPhotos = photosListMiniAllPhotos
                    if (allPhotos.length > 0) {
                        allPhotos.splice(currentPhotoIndex, 1);
                        setPhotosListMiniAllPhotos(allPhotos);
                        // no photos are remaining after the deleted photo
                        // last photo
                        if (currentPhotoIndex >= allPhotos.length) {
                            const ci = currentPhotoIndex - 1;
                            // console.log("last photo!")
                            if (photosListMiniAllPhotos[ci]) {
                                setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                                setCurrentPhotoPath(photosListMiniAllPhotos[ci].file.path);
                                setCurrentPhotoIndex(ci);
                            }
                        }
                        // not last photo
                        else {
                            const ci = currentPhotoIndex;
                            // console.log("Not last photo!")
                            setPhotosListMiniReread(!photosListMiniReread);
                            setCurrentPhotoPath(photosListMiniAllPhotos[ci].file.path);
                        }
                    }
                    if (allPhotos.length == 0) {
                        closePhotoDisplay();
                    }
                }
            }
        });
    }

    async function loadAllPhotosBasedOnFetchConfig(config) {
        logger.info('PhotosList', 'load_photos_config', 'loadAllPhotosBasedOnFetchConfig called', {
            config,
            hasConfig: !!config
        });
        if (!config) return;
        
        // Some fetch methods don't require a value (e.g., favorites, search with filters only, recent)
        if (config.fetch_method !== "favorites" && config.fetch_method !== "search" && config.fetch_method !== "recent" && !config.value) return;
        
        logger.info('PhotosList', 'load_all_start', 'Loading all photos', { 
            config, 
            isSearchMode, 
            searchResultsLength: searchResults.length,
            fetchMethod: config?.fetch_method
        });
        
        // Show loading indicator
        setPhotoLoading(true);
        
        try {
            let result;
            
            logger.debug('PhotosList', 'load_all_switch', 'About to switch on fetch_method', { 
                fetch_method: config.fetch_method 
            });
            switch (config.fetch_method) {
                case "date":
                    // Note: We need to pass filter values that won't exclude any photos
                    // but will still cause the backend to include metadata
                    result = await invoke("get_photos_with_filter", {
                        dateStr: config.value,
                        sortValue: parseInt(sortOfPhotos),
                        page: 1,
                        num: Math.min(9999, config?.max_photos_per_fetch || 1000), // Limit based on config for performance
                        offset: 0,
                        star: -1, // -1 means no star filter but include star data
                        hasComment: false,
                        extension: "all"
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
                            dateStr: config.value || compatProps.currentDate,
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
                        dateStr: config.value || compatProps.currentDate,
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
                    result = await invoke("get_recent_photos", recentParams);
                    break;
                    
                default:
                    logger.error('PhotosList', 'load_all_unknown', 'Unknown fetch method', {
                        fetchMethod: config.fetch_method
                    });
                    return;
            }
            
            const data = JSON.parse(result);
            logger.info('PhotosList', 'load_all_parsed', 'Photos loaded and parsed', {
                photoCount: data.photos.length,
                fetchMethod: config.fetch_method,
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
            
            // Store all photos unfiltered
            setAllPhotosForCurrentFetch(data.photos);
            
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
            
            // Hide loading indicator on error
            setPhotoLoading(false);
            
            // Show user-friendly error message
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
            condition: isSearchMode && searchResults.length > 0
        });
        
        if (isSearchMode && searchResults.length > 0) {
            logger.info('PhotosList', 'search_results_loading', 'Search results available, loading photos');
            loadAllPhotosBasedOnFetchConfig({
                fetch_method: "search",
                value: searchQuery,
                title: `Search: "${searchQuery}"`
            });
        }
    }, [isSearchMode, searchResults, searchQuery]);

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
        fetchPhotos().catch(console.error)
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
        
        let date = isSearchMode ? "search_results" : compatProps.currentDate;
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

    // Removed photosScroll function - replaced by handleInfiniteScroll

    return <>
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
                                    
                                    // Search mode props
                                    searchMode={isSearchMode}
                                    searchQuery={searchQuery}
                                    onClearSearch={clearSearch}
                                />
                            </div>
                        </ImgCacheContext.Provider>
                    </AllPhotosContext.Provider>
                </div>
                <div className={(props.showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"} id="photoList"
                    style={{ display: (!photoLoading && (!compatProps.showPhotoDisplay || !currentPhotoPath)) ? "block" : "none" }}
                    data-date={isSearchMode ? "search_results" : compatProps.currentDate} 
                    data-page={isSearchMode ? (compatProps.datePage["search_results"] || 1) : (compatProps.datePage[compatProps.currentDate] || 1)}>
                    <div>
                        {displayedPhotos.length == 0 && isSearchMode && <div style={{float: "left", marginBottom: "10px"}}><a className="back-to-home" onClick={(e) => { e.preventDefault(); clearSearch(); }} href="#">Back to HOME</a></div>}
                        {displayedPhotos.length > 0 ?
                            <div className="photo-list-header">
                                <div className="photo-page-info">
                                    {isSearchMode ? (
                                        <><a className="back-to-home" href="#" onClick={(e)=>{ e.preventDefault(); clearSearch(); }}>Back to HOME</a> <span style={{marginLeft: "10px"}}>{fetchConfig?.title || 'Search Results'} ({filteredPhotos.length}枚)</span></>
                                    ) : (
                                        <span>{fetchConfig?.title || 'Photos'} ({filteredPhotos.length}枚)</span>
                                    )}
                                    {infiniteScrollEnabled && displayedPhotoCount < filteredPhotos.length && (
                                        <span style={{marginLeft: "10px", fontSize: "12px", color: "#666"}}> - 表示中: {displayedPhotoCount}枚</span>
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
                                    Num:<select name="num" defaultValue={numOfPhoto} onChange={(e) => setNumOfPhoto(e.target.value)}>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={30}>30</option>
                                        <option value={40}>40</option>
                                        <option value={50}>50</option>
                                        <option value={60}>60</option>
                                    </select>
                                    Ext:<select name="extension_filter" value={extensionFilter} onChange={(e) => setExtensionFilter(e.target.value)}>
                                        <option value="all">all</option>
                                        <option value="jpeg">jpeg</option>
                                        <option value="jpg">jpg</option>
                                        <option value="mp4">mp4</option>
                                        <option value="gif">gif</option>
                                        <option value="png">png</option>
                                        <option value="webm">webm</option>
                                        <option value="bmp">bmp</option>
                                        <option value="tiff">tiff</option>
                                    </select>
                                </div>
                            </div>
                            : <>{isSearchMode ? "No Search Result" : "No Photo Found!"}</>
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
                                    
                                    // Extract date from photo path for thumbnail generation
                                    let photoDate = compatProps.currentDate;
                                    if (isSearchMode || !photoDate) {
                                        // Extract date from the photo's path
                                        for (let j = 0; j < pathParts.length; j++) {
                                            if (datePattern.test(pathParts[j])) {
                                                photoDate = pathParts[j];
                                                break;
                                            }
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
                                        <div className="loading-spinner">読み込み中...</div>
                                    ) : (
                                        <div>スクロールして続きを読み込み</div>
                                    )}
                                </div>
                            )}
                            
                            {/* Completion indicator */}
                            {displayedPhotoCount >= filteredPhotos.length && filteredPhotos.length > 0 && (
                                <div className="infinite-scroll-complete"
                                     style={{ textAlign: 'center', padding: '20px', width: '100%', gridColumn: '1 / -1', color: '#666' }}>
                                    全ての写真を表示しました ({filteredPhotos.length}枚)
                                </div>
                            )}
                        </Scrollable>
                    </div>
                    <div className="debug" style={{ display: (debugMessage == "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                        {debugMessage}
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
}

export default PhotosList;
