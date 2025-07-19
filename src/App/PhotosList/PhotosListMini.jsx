import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import PhotoDisplay from "./PhotosListMini/PhotoDisplay.jsx";
import { ImgCacheContext, AllPhotosContext } from "../ImgCacheContext.jsx";

const NUM_OF_PHOTO_LIST = 9;

function preventScroll(e) {
    e.preventDefault();
}

function PhotosListMini(props) {
    // Context
    const { imgCacheMap, setImgCacheMap } = useContext(ImgCacheContext);
    const { photosListMiniAllPhotos, setPhotosListMiniAllPhotos } = useContext(AllPhotosContext);
    
    // Search mode props
    const isSearchMode = props.searchMode || false;
    const searchQuery = props.searchQuery || "";
    const onClearSearch = props.onClearSearch;

    // State from original implementation - simplified
    const [showPhotosIndex, setShowPhotosIndex] = useState([]);
    const [borderStyle, setBorderStyle] = useState([]);
    const [currentPhotoSize, setCurrentPhotoSize] = useState([]);
    const [photoZoomReady, setPhotoZoomReady] = useState(false);
    const [photoZoom, setPhotoZoom] = useState("auto");
    const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
    const [imgStyle, setImgStyle] = useState({
        transition: 'opacity 0.1s',
        opacity: 0.5,
        maxWith: "100%",
        maxHeight: "100%",
        overflow: "hidden"
    });
    const [thumbnailStore, setThumbnailStore] = useState("");
    const [photosListImgSrc, setPhotosListImgSrc] = useState({});
    const [photosListMiniClosed, setPhotosListMiniClosed] = useState(false);
    const [selectedInfoHidden, setSelectedInfoHidden] = useState(true);
    const [unselectedInfoHidden, setUnselectedInfoHidden] = useState(true);
    const [selectedContent, setSelectedContent] = useState("");
    const [unselectedContent, setUnselectedContent] = useState("");
    const [showHelp, setShowHelp] = useState(false);

    const navigateLock = useRef(false);

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

    const handleClick = useCallback((e) => {
        // 既存の操作系（input／button など）をクリックした時は奪わない
        const interactive = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'];
        if (interactive.includes(e.target.tagName)) return;
        document.querySelector("#dummy-for-focus").focus();
    }, []);

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
        });
    }, [])

    // Handle date changes - clear thumbnail cache and reset state
    useEffect(() => {
        // console.log(`[DATE_CHANGE] Date changed to: ${props.currentDate}`);
        // Clear cached thumbnail sources when date changes
        setPhotosListImgSrc({});
    }, [props.currentDate]);

    useEffect(() => {
        const currentPhotoIndex = props.currentIndex; // Use the corrected global index
        const loadedCount = photosListMiniAllPhotos.length;
        
        // console.log(`[INIT] UseEffect - PhotoIndex: ${currentPhotoIndex}, Loaded: ${loadedCount}, Date: ${props.currentDate}`);
        
        if (loadedCount > 0 && currentPhotoIndex >= 0) {
            // console.log(`[INIT] Using existing photos data (${loadedCount} photos) for adjustment`);
            adjustCurrentIndex();
        } else {
            // console.log(`[INIT] No photos data available yet or invalid index`);
        }
    }, [props.currentIndex, props.reread, photosListMiniAllPhotos.length, props.currentDate]);

    // Note: Removed redundant useEffect to prevent conflicts
    // Thumbnail display adjustment is now handled in the main useEffect above

    // Note: hasNext is no longer needed since we load all photos at once

    function backwardPhotos() {
        const totalPhotos = photosListMiniAllPhotos.length;
        const { showPrev, startIndex } = calculateSimpleThumbnailDisplay(photosListMiniAllPhotos, props.currentIndex);
        if (!showPrev) return;
        
        // Shift window backward by recalculating with simple logic
        const newSelectedIndex = Math.max(0, startIndex - 1);
        
        // Navigate to a photo that would shift the window
        if (photosListMiniAllPhotos[newSelectedIndex]) {
            props.setCurrentIndex(newSelectedIndex);
            props.setCurrentPhotoPath(photosListMiniAllPhotos[newSelectedIndex].file.path);
            setImageCache(newSelectedIndex, -1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    function forwardPhotos() {
        const totalPhotos = photosListMiniAllPhotos.length;
        const { showNext, endIndex } = calculateSimpleThumbnailDisplay(photosListMiniAllPhotos, props.currentIndex);
        if (!showNext) return;
        
        // Shift window forward by recalculating with simple logic
        const newSelectedIndex = Math.min(totalPhotos - 1, endIndex + 1);
        
        // Navigate to a photo that would shift the window
        if (photosListMiniAllPhotos[newSelectedIndex]) {
            props.setCurrentIndex(newSelectedIndex);
            props.setCurrentPhotoPath(photosListMiniAllPhotos[newSelectedIndex].file.path);
            setImageCache(newSelectedIndex, 1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    async function setImageCache(i, direction) {
        let minIndex = i - (direction == -1 ? 4 : 2)
        let maxIndex = i + (direction == 1 ? 4 : 2)
        const cacheCandidates = []
        const thisTimeCacheMap = {}
        if (minIndex < 0) minIndex = 0;
        if (maxIndex >= photosListMiniAllPhotos.length) maxIndex = photosListMiniAllPhotos.length - 1;

        for (let j = minIndex; j <= maxIndex; j++) {
            if (!photosListMiniAllPhotos[j].file || !photosListMiniAllPhotos[j].file.path.match(/\.jpe?g/i)) {
                continue
            }
            const f = photosListMiniAllPhotos[j].file.path
            thisTimeCacheMap[f] = true
            if (!imgCacheMap[f]) {
                cacheCandidates.push(f)
            }
        }
        for (let j = 0; j < cacheCandidates.length; j++) {
            const f = cacheCandidates[j]
            const response = await fetch(convertFileSrc(f), { cache: "force-cache" })
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);
            imgCacheMap[f] = [objectURL];
            setImgCacheMap(imgCacheMap)
        }
        const keys = Object.keys(imgCacheMap)
        keys.forEach((v) => {
            if (!thisTimeCacheMap[v]) {
                delete imgCacheMap[v];
            }
        });
        setImgCacheMap(imgCacheMap)
    }

    function _movePhotos(index) {
        props.setCurrentIndex(index);
        
        // Use the new simple thumbnail display logic
        const { startIndex, endIndex, borderPosition } = calculateSimpleThumbnailDisplay(photosListMiniAllPhotos, index);
        
        // console.log(`[_MOVE_PHOTOS] Moving to index ${index}, calculated range: ${startIndex}-${endIndex}, border: ${borderPosition}`);
        
        const photosIndex = [];
        for (let i = startIndex; i <= endIndex && i < photosListMiniAllPhotos.length; i++) {
            if (photosListMiniAllPhotos[i]) {
                photosIndex.push(i);
            }
        }
        
        // Update both at the same time to ensure consistency
        setShowPhotosIndex(photosIndex);
        
        // Create border styles based on the new photosIndex length and borderPosition
        const newBorderStyle = [];
        for (let i = 0; i < photosIndex.length; i++) {
            if (i === borderPosition) {
                newBorderStyle[i] = '3px solid #4a9eff';
            } else {
                newBorderStyle[i] = '1px solid #444';
            }
        }
        setBorderStyle(newBorderStyle);
        
        // console.log(`[_MOVE_PHOTOS] Set photosIndex:`, photosIndex, `borderPosition: ${borderPosition}`);
    }

    // Note: loadAllPhotosMetadata function removed - PhotosList should provide all photos data

    // Simple Thumbnail Display Logic - based on user's specification
    function calculateSimpleThumbnailDisplay(allPhotos, selectedIndex) {
        const totalPhotos = allPhotos.length;
        const t = selectedIndex; // 0-indexed全体位置
        
        // console.log(`[SIMPLE_CALC] Input - totalPhotos: ${totalPhotos}, selectedIndex: ${t}`);
        
        // Handle edge case: no photos or invalid index
        if (totalPhotos === 0 || t < 0 || t >= totalPhotos) {
            console.warn(`[SIMPLE_CALC] Invalid input - totalPhotos: ${totalPhotos}, selectedIndex: ${t}`);
            return {
                startIndex: 0,
                endIndex: 0,
                borderPosition: 0,
                showPrev: false,
                showNext: false
            };
        }
        
        // Handle case where total photos <= 9
        if (totalPhotos <= NUM_OF_PHOTO_LIST) {
            const result = {
                startIndex: 0,
                endIndex: totalPhotos - 1,
                borderPosition: t,
                showPrev: false,
                showNext: false
            };
            // console.log(`[SIMPLE_CALC] Small set (${totalPhotos} photos):`, result);
            return result;
        }
        
        let result;
        
        if (t < 5) {
            // 最初の5枚以内：1-9番目表示
            result = {
                startIndex: 0,
                endIndex: 8, // Always show first 9 photos
                borderPosition: t, // 1-5番目位置に表示
                showPrev: false,
                showNext: true
            };
            // console.log(`[SIMPLE_CALC] First 5 case (t=${t}):`, result);
        } else if (t > totalPhotos - 5) {
            // 最後の5枚以内：末尾9枚表示
            result = {
                startIndex: totalPhotos - 9,
                endIndex: totalPhotos - 1,
                borderPosition: t - (totalPhotos - 9), // 5-9番目位置に表示
                showPrev: true,
                showNext: false
            };
            // console.log(`[SIMPLE_CALC] Last 5 case (t=${t}, totalPhotos=${totalPhotos}):`, result);
        } else {
            // 中央：選択写真を5番目（index 4）に配置
            result = {
                startIndex: t - 4,
                endIndex: t + 4,
                borderPosition: 4, // 常に5番目位置
                showPrev: true,
                showNext: true
            };
            // console.log(`[SIMPLE_CALC] Center case (t=${t}):`, result);
        }
        
        // console.log(`[SIMPLE_CALC] Final result - Will show indices ${result.startIndex} to ${result.endIndex} (${result.endIndex - result.startIndex + 1} photos)`);
        // console.log(`[SIMPLE_CALC] Selected photo ${t} will be at position ${result.borderPosition + 1} (1-indexed)`);
        // console.log(`[SIMPLE_CALC] Buttons - showPrev: ${result.showPrev}, showNext: ${result.showNext}`);
        
        return result;
    }

    function adjustCurrentIndex() {
        const totalPhotos = photosListMiniAllPhotos.length;
        const selectedIndex = props.currentIndex;
        
        // console.log(`[ADJUST] Photos: ${totalPhotos}, Selected: ${selectedIndex}`);
        
        if (totalPhotos === 0 || selectedIndex === undefined || selectedIndex === null || selectedIndex < 0 || selectedIndex >= totalPhotos) {
            console.warn(`[ADJUST] Invalid state - totalPhotos: ${totalPhotos}, selectedIndex: ${selectedIndex}`);
            // Reset to safe state
            setShowPhotosIndex([]);
            setBorderStyle([]);
            return;
        }
        
        
        // Use the new simple thumbnail display logic
        const { startIndex, endIndex, borderPosition, showPrev, showNext } = calculateSimpleThumbnailDisplay(photosListMiniAllPhotos, selectedIndex);
        
        // console.log(`[ADJUST] Simple Logic Result - Range: ${startIndex}-${endIndex}, Border: ${borderPosition}`);
        // console.log(`[ADJUST] Button visibility - showPrev: ${showPrev}, showNext: ${showNext}`);
        
        const photosIndex = [];
        for (let i = startIndex; i <= endIndex && i < totalPhotos; i++) {
            if (photosListMiniAllPhotos[i]) {
                photosIndex.push(i);
            }
        }
        
        // console.log(`[ADJUST] PhotosIndex array:`, photosIndex);
        // console.log(`[ADJUST] BorderPosition should be: ${borderPosition} (selected photo at position ${borderPosition + 1})`);
        
        // Update both at the same time to ensure consistency
        setShowPhotosIndex(photosIndex);
        
        // Create border styles based on the new photosIndex length and borderPosition
        const newBorderStyle = [];
        for (let i = 0; i < photosIndex.length; i++) {
            if (i === borderPosition) {
                newBorderStyle[i] = '3px solid #4a9eff';
            } else {
                newBorderStyle[i] = '1px solid #444';
            }
        }
        setBorderStyle(newBorderStyle);
        
        // console.log(`[ADJUST] Border styles created for ${photosIndex.length} photos, selected at position ${borderPosition}`);
    }

    // Note: resetSelectedBorder function removed - border styles are now created directly in adjustCurrentIndex

    function SetImgStyle(style, w, h) {
        setImgStyle(prevStyle => ({ ...prevStyle, ...style }));
        if (w && h) {
            setCurrentPhotoSize([w, h]);
        }
    }

    function getThumbnailSrc(photo) {
        if (!photo || !photo.has_thumbnail) return "";

        let thumbnailSrc = "";
        const pathParts = photo.file.path.split('/');
        let uuid = null;
        
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        for (let i = 0; i < pathParts.length - 1; i++) {
            if (datePattern.test(pathParts[i]) && pathParts[i + 2] !== undefined) {
                uuid = pathParts[i + 1];
                break;
            }
        }
        
        // Extract date from photo path for thumbnail generation
        let photoDate = props.currentDate;
        if (isSearchMode || !photoDate) {
            // Extract date from the photo's path
            for (let i = 0; i < pathParts.length; i++) {
                if (datePattern.test(pathParts[i])) {
                    photoDate = pathParts[i];
                    break;
                }
            }
        }
        
        if (uuid && photoDate) {
            if (photo.file.name.match(/(mp4|webm)$/i)) {
                thumbnailSrc = thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + uuid + '/' + photo.file.name + ".jpg";
            } else {
                thumbnailSrc = (thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + uuid + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
            }
        } else if (photoDate) {
            if (photo.file.name.match(/(mp4|webm)$/i)) {
                thumbnailSrc = thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + photo.file.name + ".jpg";
            } else {
                thumbnailSrc = (thumbnailStore + '/' + photoDate.replace(/\//g, '-') + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
            }
        }
        return thumbnailSrc;
    }

    // Navigation functions
    const lockNavigate = (fn) => {
        if (navigateLock.current) return;
        navigateLock.current = true;
        fn();
        setTimeout(() => {
            navigateLock.current = false;
        }, 100);
    };

    function nextPhoto() {
        const nextIndex = props.currentIndex + 1;
        
        // console.log(`[NAVIGATION] NextPhoto - Index: ${nextIndex}, Total: ${photosListMiniAllPhotos.length}`);
        
        if (nextIndex < photosListMiniAllPhotos.length) {
            _nextOrPrevPhoto(nextIndex);
            setImageCache(nextIndex, 1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }

    function prevPhoto() {
        const prevIndex = props.currentIndex - 1;
        
        // console.log(`[NAVIGATION] PrevPhoto - Index: ${prevIndex}`);
        
        if (prevIndex >= 0) {
            _nextOrPrevPhoto(prevIndex);
            setImageCache(prevIndex, -1);
            // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
        }
    }
    
    // Note: updateThumbnailDisplay function removed - using adjustCurrentIndex for all thumbnail updates

    function _nextOrPrevPhoto(index) {
        const currentW = currentPhotoSize[0];
        const currentH = currentPhotoSize[1];
        if (currentW && currentH) {
            SetImgStyle({ opacity: 0 }, currentW, currentH);
        } else {
            SetImgStyle({ opacity: 0 });
        }
        setPhotoZoom("auto");
        if (photosListMiniAllPhotos[index]) {
            props.setCurrentPhotoPath(photosListMiniAllPhotos[index].file.path);
            props.datePage[props.currentDate] = Math.trunc((index) / props.num) + 1;
            props.setCurrentIndex(index);
        }
    }

    // Restored keyboard functions from main branch
    function photoNavigationUp(e) {
        if (e.ctrlKey) {
            setPhotoZoomReady(false);
            window.removeEventListener('wheel', preventScroll, { passive: false });
        }
    }

    function changeStar(isIncrease, additionalMessage) {
        invoke("get_photo_info", { pathStr: props.currentPhotoPath }).then((r) => {
            let data = JSON.parse(r);
            let star = 0;
            let curStar = 0;
            if (data.meta) {
                curStar = data.meta.star.data || 0;
                if (isIncrease) {
                    if (curStar < 5) {
                        star = curStar + 1;
                    } else {
                        star = 5;
                    }
                } else if (!isIncrease && curStar > 0) {
                    star = curStar - 1;
                }
            }
            let stars = ["☆", "☆", "☆", "☆", "☆"];
            let newStar = [false, false, false, false, false];
            for (let i = 0; i < star; i++) {
                stars[i] = "★";
                newStar[i] = true;
            }
            props.setStar(newStar);
            let c = "Star: " + stars.join("")
            if (additionalMessage && additionalMessage !== "") {
                c = additionalMessage + "<br />" + c;
            }
            setSelectedContent(c);
            setTimeout(() => {
                setSelectedInfoHidden(true);
            }, 700)
            setSelectedInfoHidden(false);
            invoke("save_star", { pathStr: props.currentPhotoPath, starNum: star });
        });
    }

    function togglePhotoSelected() {
        const t = props.toggleSelection(props.currentPhotoPath);
        setTimeout(() => {
            if (t) {
                setSelectedInfoHidden(true);
            } else {
                setUnselectedInfoHidden(true);
            }
        }, 700)
        if (t) {
            setSelectedContent("Photo is selected")
            setSelectedInfoHidden(false);
        } else {
            setUnselectedContent("Photo is unselected")
            setUnselectedInfoHidden(false);
        }
    }

    // Keyboard navigation - restored from main branch
    function photoNavigation(e) {
        let f = props.currentPhotoPath;
        if (e.keyCode === 39) { // right arrow
            nextPhoto();
        } else if (e.keyCode === 37) { // left arrow
            prevPhoto();
        } else if (e.keyCode === 38) { // up arrow ... open mini list
            setPhotosListMiniClosed(false);
        } else if (e.keyCode === 40) { // down arrow ... close mini list
            setPhotosListMiniClosed(true);
        } else if (e.keyCode === 67) { // c ... choose as selected
            togglePhotoSelected();
        } else if (e.keyCode === 83) { // s ... increase star
            changeStar(true);
        } else if (e.keyCode === 68) { // d ... declease star
            changeStar(false);
        } else if (e.keyCode === 73) { // i ... toggle show photo info
            props.setShowSideMenu(!props.showSideMenu);
        } else if (e.keyCode === 70) { // f ... c & s
            let additionalMessage = "Photo is selected";
            if (props.isSelected(f)) {
                additionalMessage = "Photo is already selected";
            } else {
                props.toggleSelection(props.currentPhotoPath);
            }
            changeStar(true, additionalMessage);
        } else if (e.keyCode === 191) { // ? ... show help
            setShowHelp(!showHelp);
        } else if (e.keyCode === 46) { // Del
            props.moveToTrashCan(f)
        } else if (photoZoomReady && e.keyCode === 48) { // ctrl+0
            setPhotoZoom("auto");
            SetImgStyle({ opacity: '100%' });
            document.querySelector("#dummy-for-focus").focus();
        } else if (!photoZoomReady && e.ctrlKey) {
            setPhotoZoomReady(true);
            window.addEventListener('wheel', preventScroll, { passive: false });
        }
    }

    return (
        <>
            <div className={props.centerDisplayClass}>
                <div
                    className={"photoDisplay" + (photosListMiniClosed ? " photosListMiniClosed" : "")}
                    id="photoDisplay"
                    autoFocus={true}
                    onKeyDown={(e) => photoNavigation(e)}
                    onKeyUp={(e) => photoNavigationUp(e)}
                    onClick={handleClick}
                >
                    <a href="#" id="dummy-for-focus">{/* Dummy */}</a>
                    {props.currentIndex > 0 ? 
                        <><a href="#" onClick={() => lockNavigate(prevPhoto)}>&lt;&lt; prev</a>&nbsp;&nbsp;|| </> : 
                        <>&lt;&lt; <s>prev</s>&nbsp;&nbsp;|| </>
                    }
                    <a href="#" onClick={() => props.closePhotoDisplay()}>close</a>
                    {props.currentIndex < (photosListMiniAllPhotos.length - 1) ?
                        <> ||&nbsp;&nbsp;<a href="#" onClick={() => lockNavigate(nextPhoto)}>next &gt;&gt;</a><br /><br /></>
                        : <> ||&nbsp;&nbsp;<s>next</s> &gt;&gt;<br /><br /></>
                    }

                    <PhotoDisplay
                        imgStyle={imgStyle}
                        SetImgStyle={SetImgStyle}
                        setPhotoZoom={setPhotoZoom}
                        photoZoom={photoZoom}
                        photoZoomReady={photoZoomReady}
                        currentPhotoPath={props.currentPhotoPath}
                        currentPhotoSize={currentPhotoSize}
                        imgCacheMap={imgCacheMap}
                        thumbnailSrc={getThumbnailSrc(photosListMiniAllPhotos[props.currentIndex])}
                        photosListMiniClosed={photosListMiniClosed}
                        selectedInfoHidden={selectedInfoHidden}
                        unselectedInfoHidden={unselectedInfoHidden}
                        selectedContent={selectedContent}
                        unselectedContent={unselectedContent}
                        currentPhotoCssStyle={photosListMiniAllPhotos[props.currentIndex]?.css_style}
                    />
                </div>
                
                <div id="photos-list-mini" className={photosListMiniClosed ? "photosListMiniClosed" : "photosListMini"}>
                    <div className="row1">
                        <a style={{ display: calculateSimpleThumbnailDisplay(photosListMiniAllPhotos, props.currentIndex).showPrev ? "" : "none" }} onClick={() => { backwardPhotos() }}>◁</a>
                    </div>
                    {showPhotosIndex.map((vIndex, i) => {
                        // Strict validation to prevent rendering invalid photos
                        if (typeof vIndex !== 'number' || vIndex < 0 || vIndex >= photosListMiniAllPhotos.length) {
                            console.warn(`[THUMBNAIL] Invalid vIndex: ${vIndex} (array length: ${photosListMiniAllPhotos.length})`);
                            return null;
                        }
                        
                        let v = photosListMiniAllPhotos[vIndex];
                        
                        // Skip if photo doesn't exist at this index
                        if (!v || !v.file || !v.file.path) {
                            console.warn(`[THUMBNAIL] Photo at index ${vIndex} is undefined or missing file property`);
                            return null; // Don't render anything for missing photos
                        }
                        
                        const clientHeight = document.querySelector('#photos-list-mini')?.clientHeight - 20 || 80;
                        const thumbnailSrc = getThumbnailSrc(v);
                        
                        if (thumbnailSrc !== "") {
                            photosListImgSrc[v.file.path] = convertFileSrc(thumbnailSrc);
                        } else {
                            photosListImgSrc[v.file.path] = convertFileSrc(v.file.path);
                        }
                        
                        return <div className="row2" key={`${vIndex}-${v.file.path}`} style={{ position: "relative" }}>
                            <a onClick={(e) => {
                                props.setCurrentIndex(vIndex);
                                props.setCurrentPhotoPath(v.file.path);
                                props.datePage[props.currentDate] = Math.trunc((vIndex) / props.num) + 1;
                                setImageCache(vIndex, 0);
                                
                                // adjustCurrentIndex will be called by useEffect when props.currentIndex changes
                            }}>
                                {!v.has_thumbnail && v.file.path.match(/\.(mp4|webm)$/i)
                                    ? <div className="photo-list-movie" style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }}>
                                        <span>🎬</span>
                                    </div>
                                    : <>
                                        <img src={photosListImgSrc[v.file.path]} 
                                            style={{ 
                                                border: borderStyle[i], 
                                                maxHeight: clientHeight + "px",
                                                ...parseCssStyle(v.css_style)
                                            }} 
                                            alt={"photo-" + i}
                                            onError={(e) => { e.target.src = "/img_error.png" }} />
                                        {v.file.path.match(/\.(mp4|webm)$/i) && <div style={{ color: "white", position: "relative", top: clientHeight / -4 }}>▶</div>}
                                    </>
                                }
                            </a>
                            
                            {/* Metadata overlay - stars and comments */}
                            {(v.star > 0 || v.comment) && (
                                <div style={{
                                    position: "absolute",
                                    top: "28px",
                                    left: "2px",
                                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                                    color: "white",
                                    padding: "2px 4px",
                                    borderRadius: "3px",
                                    fontSize: "11px",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "2px",
                                    pointerEvents: "none"
                                }}>
                                    {v.star > 0 && (
                                        <span>⭐{v.star}</span>
                                    )}
                                    {v.comment && (
                                        <span>💬</span>
                                    )}
                                </div>
                            )}
                        </div>
                    })}
                    <div className="row1">
                        <a style={{ display: calculateSimpleThumbnailDisplay(photosListMiniAllPhotos, props.currentIndex).showNext ? "" : "none" }} onClick={() => { forwardPhotos() }}>▷</a>
                    </div>
                </div >
                
                <div style={{ textAlign: "center", width: "100%", margin: "0px 0px 0px 0px", padding: "0px 0px 0px 0px" }}>
                    <a href="#" onClick={() => { setPhotosListMiniClosed(!photosListMiniClosed); document.querySelector("#dummy-for-focus").focus(); }}>
                        {photosListMiniClosed ? "△ open mini list △" : "▽ close mini list ▽"}
                    </a>
                </div>
                
                <div id="help" className={(showHelp ? "" : " hidden")} onClick={() => { setShowHelp(false); document.querySelector("#dummy-for-focus").focus(); }}>
                    <h1>Help</h1>
                    <table>
                        <tr><th>Right/Left Arrow</th><td>navigate photos</td></tr>
                        <tr><th>Up Arrow/Down Arrow</th><td>Open/Close mini list</td></tr>
                        <tr><th>Ctrl + Mouse Wheel</th><td>zoom photo</td></tr>
                        <tr><th>Ctrl + Drag</th><td>drag photo while zooming</td></tr>
                        <tr><th>Ctrl + 0</th><td>reset zoom</td></tr>
                        <tr><th>S</th><td>increase star</td></tr>
                        <tr><th>D</th><td>decrease star</td></tr>
                        <tr><th>I</th><td>toggle photo info</td></tr>
                        <tr><th>Del</th><td>move to trash can</td></tr>
                        <tr><th>?</th><td>toggle showing this help</td></tr>
                    </table>
                </div>
            </div>
        </>
    )
}

export default PhotosListMini;