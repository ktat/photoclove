import React, { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { message, confirm } from "@tauri-apps/api/dialog";
import { tauri } from "@tauri-apps/api";
import { emit } from "@tauri-apps/api/event";
import { localForage } from "./storage/forage"

function DirectoryMenu(props) {

    const [photoIndex, setPhotoIndex] = useState(-1);

    useEffect(() => {
        let l = props.photoSelection.length;
        setPhotoIndex(l - 1)
    }, [props.photoSelection])

    let lock = false;
    let lockThumbnail = false;
    let lockUpload = false;
    let lockDelete = false;

    function doOperation(e) {
        const selected = e.target.value;
        if (selected == "uploadToGooglePhotos") {
            uploadToGooglePhotos()
        } else if (selected == "deleteFiles") {
            deleteFiles();
        }
        e.target.value = "";
    }

    async function createDbInDate() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("create_db_in_date", { dateStr: props.currentDate }).then((r) => {
                        lock = false;
                        let data = JSON.parse(r);
                        props.setCurrentDateNum(data[props.currentDate.replace(/\//g, "-")]);
                    })
                }
            });
        }
    }

    async function movePhotosToExifDate() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("move_photos_to_exif_date", { dateStr: props.currentDate }).then(() => {
                        lock = false;
                    })
                }
            });
        }
    }

    async function createThumbnails() {
        if (lockThumbnail) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lockThumbnail = true;
                    // TODO: not implented
                    invoke("create_thumbnails", { dateStr: props.currentDate }).then((r) => {
                        lockThumbnail = false;
                        console.log(r);
                    })
                }
            });
        }
    }

    async function uploadToGooglePhotos() {
        if (lockUpload) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            let files = [];
            props.photoSelection.map((v, i) => files.push(v));
            let answer = true;
            if (files.length > 2) {
                answer = await confirm("This takes long time if you have many photos.", "Warning");
            }
            if (answer) {
                localForage.getItem("GoogleOAuthTokens").then((tokens) => {
                    lockUpload = true;
                    invoke("upload_to_google_photos", { dateStr: props.currentDate, selectedFiles: files, accessToken: tokens.accessToken }).then((r) => {
                        props.clearPhotoSelection()
                        lockUpload = false;
                        let data = JSON.parse(r);
                        console.log(data);
                    }).catch(e => {
                        console.log(e);
                    });
                }
                ).catch((e) => {
                    console.log(e);
                })
            }
        }
    }

    async function deleteFiles() {
        if (!lockDelete) {
            props.photoSelection.map((v, i) => {
                props.moveToTrashCan(v);
            });
            lockDelete = false;
            props.clearPhotoSelection()
        }
    }

    return (
        <div id="directory-maintenance" className="rightMenu">
            <ul className="tabs-list">
                <li className={props.tabClass['filter'] ? "tab tab-active" : "tab"} ><a onClick={(e) => props.changeTab(e, e.target.href)} href="#tab-filter">Filter</a></li>
                <li className={props.tabClass['selection'] ? "tab tab-active" : "tab"} ><a onClick={(e) => props.changeTab(e, e.target.href)} href="#tab-selection">Selection</a></li>
                <li className={props.tabClass['maintenance'] ? "tab tab-active" : "tab"} ><a onClick={(e) => props.changeTab(e, e.target.href)} href="#tab-maintenance">Maintenance</a></li>
            </ul>
            <div id="tab-maintenance" className={props.tabClass['maintenance'] ? "tab-active" : "tab"}>
                <ul>
                    <li><a href="#" onClick={() => { createDbInDate() }}>(re)Create database of the date</a></li>
                    <li><a href="#" onClick={() => { movePhotosToExifDate() }}>Move files according to Exif date</a></li>
                    <li><a href="#" onClick={() => { createThumbnails() }}>Make thumbnails</a></li>
                </ul>
            </div>
            <div id="tab-filter" className={props.tabClass['filter'] ? "tab-active" : "tab"}>
                <div>
                    Stars: more than ...<br />
                    has comment<br />
                    not comentted<br />
                </div>
            </div>
            <div id="tab-selection" className={props.tabClass['selection'] ? "tab-active" : "tab"}>
                <div>
                    <button onClick={() => props.selectAllPhotoToSelection()}>Select all photos in page</button>
                </div>
                {props.photoSelection.length == 0
                    ?
                    <div><br />Photos are not selected.</div>
                    :
                    <div>
                        <div className="operation">
                            <select onChange={(e) => doOperation(e)}>
                                <option value="select">Select an Opertaion</option>
                                <option value="uploadToGooglePhotos">Upload to Google Photos</option>
                                <option value="deleteFiles">Delete files</option>
                            </select>
                        </div>
                        <ul className="list-of-selected">
                            {props.photoSelection.map((v, i) => {
                                return <li key={v}><a href="#" onClick={() => setPhotoIndex(i)}>{v.replace(/^.+\//, "")}</a></li>
                            })}
                        </ul>
                        <button onClick={() => props.clearPhotoSelection()}>Clear Selection</button>
                    </div>
                }
                {photoIndex >= 0 && <img src={convertFileSrc(props.photoSelection[photoIndex])} />}
            </div>
        </div >
    )
}

export default DirectoryMenu;
