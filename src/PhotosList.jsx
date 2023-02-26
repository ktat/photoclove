import { useState, useEffect } from "react";
import PhotoDisplay from "./PhotoDisplay.jsx";
import PhotosListMini from "./PhotosListMini.jsx";
import PhotoInfo from "./PhotoInfo.jsx";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import PhotoLoading from "./PhotoLoading.jsx";
import DirectoryMenu from "./DirectoryMenu.jsx";

function PhotosList(props) {
    const [iconSize, setIconSize] = useState(100);
    const [numOfPhoto, setNumOfPhoto] = useState(20);
    const [currentPhotoPath, setCurrentPhotoPath] = useState("");
    const [photos, setPhotosList] = useState({ "photos": [] });
    const [showPhotoDisplay, setShowPhotoDisplay] = useState(false);
    const [scrollLock, setScrollLock] = useState(false);
    const [sortOfPhotos, setSort] = useState(0);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoSelection, setPhotoSelection] = useState([]);
    const [photoSelectionDict, setPhotoSelectionDict] = useState({});

    useEffect((e) => {
        setShowPhotoDisplay(false);
        if (props.currentDate != "") {
            delete props.datePage[props.currentDate];
            photos.photos = [];
            setPhotosList({ "photos": [] });
            props.setDatePage({});
            const fetchPhotos = async () => getPhotos(undefined, true);;
            fetchPhotos().catch(console.error);
        }
    }, [numOfPhoto, props.currentDate, sortOfPhotos, iconSize]);

    function displayPhoto(f) {
        setCurrentPhotoPath(f);
        setShowPhotoDisplay(true);
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
        invoke("move_to_trash", { dateStr: props.currentDate, pathStr: f, sortValue: parseInt(sortOfPhotos) }).then((r) => {
            console.log("target:", r);
            if (!r) {
                closePhotoDisplay();
            } else {
                if (props.currentPhotoPath !== r) setCurrentPhotoPath(r);
            }
        });
    }

    function closePhotoDisplay() {
        setShowPhotoDisplay(false);
        if (props.currentPhotoPath !== "") setCurrentPhotoPath("");
        const fetchPhotos = async () => props.getPhotos();
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
        await invoke("get_photos", { dateStr: date, sortValue: parseInt(sort), page: page, num: parseInt(num) }).then((r) => {
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
            (showPhotoDisplay && currentPhotoPath !== "")
                ?
                <div className="photo-display">
                    <PhotoDisplay
                        moveToTrashCan={moveToTrashCan}
                        closePhotoDisplay={closePhotoDisplay}
                        currentPhotoPath={currentPhotoPath}
                        oad setCurrentPhotoPath={setCurrentPhotoPath}
                        currentDate={props.currentDate}
                        sortOfPhotos={sortOfPhotos}
                        setShortCutNavigation={props.setShortCutNavigation}
                        setShowPhotoDisplay={setShowPhotoDisplay}
                        shortCutNavigation={props.shortCutNavigation}
                        getPhotos={getPhotos}
                    />
                    <PhotosListMini />
                </div>
                :
                <div className="centerDisplay" id="photoList" onWheel={(e) => photosScroll(e)} data-date={props.currentDate} data-page={props.datePage[props.currentDate]}>
                    <div>
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
                    </div>
                    <div className="photos">
                        {photos.photos.map((l, i) => {
                            return (
                                <div key={i} className={"row pict-" + iconSize} style={{ textAlign: "center" }} >
                                    <a href="#" onClick={() => { displayPhoto(l.file.path) }}>
                                        {l.file.path.match(/\.(mp4|webm)$/i)
                                            ? <img style={{ width: "50%" }} src="/video.png" />
                                            : <img loading="eager"
                                                alt={l.file.path}
                                                style={{ maxWidth: iconSize + 'px', maxHeight: iconSize + 'px' }}
                                                src={convertFileSrc(l.file.path)}
                                            />
                                        }
                                    </a>
                                    <div className="photo-list-menu">
                                        <input type="checkbox"
                                            id={"photo-checkbox-" + i}
                                            checked={photoSelectionDict[l.file.path] ? "checked" : ""}
                                            onChange={(e) => addSelection(e.target.checked, l.file.path)}
                                        />
                                        <label className={"cneckbox-photo checkbox hover"} htmlFor={"photo-checkbox-" + i}></label><br />
                                        <a href="#" onClick={() => setCurrentPhotoPath(l.file.path)} >(&#8505;)</a>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
        }
        {
            currentPhotoPath
                ?
                <PhotoInfo
                    moveToTrashCan={moveToTrashCan}
                    currentPhotoPath={currentPhotoPath}
                    closePhotoDisplay={closePhotoDisplay}
                    path={currentPhotoPath}
                    addFooterMessage={props.addFooterMessage}
                    setCurrentPhotoPath={setCurrentPhotoPath}
                />
                :
                <DirectoryMenu
                    tabClass={tabClass}
                    setTabClass={setTabClass}
                    changeTab={changeTab}
                    currentDate={props.currentDate}
                    photoSelection={photoSelection}
                    clearPhotoSelection={clearPhotoSelection}
                    selectAllPhotoToSelection={selectAllPhotoToSelection}
                    dateNum={props.dateNum}
                    setCurrentDateNum={props.setCurrentDateNum}
                />
        }
    </>
}

export default PhotosList;
