import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";

function PhotoInfo(props) {
    const [photoInfo, setPhotoInfo] = useState({});

    useEffect((e) => {
        if (props.path && props.path != "") {
            getPhotoInfo(props.path);
        }
    }, [props.path])

    async function getPhotoInfo(path) {
        await invoke("get_photo_info", { pathStr: path }).then((r) => {
            let data = JSON.parse(r);
            setPhotoInfo(data);
        });
    };

    return (
        <div className="rightMenu">
            <p>Photo Info</p>
            <div>
                {props.path && (
                    <table>
                        <tbody>
                            <tr><th>File Name</th><td>{props.path.replace(/^.+\//, '')}</td></tr>
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
                )}
            </div>
        </div >
    );
}

export default PhotoInfo;