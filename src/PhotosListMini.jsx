import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";

const NUM_OF_PHOTO_LIST = 9;

function PhotosListMini(props) {
    const [allPhotos, setAllPhotos] = useState([]);
    const [showPhotos, setShowPhotos] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [borderStyle, setBorderStyle] = useState([]);
    useEffect((e) => {
        const page = props.datePage[props.currentDate];
        if (hasNext || allPhotos.length === 0) {
            getPhotos();
        }
        let index = props.currentPhotoIndex - Math.trunc(NUM_OF_PHOTO_LIST / 2);
        if (allPhotos.length - index < NUM_OF_PHOTO_LIST) {
            index = allPhotos.length - NUM_OF_PHOTO_LIST;
        }
        if (index < 0) {
            index = 0;
        }
        setSetOfShowPhotos(index);
    }, [props.currentPhotoIndex]);

    function backwardPhotos() {
        if (currentIndex < 1) {
            return;
        }
        _movePhotos(currentIndex - 1)
    }

    function forwardPhotos() {
        if ((allPhotos.length - currentIndex) <= NUM_OF_PHOTO_LIST) {
            if (hasNext) {
                getPhotos();
            } else {
                return;
            }
        }
        _movePhotos(currentIndex + 1)
    }

    function getPhotos() {
        let num = allPhotos.length === 0 ? props.currentPhotoIndex + NUM_OF_PHOTO_LIST * 2 : NUM_OF_PHOTO_LIST * 2;
        invoke("get_photos", {
            dateStr: props.currentDate,
            sortValue: props.sortOfPhotos,
            page: 1,
            num: num,
            offset: allPhotos.length,
        }).then((r) => {
            let index = currentIndex;
            let data = JSON.parse(r);
            let mergedAllPhotos;

            if (data.photos.length > 0) {
                mergedAllPhotos = allPhotos.concat(data.photos);
                setAllPhotos(mergedAllPhotos);
            }

            setHasNext(data.has_next)

            if (props.currentPhotoIndex > Math.trunc(NUM_OF_PHOTO_LIST / 2)) {
                index = props.currentPhotoIndex - Math.trunc(NUM_OF_PHOTO_LIST / 2);
            }
            if ((mergedAllPhotos.length - index) < NUM_OF_PHOTO_LIST) {
                index = mergedAllPhotos.length - NUM_OF_PHOTO_LIST;
            }
            setSetOfShowPhotos(index, mergedAllPhotos);
            setBorderStyle(borderStyle);
        });
    }

    function setSetOfShowPhotos(index, mergedAllPhotos) {
        setCurrentIndex(index);
        if (!mergedAllPhotos) {
            mergedAllPhotos = allPhotos;
        }
        const photos = [];
        let selected = -1;
        for (let i = index; i < (NUM_OF_PHOTO_LIST + index); i++) {
            if (mergedAllPhotos[i]) {
                if (i === props.currentPhotoIndex) {
                    selected = photos.length;
                }
                photos.push(mergedAllPhotos[i]);
            }
        }
        setShowPhotos(photos);
        resetSelectedBorder(selected);
    }

    function _movePhotos(index) {
        setCurrentIndex(index);
        const photos = [];
        let selected = -1;
        for (let i = index; i < (NUM_OF_PHOTO_LIST + index); i++) {
            if (allPhotos[i]) {
                if (i === props.currentPhotoIndex) {
                    selected = photos.length;
                }
                photos.push(allPhotos[i]);
            }
        }
        setShowPhotos(photos);
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

    return (
        <div id="photos-list-mini">
            <div className="row1"><a style={{ display: currentIndex == 0 ? "none" : "" }} onClick={() => { backwardPhotos() }}>◁</a></div>
            {
                showPhotos.map((v, i) => {
                    const clientHeight = document.querySelector('#photos-list-mini').clientHeight - 20;
                    return <div className="row2" key={i}>
                        <a onClick={(e) => {
                            props.setCurrentPhotoPath(v.file.path);
                            props.setCurrentPhotoIndex(currentIndex + i);
                            props.datePage[props.currentDate] = Math.trunc((currentIndex + i) / props.num) + 1;
                        }}>
                            {v.file.path.match(/\.(mp4|webm)$/i)
                                ? <div className="photo-list-movie" style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }}>
                                    <span>&#127909;</span>
                                </div>
                                : <img src={convertFileSrc(v.file.path)} style={{ border: borderStyle[i], maxHeight: clientHeight + "px" }} alt={"photo-" + i} />
                            }
                        </a>
                    </div>
                })
            }
            <div className="row1"><a style={{ display: (!hasNext && (allPhotos.length - currentIndex) <= NUM_OF_PHOTO_LIST) ? "none" : "" }} onClick={() => { forwardPhotos() }}>▷</a></div>
        </div >
    )
}

export default PhotosListMini;