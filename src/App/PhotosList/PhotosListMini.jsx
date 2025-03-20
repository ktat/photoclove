import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import PhotoDisplay from "./PhotosListMini/PhotoDisplay.jsx";

const NUM_OF_PHOTO_LIST = 9;

function preventScroll(e) {
    e.preventDefault();
}

function PhotosListMini(props) {
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
    const [imgCache, setImgCache] = useState([])

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setThumbnailStore(json.thumbnail_store);
        });
    }, [])

    useEffect((e) => {
        const page = props.datePage[props.currentDate];
        let currentPhotoIndex = props.currentPhotoIndex;
        let l = props.allPhotos.length;
        if (l === 0 || (hasNext && l - currentPhotoIndex < NUM_OF_PHOTO_LIST) || l < currentPhotoIndex) {
            getPhotos();
        } else {
            adjustCurrentIndex(props.allPhotos);
        }
    }, [props.currentPhotoIndex, props.reread]);

    function backwardPhotos() {
        if (props.currentIndex < 1) {
            return;
        }
        _movePhotos(props.currentIndex - 1)
    }

    function forwardPhotos() {
        if ((props.allPhotos.length - props.currentIndex) <= NUM_OF_PHOTO_LIST) {
            if (hasNext) {
                getPhotos();
            } else {
                return;
            }
        }
        _movePhotos(props.currentIndex + 1)
    }

    async function setImageCache(links) {
        for (let i = 0; i < links.length; i++) {
            if (links[i].match(/\.jpe?g/i) && !props.imgCacheMap[links[i]]) {
                const response = await fetch(convertFileSrc(links[i]), { cache: "force-cache" });
                const blob = await response.blob();
                const objectURL = URL.createObjectURL(blob);
                props.imgCacheMap[links[i]] = [objectURL];
                imgCache.push(links[i]);
                invoke("get_photo_info", { pathStr: links[i] }).then((r) => {
                    props.imgCacheMap[links[i]][1] = JSON.parse(r);
                })
            }
        }
        while (imgCache.length > 5) {
            const shifted = imgCache.shift();
            delete props.imgCacheMap[shifted];
        }
        props.setImgCacheMap(props.imgCacheMap)
        setImgCache(imgCache)
    }

    function _movePhotos(index) {
        props.setCurrentIndex(index);
        const photosIndex = [];
        let selected = -1;
        for (let i = index; i < (NUM_OF_PHOTO_LIST + index); i++) {
            if (props.allPhotos[i]) {
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
        let num = props.allPhotos.length === 0 ? props.currentPhotoIndex + NUM_OF_PHOTO_LIST * 2 : NUM_OF_PHOTO_LIST * 2;
        invoke("get_photos", {
            dateStr: props.currentDate,
            sortValue: props.sortOfPhotos,
            page: 1,
            num: num,
            offset: props.allPhotos.length,
        }).then((r) => {
            let index = props.currentIndex;
            let data = JSON.parse(r);
            let mergedAllPhotos;

            if (data.photos.length > 0) {
                mergedAllPhotos = props.allPhotos.concat(data.photos);
                props.setAllPhotos(mergedAllPhotos);
            }

            setHasNext(data.has_next);
            adjustCurrentIndex(mergedAllPhotos);
        });
    }
    function adjustCurrentIndex(allPhotos) {
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
            mergedAllPhotos = props.allPhotos;
        } else {
            props.setAllPhotos(mergedAllPhotos);
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

    function photoNavigation(e) {
        let f = props.currentPhotoPath;
        if (e.keyCode === 39) { // right arrow
            nextPhoto();
        } else if (e.keyCode === 37) { // left arrow
            prevPhoto();
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
        const photoSpaceHeight = document.querySelector('.photo').clientHeight;
        const photoSpaceWidth = document.querySelector('.photo').clientWidth;
        const st = {
            transition: 'opacity 0.1s',
        }
        Object.keys(style).map((k) => {
            st[k] = style[k];
        })
        if (currentPhotoSize[0] || w) {
            if ((currentPhotoSize[0] || w) > (currentPhotoSize[1] || h)) {
                let adjustH = photoSpaceWidth * (currentPhotoSize[1] || h) / (currentPhotoSize[0] || w);
                if (adjustH > photoSpaceHeight) {
                    st["maxWidth"] = "calc(" + photoSpaceWidth * (photoSpaceHeight / adjustH) + "px - 20px)";
                } else {
                    st["maxWidth"] = "calc(" + photoSpaceWidth + "px - 10px)";
                }
                st["transition"] += ", maxWidth 0.7s";
            } else {
                st["maxHeight"] = "calc(" + photoSpaceHeight + "px - 10px)";
                st["transition"] += ", maxHeight 0.7s";
            }
        } else {
            st["maxWidth"] = "100%";
            st["maxHeight"] = "100%";
            st["transition"] += ", maxWidth 0.7s";
            st["transition"] += ", maxHeight 0.7s";
        }
        setImgStyle(st);
    }

    async function prevPhoto(f) {
        const prevIndex = props.currentPhotoIndex - 1;
        if (prevIndex >= 0) {
            let rels = []
            for (let i = - 1; i < -4 && prevIndex + i > 0; i--) {
                if (props.allPhotos[prevIndex + i] && props.allPhotos[prevIndex + i].file) {
                    rels.push(props.allPhotos[prevIndex + i].file.path)
                }
            }
            if (props.currentIndex > 0 && (props.allPhotos.length - prevIndex) > Math.trunc(NUM_OF_PHOTO_LIST / 2)) {
                props.setCurrentIndex(props.currentIndex - 1)
            }
            _nextOrPrevPhoto(prevIndex);
            setImageCache(rels).then(() => { })
        }
    }

    async function nextPhoto() {
        const nextIndex = props.currentPhotoIndex + 1;
        if (props.allPhotos.length > nextIndex) {
            let rels = []
            for (let i = 1; i < 4 && i < props.allPhotos.length; i++) {
                if (props.allPhotos[nextIndex + i] && props.allPhotos[nextIndex + i].file) {
                    rels.push(props.allPhotos[nextIndex + i].file.path)
                }
            }
            if (nextIndex > Math.trunc(NUM_OF_PHOTO_LIST / 2)) {
                props.setCurrentIndex(props.currentIndex + 1)
            }
            _nextOrPrevPhoto(nextIndex);
            setImageCache(rels).then(() => { })
        }
    }

    function _nextOrPrevPhoto(index) {
        SetImgStyle({ opacity: 0 });
        setPhotoZoom("auto");
        props.setCurrentPhotoPath(props.allPhotos[index].file.path);
        props.datePage[props.currentDate] = Math.trunc((index) / props.num) + 1;
        props.setCurrentPhotoIndex(index);
    }

    function getThumbnailSrc(photo) {
        let thumbnailSrc = "";
        if (photo && photo.has_thumbnail) {
            if (photo.file.name.match(/(mp4|webm)$/i)) {
                thumbnailSrc = thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + photo.file.name + ".jpg";
            } else {
                thumbnailSrc = (thumbnailStore + '/' + props.currentDate.replace(/\//g, '-') + '/' + photo.file.name).replace(/\.([a-zA-Z]+)$/, '.') + RegExp.$1.toLowerCase();
            }
        }
        return thumbnailSrc;
    }

    return (
        <>
            <div className="centerDisplay">

                <div
                    className="photoDisplay"
                    id="photoDisplay"
                    autoFocus={true}
                    onKeyDown={(e) => photoNavigation(e)}
                    onKeyUp={(e) => photoNavigationUp(e)}
                >
                    <a href="#" id="dummy-for-focus">{/* Dummy */}</a>
                    {props.currentPhotoIndex > 0 ? <><a href="#" onClick={() => prevPhoto()}>&lt;&lt; prev</a><></>&nbsp;&nbsp;|| </> : <>&lt;&lt; <s>prev</s>&nbsp;&nbsp;|| </>}
                    <a href="#" onClick={() => props.closePhotoDisplay()}>close</a>
                    {props.currentPhotoIndex < (props.allPhotos.length - 1) ? <> ||&nbsp;&nbsp;<a href="#" onClick={() => nextPhoto()}>next &gt;&gt;</a><br /><br /></> : <>||&nbsp;&nbsp;<s>next</s> &gt;&gt;</>}

                    <PhotoDisplay
                        imgStyle={imgStyle}
                        SetImgStyle={SetImgStyle}
                        setPhotoZoom={setPhotoZoom}
                        photoZoom={photoZoom}
                        photoZoomReady={photoZoomReady}
                        currentPhotoPath={props.currentPhotoPath}
                        currentPhotoSize={currentPhotoSize}
                        imgCacheMap={props.imgCacheMap}
                        thumbnailSrc={getThumbnailSrc(props.allPhotos[props.currentPhotoIndex])}
                    />
                </div>
                <div id="photos-list-mini">
                    <div className="row1"><a style={{ display: props.currentIndex == 0 ? "none" : "" }} onClick={() => { backwardPhotos() }}>◁</a></div>
                    {
                        showPhotosIndex.map((vIndex, i) => {
                            let v = props.allPhotos[vIndex];
                            if (!v) {
                                vIndex -= 1;
                                v = props.allPhotos[vIndex];
                            }
                            const clientHeight = document.querySelector('#photos-list-mini').clientHeight - 20;
                            const thumbnailSrc = getThumbnailSrc(v);
                            // console.log(v.file.path + " : " + v.has_thumbnail);
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
                                }}>
                                    {!v.has_thumbnail && v.file.path.match(/\.(mp4|webm)$/i)
                                        ? <div className="photo-list-movie" style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }}>
                                            <span>&#127909;</span>
                                        </div>
                                        : <>
                                            <img src={photosListImgSrc[v.file.path]} style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }} alt={"photo-" + i}
                                                onError={(e) => { e.target.src = "/img_error.png" }} />
                                            {v.file.path.match(/\.(mp4|webm)$/i) && <div style={{ color: "white", position: "relative", top: clientHeight / -4 }}>&#x25b6;</div>}
                                        </>
                                    }
                                </a>
                            </div>
                        })
                    }
                    <div className="row1"><a style={{ display: (!hasNext && (props.allPhotos.length - props.currentIndex) <= NUM_OF_PHOTO_LIST) ? "none" : "" }} onClick={() => { forwardPhotos() }}>▷</a></div>
                </div >
            </div>
        </>
    )
}

export default PhotosListMini;
