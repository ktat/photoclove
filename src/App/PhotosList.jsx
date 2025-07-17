import { useState, useEffect } from "react";
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
    const [hasCommentFilter, setHasCommentFilter] = useState(false);
    const [extensionFilter, setExtensionFilter] = useState("all");
    const [debugMessage, setDebugMessage] = useState("");
    const [currentPhotoLoadingController, setCurrentPhotoLoadingController] = useState(null);

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
    }, [iconSize])

    useEffect((e) => {
        setShowSideMenu(false);
        if (compatProps.currentDate != "" && !compatProps.showPhotoDisplay[compatProps.currentDate]) {
            // Cancel current photo loading if in progress
            if (currentPhotoLoadingController) {
                currentPhotoLoadingController.abort();
                setCurrentPhotoLoadingController(null);
            }
            
            delete compatProps.datePage[compatProps.currentDate];
            photos.photos = [];
            setPhotosList({ "photos": [] });
            compatProps.setDatePage({});
            const fetchPhotos = async () => getPhotos(undefined, true);;
            setCurrentPhotoIndex(0)
            fetchPhotos().catch(console.error);
            setPhotosListMiniReread(!photosListMiniReread);
            setPhotosListMiniAllPhotos([]);
        }
    }, [numOfPhoto, compatProps.currentDate, sortOfPhotos, starFilter, hasCommentFilter, extensionFilter]);

    useEffect(e => {
        setPhotosListMiniAllPhotos([]);
        setPhotosListMiniCurrentIndex(0);
        setCurrentPhotoPath(undefined);
    }, [compatProps.currentDate])

    function displayPhoto(f, i) {
        setCurrentPhotoPath(f);
        setCurrentPhotoIndex(i)
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
        'tab-filter': true,
        'tab-maintenance': false,
        'tab-selection': false,
    });

    function changeTab(e, t) {
        if (e) e.preventDefault();
        const c = {
            'filter': false,
            'maintenance': false,
            'selection': false,
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
        // Cancel any existing photo loading request
        if (currentPhotoLoadingController) {
            currentPhotoLoadingController.abort();
        }
        
        // Create new AbortController for this request
        const controller = new AbortController();
        setCurrentPhotoLoadingController(controller);
        
        setPhotoLoading(true);
        setPhotosList({ "photos": [] });
        let sort = sortOfPhotos;
        let num = numOfPhoto;
        let date;
        if (e && e.currentTarget && e.currentTarget.getAttribute && e.currentTarget.getAttribute("data-date")) {
            date = e.currentTarget.getAttribute("data-date");
        } else {
            date = compatProps.currentDate;
        }
        if (!date || date == "") {
            setPhotoLoading(false);
            setCurrentPhotoLoadingController(null);
            return;
        }
        let page = compatProps.datePage[date];
        compatProps.setCurrentDate(date)
        if (!page || page == "NaN") {
            page = 1;
        }
        page = parseInt(page);
        
        try {
            const result = await invoke("get_photos_with_filter", {
                dateStr: date,
                sortValue: parseInt(sort),
                page: page,
                num: parseInt(num),
                offset: 0,
                star: parseInt(starFilter, 10),
                hasComment: hasCommentFilter,
                extension: extensionFilter
            });
            
            // Check if this request was cancelled
            if (controller.signal.aborted) {
                return;
            }
            
            let data = JSON.parse(result);
            let l = data.photos;
            let tags = [];
            if (l.length > 0) {
                setPhotosList(data);
            } else {
                page -= 1;
            }
            compatProps.datePage[date] = page;
            compatProps.setDatePage(compatProps.datePage);
            setPhotoLoading(false);
            setCurrentPhotoLoadingController(null);
            setTimeout(() => { setScrollLock(false) }, 200);
        } catch (error) {
            // Check if this was a cancellation (not an actual error)
            if (controller.signal.aborted) {
                return;
            }
            console.log("in PhotosList.jsx");
            console.log(error);
            setPhotoLoading(false);
            setCurrentPhotoLoadingController(null);
        }
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
                                    setStar={setStar}
                                    hasCommentFilter={hasCommentFilter}
                                    starFilter={starFilter}
                                    extensionFilter={extensionFilter}

                                    reread={photosListMiniReread}
                                    currentIndex={photosListMiniCurrentIndex}
                                    setCurrentIndex={setPhotosListMiniCurrentIndex}
                                    setShowSideMenu={setShowSideMenu}
                                    showSideMenu={showSideMenu}
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
                                <div className="photo-page-info">{compatProps.currentDate} page:{compatProps.datePage[compatProps.currentDate]}</div>
                                <div className="navigation">
                                    {photos.has_prev && (<span><a href="#" onClick={(e) => nextPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
                                    {photos.has_next && (<span><a href="#" onClick={(e) => nextPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}
                                </div>
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
                                    
                                    if (uuid) {
                                        // Build thumbnail path with UUID directory
                                        if (l.file.name.match(/(mp4|webm)$/i)) {
                                            thumbnailSrc = thumbnailStore + '/' + compatProps.currentDate.replace(/\//g, '-') + '/' + uuid + '/' + l.file.name + ".jpg";
                                        } else {
                                            thumbnailSrc = (thumbnailStore + '/' + compatProps.currentDate.replace(/\//g, '-') + '/' + uuid + '/' + l.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                                        }
                                    } else {
                                        // Fallback to old behavior if UUID cannot be extracted
                                        if (l.file.name.match(/(mp4|webm)$/i)) {
                                            thumbnailSrc = thumbnailStore + '/' + compatProps.currentDate.replace(/\//g, '-') + '/' + l.file.name + ".jpg";
                                        } else {
                                            thumbnailSrc = (thumbnailStore + '/' + compatProps.currentDate.replace(/\//g, '-') + '/' + l.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                                        }
                                    }
                                    photosListImgSrc[l.file.path] = convertFileSrc(thumbnailSrc);
                                } else {
                                    photosListImgSrc[l.file.path] = convertFileSrc(l.file.path);
                                }
                                return (
                                    <>
                                        <div key={i} className={"row pict-" + iconSize} style={{ flex: "0 0 " + ((iconSize / 1) + 41) + "px", textAlign: "center", verticalAlign: "middle" }} >
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
                                            </div>
                                            <div className="photo-list-menu">
                                                <input type="checkbox"
                                                    id={"photo-checkbox-" + i}
                                                    checked={photoSelectionDict[l.file.path] ? "checked" : ""}
                                                    onChange={(e) => addSelection(e.target.checked, l.file.path)}
                                                />
                                                <label className={"cneckbox-photo checkbox hover"} htmlFor={"photo-checkbox-" + i}></label>
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
        <div className={(showSideMenu || !currentPhotoPath) ? "rightMenu" : "rightMenu-close"}>
            <div style={{ display: (compatProps.showPhotoDisplay && currentPhotoPath) ? "block" : "none" }}>
                <PhotoOption
                    setShowSideMenu={setShowSideMenu}
                    showSideMenu={showSideMenu}
                    currentPhotoPath={currentPhotoPath}
                    closePhotoDisplay={closePhotoDisplay}
                    path={currentPhotoPath}
                    addFooterMessage={compatProps.addFooterMessage}
                    imgCacheMap={imgCacheMap}
                    setStar={setStar}
                    star={star}
                    onPhotosRefresh={getPhotos}
                />
            </div>
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
                />
            </div>
        </div>
    </>
}

export default PhotosList;
