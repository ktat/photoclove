import { convertFileSrc } from "@tauri-apps/api/tauri";
import { useState } from "react";

function PhotoDisplay(props) {
    const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
    const [scrollLock, setScrollLock] = useState(false);
    const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");

    function dragPhotoStart(e) {
        setPhotoDisplayImgClass("photo_dragging"); photos
        setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
    }

    // TODO: not correct scroll adjustment.
    function photoScroll(e) {
        if (scrollLock || !props.zoomReady) {
            return;
        }
        setScrollLock(true);
        let zoom = parseInt(props.zoom.replace("%", ""));

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

        props.setZoom(zoom + "%");

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

    function dragPhotoEnd(e) {
        setPhotoDisplayImgClass("");
        setDragPhotoInfo({});
    }

    return (
        <div id="photoDisplay" autoFocus={true} className={props.class}>
            <p>Photo Viewer</p>
            <a href="#" onClick={() => props.prevPhoto(props.path)}>&lt;&lt; prev</a>&nbsp;&nbsp;
            || <a href="#" onClick={() => props.toggleCenterDisplay()}>close</a> ||&nbsp;&nbsp;
            <a href="#" onClick={() => props.nextPhoto(props.path)}>next &gt;&gt;</a><br /><br />
            <a href="#" onClick={() => props.moveToTrashCan(props.path)}>&#128465;</a>
            <div className="photo">
                <img className={photoDisplayImgClass} src={convertFileSrc(props.path)} width={props.zoom}
                    onMouseDown={(e) => dragPhotoStart(e)}
                    onMouseMove={(e) => dragPhoto(e)}
                    onMouseUp={(e) => dragPhotoEnd(e)}
                    onWheel={(e) => photoScroll(e)} />
            </div>
        </div>
    );
}

export default PhotoDisplay;

