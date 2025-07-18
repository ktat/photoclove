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

    // State from original implementation
    const [showPhotosIndex, setShowPhotosIndex] = useState([]);
    const [hasNext, setHasNext] = useState(false);
    const [borderStyle, setBorderStyle] = useState([]);
    const [currentPhotoSize, setCurrentPhotoSize] = useState([]);
    const [photoZoomReady, setPhotoZoomReady] = useState(false);
    const [photoZoom, setPhotoZoom] = useState("auto");
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

    useEffect((e) => {
        const page = props.datePage[props.currentDate];
        let currentPhotoIndex = props.currentPhotoIndex;
        let l = photosListMiniAllPhotos.length;
        if (l === 0 || (hasNext && l - currentPhotoIndex < NUM_OF_PHOTO_LIST) || l < currentPhotoIndex) {
            getPhotos();
        } else {
            adjustCurrentIndex(photosListMiniAllPhotos);
        }
    }, [props.currentPhotoIndex, props.reread]);

    // Adjust thumbnail display when photos are loaded or currentIndex changes
    useEffect(() => {
        if (photosListMiniAllPhotos.length > 0) {
            adjustCurrentIndex(photosListMiniAllPhotos);
        }
    }, [photosListMiniAllPhotos.length, props.currentIndex]);

    function backwardPhotos() {
        const totalPhotos = photosListMiniAllPhotos.length;
        const { showPrev } = getButtonVisibility(totalPhotos, props.currentPhotoIndex);
        if (!showPrev) return;
        
        // Shift window backward by recalculating with algorithm
        const { startIndex } = calculateDisplayWindow(totalPhotos, props.currentPhotoIndex);
        const newSelectedIndex = Math.max(0, startIndex - 1);
        
        // Navigate to a photo that would shift the window
        if (photosListMiniAllPhotos[newSelectedIndex]) {
            props.setCurrentPhotoIndex(newSelectedIndex);
            props.setCurrentPhotoPath(photosListMiniAllPhotos[newSelectedIndex].file.path);
            updateThumbnailDisplay(newSelectedIndex);
            setImageCache(newSelectedIndex, -1);
        }
    }

    function forwardPhotos() {
        const totalPhotos = photosListMiniAllPhotos.length;
        const { showNext } = getButtonVisibility(totalPhotos, props.currentPhotoIndex);
        if (!showNext && !hasNext) return;
        
        if (hasNext && (photosListMiniAllPhotos.length - props.currentPhotoIndex) <= NUM_OF_PHOTO_LIST) {
            getPhotos();
        }
        
        // Shift window forward by recalculating with algorithm
        const { endIndex } = calculateDisplayWindow(totalPhotos, props.currentPhotoIndex);
        const newSelectedIndex = Math.min(totalPhotos - 1, endIndex + 1);
        
        // Navigate to a photo that would shift the window
        if (photosListMiniAllPhotos[newSelectedIndex]) {
            props.setCurrentPhotoIndex(newSelectedIndex);
            props.setCurrentPhotoPath(photosListMiniAllPhotos[newSelectedIndex].file.path);
            updateThumbnailDisplay(newSelectedIndex);
            setImageCache(newSelectedIndex, 1);
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
        const totalPhotos = photosListMiniAllPhotos.length;
        const { startIndex, endIndex, borderPosition } = calculateDisplayWindow(totalPhotos, props.currentPhotoIndex);
        
        const photosIndex = [];
        for (let i = startIndex; i <= endIndex; i++) {
            if (photosListMiniAllPhotos[i]) {
                photosIndex.push(i);
            }
        }
        
        setShowPhotosIndex(photosIndex);
        resetSelectedBorder(borderPosition);
    }

    async function getPhotos() {
        if (!props.currentDate || !props.datePage) return;
        
        try {
            const page = props.datePage[props.currentDate];
            const result = await invoke("get_photos", {
                dateStr: props.currentDate,
                page: page,
                sort: props.sortOfPhotos || 0,
                starFilter: props.starFilter || 0,
                hasCommentFilter: props.hasCommentFilter || false,
                extensionFilter: props.extensionFilter || "all"
            });
            
            const photos = JSON.parse(result);
            if (photos.photos && Array.isArray(photos.photos)) {
                // Append new photos to existing ones (for pagination)
                const newPhotos = [...photosListMiniAllPhotos, ...photos.photos];
                setPhotosListMiniAllPhotos(newPhotos);
                setHasNext(photos.has_next || false);
                return photos.photos;
            }
        } catch (error) {
            console.error("Failed to load photos:", error);
        }
        return [];
    }

    // Display Window Algorithm implementation
    function calculateDisplayWindow(totalPhotos, selectedIndex, maxDisplay = NUM_OF_PHOTO_LIST) {
        if (totalPhotos <= maxDisplay) {
            return {
                startIndex: 0,
                endIndex: totalPhotos - 1,
                borderPosition: selectedIndex
            };
        }
        
        let startIndex = Math.max(0, selectedIndex - Math.floor(maxDisplay / 2));
        let endIndex = Math.min(totalPhotos - 1, startIndex + maxDisplay - 1);
        
        // Adjust if we're near the end
        if (endIndex - startIndex + 1 < maxDisplay && endIndex === totalPhotos - 1) {
            startIndex = Math.max(0, endIndex - maxDisplay + 1);
        }
        
        return {
            startIndex: startIndex,
            endIndex: endIndex,
            borderPosition: selectedIndex - startIndex
        };
    }

    // Button visibility detection
    function getButtonVisibility(totalPhotos, selectedIndex) {
        if (totalPhotos <= NUM_OF_PHOTO_LIST) {
            return { showPrev: false, showNext: false };
        }
        
        const { startIndex, endIndex } = calculateDisplayWindow(totalPhotos, selectedIndex);
        
        return {
            showPrev: startIndex > 0,
            showNext: endIndex < totalPhotos - 1
        };
    }

    function adjustCurrentIndex(allPhotos) {
        const totalPhotos = allPhotos.length;
        const { startIndex, endIndex, borderPosition } = calculateDisplayWindow(totalPhotos, props.currentPhotoIndex);
        
        const photosIndex = [];
        for (let i = startIndex; i <= endIndex; i++) {
            if (allPhotos[i]) {
                photosIndex.push(i);
            }
        }
        
        setShowPhotosIndex(photosIndex);
        resetSelectedBorder(borderPosition);
    }

    function resetSelectedBorder(selectedIndex) {
        const newBorderStyle = [];
        // Create border styles for the actual number of displayed photos
        for (let i = 0; i < showPhotosIndex.length; i++) {
            if (i === selectedIndex) {
                newBorderStyle[i] = '3px solid #4a9eff';
            } else {
                newBorderStyle[i] = '1px solid #444';
            }
        }
        setBorderStyle(newBorderStyle);
    }

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
        
        if (uuid) {
            if (photo.file.name.match(/(mp4|webm)$/i)) {
                thumbnailSrc = thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + uuid + '/' + photo.file.name + ".jpg";
            } else {
                thumbnailSrc = (thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + uuid + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
            }
        } else {
            if (photo.file.name.match(/(mp4|webm)$/i)) {
                thumbnailSrc = thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + photo.file.name + ".jpg";
            } else {
                thumbnailSrc = (thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
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

    async function nextPhoto() {
        const nextIndex = props.currentPhotoIndex + 1;
        if (nextIndex < photosListMiniAllPhotos.length) {
            // Check if we need to load more photos
            if (hasNext && (photosListMiniAllPhotos.length - nextIndex) <= NUM_OF_PHOTO_LIST) {
                getPhotos();
            }
            _nextOrPrevPhoto(nextIndex);
            setImageCache(nextIndex, 1);
            
            // Update thumbnail display using algorithm
            updateThumbnailDisplay(nextIndex);
        } else if (hasNext) {
            const updatedPhotos = await getPhotos();
            if (updatedPhotos && updatedPhotos.length > 0) {
                _nextOrPrevPhoto(nextIndex);
                setImageCache(nextIndex, 1);
                updateThumbnailDisplay(nextIndex);
            }
        }
    }

    function prevPhoto() {
        const prevIndex = props.currentPhotoIndex - 1;
        if (prevIndex >= 0) {
            _nextOrPrevPhoto(prevIndex);
            setImageCache(prevIndex, -1);
            
            // Update thumbnail display using algorithm
            updateThumbnailDisplay(prevIndex);
        }
    }
    
    function updateThumbnailDisplay(selectedIndex) {
        const totalPhotos = photosListMiniAllPhotos.length;
        const buttonVisibility = getButtonVisibility(totalPhotos, selectedIndex);
        const { startIndex, endIndex, borderPosition } = calculateDisplayWindow(totalPhotos, selectedIndex);
        
        // Check if we're in Dynamic mode (buttons visible) or Fixed mode
        const isDynamicMode = buttonVisibility.showPrev || buttonVisibility.showNext;
        
        if (isDynamicMode) {
            // Dynamic mode: recalculate window
            const photosIndex = [];
            for (let i = startIndex; i <= endIndex; i++) {
                if (photosListMiniAllPhotos[i]) {
                    photosIndex.push(i);
                }
            }
            setShowPhotosIndex(photosIndex);
            resetSelectedBorder(borderPosition);
        } else {
            // Fixed mode: only update border position
            const currentStart = showPhotosIndex.length > 0 ? showPhotosIndex[0] : 0;
            const relativeBorder = selectedIndex - currentStart;
            resetSelectedBorder(relativeBorder);
        }
    }

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
            props.setCurrentPhotoIndex(index);
        }
    }

    // Keyboard navigation
    const photoNavigation = (e) => {
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                lockNavigate(nextPhoto);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                lockNavigate(prevPhoto);
                break;
            case 'ArrowUp':
            case 'ArrowDown':
                e.preventDefault();
                setPhotosListMiniClosed(!photosListMiniClosed);
                break;
            case '?':
                e.preventDefault();
                setShowHelp(!showHelp);
                break;
            case 'Escape':
                e.preventDefault();
                setShowHelp(false);
                break;
            default:
                break;
        }
    };

    const photoNavigationUp = (e) => {
        // Handle key up events if needed
    };

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
                    {props.currentPhotoIndex > 0 ? 
                        <><a href="#" onClick={() => lockNavigate(prevPhoto)}>&lt;&lt; prev</a>&nbsp;&nbsp;|| </> : 
                        <>&lt;&lt; <s>prev</s>&nbsp;&nbsp;|| </>
                    }
                    <a href="#" onClick={() => props.closePhotoDisplay()}>close</a>
                    {(props.currentPhotoIndex < (photosListMiniAllPhotos.length - 1)) || hasNext ?
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
                        thumbnailSrc={getThumbnailSrc(photosListMiniAllPhotos[props.currentPhotoIndex])}
                        photosListMiniClosed={photosListMiniClosed}
                        selectedInfoHidden={selectedInfoHidden}
                        unselectedInfoHidden={unselectedInfoHidden}
                        selectedContent={selectedContent}
                        unselectedContent={unselectedContent}
                        currentPhotoCssStyle={photosListMiniAllPhotos[props.currentPhotoIndex]?.css_style}
                    />
                </div>
                
                <div id="photos-list-mini" className={photosListMiniClosed ? "photosListMiniClosed" : "photosListMini"}>
                    <div className="row1">
                        <a style={{ display: getButtonVisibility(photosListMiniAllPhotos.length, props.currentPhotoIndex).showPrev ? "" : "none" }} onClick={() => { backwardPhotos() }}>◁</a>
                    </div>
                    {showPhotosIndex.map((vIndex, i) => {
                        let v = photosListMiniAllPhotos[vIndex];
                        const clientHeight = document.querySelector('#photos-list-mini')?.clientHeight - 20 || 80;
                        const thumbnailSrc = getThumbnailSrc(v);
                        
                        if (thumbnailSrc !== "") {
                            photosListImgSrc[v.file.path] = convertFileSrc(thumbnailSrc);
                        } else {
                            photosListImgSrc[v.file.path] = convertFileSrc(v.file.path);
                        }
                        
                        return <div className="row2" key={i}>
                            <a onClick={(e) => {
                                props.setCurrentPhotoIndex(vIndex);
                                props.setCurrentPhotoPath(v.file.path);
                                props.datePage[props.currentDate] = Math.trunc((vIndex) / props.num) + 1;
                                setImageCache(vIndex, 0);
                                
                                // Update thumbnail display based on new selection
                                updateThumbnailDisplay(vIndex);
                                
                                if (hasNext && photosListMiniAllPhotos.length < vIndex + NUM_OF_PHOTO_LIST) {
                                    getPhotos()
                                }
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
                        </div>
                    })}
                    <div className="row1">
                        <a style={{ display: getButtonVisibility(photosListMiniAllPhotos.length, props.currentPhotoIndex).showNext ? "" : "none" }} onClick={() => { forwardPhotos() }}>▷</a>
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