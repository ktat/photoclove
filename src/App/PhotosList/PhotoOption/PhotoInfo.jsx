import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import fileUrl from "../../../PathUtil.jsx";
import { logger } from '../../../services/LoggerService.js';

function PhotoInfo(props) {
    const [photoInfo, setPhotoInfo] = useState({});
    const [comment, setComment] = useState("");

    useEffect((e) => {
        if (props.currentPhotoPath && props.currentPhotoPath !== "" && props.showSideMenu) {
            getPhotoInfo(props.currentPhotoPath).then((photoInfo) => {
            });
        }
    }, [props.currentPhotoPath, props.showSideMenu])

    async function getPhotoInfo(path) {
        if (props.imgCacheMap[path] && props.imgCacheMap[path][1]) {
            setPhotoInfo(props.imgCacheMap[path][1])
        } else if (props.showSideMenu) {
            await invoke("get_photo_info", { pathStr: path }).then((r) => {
                let data = JSON.parse(r);
                if (data.meta) {
                    if (data.meta.star.data > 0) {
                        const newStar = [false, false, false, false, false];
                        for (let i = 0; i < data.meta.star.data; i++) {
                            newStar[i] = true;
                        }
                        props.setStar(newStar);
                    } else {
                        props.setStar([false, false, false, false, false]);
                    }
                    if (data.meta.comment) {
                        setComment(data.meta.comment.data);
                    } else {
                        setComment("");
                    }
                } else {
                    props.setStar([false, false, false, false, false]);
                    setComment("");
                }
                setPhotoInfo(data);
            });
        }
    };

    function getCurrentStarRate() {
        return getStarRate(props.star);
    }

    function getStarRate(star) {
        let starIndex = 0;
        for (let i = 0; i < 5; i++) {
            if (star[i]) {
                starIndex = i + 1;
            } else {
                break;
            }
        }
        return starIndex;
    }

    function toggleStar(i) {
        const newStar = [false, false, false, false, false];
        const currentStarRate = getCurrentStarRate();
        
        // If clicking on an empty star or a star that's not the last filled one
        if (!props.star[i] || (i < 4 && props.star[i + 1])) {
            // Fill all stars up to and including the clicked one
            for (let j = 0; j <= i; j++) {
                newStar[j] = true;
            }
        } else if (props.star[i] && (i === 4 || !props.star[i + 1])) {
            // If clicking on the last filled star, toggle it off
            for (let j = 0; j < i; j++) {
                newStar[j] = true;
            }
            // newStar[i] remains false
        }
        
        const newStarRate = getStarRate(newStar);
        logger.info('PhotoInfo', 'star_clicked', 'Star rating changed', {
            index: i,
            currentRate: currentStarRate,
            newRate: newStarRate
        });
        
        invoke("save_star", { pathStr: props.currentPhotoPath, starNum: newStarRate });
        props.setStar(newStar);
    }

    function saveComment() {
        invoke("save_comment", { pathStr: props.currentPhotoPath, commentStr: comment });
        
        // Notify parent component about comment update
        if (props.onCommentUpdate) {
            props.onCommentUpdate(props.currentPhotoPath, comment && comment.trim() !== "");
        }
    }

    return (
        <div className="info-tab">
            <div className="photo-info-table-wrapper">
                <table className="photo-info-table">
                    <tbody>
                        <tr><th>File Name</th>
                            <td>
                                <a href="#" onClick={() => {
                                    writeText(props.currentPhotoPath);
                                    props.addFooterMessage("clipboard", "Copy file path to clipboard", false, 5000);
                                }}>📋</a>
                                <a
                                    onMouseEnter={() => { props.addFooterMessage("current_phtoo_path", "File Path: " + props.currentPhotoPath, false, 10000) }}>
                                    {props.currentPhotoPath.replace(/^.+\//, '')}
                                </a>
                                <a href="#" onClick={(e) => {
                                    e.preventDefault();
                                    openUrl(fileUrl(props.currentPhotoPath));
                                }}>🚀</a>
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
                        <tr><th>Google Photos URL</th><td>{photoInfo.meta && photoInfo.meta.google_photo_url ? <a href={photoInfo.meta.google_photo_url} target="_blank" rel="noopener noreferrer">link</a> : ""}</td></tr>
                    </tbody>
                </table>
            </div>
            <div>
                Stars:
                <span className="star">
                    {
                        [0, 1, 2, 3, 4].map((v, i) => {
                            return <a key={i} href="#" value={v} onClick={(e) => { e.preventDefault(); toggleStar(v) }}>{props.star[i] ? "★" : "☆"}</a>
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
    );
}

export default PhotoInfo;