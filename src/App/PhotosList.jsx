import { useState, useEffect, useMemo, useCallback } from "react";
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
import BaseThumbnailGrid from "../components/BaseThumbnailGrid.jsx";
import { PhotoDataAdapter } from "../utils/PhotoDataAdapter.js";

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
        setCurrentDateNum
    } = usePhoto();
    const { addFooterMessage } = useUI();
    
    // Check if we're in search mode
    const isSearchMode = props.searchMode || false;
    const searchResults = props.searchResults || [];
    const searchQuery = props.searchQuery || "";
    
    // fetchConfig from props or generate from currentDate
    const fetchConfig = props.fetchConfig || {
        fetch_method: isSearchMode ? "search" : "date",
        value: isSearchMode ? searchQuery : currentDate,
        title: isSearchMode ? `Search: "${searchQuery}"` : currentDate
    };
    
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
    const [scrollLock, setScrollLock] = useState(false);
    const [sortOfPhotos, setSort] = useState(0);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoSelection, setPhotoSelection] = useState([]);
    const [photoSelectionDict, setPhotoSelectionDict] = useState({});
    const [thumbnailStore, setThumbnailStore] = useState("");
    const [photosListMiniAllPhotos, setPhotosListMiniAllPhotos] = useState([]);
    const [photosListMiniCurrentIndex, setPhotosListMiniCurrentIndex] = useState(0);
    const [photosListMiniReread, setPhotosListMiniReread] = useState(false);
    const [photosListImgSrc, setPhotosListImgSrc] = useState({});
    const [imgCacheMap, setImgCacheMap] = useState({});
    const [showSideMenu, setShowSideMenu] = useState(false);
    const [star, setStar] = useState([false, false, false, false, false]);
    const [starFilter, setStarFilter] = useState(0);
    
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
    const [hasCommentFilter, setHasCommentFilter] = useState(false);
    const [extensionFilter, setExtensionFilter] = useState("all");
    const [debugMessage, setDebugMessage] = useState("");
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);
    
    // Store all photos for current fetch config (unfiltered)
    const [allPhotosForCurrentFetch, setAllPhotosForCurrentFetch] = useState([]);
    
    // Store configuration for photo fetch limits
    const [config, setConfig] = useState(null);
    
    // Frontend filtering function
    const applyFrontendFilters = useCallback((photos) => {
        console.log(`[FILTER] Applying filters - star: ${starFilter}, hasComment: ${hasCommentFilter}, extension: ${extensionFilter}`);
        console.log(`[FILTER] Input photos count: ${photos.length}`);
        
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
        
        console.log(`[FILTER] Filtered photos count: ${filtered.length}`);
        return filtered;
    }, [starFilter, hasCommentFilter, extensionFilter]);
    
    // Memoize filtered photos to avoid recalculating on every render
    const filteredPhotos = useMemo(() => {
        return applyFrontendFilters(allPhotosForCurrentFetch);
    }, [allPhotosForCurrentFetch, applyFrontendFilters]);

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
        document.documentElement.style.setProperty('--photo-grid-size', `${iconSize + 41}px`);
        
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
        console.log(`[FETCH_CONFIG_CHANGE] New fetchConfig:`, fetchConfig);
        
        // Skip if already loading to prevent race conditions
        if (photoLoading) {
            console.log(`[FETCH_CONFIG_CHANGE] Already loading, skipping`);
            return;
        }
        
        setShowSideMenu(false);
        
        // Cancel current photo loading if in progress
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
            setCurrentPhotoLoadingController(null);
        }
        
        // Reset state
        photos.photos = [];
        setPhotosList({ "photos": [] });
        setCurrentPhotoIndex(0);
        setPhotosListMiniCurrentIndex(0);
        setCurrentPhotoPath(undefined);
        
        // Load all photos based on fetch config
        loadAllPhotosBasedOnFetchConfig(fetchConfig);
        
    }, [fetchConfig.fetch_method, fetchConfig.value]);

    // Apply filters when filter settings change (no API call, just frontend filtering)
    useEffect(() => {
        if (filteredPhotos.length > 0 || allPhotosForCurrentFetch.length > 0) {
            console.log(`[FILTER_CHANGE] Applying frontend filters: ${filteredPhotos.length} photos after filtering`);
            setPhotosListMiniAllPhotos(filteredPhotos);
            
            // Also update current page view
            const pageStart = (compatProps.datePage[compatProps.currentDate] - 1) * numOfPhoto || 0;
            const pageEnd = pageStart + numOfPhoto;
            const pagePhotos = filteredPhotos.slice(pageStart, pageEnd);
            setPhotosList({ photos: pagePhotos, has_next: pageEnd < filteredPhotos.length, has_prev: pageStart > 0 });
        }
    }, [filteredPhotos, numOfPhoto, compatProps.datePage, compatProps.currentDate])

    function displayPhoto(f, i) {
        setCurrentPhotoPath(f);
        setCurrentPhotoIndex(i);
        
        // Find the global index in the all photos array
        const globalIndex = photosListMiniAllPhotos.findIndex(photo => photo.file.path === f);
        if (globalIndex !== -1) {
            console.log(`[DISPLAY_PHOTO] Found photo at global index: ${globalIndex} (total photos: ${photosListMiniAllPhotos.length})`);
            setPhotosListMiniCurrentIndex(globalIndex);
        } else {
            console.log(`[DISPLAY_PHOTO] Photo not found in all photos array, using page-relative index: ${i}`);
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
        photos.photos.map((v) => {
            const f = v.file.path;
            if (!photoSelectionDict[f]) {
                selection.push(f);
                photoSelectionDict[f] = true;
            }
        })
        setPhotoSelectionDict(photoSelectionDict);
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
        console.log("delete file: " + f)
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
                            console.log("last photo!")
                            if (photosListMiniAllPhotos[ci]) {
                                setPhotosListMiniCurrentIndex(photosListMiniCurrentIndex - 1);
                                setCurrentPhotoPath(photosListMiniAllPhotos[ci].file.path);
                                setCurrentPhotoIndex(ci);
                            }
                        }
                        // not last photo
                        else {
                            const ci = currentPhotoIndex;
                            console.log("Not last photo!")
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
        if (!config) return;
        
        // Some fetch methods don't require a value (e.g., favorites)
        if (config.fetch_method !== "favorites" && !config.value) return;
        
        console.log(`[LOAD_ALL] Loading all photos with config:`, config);
        
        // Show loading indicator
        setPhotoLoading(true);
        
        try {
            let result;
            
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
                    // Use search results passed from props if available
                    if (isSearchMode && searchResults.length > 0) {
                        console.log("[LOAD_ALL] Using search results from props");
                        result = JSON.stringify({ photos: searchResults });
                    } else {
                        // Fall back to date-based search for now
                        console.warn("[LOAD_ALL] No search results provided, falling back to date-based");
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
                    
                default:
                    console.error("[LOAD_ALL] Unknown fetch method:", config.fetch_method);
                    return;
            }
            
            const data = JSON.parse(result);
            console.log(`[LOAD_ALL] Loaded ${data.photos.length} photos`);
            
            // Debug: Check if metadata is included
            if (data.photos.length > 0) {
                console.log(`[LOAD_ALL] Sample photo data:`, data.photos[0]);
                console.log(`[LOAD_ALL] Available properties:`, Object.keys(data.photos[0]));
                
                // Check different possible metadata locations
                if (data.photos[0].meta) {
                    console.log(`[LOAD_ALL] Meta object:`, data.photos[0].meta);
                }
                if (data.photos[0].metadata) {
                    console.log(`[LOAD_ALL] Metadata object:`, data.photos[0].metadata);
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

    function closePhotoDisplay() {
        setShowSideMenu(false);
        compatProps.setShowPhotoDisplay(false);
        if (props.currentPhotoPath !== "") setCurrentPhotoPath("");
        console.log("photos-list-close-photod-display -- getPhotos")
        
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
        
        let date = compatProps.currentDate;
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
        setTimeout(() => { setScrollLock(false) }, 200);
    };

    function nextPhotosList(e, isForward) {
        let target = document.getElementById("photoList");
        let page = target.getAttribute("data-page");
        let date = target.getAttribute("data-date");
        if (!page || page == "NaN") {
            page = 0;
        }
        page = parseInt(page);
        if (!isForward) {
            page -= 1;
            if (page <= 0) {
                page = 1;
            }
        } else {
            page += 1;
        }
        compatProps.datePage[date] = page;
        compatProps.setDatePage(compatProps.datePage);
        const fetchPhotos = async () => getPhotos(e, isForward)
        fetchPhotos().catch(console.error);
    }

    let beforeScrollTop = -1;
    let isScrollBottom = 0;
    function photosScroll(e) {
        if (scrollLock || compatProps.currentDate === "") {
            return;
        }

        let isForward = true;
        const list = document.querySelector("#photoList .scroll-box");
        if (e.deltaY < 0) {
            isForward = false;
        } else if (beforeScrollTop == list.scrollTop && list.scrollTop !== 0) {
            isScrollBottom += 1;
        }

        if ((isForward && photos.has_next) || (!isForward && photos.has_prev)) {
            beforeScrollTop = list.scrollTop;
            if (
                (list.offsetHeight === list.scrollHeight && list.scrollTop === 0)
                || (!isForward && list.scrollTop === 0)
                || (isForward && isScrollBottom > 5)
            ) {
                setScrollLock(true);
                beforeScrollTop = -1;
                isScrollBottom = 0;
                nextPhotosList(e, isForward)
            }
        }
    }

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
                                    onClearSearch={props.onClearSearch}
                                />
                            </div>
                        </ImgCacheContext.Provider>
                    </AllPhotosContext.Provider>
                </div>
                <div className={(props.showSideMenu || !currentPhotoPath) ? "centerDisplay" : "centerDisplayMax"} id="photoList"
                    style={{ display: (!photoLoading && (!compatProps.showPhotoDisplay || !currentPhotoPath)) ? "block" : "none" }}
                    data-date={compatProps.currentDate} data-page={compatProps.datePage[compatProps.currentDate]}>
                    <div>
                        {photos.photos.length > 0 ?
                            <div className="photo-list-header">
                                <div className="photo-page-info">
                                    {isSearchMode ? (
                                        <span className="search-results-info">
                                            {photos.photos.length} photo{photos.photos.length !== 1 ? 's' : ''} found for "{searchQuery}"
                                            {props.onClearSearch && (
                                                <button onClick={props.onClearSearch} className="clear-search-btn" style={{ marginLeft: "10px", fontSize: "12px" }}>
                                                    Clear Search
                                                </button>
                                            )}
                                        </span>
                                    ) : (
                                        <span>{fetchConfig.title} page:{compatProps.datePage[compatProps.currentDate] || 1}</span>
                                    )}
                                </div>
                                {!isSearchMode && (
                                    <div className="navigation">
                                        {photos.has_prev && (<span><a href="#" onClick={(e) => nextPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
                                        {photos.has_next && (<span><a href="#" onClick={(e) => nextPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}
                                    </div>
                                )}
                                <div className="photo-operation">
                                    Icon:<select name="icon_size" defaultValue={iconSize} onChange={(e) => setIconSize(e.target.value)}>
                                        <option value={50}>small</option>
                                        <option value={100}>normal</option>
                                        <option value={200}>large</option>
                                        <option value={300}>huge</option>
                                    </select>
                                    Sort:<select name="sort" defaultValue={sortOfPhotos} onChange={(e) => setSort(e.target.value)}>
                                        <option value={0}>photo time</option>
                                        <option value={1}>time</option>
                                        <option value={2}>name</option>
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
                            : <>No Photo Found!</>
                        }
                        <Scrollable f={photosScroll} className="photos" hasNext={photos.has_next} hasPrev={photos.has_prev} >
                            {photos.has_prev && compatProps.datePage[compatProps.currentDate] > 1 && 
                                <div className="scroll-indicator" style={{ textAlign: "center", minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div className="scroll-indicator-text up">⬆ scroll to load more ⬆</div>
                                </div>
                            }
                            {photos.photos.map((l, i) => {
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
                                                    setShowSideMenu(false);
                                                    displayPhoto(l.file.path, i + (compatProps.datePage[compatProps.currentDate] - 1) * numOfPhoto)
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
                                                    displayPhoto(l.file.path, i + (compatProps.datePage[compatProps.currentDate] - 1) * numOfPhoto)
                                                    setShowSideMenu(true);
                                                }
                                                } >(&#8505;)</a>
                                                <a href="#" className="run-app" onClick={(e) => openUrl(fileUrl(l.file.path))}>&#128640;</a>
                                            </div>
                                        </div>
                                        {photos.has_next && (photos.photos.length - 1) == i && <div className="scroll-indicator" style={{ textAlign: "center", minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}><div className="scroll-indicator-text down">⬇ scroll to load more ⬇</div></div>}
                                    </>
                                )
                            })}
                            {/* Add dummy grid items to ensure scroll effect */}
                            {photos.has_next && Array.from({ length: Math.max(0, 25 - photos.photos.length) }, (_, index) => (
                                <div key={`dummy-${index}`} className="dummy-grid-item" style={{ height: iconSize + 'px' }}></div>
                            ))}
                            {!photos.has_next && Array.from({ length: Math.max(0, 10 - photos.photos.length) }, (_, index) => (
                                <div key={`dummy-${index}`} className="dummy-grid-item" style={{ height: iconSize + 'px' }}></div>
                            ))}
                        </Scrollable>
                    </div>
                    <div className="debug" style={{ display: (debugMessage == "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                        {debugMessage}
                    </div>
                </div>
            </>
        }
        <div className={(showSideMenu || !currentPhotoPath) ? "rightMenu" : "rightMenu-close"} style={{ backgroundColor: "blue", border: "2px solid yellow" }}>
            <div style={{ color: "white", padding: "10px" }}>
                DEBUG: showSideMenu={showSideMenu ? "true" : "false"}, currentPhotoPath={currentPhotoPath ? "exists" : "null"}, isSearchMode={isSearchMode ? "true" : "false"}
            </div>
            <div style={{ display: (compatProps.showPhotoDisplay && currentPhotoPath) ? "block" : "none" }}>
                <PhotoOption
                    setShowSideMenu={setShowSideMenu}
                    showSideMenu={showSideMenu}
                    currentPhotoPath={currentPhotoPath}
                    closePhotoDisplay={closePhotoDisplay}
                    path={currentPhotoPath}
                    
                    // Search mode props
                    searchMode={isSearchMode}
                    searchQuery={searchQuery}
                    searchResultsCount={photos.photos.length}
                    onClearSearch={props.onClearSearch}
                    searchTools={props.searchTools}
                    addFooterMessage={compatProps.addFooterMessage}
                    imgCacheMap={imgCacheMap}
                    setStar={setStarWithUpdate}
                    star={star}
                    onPhotosRefresh={getPhotos}
                    onCommentUpdate={updatePhotoComment}
                />
            </div>
            <div style={{ display: (!compatProps.showPhotoDisplay || !currentPhotoPath || isSearchMode) ? "block" : "none" }}>
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
                    
                    // Search mode props
                    searchMode={isSearchMode}
                    searchTools={props.searchTools}
                />
            </div>
        </div>
    </>
}

export default PhotosList;
