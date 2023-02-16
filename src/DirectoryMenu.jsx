import { invoke } from "@tauri-apps/api/tauri";

function DirectoryMenu(props) {
    return (
        <div id="directory-maintenance" className="rightMenu">
            <h3>Directory Maintenance</h3>
            <ul>
                <li><a href="#" onClick={() => { invoke("create_db_in_date", { dateStr: props.currentDate }) }}>(re)Create database of the date</a></li>
                <li><a href="#" onClick={() => { }}>Move files according to Exif date</a></li>
            </ul>

            <h3>Directory Filter</h3>
            <div>
                Stars: more than ...<br />
                has comment<br />
                not comentted<br />
            </div>

            <h3>Selected Photos</h3>
            <a href="#">select all photos in page</a>
            {props.photoSelection.length == 0
                ?
                <>Photos are not selected.</>
                :
                <ul>
                    {props.photoSelection.map((v) => {
                        return <li key={v}>{v.replace(/^.+\//, "")}</li>
                    })}
                </ul>
            }
        </div >
    )
}

export default DirectoryMenu;