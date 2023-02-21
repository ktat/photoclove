import React, { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { message, confirm } from "@tauri-apps/api/dialog";


function DirectoryMenu(props) {

    const [photoIndex, setPhotoIndex] = useState(-1);

    useEffect(() => {
        let l = props.photoSelection.length;
        setPhotoIndex(l - 1)
    }, [props.photoSelection])

    let lock = false;
    async function create_db_in_date() {
        if (lock) {
            message("Currently, this operation is locked. Pelase wait for a while", "This operation is locked");
        } else {
            confirm("This takes long time if you have many photos.", "Warning").then((answer) => {
                if (answer) {
                    lock = true;
                    invoke("create_db_in_date", { dateStr: props.currentDate }).then(() => {
                        lock = false;
                    })
                }
            });
        }
    }

    async function move_photos_to_exif_date() {
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

    return (
        <div id="directory-maintenance" className="rightMenu">
            <ul className="tabs-list">
                <li className={props.tabClass['filter'] ? "tab tab-active" : "tab"} ><a onClick={(e) => props.changeTab(e, e.target.href)} href="#tab-filter">Filter</a></li>
                <li className={props.tabClass['selection'] ? "tab tab-active" : "tab"} ><a onClick={(e) => props.changeTab(e, e.target.href)} href="#tab-selection">Selection</a></li>
                <li className={props.tabClass['maintenance'] ? "tab tab-active" : "tab"} ><a onClick={(e) => props.changeTab(e, e.target.href)} href="#tab-maintenance">Maintenance</a></li>
            </ul>
            <div id="tab-maintenance" className={props.tabClass['maintenance'] ? "tab-active" : "tab"}>
                <ul>
                    <li><a href="#" onClick={() => { create_db_in_date() }}>(re)Create database of the date</a></li>
                    <li><a href="#" onClick={() => { move_photos_to_exif_date() }}>Move files according to Exif date</a></li>
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
                    <div>Photos are not selected.</div>
                    :

                    <div>
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