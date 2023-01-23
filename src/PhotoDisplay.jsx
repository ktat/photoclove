import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import { tauri } from "@tauri-apps/api";

function PhotoDisplay(props) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
    const [scrollLock, setScrollLock] = useState(false);
    const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");
    const [photoZoom, setPhotoZoom] = useState("100%");
    const [photoZoomReady, setPhotoZoomReady] = useState(false);
    const [currentPhotoPath, setCurrentPhotoPath] = useState("");

    const loaded = false;
    useEffect((e) => {
        console.log("photoDisplay loaded");
        document.querySelector("#dummy-for-focus").focus();
        setCurrentPhotoPath(props.currentPhotoPath);
    }, [loaded]);

    useEffect((e) => {
        console.log(props.currentPhotoPath);
    }, [props]);

    function dragPhotoStart(e) {
        setPhotoDisplayImgClass("photo_dragging");
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }

    function photoNavigation(e) {
        console.log("keyDown");
        console.log(e.keyCode);
        let f = currentPhotoPath;
        if (e.keyCode === 39) { // right arrow
            nextPhoto(f);
        } else if (e.keyCode === 37) { // left arrow
            prevPhoto(f);
        } else if (e.keyCode === 46) { // Del
            moveToTrashCan(f)
        } else if (e.ctrlKey && e.keyCode === 48) { // ctrl+0
            setPhotoZoom("100%");
            document.querySelector("#dummy-for-focus").focus();
        } else if (e.ctrlKey) {
            console.log("ready");
            setPhotoZoomReady(true);
        }
    }

    function photoNavigationUp(e) {
        console.log("keyUp");
        console.log(e.keyCode);
        if (e.ctrlKey) {
            console.log("release");
            setPhotoZoomReady(false);
        }
    }

    async function prevPhoto(f) {
        await invoke("get_prev_photo", { path: f, dateStr: props.currentDate, sortValue: parseInt(props.sortOfPhotos) }).then((r) => {
            if (r !== "") {
                setPhotoZoom("100%");
                setCurrentPhotoPath(r);
            }
        });
    }

    async function nextPhoto(f) {
        await invoke("get_next_photo", { path: f, dateStr: props.currentDate, sortValue: parseInt(props.sortOfPhotos) }).then((r) => {
            if (r !== "") {
                setPhotoZoom("100%");
                setCurrentPhotoPath(r);
                console.log([r, currentPhotoPath]);
            }
        });
    }

    function moveToTrashCan(f, set) {
        console.log("delete file: " + f)
        invoke("move_to_trash", { dateStr: props.currentDate, pathStr: f, sortValue: parseInt(props.sortOfPhotos) }).then((r) => {
            console.log("target:", r);
            if (!r) {
                closePhotoDisplay();
            } else {
                setCurrentPhotoPath(r);
            }
        });
    }

    // TODO: not correct scroll adjustment.
    function photoScroll(e) {
        if (scrollLock || !photoZoomReady) {
            return;
        }
        setScrollLock(true);
        let zoom = parseInt(photoZoom.replace("%", ""));

        const imgTag = document.querySelector(".photo img");
        const display = e.currentTarget.parentElement;

        const x = e.clientX - imgTag.offsetLeft + display.scrollLeft;
        const y = e.clientY - imgTag.offsetTop + display.scrollTop;

        const xPos = x / imgTag.width;
        const yPos = y / imgTag.height;

        if (e.deltaY > 0) {
            zoom -= 10;
            if (zoom <= 100) {
                zoom = 100;
            }
        } else {
            zoom += 10;
        }

        setPhotoZoom(zoom + "%");
        console.log(zoom);

        const sTop = (imgTag.height * yPos - display.clientHeight * yPos);
        const sLeft = (imgTag.width * xPos - display.clientWidth * xPos);
        display.scrollTop = sTop - sTop % (50 * zoom / 200);
        display.scrollLeft = sLeft - sLeft % (50 * zoom / 200);

        setTimeout(() => { setScrollLock(false) }, 100);
        window.onscroll = function () { };
    }

    function dragPhoto(e) {
        if (dragPhotoInfo.is_dragging) {
            let x = e.clientX - dragPhotoInfo.x;
            let y = e.clientY - dragPhotoInfo.y;
            let display = e.currentTarget.parentElement;
            display.scrollTop -= y / 20;
            display.scrollLeft -= x / 20;
        } else {
            /*
            console.log(e.clientY - document.getElementsByClassName("photo")[0].children[0].offsetTop);
            console.log(e.clientX - document.getElementsByClassName("photo")[0].children[0].offsetLeft);
            console.log([e.clientX, e.clientY])
            */
        }
    }

    function closePhotoDisplay() {
        props.setShowPhotoDisplay(false);
        props.getPhotos();
        props.setCurrentPhotoPath("");
    }

    function dragPhotoEnd(e) {
        setPhotoDisplayImgClass("");
        setDragPhotoInfo({});
    }

    return (
        <div
            className="photoDisplay"
            id="photoDisplay"
            autoFocus={true}
            onKeyDown={(e) => photoNavigation(e)}
            onKeyUp={(e) => photoNavigationUp(e)}
        >
            <p>Photo Viewer</p>
            <a href="#" id="dummy-for-focus">{/* Dummy */}</a>
            <a href="#" onClick={() => prevPhoto(currentPhotoPath)}>&lt;&lt; prev</a>&nbsp;&nbsp;
            || <a href="#" onClick={() => closePhotoDisplay()}>close</a> ||&nbsp;&nbsp;
            <a href="#" onClick={() => nextPhoto(currentPhotoPath)}>next &gt;&gt;</a><br /><br />
            <a href="#" onClick={() => moveToTrashCan(currentPhotoPath)}>&#128465;</a>
            <div className="photo">
                <img className={photoDisplayImgClass}
                    src={convertFileSrc(currentPhotoPath)}
                    width={photoZoom}
                    onMouseDown={(e) => dragPhotoStart(e)}
                    onMouseMove={(e) => dragPhoto(e)}
                    onMouseUp={(e) => dragPhotoEnd(e)}
                    onWheel={(e) => photoScroll(e)} />
            </div>
        </div>
    );
}

export default PhotoDisplay;

