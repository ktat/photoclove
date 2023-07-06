import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { writeText, readText } from '@tauri-apps/api/clipboard';

function PhotoInfo(props) {
    const [photoInfo, setPhotoInfo] = useState({});
    const [star, setStar] = useState([false, false, false, false, false]);
    const [comment, setComment] = useState("");

    useEffect((e) => {
        if (props.currentPhotoPath && props.currentPhotoPath !== "") {
            getPhotoInfo(props.currentPhotoPath).then((photoInfo) => {
            });
        }
    }, [props.currentPhotoPath])

    async function getPhotoInfo(path) {
        await invoke("get_photo_info", { pathStr: path }).then((r) => {
            let data = JSON.parse(r);
            if (data.meta) {
                if (data.meta.star.data > 0) {
                    const newStar = [false, false, false, false, false];
                    for (let i = 0; i < data.meta.star.data; i++) {
                        newStar[i] = true;
                    }
                    setStar(newStar);
                } else {
                    setStar([false, false, false, false, false]);
                }
                if (data.meta.comment) {
                    setComment(data.meta.comment.data);
                } else {
                    setComment("");
                }
            } else {
                setStar([false, false, false, false, false]);
                setComment("");
            }
            setPhotoInfo(data);
        });
    };

    function getCurrentStarRate() {
        return getStarRate(star);
    }

    function getStarRate(star) {
        let starIndex = 0;
        for (let i = 0; i < 5; i++) {
            if (star[i]) {
                starIndex = i;
            } else {
                break;
            }
        }
        return starIndex;
    }

    function toggleStar(i) {
        const newStar = []
        const currentStarRate = getCurrentStarRate()
        if (!star[i] || (star[i] && star[i + 1])) {
            for (let j = 0; j <= i; j++) {
                newStar[j] = true;
            }
            if (i < 4) {
                for (let j = i + 1; j < 5; j++) {
                    newStar[j] = false;
                }
            }
        } else {
            if (i < 4) {
                for (let j = i + 1; j < 5; j++) {
                    newStar[j] = false;
                }
            }
        }
        const newStarRate = getStarRate(newStar);
        if (currentStarRate !== newStarRate) {
            invoke("save_star", { pathStr: props.currentPhotoPath, starNum: newStarRate });
            setStar(newStar);
        }
    }

    function saveComment() {
        invoke("save_comment", { pathStr: props.currentPhotoPath, commentStr: comment });
    }

    return (
        <div className="rightMenu">
            <div style={{ float: "right" }}>
                <a href="#" onClick={(e) => props.setCurrentPhotoPath("")}>&#x2715;</a>
            </div>
            <p><strong>Photo Info</strong></p>
            {props.currentPhotoPath && (
                <div>
                    <table>
                        <tbody>
                            <tr><th>File Name</th>
                                <td>
                                    <a href="#" onClick={() => {
                                        writeText(props.currentPhotoPath);
                                        props.addFooterMessage("clipboard", "Copy file path to clipboard", 50000);
                                    }}>📋</a>
                                    <a
                                        onMouseEnter={() => { props.addFooterMessage("current_phtoo_path", "File Path: " + props.currentPhotoPath, false, 10000) }}>
                                        {props.currentPhotoPath.replace(/^.+\//, '')}
                                    </a>
                                </td></tr>
                            <tr><th>ISO</th><td>{photoInfo.exif ? photoInfo.exif.iso : ""}</td></tr>
                            <tr><th>FNumber</th><td>{photoInfo.exif ? photoInfo.exif.fnumber : ""}</td></tr>
                            <tr><th>Shutter Speed</th><td>{photoInfo.exif ? photoInfo.exif.exposure_time : ""}</td></tr>
                            <tr><th>LensModel</th><td>{photoInfo.exif ? photoInfo.exif.lens_model : ""}</td></tr>
                            <tr><th>LensMake</th><td>{photoInfo.exif ? photoInfo.exif.lens_make : ""}</td></tr>
                            <tr><th>Make</th><td>{photoInfo.exif ? photoInfo.exif.make : ""}</td></tr>
                            <tr><th>Model</th><td>{photoInfo.exif ? photoInfo.exif.model : ""}</td></tr>
                            <tr><th>Date & Time</th><td>{photoInfo.exif ? photoInfo.exif.date_time : ""}</td></tr>
                            <tr><th>Focal Length</th><td>{photoInfo.exif ?
                                photoInfo.exif.focal_length == photoInfo.exif.focal_length_in35mm_film
                                    ? photoInfo.exif.focal_length
                                    : photoInfo.exif.focal_length + "(" + photoInfo.exif.focal_length_in35mm_film + ")" : ""}
                            </td></tr>
                            <tr><th>Digital Zoom Ratio</th><td>{photoInfo.exif ? photoInfo.exif.digital_zoom_ratio : ""}</td></tr>
                            <tr><th>Exposure Mode</th><td>{photoInfo.exif ? photoInfo.exif.exposure_mode : ""}</td></tr>
                            <tr><th>WhiteBalance Mode</th><td>{photoInfo.exif ? photoInfo.exif.white_balance_mode : ""}</td></tr>
                            <tr><th>Orientation</th><td>{photoInfo.exif ? photoInfo.exif.orientation : ""}</td></tr>
                        </tbody>
                    </table>
                    <div>
                        Stars:
                        <span className="star">
                            {
                                [0, 1, 2, 3, 4].map((v, i) => {
                                    return <a key={i} href="#" value={v} onClick={() => { toggleStar(v) }}>{star[i] ? "★" : "☆"}</a>
                                })
                            }
                        </span>
                    </div>
                    <div className="comment">
                        Comment:<br />
                        <textarea
                            onChange={(e) => setComment(e.target.value)}
                            value={comment}>
                        </textarea>
                        <button onClick={() => saveComment()}>SAVE</button>
                    </div>
                </div>
            )}
        </div>);
}

export default PhotoInfo;
