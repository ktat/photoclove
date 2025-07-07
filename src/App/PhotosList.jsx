import { useState, useEffect } from "react";
import PhotosListMini from "./PhotosList/PhotosListMini.jsx";
import PhotoInfo from "./PhotosList/PhotoInfo.jsx";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import PhotoLoading from "./PhotosList/PhotoLoading.jsx";
import DirectoryMenu from "./PhotosList/DirectoryMenu.jsx";
import { openUrl } from '@tauri-apps/plugin-opener';
import { ImgCacheContext, AllPhotosContext } from "./ImgCacheContext.jsx";
import Scrollable from "../Scrollable.jsx";
import fileUrl from "../PathUtil.jsx";
import '../scrollable.css';

function PhotosList(props) {
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

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
        });
    }, [])

    useEffect((e) => {
        setShowSideMenu(false);
        if (props.currentDate != "" && !props.showPhotoDisplay) {
            delete props.datePage[props.currentDate];
            photos.photos = [];
            setPhotosList({ "photos": [] });
            props.setDatePage({});
            const fetchPhotos = async () => getPhotos(undefined, true);;
            setCurrentPhotoIndex(0)
            fetchPhotos().catch(console.error);
            setPhotosListMiniReread(!photosListMiniReread);
            setPhotosListMiniAllPhotos([]);
        }
    }, [numOfPhoto, props.currentDate, sortOfPhotos, starFilter, hasCommentFilter, extensionFilter]);

    useEffect(e => {
        setPhotosListMiniAllPhotos([]);
        setPhotosListMiniCurrentIndex(0);
        setCurrentPhotoPath(undefined);
    }, [props.currentDate])

    function displayPhoto(f, i) {
        setCurrentPhotoPath(f);
        setCurrentPhotoIndex(i)
        props.setShowPhotoDisplay(true);
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
                if (props.dateNum[date] > 0) {
                    props.dateNum[date] -= 1;
                    props.setDateNum(props.dateNum);
                    props.setDateList(props.dateList.concat());
                }

                // exists photo before the deleted photo
                if (date_with_slash === props.currentDate) {
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
        props.setShowPhotoDisplay(false);
        if (props.currentPhotoPath !== "") setCurrentPhotoPath("");
        console.log("photos-list-close-photod-display -- getPhotos")
        const fetchPhotos = async () => getPhotos();
        fetchPhotos().catch(console.error)
    }

    async function getPhotos(e, isForward) {
        setPhotoLoading(true);
        setPhotosList({ "photos": [] });
        let sort = sortOfPhotos;
        let num = numOfPhoto;
        let date;
        if (e && e.currentTarget && e.currentTarget.getAttribute && e.currentTarget.getAttribute("data-date")) {
            date = e.currentTarget.getAttribute("data-date");
        } else {
            date = props.currentDate;
        }
        if (!date || date == "") {
            return;
        }
        let page = props.datePage[date];
        props.setCurrentDate(date)
        if (!page || page == "NaN") {
            page = 1;
        }
        page = parseInt(page);
        await invoke("get_photos_with_filter", {
            dateStr: date,
            sortValue: parseInt(sort),
            page: page,
            num: parseInt(num),
            offset: 0,
            star: parseInt(starFilter, 10),
            hasComment: hasCommentFilter,
            extension: extensionFilter
        }).then((r) => {
            let data = JSON.parse(r);
            let l = data.photos;
            let tags = [];
            if (l.length > 0) {
                setPhotosList(data);
            } else {
                page -= 1;
            }
            props.datePage[date] = page;
            props.setDatePage(props.datePage);
            setPhotoLoading(false);
            setTimeout(() => { setScrollLock(false) }, 200);
        }).catch(e => {
            console.log("in PhotosList.jsx");
            console.log(e);
        });
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
        props.datePage[date] = page;
        props.setDatePage(props.datePage);
        const fetchPhotos = async () => getPhotos(e, isForward)
        fetchPhotos().catch(console.error);
    }

    let beforeScrollTop = -1;
    let isScrollBottom = 0;
    function photosScroll(e) {
        if (scrollLock || props.currentDate === "") {
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
                list.offsetHeight === list.scrollHeight
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
                <div id="photos-display-wrapper" style={{ display: (!photoLoading && props.showPhotoDisplay && currentPhotoPath) ? "block" : "none" }}>
                    <AllPhotosContext.Provider value={{ photosListMiniAllPhotos, setPhotosListMiniAllPhotos }}>
                        <ImgCacheContext.Provider value={{ imgCacheMap, setImgCacheMap }}>
                            <div className="photo-display">
                                <PhotosListMini
                                    moveToTrashCan={moveToTrashCan}
                                    closePhotoDisplay={closePhotoDisplay}
                                    toggleSelection={toggleSelection}
                                    isSelected={isSelected}

                                    setShortCutNavigation={props.setShortCutNavigation}
                                    setShowPhotoDisplay={props.setShowPhotoDisplay}
                                    shortCutNavigation={props.shortCutNavigation}
                                    getPhotos={getPhotos}
                                    currentPhotoPath={currentPhotoPath}
                                    setCurrentPhotoPath={setCurrentPhotoPath}
                                    sortOfPhotos={sortOfPhotos}
                                    currentDate={props.currentDate}
                                    datePage={props.datePage}
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
                    style={{ display: (!photoLoading && (!props.showPhotoDisplay || !currentPhotoPath)) ? "block" : "none" }}
                    data-date={props.currentDate} data-page={props.datePage[props.currentDate]}>
                    <div>
                        {photos.photos.length > 0 ?
                            <div className="photo-list-header">
                                <div className="photo-page-info">{props.currentDate} page:{props.datePage[props.currentDate]}</div>
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
                            {photos.has_prev && props.datePage[props.currentDate] > 1 && 
                                <div className={"row pict-" + iconSize} style={{ flex: "0 0 " + (iconSize / 1 + 41) + "px", maxWidth: iconSize + 'px', minHeight: "80px", textAlign: "center", verticalAlign: "middle" }}>
                                    <img style={{ width: iconSize + 'px' }} src="/scroll-to-load-more.png" />
                                </div>
                            }
                            {photos.photos.map((l, i) => {
                                const image_for_not_found = "/img_error.png";
                                let thumbnailSrc = "";
                                if (l.has_thumbnail) {
                                    if (l.file.name.match(/(mp4|webm)$/i)) {
                                        thumbnailSrc = thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + l.file.name + ".jpg";
                                    } else {
                                        thumbnailSrc = (thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + l.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
                                    }
                                    photosListImgSrc[l.file.path] = convertFileSrc(thumbnailSrc);
                                } else {
                                    photosListImgSrc[l.file.path] = convertFileSrc(l.file.path);
                                }
                                return (
                                    <>
                                        <div key={i} className={"row pict-" + iconSize} style={{ flex: "0 0 " + ((iconSize / 1) + 41) + "px", textAlign: "center", verticalAlign: "middle" }} >
                                            <a href="#" onClick={() => {
                                                setShowSideMenu(false);
                                                displayPhoto(l.file.path, i + (props.datePage[props.currentDate] - 1) * numOfPhoto)
                                            }}>
                                                {!l.has_thumbnail && l.file.path.match(/\.(mp4|webm)$/i)
                                                    ? <div className="photo-list-movie" style={{ minWidth: (iconSize - 20) + 'px', marginTop: (iconSize / 7) + "px" }}>
                                                        <span style={{ fontSize: (iconSize / 3) + 'px' }}>&#127909;</span>
                                                    </div>
                                                    : <div style={{ width: iconSize + 'px', height: iconSize + 'px', float: "left" }} >
                                                        <img loading="eager"
                                                            alt={l.file.path}
                                                            style={{ width: "97%" }}
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
                                            <div className="photo-list-menu">
                                                <input type="checkbox"
                                                    id={"photo-checkbox-" + i}
                                                    checked={photoSelectionDict[l.file.path] ? "checked" : ""}
                                                    onChange={(e) => addSelection(e.target.checked, l.file.path)}
                                                />
                                                <label className={"cneckbox-photo checkbox hover"} htmlFor={"photo-checkbox-" + i}></label><br />
                                                <a href="#" onClick={() => {
                                                    displayPhoto(l.file.path, i + (props.datePage[props.currentDate] - 1) * numOfPhoto)
                                                    setShowSideMenu(true);
                                                }
                                                } >(&#8505;)</a><br />
                                                <a href="#" className="run-app" onClick={(e) => openUrl(fileUrl(l.file.path))}>&#128640;</a>
                                            </div>
                                        </div>
                                        {photos.has_next && (photos.photos.length - 1) == i && <div className={"row pict-" + iconSize} style={{ flex: "0 0 " + (iconSize / 1 + 41) + "px", maxWidth: iconSize + 'px', minHeight: "80px", textAlign: "center", verticalAlign: "middle" }} ><img style={{ width: iconSize + 'px' }} src="/scroll-to-load-more.png" /></div >}
                                    </>
                                )
                            })}
                        </Scrollable>
                    </div>
                    <div className="debug" style={{ display: (debugMessage == "" ? "none" : "block"), backgroundColor: "white", color: "black", position: "absolute", zIndex: "100", bottom: "0px", left: "0px", width: "400px", height: "200px" }}>
                        {debugMessage}
                    </div>
                </div>
            </>
        }
        <div className={(showSideMenu || !currentPhotoPath) ? "rightMenu" : "rightMenu-close"}>
            <div style={{ display: (props.showPhotoDisplay && currentPhotoPath) ? "block" : "none" }}>
                <PhotoInfo
                    setShowSideMenu={setShowSideMenu}
                    showSideMenu={showSideMenu}
                    currentPhotoPath={currentPhotoPath}
                    closePhotoDisplay={closePhotoDisplay}
                    path={currentPhotoPath}
                    addFooterMessage={props.addFooterMessage}
                    imgCacheMap={imgCacheMap}
                    setStar={setStar}
                    star={star}
                />
            </div>
            <div style={{ display: (!props.showPhotoDisplay || !currentPhotoPath) ? "block" : "none" }}>
                <DirectoryMenu
                    addFooterMessage={props.addFooterMessage}
                    tabClass={tabClass}
                    setTabClass={setTabClass}
                    changeTab={changeTab}
                    currentDate={props.currentDate}
                    photoSelection={photoSelection}
                    clearPhotoSelection={clearPhotoSelection}
                    selectAllPhotoToSelection={selectAllPhotoToSelection}
                    dateNum={props.dateNum}
                    setCurrentDateNum={props.setCurrentDateNum}
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
