import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";

function PhotoInfo(props) {
    const [photoInfo, setPhotoInfo] = useState({});
    const [star, setStar] = useState([false, false, false, false, false]);
    const [comment, setComment] = useState("");

    console.log(props);

    useEffect((e) => {
        if (props.path && props.path != "") {
            getPhotoInfo(props.path);
        }
        setComment("");
        setStar([false, false, false, false, false]);
    }, [props.path])

    async function getPhotoInfo(path) {
        await invoke("get_photo_info", { pathStr: path }).then((r) => {
            let data = JSON.parse(r);
            console.log(data);
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
            invoke("save_star", { pathStr: props.path, starNum: newStarRate });
            setStar(newStar);
        }
    }

    function saveComment() {
        invoke("save_comment", { pathStr: props.path, commentStr: comment });
    }

    return (
        <div className="rightMenu">
            <p><strong>Photo Info</strong></p>
            {props.path && (
                <div>
                    <table>
                        <tbody>
                            <tr><th>File Name</th><td><a
                                onMouseEnter={() => { props.addFooterMessage("current_phtoo_path", "File Path: " + props.path, 10000) }}>
                                {props.path.replace(/^.+\//, '')}
                            </a></td></tr>
                            <tr><th>ISO</th><td>{photoInfo.ISO}</td></tr>
                            <tr><th>FNumber</th><td>{photoInfo.FNumber}</td></tr>
                            <tr><th>Shutter Speed</th><td>{photoInfo.ExposureTime}</td></tr>
                            <tr><th>LensModel</th><td>{photoInfo.LensModel}</td></tr>
                            <tr><th>LensMake</th><td>{photoInfo.LensMake}</td></tr>
                            <tr><th>Make</th><td>{photoInfo.Make}</td></tr>
                            <tr><th>Model</th><td>{photoInfo.Model}</td></tr>
                            <tr><th>Date & Time</th><td>{photoInfo.DateTime}</td></tr>
                            <tr><th>Focal Length</th><td>{photoInfo.FocalLength == photoInfo.FocalLengthIn35mmFilm ? photoInfo.FocalLength : photoInfo.FocalLength + "(" + photoInfo.FocalLengthIn35mmFilm + ")"}</td></tr>
                            <tr><th>Digital Zoom Ratio</th><td>{photoInfo.DigitalZoomRatio}</td></tr>
                            <tr><th>Exposure Mode</th><td>{photoInfo.ExposureMode}</td></tr>
                            <tr><th>WhiteBalance Mode</th><td>{photoInfo.WhiteBalanceMode}</td></tr>
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