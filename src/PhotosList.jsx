import { useState, useEffect } from "react";
import PhotoDisplay from "./PhotoDisplay.jsx";
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

    useEffect((e) => {
        setShowPhotoDisplay(false);
        if (props.currentDate != "") {
            delete props.datePage[props.currentDate];
            photos.photos = [];
            setPhotosList({ "photos": [] });
            props.setDatePage({});
            const fetchPhotos = async () => getPhotos(undefined, true);;
            fetchPhotos().catch(console.error);
            setCurrentPhotoPath(undefined);
        }
    }, [numOfPhoto, props.currentDate, sortOfPhotos, iconSize]);

    function displayPhoto(f) {
        setCurrentPhotoPath(f);
        setShowPhotoDisplay(true);
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

    function photosScroll(e) {
        if (scrollLock || props.currentDate === "") {
            return;
        }

        let isForward = true;
        if (e.deltaY < 0) {
            isForward = false;
        }
        if ((isForward && photos.has_next) || (!isForward && photos.has_prev)) {
            setScrollLock(true);
            nextPhotosList(e, isForward)
        }
    }

    if (showPhotoDisplay) {
        return (
            <>
                < PhotoDisplay
                    currentPhotoPath={currentPhotoPath}
                    setCurrentPhotoPath={setCurrentPhotoPath}
                    currentDate={props.currentDate}
                    sortOfPhotos={sortOfPhotos}
                    setShortCutNavigation={props.setShortCutNavigation}
                    setShowPhotoDisplay={setShowPhotoDisplay}
                    shortCutNavigation={props.shortCutNavigation}
                    getPhotos={getPhotos}
                />
                <PhotoInfo path={currentPhotoPath} addFooterMessage={props.addFooterMessage} />
            </>
        );
    } else {
        if (!photoLoading) {
            return (<>
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
                                <div key={i} className="row" style={
                                    {
                                        minWidth: (parseInt(iconSize || 100) + 20) + "px",
                                        maxWidth: (parseInt(iconSize || 100) + 20) + "px"
                                    }
                                }>
                                    <a href="#" onClick={() => { displayPhoto(l.file.path) }}>
                                        <img loading="lazy" alt={l.file.path} style={{ maxWidth: iconSize + 'px', maxHeight: iconSize + 'px' }} src={convertFileSrc(l.file.path)} />
                                    </a>
                                    <a href="#" onClick={() => setCurrentPhotoPath(l.file.path)} >(&#8505;)</a>
                                </div>)
                        })}
                    </div>
                </div>
                <DirectoryMenu
                    currentDate={props.currentDate}
                />
            </>)
        } else {
            return <><PhotoLoading /><DirectoryMenu /></>
        }
    }
}

export default PhotosList;
