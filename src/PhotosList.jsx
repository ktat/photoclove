import { useState, useEffect } from "react";
import PhotoDisplay from "./PhotoDisplay.jsx";
import PhotoInfo from "./PhotoInfo.jsx";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";

function PhotosList(props) {
    const [icon_size, setIconSize] = useState(100);
    const [num_of_photo, setNumOfPhoto] = useState(20);
    const [currentPhotoPath, setCurrentPhotoPath] = useState("");
    const [photos, setPhotosList] = useState({ "files": [] });
    const [showPhotoDisplay, setShowPhotoDisplay] = useState(false);
    const [scrollLock, setScrollLock] = useState(false);
    const [sortOfPhotos, setSort] = useState(0);

    useEffect((e) => {
        setShowPhotoDisplay(false);
        if (props.currentDate != "") {
            delete props.datePage[props.currentDate];
            photos.files = [];
            setPhotosList({ "files": [] });
            props.setDatePage({});
            getPhotos(undefined, true);
        }
    }, [num_of_photo, props.currentDate, sortOfPhotos, icon_size]);

    function displayPhoto(f) {
        setCurrentPhotoPath(f);
        setShowPhotoDisplay(true);
    }

    async function getPhotos(e, isForward) {
        props.setPhotoLoading(true);
        setPhotosList({ files: [] });
        let sort = sortOfPhotos;
        let num = num_of_photo;
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
            let l = data.files;
            let tags = [];
            if (l.length > 0) {
                setPhotosList(data);
            } else {
                page -= 1;
            }
            props.datePage[date] = page;
            props.setDatePage(props.datePage);
            props.setPhotoLoading(false);
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
        getPhotos(e, isForward)
    }

    function changeSort(e, value) {
        setSort(value);
    }

    function changeNumOfPhoto(e, value) {
        console.log("set: " + value);
        setNumOfPhoto(value)
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
                    currentDate={props.currentDate}
                    sortOfPhotos={sortOfPhotos}
                    setShortCutNavigation={props.setShortCutNavigation}
                    setShowPhotoDisplay={setShowPhotoDisplay}
                    shortCutNavigation={props.shortCutNavigation}
                />
                <PhotoInfo path={currentPhotoPath} />
            </>
        );
    } else {
        return (<>
            <div className="centerDisplay" id="photoList" onWheel={(e) => photosScroll(e)} data-date={props.currentDate} data-page={props.datePage[props.currentDate]}>
                <div>
                    List of Photos
                    <div className="photoPageInfo">{props.currentDate} page:{props.datePage[props.currentDate]}</div>
                    <div className="photoOperation">
                        Icon:<select name="icon_size" defaultValue="100" onChange={(e) => setIconSize(e.target.value)}>
                            <option value={50}>small</option>
                            <option value={100}>normal</option>
                            <option value={200}>large</option>
                            <option value={300}>huge</option>
                        </select>
                        Sort:<select name="sort" onChange={(e) => changeSort(e, e.target.value)}>
                            <option value={0}>photo time</option>
                            <option value={1}>time</option>
                            <option value={2}>name</option>
                        </select>
                        Num:<select name="num" defaultValue="20" onChange={(e) => changeNumOfPhoto(e, e.target.value)}>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={30}>30</option>
                            <option value={40}>40</option>
                        </select>
                    </div>
                </div>
                <div className="navigation">
                    {photos.has_prev && (<span><a href="#" onClick={(e) => nextPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
                    {photos.has_next && (<span><a href="#" onClick={(e) => nextPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}
                </div>
                <div className="photos">
                    {photos.files.map((l, i) => {
                        return <li key={i}><a href="#" onClick={() => { displayPhoto(l.file.path) }}><img style={{ maxWidth: icon_size + 'px', maxHeight: icon_size + 'px' }} src={convertFileSrc(l.file.path)} /></a>
                            <a href="#" onClick={() => getPhotoInfo(l.file.path)} >(&#8505;)</a></li>
                    })}
                </div>
            </div>
            <PhotoInfo />
        </>)
    }
}

export default PhotosList;
