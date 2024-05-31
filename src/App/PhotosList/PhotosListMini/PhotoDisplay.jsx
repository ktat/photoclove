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
    const [videoSource, setVideoSource] = useState("");
    const [videoClass, setVideoClass] = useState("video-off");

    useEffect((e) => {
        currentFile = "";
        document.querySelector("#dummy-for-focus").focus();
    }, []);

    useEffect((e) => {
        props.SetImgStyle({ opacity: 0.5 });
        document.querySelector("#dummy-for-focus").focus();
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

    async function movie(path) {
        if (currentFile != path) {
            invoke("lock", { t: false }).then(async (r) => {
                // tauri cannot play movie file which is not in public folder. So copy movie file to public/movie
                const result = await invoke("link_file_to_public", {
                    fromFilePath: path,
                    toFileName: "movie.tmp"
                }).then((r) => {
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

    // TODO: not correct scroll adjustment.
    function photoScroll(e) {
        if (scrollLock || !props.photoZoomReady) {
            return;
        }

        setScrollLock(true);
        let zoom = props.photoZoom === "auto" ? 100 : parseInt(props.photoZoom.replace("%", ""));

        const imgTag = document.querySelector(".photo img");
        const display = e.currentTarget.parentElement;

        const x = e.clientX - imgTag.offsetLeft + display.scrollLeft;
        const y = e.clientY - imgTag.offsetTop + display.scrollTop;

        const xPos = x / imgTag.width;
        const yPos = y / imgTag.height;

        if (e.deltaY > 0) {
            zoom -= 5;
            if (zoom <= 100) {
                zoom = 100;
            }
        } else if (e.deltaY < 0) {
            zoom += 5;
        }

        props.setPhotoZoom(zoom + "%");

        const sTop = (imgTag.height * yPos - display.clientHeight * yPos);
        const sLeft = (imgTag.width * xPos - display.clientWidth * xPos);
        display.scrollTop = sTop - sTop % (50 * zoom / 200);
        display.scrollLeft = sLeft - sLeft % (50 * zoom / 200);

        if (props.currentPhotoSize[1] && props.currentPhotoSize[1] > props.currentPhotoSize[0]) {
            props.SetImgStyle({ minHeight: zoom + "%", opacity: '100%' });
        } else {
            props.SetImgStyle({ minWidth: zoom + "%", opacity: '100%' });
        }

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

    function dragPhotoEnd(e) {
        setPhotoDisplayImgClass("");
        setDragPhotoInfo({});
    }

    return (
        <div className="photo">
            {/* video doesn't work for local files: https://github.com/tauri-apps/tauri/issues/3725#issuecomment-1160842638

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
                    lading="eager"
                    onLoad={(e) => {
                        setTimeout(() => {
                            props.SetImgStyle({ opacity: 1, transition: "opacity 0.5s" }, e.target.width, e.target.height);
                        }, 150)
                    }}
                    onError={(e) => {
                        e.target.src = "/img_error.png";
                    }}
                    style={props.imgStyle}
                    src={convertFileSrc(props.currentPhotoPath)}
                    onMouseDown={(e) => dragPhotoStart(e)}
                    onMouseMove={(e) => dragPhoto(e)}
                    onMouseUp={(e) => dragPhotoEnd(e)}
                    onWheel={(e) => photoScroll(e)}
                />
            }
        </div>
    );
}

export default PhotoDisplay;
