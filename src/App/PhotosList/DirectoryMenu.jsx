import React, { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import { emit } from "@tauri-apps/api/event";
import { localForage } from "../../storage/forage"

function DirectoryMenu(props) {

    const [photoIndex, setPhotoIndex] = useState(-1);
    const [showBigPhoto, setShowBigPhoto] = useState(false);

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
                    invoke("create_thumbnails_in_date", { dateStr: props.currentDate }).then((r) => {
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
                    invoke("upload_to_google_photos", { dateStr: props.currentDate, selectedFiles: files, accessToken: tokens.accessToken, refleshToken: tokens.refreshToken }).then((r) => {
                        props.clearPhotoSelection()
                        lockUpload = false;
                        let data = JSON.parse(r);
                        console.log("1 === ", data);
                    }).catch(e => {
                        console.log("2 === ", e);
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
        <div id="directory-maintenance">
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
                <ul>
                    <li>
                        Stars:
                        {[0, 1, 2, 3, 4, 5].map((v, i) => {
                            return <span key={i} onClick={() => props.setStarFilter(v)}>{props.starFilter >= v ? " ★" + i : " ☆" + i}</span>
                        })}
                    </li>
                    <li>
                        <input type="checkbox" value="1" id="filter-has-comment-check"
                            onChange={(e) => { props.setHasCommentFilter(e.target.checked); }}
                        />
                        <label className="checkbox checkbox-normal" htmlFor="filter-has-comment-check">Has comment</label>
                    </li>
                    <li>
                        Extensions:
                        <div style={{ marginTop: '5px' }}>
                            {/* Image Extensions Group */}
                            <div style={{ marginBottom: '10px' }}>
                                <div>
                                    <input 
                                        type="checkbox" 
                                        id="filter-extension-image-group-check"
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
                                            
                                            let newFilters;
                                            if (checked) {
                                                // Add all image extensions
                                                newFilters = [...currentFilters.filter(f => !imageExtensions.includes(f)), ...imageExtensions];
                                            } else {
                                                // Remove all image extensions
                                                newFilters = currentFilters.filter(f => !imageExtensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                            props.setExtensionFilter(filterString);
                                        }}
                                        checked={props.extensionFilter !== "all" && ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'].some(ext => props.extensionFilter.split(',').includes(ext))}
                                    />
                                    <label className="checkbox checkbox-normal" htmlFor="filter-extension-image-group-check"><strong>Image</strong></label>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                    {[
                                        { value: 'jpeg', label: 'jpeg(jpg)', extensions: ['jpg', 'jpeg'] },
                                        { value: 'png', label: 'png', extensions: ['png'] },
                                        { value: 'gif', label: 'gif', extensions: ['gif'] },
                                        { value: 'bmp', label: 'bmp', extensions: ['bmp'] },
                                        { value: 'tiff', label: 'tiff', extensions: ['tiff'] }
                                    ].map(item => (
                                        <div key={item.value}>
                                            <input 
                                                type="checkbox" 
                                                value={item.value}
                                                id={`filter-extension-${item.value}-check`}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                                    
                                                    let newFilters;
                                                    if (checked) {
                                                        // Add all extensions for this item
                                                        newFilters = [...currentFilters, ...item.extensions];
                                                    } else {
                                                        // Remove all extensions for this item
                                                        newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                    }
                                                    
                                                    const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                    props.setExtensionFilter(filterString);
                                                }}
                                                checked={props.extensionFilter !== "all" && item.extensions.some(ext => props.extensionFilter.split(',').includes(ext))}
                                            />
                                            <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Movie Extensions Group */}
                            <div>
                                <div>
                                    <input 
                                        type="checkbox" 
                                        id="filter-extension-movie-group-check"
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                            const movieExtensions = ['mp4', 'webm'];
                                            
                                            let newFilters;
                                            if (checked) {
                                                // Add all movie extensions
                                                newFilters = [...currentFilters.filter(f => !movieExtensions.includes(f)), ...movieExtensions];
                                            } else {
                                                // Remove all movie extensions
                                                newFilters = currentFilters.filter(f => !movieExtensions.includes(f));
                                            }
                                            
                                            const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                            props.setExtensionFilter(filterString);
                                        }}
                                        checked={props.extensionFilter !== "all" && ['mp4', 'webm'].some(ext => props.extensionFilter.split(',').includes(ext))}
                                    />
                                    <label className="checkbox checkbox-normal" htmlFor="filter-extension-movie-group-check"><strong>Movie</strong></label>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px', marginLeft: '20px' }}>
                                    {[
                                        { value: 'mp4', label: 'mp4', extensions: ['mp4'] },
                                        { value: 'webm', label: 'webm', extensions: ['webm'] }
                                    ].map(item => (
                                        <div key={item.value}>
                                            <input 
                                                type="checkbox" 
                                                value={item.value}
                                                id={`filter-extension-${item.value}-check`}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    const currentFilters = props.extensionFilter === "all" ? [] : props.extensionFilter.split(',').filter(f => f.trim() !== '');
                                                    
                                                    let newFilters;
                                                    if (checked) {
                                                        // Add all extensions for this item
                                                        newFilters = [...currentFilters, ...item.extensions];
                                                    } else {
                                                        // Remove all extensions for this item
                                                        newFilters = currentFilters.filter(f => !item.extensions.includes(f));
                                                    }
                                                    
                                                    const filterString = newFilters.length === 0 ? "all" : newFilters.join(',');
                                                    props.setExtensionFilter(filterString);
                                                }}
                                                checked={props.extensionFilter !== "all" && item.extensions.some(ext => props.extensionFilter.split(',').includes(ext))}
                                            />
                                            <label className="checkbox checkbox-normal" htmlFor={`filter-extension-${item.value}-check`}>{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </li>
                </ul>
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
                {photoIndex >= 0 &&
                    <img
                        onMouseOver={() => setShowBigPhoto(true)}
                        src={convertFileSrc(props.photoSelection[photoIndex])}
                    />}
            </div>
            <div className="big-photo-in-selection" style={{ display: showBigPhoto ? "block" : "none" }}
                onMouseLeave={() => setShowBigPhoto(false)}
                onClick={() => setShowBigPhoto(false)}
            >
                <img src={convertFileSrc(props.photoSelection[photoIndex])} />
            </div>
        </div >
    )
}

export default DirectoryMenu;
