import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useEffect, useState, useRef } from "react";
// import ReactPlayer from 'react-player';
import { openUrl } from '@tauri-apps/plugin-opener';
import fileUrl from "../../../PathUtil.jsx";

let currentFile = "";
let width = 0;
let height = 0;

function PhotoDisplay(props) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
    const [scrollLock, setScrollLock] = useState(false);
    const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");
    const [videoSource, setVideoSource] = useState("");
    const [videoClass, setVideoClass] = useState("video-off");
    const [photoDisplayWidth, setPhotoDisplayWidth] = useState("pdWidth");
    const [photoDisplayHeight, setPhotoDisplayHeight] = useState("pdHeight");

    // Function to parse CSS style string and convert to style object
    const parseCssStyle = (cssString) => {
        if (!cssString) return {};
        
        const styles = {};
        const declarations = cssString.split(';').filter(decl => decl.trim());
        
        declarations.forEach(declaration => {
            const [property, value] = declaration.split(':').map(s => s.trim());
            if (property && value) {
                // Convert CSS property names to camelCase for React
                const camelCaseProperty = property.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                styles[camelCaseProperty] = value;
            }
        });
        
        return styles;
    };

    useEffect((e) => {
        currentFile = "";
        document.querySelector("#dummy-for-focus").focus();

        const resizeHandler = () => {
            // Recalculate image sizing on window resize
            if (width > 0 && height > 0) {
                // Small delay to ensure container has updated dimensions
                setTimeout(() => {
                    props.SetImgStyle(
                        { opacity: 1, transition: "opacity 0.3s" },
                        width,
                        height
                    );
                }, 50);
            }
        };
        
        window.addEventListener('resize', resizeHandler);
        
        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', resizeHandler);
        };
    }, []);

    useEffect((e) => {
        handleImgLoad();
    }, [props.photosListMiniClosed])

    useEffect((e) => {
        // Don't set opacity here - let handleImgLoad handle it when image is ready
        document.querySelector("#dummy-for-focus").focus();
        
        // Small delay to ensure container is ready when transitioning from thumbnail view
        setTimeout(() => {
            if (props.currentPhotoPath && props.currentPhotoPath.match(/(mp4|webm)$/i)) {
                movie(props.currentPhotoPath);
                let photoDisplayDiv = document.querySelector('.photoDisplay');
                let width = photoDisplayDiv.clientWidth;
                let height = photoDisplayDiv.clientHeight - 150;

                setPhotoDisplayWidth(width + "px");
                setPhotoDisplayHeight(height + "px");
                setVideoClass("video-on");
            } else {
                setVideoClass("video-off");
                setVideoSource("");
            }
        }, 50);
    }, [props.currentPhotoPath]);

    function dragPhotoStart(e) {
        setPhotoDisplayImgClass("photo_dragging");
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }

    async function movie(path) {
        if (currentFile != path) {
            invoke("lock", { t: true }).then(async (r) => {
                // tauri cannot play movie file which is not in public folder. So copy movie file to public/movie
                const ext = path.split('.').pop();
                const result = await invoke("link_file_to_public", {
                    fromFilePath: path,
                    toFileName: "movie.tmp." + ext
                }).then((r) => {
                    let videoPath = "/movie.tmp." + ext + "?" + path;
                    currentFile = path;
                    // I don't know why it works only when set twice sometime.
                    setVideoSource("#");
                    // I don't know why react player require waiting for a while to play video correctly.
                    setTimeout(() => {
                        setVideoSource(videoPath);
                    }, 200);
                });
                setTimeout(() => {
                    invoke("lock", { t: false })
                }, 1000);
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

    const handleImgLoad = (e) => {
        if (e !== undefined) {
            height = e.naturalHeight;
            width = e.naturalWidth;
        }
        
        // Use the event target dimensions if available, otherwise use globals
        const imgWidth = e?.naturalWidth || width;
        const imgHeight = e?.naturalHeight || height;
        
        if (imgWidth > 0 && imgHeight > 0) {
            // Always apply styling immediately - no container dimension checks needed
            props.SetImgStyle(
                { opacity: 1, transition: "opacity 0.3s" },
                imgWidth,
                imgHeight
            );
        }
    };

    return (
        <div id="photo" className={"photo" + (props.photosListMiniClosed ? " photosListMiniClosed" : "")}>
            <div id="selectedInfo" className={props.selectedInfoHidden ? "hidden" : ""}
                dangerouslySetInnerHTML={{ __html: props.selectedContent }}>
            </div>
            <div id="unselectedInfo" className={props.unselectedInfoHidden ? "hidden" : ""}>
                {props.unselectedContent}
            </div>
            <div className={videoClass}>
                <div style={{ "width": photoDisplayWidth, "height": photoDisplayHeight }}>
                    { /* <ReactPlayer
                    width="100%"
                    height="100%"
                    controls
                    url={videoSource}
                    */ }
                    <video
                        controls
                        src={videoSource}
                    >
                    </video>
                </div>
                Open with other software: <a href="#" onClick={(e) => openUrl(fileUrl(props.currentPhotoPath))}>{props.currentPhotoPath}</a>
            </div>
            {props.currentPhotoPath && !props.currentPhotoPath.match(/\.(mp4|webm)$/i) &&
                <img id="photoImgTag" className={photoDisplayImgClass}
                    loading="eager"
                    onLoad={(e) => handleImgLoad(e.target)}
                    onDoubleClick={(e) => props.togglePhotoSelected()}
                    onError={(e) => {
                        e.target.src = "/img_error.png";
                    }}
                    style={{
                        ...props.imgStyle,
                        ...parseCssStyle(props.currentPhotoCssStyle)
                    }}
                    onLoad={(e) => {
                        console.log('=== PHOTODISPLAY DEBUG ===');
                        console.log('currentPhotoCssStyle:', props.currentPhotoCssStyle);
                        console.log('parsed CSS style:', parseCssStyle(props.currentPhotoCssStyle));
                        console.log('imgStyle:', props.imgStyle);
                        handleImgLoad(e.target);
                    }}
                    src={(props.imgCacheMap[props.currentPhotoPath] && props.imgCacheMap[props.currentPhotoPath][0]) || convertFileSrc(props.currentPhotoPath)}
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
