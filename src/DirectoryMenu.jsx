import { invoke } from "@tauri-apps/api/tauri";

function DirectoryMenu(props) {
    return (
        <div id="directory-maintenance" className="rightMenu">
            <strong>Directory Filter</strong>
            <div>
                Stars: more than ...<br />
            </div>
            <strong>Directory Maintenance</strong>
            <ul>
                <li><a href="#" onClick={() => { invoke("create_db_in_date", { dateStr: props.currentDate }) }}>(re)Create database of the date</a></li>
                <li><a href="#" onClick={() => { }}>Move files according to Exif date</a></li>
            </ul>
        </div >
    )
}

export default DirectoryMenu;