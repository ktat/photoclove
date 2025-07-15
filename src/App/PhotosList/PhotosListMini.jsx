import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import React, { useRef, useContext, useEffect, useState, useCallback } from 'react';
import PhotoDisplay from "./PhotosListMini/PhotoDisplay.jsx";

import { ImgCacheContext, AllPhotosContext } from "../ImgCacheContext.jsx";

const NUM_OF_PHOTO_LIST = 9;

function preventScroll(e) {
    e.preventDefault();
}

function PhotosListMini(props) {
    const { imgCacheMap, setImgCacheMap } = useContext(ImgCacheContext);
    const { photosListMiniAllPhotos, setPhotosListMiniAllPhotos } = useContext(AllPhotosContext);

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
    const [photosListMiniClosed, setPhotosListMiniClosed] = useState(false)
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

    function backwardPhotos() {
        if (props.currentIndex < 1) {
            return;
        }
        _movePhotos(props.currentIndex - 1)
    }

    function forwardPhotos() {
        if (hasNext && (photosListMiniAllPhotos.length - props.currentIndex) <= NUM_OF_PHOTO_LIST) {
            getPhotos();
        }
        _movePhotos(props.currentIndex + 1)
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
        const photosIndex = [];
        let selected = -1;
        for (let i = index; i < (NUM_OF_PHOTO_LIST + index); i++) {
            if (photosListMiniAllPhotos[i]) {
                if (i === props.currentPhotoIndex) {
                    selected = photosIndex.length;
                }
                photosIndex.push(i);
            }
        }
        setShowPhotosIndex(photosIndex);
        resetSelectedBorder(selected);
    }

    function getPhotos() {
        let cpi = props.currentPhotoIndex ? props.currentPhotoIndex : 0
        let num = cpi + NUM_OF_PHOTO_LIST * 2 - photosListMiniAllPhotos.length;
        let needReset = true;
        if (num <= 0 && showPhotosIndex.length <= NUM_OF_PHOTO_LIST) {
            num = NUM_OF_PHOTO_LIST * 2;
            needReset = false;
        }
        if (num <= 0) {
            return Promise.resolve(photosListMiniAllPhotos)
        }
        return invoke("get_photos_with_filter", {
            dateStr: props.currentDate,
            sortValue: props.sortOfPhotos,
            page: 1,
            num: num,
            star: props.starFilter,
            hasComment: props.hasCommentFilter,
            extension: props.extensionFilter,
            offset: photosListMiniAllPhotos.length,
        }).then((r) => {
            let index = props.currentIndex;
            let data = JSON.parse(r);
            let mergedAllPhotos;

            if (data.photos.length > 0) {
                mergedAllPhotos = photosListMiniAllPhotos.concat(data.photos)
                setPhotosListMiniAllPhotos(mergedAllPhotos);
            } else {
                mergedAllPhotos = photosListMiniAllPhotos;
            }

            setHasNext(data.has_next);
            if (needReset) {
                adjustCurrentIndex(mergedAllPhotos);
            }
            return mergedAllPhotos;
        }).catch(e => {
            console.log("in PhotosListMini.jsx");
            console.log(e);
            console.log(num)
            return photosListMiniAllPhotos;
        });
    }

    function adjustCurrentIndex(allPhotos) {
        if (!allPhotos) return

        const currentPhotoIndex = props.currentPhotoIndex;
        // currentIndex is the index of the start index of the mini photos list
        let index = currentPhotoIndex - Math.trunc(NUM_OF_PHOTO_LIST / 2);
        if (allPhotos.length - index < NUM_OF_PHOTO_LIST) {
            index = allPhotos.length - NUM_OF_PHOTO_LIST;
        }
        if (index < 0) {
            index = 0;
        }
        props.setCurrentIndex(index);
        setSetOfShowPhotos(index, allPhotos);
    }

    function setSetOfShowPhotos(index, mergedAllPhotos) {
        if (!mergedAllPhotos) {
            mergedAllPhotos = photosListMiniAllPhotos;
        } else {
            setPhotosListMiniAllPhotos(mergedAllPhotos);
        }
        const photosIndex = [];
        let selected = -1;
        for (let i = index; i < (NUM_OF_PHOTO_LIST + index); i++) {
            if (mergedAllPhotos[i]) {
                if (i === props.currentPhotoIndex) {
                    selected = photosIndex.length;
                }
                photosIndex.push(i);
            }
        }
        setShowPhotosIndex(photosIndex);
        resetSelectedBorder(selected);
    }

    function resetSelectedBorder(i) {
        borderStyle.map((v, n) => {
            borderStyle[n] = "unset";
        });
        if (0 <= i && i < NUM_OF_PHOTO_LIST) {
            borderStyle[i] = "solid";
        }
        setBorderStyle(borderStyle);
    }

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

    function SetImgStyle(style, w, h) {
        const st = {
            transition: 'opacity 0.3s',
        }
        Object.keys(style).map((k) => {
            st[k] = style[k];
        })
        
        // Update current photo size for future reference
        if (w && h) {
            setCurrentPhotoSize([w, h]);
        }
        
        // Get current container dimensions
        const photoContainer = document.querySelector('.photo');
        if (!photoContainer) {
            // Fallback if container not found
            st["width"] = "auto";
            st["height"] = "auto";
            st["maxWidth"] = "100%";
            st["maxHeight"] = "100%";
            setImgStyle(st);
            return;
        }
        
        // Account for padding (20px left/right, 20px top, 40px bottom = 40px width, 60px height)
        const containerWidth = photoContainer.clientWidth - 40;
        const containerHeight = photoContainer.clientHeight - 60;
        
        if (containerWidth <= 0 || containerHeight <= 0) {
            // Container not ready, use basic responsive styling
            st["width"] = "auto";
            st["height"] = "auto";
            st["maxWidth"] = "calc(100% - 40px)";
            st["maxHeight"] = "calc(100% - 60px)";
            setImgStyle(st);
            return;
        }
        
        if (currentPhotoSize[0] || w) {
            const imgWidth = currentPhotoSize[0] || w;
            const imgHeight = currentPhotoSize[1] || h;
            
            // Calculate aspect ratios
            const imgAspectRatio = imgWidth / imgHeight;
            const containerAspectRatio = containerWidth / containerHeight;
            
            if (imgAspectRatio > containerAspectRatio) {
                // Image is wider - constrain by width
                st["width"] = containerWidth + "px";
                st["height"] = "auto";
                st["maxWidth"] = containerWidth + "px";
                st["maxHeight"] = containerHeight + "px";
            } else {
                // Image is taller - constrain by height
                st["width"] = "auto";
                st["height"] = containerHeight + "px";
                st["maxWidth"] = containerWidth + "px";
                st["maxHeight"] = containerHeight + "px";
            }
        } else {
            // Fallback when image dimensions aren't available
            st["width"] = "auto";
            st["height"] = "auto";
            st["maxWidth"] = containerWidth + "px";
            st["maxHeight"] = containerHeight + "px";
        }
        
        setImgStyle(st);
    }

    function lockNavigate(f) {
        if (navigateLock.current) {
            return
        }
        navigateLock.current = true
        f().then(() => {
            navigateLock.current = false
        })
    }

    async function prevPhoto() {
        const prevIndex = props.currentPhotoIndex - 1;
        if (prevIndex >= 0) {
            if (props.currentIndex > 0 && (photosListMiniAllPhotos.length - prevIndex) > Math.trunc(NUM_OF_PHOTO_LIST / 2)) {
                props.setCurrentIndex(props.currentIndex - 1)
            }
            _nextOrPrevPhoto(prevIndex);
            setImageCache(prevIndex, -1)
        }
    }

    async function nextPhoto() {
        const nextIndex = props.currentPhotoIndex + 1;
        
        // If next photo is already loaded, navigate to it normally
        if (photosListMiniAllPhotos.length > nextIndex) {
            let cacheCandidates = []
            if (nextIndex > Math.trunc(NUM_OF_PHOTO_LIST / 2)) {
                props.setCurrentIndex(props.currentIndex + 1)
            }
            if (hasNext && (photosListMiniAllPhotos.length - props.currentIndex) <= NUM_OF_PHOTO_LIST) {
                getPhotos();
            }
            _nextOrPrevPhoto(nextIndex);
            setImageCache(nextIndex, 1)
        } 
        // If we're at the end of loaded photos but more exist on server, load more photos first
        else if (hasNext) {
            console.log('Loading more photos for navigation - current:', props.currentPhotoIndex, 'total loaded:', photosListMiniAllPhotos.length);
            // Load more photos first, then navigate
            const updatedPhotos = await getPhotos();
            // After loading, check if we can navigate to the next photo
            if (updatedPhotos && updatedPhotos.length > nextIndex) {
                _nextOrPrevPhoto(nextIndex);
                setImageCache(nextIndex, 1)
            }
        }
    }

    function _nextOrPrevPhoto(index) {
        // Preserve dimensions when hiding current photo
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
        } else {
            console.log("invalid index. index: " + index + ", allPhotos.length: " + photosListMiniAllPhotos.length)
        }
    }

    function getThumbnailSrc(photo) {
        let thumbnailSrc = "";
        if (photo && photo.has_thumbnail) {
            // Extract UUID from the full file path
            // Path format: /path/to/target/2025-07-01/[UUID]/image.jpg
            // We need to extract the UUID directory from the full path
            const pathParts = photo.file.path.split('/');
            let uuid = null;
            
            // Find the date directory and the UUID directory after it
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            for (let i = 0; i < pathParts.length - 1; i++) {
                if (datePattern.test(pathParts[i]) && pathParts[i + 1]) {
                    uuid = pathParts[i + 1];
                    break;
                }
            }
            
            if (uuid) {
                // Build thumbnail path with UUID directory
                if (photo.file.name.match(/(mp4|webm)$/i)) {
                    thumbnailSrc = thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + uuid + '/' + photo.file.name + ".jpg";
                } else {
                    thumbnailSrc = (thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + uuid + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                }
            } else {
                // Fallback to old behavior if UUID cannot be extracted
                if (photo.file.name.match(/(mp4|webm)$/i)) {
                    thumbnailSrc = thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + photo.file.name + ".jpg";
                } else {
                    thumbnailSrc = (thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                }
            }
        }
        return thumbnailSrc;
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
                    {props.currentPhotoIndex > 0 ? <><a href="#" onClick={() => lockNavigate(prevPhoto)}>&lt;&lt; prev</a><></>&nbsp;&nbsp;|| </> : <>&lt;&lt; <s>prev</s>&nbsp;&nbsp;|| </>}
                    <a href="#" onClick={() => props.closePhotoDisplay()}>close</a>
                    {(props.currentPhotoIndex < (photosListMiniAllPhotos.length - 1)) || hasNext ?
                        <> ||&nbsp;&nbsp;<a href="#" onClick={() => lockNavigate(nextPhoto)}>next &gt;&gt;</a><br /><br /></>
                        : <> ||&nbsp;&nbsp;<s onClick={() => { console.log('Debug - currentPhotoIndex:', props.currentPhotoIndex, 'allPhotos.length:', photosListMiniAllPhotos.length, 'hasNext:', hasNext) }}>next</s> &gt;&gt;<br /><br /></>}

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
                        togglePhotoSelected={togglePhotoSelected}
                        selectedInfoHidden={selectedInfoHidden}
                        unselectedInfoHidden={unselectedInfoHidden}
                        selectedContent={selectedContent}
                        unselectedContent={unselectedContent}
                        currentPhotoCssStyle={(() => {
                            const cssStyle = photosListMiniAllPhotos[props.currentPhotoIndex]?.css_style;
                            console.log('=== PHOTOSLISTMINI DEBUG ===');
                            console.log('currentPhotoIndex:', props.currentPhotoIndex);
                            console.log('photo object:', photosListMiniAllPhotos[props.currentPhotoIndex]);
                            console.log('css_style from photo:', cssStyle);
                            return cssStyle;
                        })()}
                    />
                </div>
                <div id="photos-list-mini" className={photosListMiniClosed ? "photosListMiniClosed" : "photosListMini"}>
                    <div className="row1"><a style={{ display: props.currentIndex == 0 ? "none" : "" }} onClick={() => { backwardPhotos() }}>◁</a></div>
                    {
                        showPhotosIndex.map((vIndex, i) => {
                            let v = photosListMiniAllPhotos[vIndex];
                            if (!v) {
                                vIndex -= 1;
                                v = photosListMiniAllPhotos[vIndex];
                            }
                            const clientHeight = document.querySelector('#photos-list-mini').clientHeight - 20;
                            const thumbnailSrc = getThumbnailSrc(v);
                            // console.log(v</td>.file.path + " : " + v.has_thumbnail);
                            if (thumbnailSrc !== "") {
                                photosListImgSrc[v.file.path] = convertFileSrc(thumbnailSrc);
                            } else {
                                photosListImgSrc[v.file.path] = convertFileSrc(v.file.path);
                            }
                            return <div className="row2" key={i}>
                                <a onClick={(e) => {
                                    props.setCurrentPhotoIndex(vIndex);
                                    props.setCurrentPhotoPath(v.file.path);
                                    resetSelectedBorder(i);
                                    props.datePage[props.currentDate] = Math.trunc((props.currentIndex + i) / props.num) + 1;
                                    setImageCache(vIndex, 0)
                                    if (hasNext && photosListMiniAllPhotos.length < props.currentIndex + NUM_OF_PHOTO_LIST) {
                                        getPhotos()
                                    }
                                }}>
                                    {!v.has_thumbnail && v.file.path.match(/\.(mp4|webm)$/i)
                                        ? <div className="photo-list-movie" style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }}>
                                            <span>&#127909;</span>
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
                                            {v.file.path.match(/\.(mp4|webm)$/i) && <div style={{ color: "white", position: "relative", top: clientHeight / -4 }}>&#x25b6;</div>}
                                        </>
                                    }
                                </a>
                            </div>
                        })
                    }
                    <div className="row1"><a style={{ display: (!hasNext && (photosListMiniAllPhotos.length - props.currentIndex) <= NUM_OF_PHOTO_LIST) ? "none" : "" }} onClick={() => { forwardPhotos() }}>▷</a></div>
                </div >
                <div style={{ textAlign: "center", width: "100%", margin: "0px 0px 0px 0px", padding: "0px 0px 0px 0px" }}>
                    <a hre="#" onClick={() => { setPhotosListMiniClosed(!photosListMiniClosed); document.querySelector("#dummy-for-focus").focus(); }}>{photosListMiniClosed ? "△ open mini list △" : "▽ close mini list ▽"}</a>
                </div>
                <div id="help" className={(showHelp ? "" : " hidden")} onClick={() => { setShowHelp(false); document.querySelector("#dummy-for-focus").focus(); }}>
                    <h1>Help</h1>
                    <table>
                        <tr><th>Right/Left Arrow</th><td>navigate photos</td></tr>
                        <tr><th>Up Arrow/Down Arrow</th><td>Open/Close mini list</td></tr>
                        <tr><th>Ctrl + Mouse Wheel</th><td>zoom photo</td></tr>
                        <tr><th>Ctrl + Drag</th><td>drag photo while zooming</td></tr>
                        <tr><th>Ctrl + 0</th><td>reset zoom</td></tr>
                        <tr><th>C</th><td>choose as selected</td></tr>
                        <tr><th>S</th><td>increase star</td></tr>
                        <tr><th>D</th><td>decrease star</td></tr>
                        <tr><th>F</th><td>choose as selected and increase star</td></tr>
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
