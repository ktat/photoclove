import { useState, useEffect } from "react";
import PhotosListMini from "./PhotosList/PhotosListMini.jsx";
import PhotoInfo from "./PhotosList/PhotoInfo.jsx";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import PhotoLoading from "./PhotosList/PhotoLoading.jsx";
import DirectoryMenu from "./PhotosList/DirectoryMenu.jsx";
import { open } from '@tauri-apps/api/shell';

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

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
        });
    }, [])

    useEffect((e) => {
        if (props.currentDate != "" && !props.showPhotoDisplay) {
            delete props.datePage[props.currentDate];
            photos.photos = [];
            setPhotosList({ "photos": [] });
            props.setDatePage({});
            const fetchPhotos = async () => getPhotos(undefined, true);;
            fetchPhotos().catch(console.error);
        }
    }, [numOfPhoto, props.currentDate, sortOfPhotos]);

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
        if (e && e.currentTarget && e.currentTarget.getAttribute("data-date")) {
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
        await invoke("get_photos", { dateStr: date, sortValue: parseInt(sort), page: page, num: parseInt(num), offset: 0 }).then((r) => {
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
            console.log(e)
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
        const list = document.querySelector(".photos");
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
        {photoLoading
            ?
            <PhotoLoading />
            :
            (props.showPhotoDisplay && currentPhotoPath !== "")
                ?
                <div className="photo-display">
                    <PhotosListMini
                        moveToTrashCan={moveToTrashCan}
                        closePhotoDisplay={closePhotoDisplay}

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

                        reread={photosListMiniReread}
                        allPhotos={photosListMiniAllPhotos}
                        setAllPhotos={setPhotosListMiniAllPhotos}
                        currentIndex={photosListMiniCurrentIndex}
                        setCurrentIndex={setPhotosListMiniCurrentIndex}
                    />
                </div>
                :
                <div className="centerDisplay" id="photoList" onWheel={(e) => photosScroll(e)} data-date={props.currentDate} data-page={props.datePage[props.currentDate]}>
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
                                    </select>
                                </div>
                            </div>
                            : <>No Photo Found!</>
                        }
                        <div className="photos">
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
                                    <div key={i} className={"row pict-" + iconSize} style={{ textAlign: "center" }} >
                                        <a href="#" onClick={() => { displayPhoto(l.file.path, i + (props.datePage[props.currentDate] - 1) * numOfPhoto) }}>
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
                                            <a href="#" onClick={() => setCurrentPhotoPath(l.file.path)} >(&#8505;)</a><br />
                                            <a href="#" className="run-app" onClick={(e) => open("file://" + l.file.path)}>&#128640;</a>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div >
        }
        {
            currentPhotoPath
                ?
                <PhotoInfo
                    currentPhotoPath={currentPhotoPath}
                    closePhotoDisplay={closePhotoDisplay}
                    path={currentPhotoPath}
                    addFooterMessage={props.addFooterMessage}
                    setCurrentPhotoPath={setCurrentPhotoPath}
                />
                :
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
                />
        }
    </>
}

export default PhotosList;
