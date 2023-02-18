import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { useEffect, useState } from "react";
import ReactPlayer from 'react-player';
import { open } from '@tauri-apps/api/shell';
import { tauri } from "@tauri-apps/api";

let currentFile = "";

function PhotoDisplay(props) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
    const [scrollLock, setScrollLock] = useState(false);
    const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");
    const [photoZoom, setPhotoZoom] = useState("100%");
    const [photoZoomReady, setPhotoZoomReady] = useState(false);
    const [opacity, setOpacity] = useState(0.5);
    const [videoSource, setVideoSource] = useState("");
    const [videoClass, setVideoClass] = useState("video-off");

    useEffect((e) => {
        currentFile = "";
        document.querySelector("#dummy-for-focus").focus();
    }, []);

    useEffect((e) => {
        if (props.currentPhotoPath.match(/(mp4|webm)$/i)) {
            movie(props.currentPhotoPath);
            setVideoClass("video-on")
        } else {
            setVideoClass("video-off")
        }
    }, [props.currentPhotoPath]);

    function dragPhotoStart(e) {
        setPhotoDisplayImgClass("photo_dragging");
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }

    function photoNavigation(e) {
        console.log("keyDown");
        console.log(e.keyCode);
        let f = props.currentPhotoPath;
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
            setPhotoZoomReady(true);
        }
    }

    async function movie(path) {
        if (currentFile != path) {
            invoke("lock", { t: false }).then(async (r) => {
                // tauri cannot play movie file which is not in public folder. So copy movie file to public/movie
                const result = await invoke("copy_file_to_public", { fromFilePath: path, toFileName: "movie.tmp" }).then((r) => {
                    let videoPath = "/movie.tmp?" + path;
                    currentFile = path;
                    // I don't know why it works only when set twice sometime.
                    setVideoSource("#");
                    // I don't know why react player require waiting for a while to play video correctly.
                    setTimeout(() => {
                        setVideoSource(videoPath);
                    }, 100);
                });
            })
        }
        return true;
    }

    function photoNavigationUp(e) {
        console.log("keyUp");
        console.log(e.keyCode);
        if (e.ctrlKey) {
            setPhotoZoomReady(false);
        }
    }

    async function prevPhoto(f) {
        setOpacity(0.5);
        await invoke("get_prev_photo", { path: f, dateStr: props.currentDate, sortValue: parseInt(props.sortOfPhotos) }).then((r) => {
            if (r !== "") {
                setPhotoZoom("100%");
                if (props.currentPhotoPath !== r) props.setCurrentPhotoPath(r);
            }
        });
    }

    async function nextPhoto(f) {
        setOpacity(0.5);
        await invoke("get_next_photo", { path: f, dateStr: props.currentDate, sortValue: parseInt(props.sortOfPhotos) }).then((r) => {
            if (r !== "") {
                setPhotoZoom("100%");
                if (props.currentPhotoPath !== r) props.setCurrentPhotoPath(r);
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
                if (props.currentPhotoPath !== r) props.setCurrentPhotoPath(r);
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
        if (props.currentPhotoPath !== "") props.setCurrentPhotoPath("");
        const fetchPhotos = async () => props.getPhotos();
        fetchPhotos().catch(console.error)
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
            <a href="#" id="dummy-for-focus">{/* Dummy */}</a>
            <a href="#" onClick={() => prevPhoto(props.currentPhotoPath)}>&lt;&lt; prev</a>&nbsp;&nbsp;
            || <a href="#" onClick={() => closePhotoDisplay()}>close</a> ||&nbsp;&nbsp;
            <a href="#" onClick={() => nextPhoto(props.currentPhotoPath)}>next &gt;&gt;</a><br /><br />
            <a href="#" onClick={() => moveToTrashCan(props.currentPhotoPath)}>&#128465;</a>
            <div className="photo">
                {/* video doesn't work for local failes: https://github.com/tauri-apps/tauri/issues/3725#issuecomment-1160842638

                    <video style={{ width: "100%", height: "100%" }} controls="" autoPlay="" name="media">
                        <source src={convertFileSrc(props.currentPhotoPath)} type={"video/" + (props.currentPhotoPath.match(/\.mp4$/) ? "mp4" : "webm")} />
                    </video>

                */}
                <div className={videoClass}>
                    <ReactPlayer
                        width="100%"
                        height="100%"
                        controls
                        url={videoSource}
                    />
                    Open with other software: <a href="#" onClick={(e) => open("file://" + props.currentPhotoPath)}>{props.currentPhotoPath}</a>
                </div>
                {!props.currentPhotoPath.match(/\.(mp4|webm)$/i) &&
                    <img className={photoDisplayImgClass}
                        onLoad={() => {
                            setTimeout(() => {
                                setOpacity(1);
                            }, 150)
                        }
                        }
                        style={{
                            transition: 'opacity 0.5s',
                            opacity: opacity,
                        }}
                        src={convertFileSrc(props.currentPhotoPath)}
                        width={photoZoom}
                        onMouseDown={(e) => dragPhotoStart(e)}
                        onMouseMove={(e) => dragPhoto(e)}
                        onMouseUp={(e) => dragPhotoEnd(e)}
                        onWheel={(e) => photoScroll(e)}
                    />
                }
            </div>
        </div>
    );
}

export default PhotoDisplay;
