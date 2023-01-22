import { convertFileSrc } from "@tauri-apps/api/tauri";

function SelectedPhotoInfo(props) {
    console.log(props.importPhotos);
    return (
        <div className={props.class}>
            <p>Selected Photos for import</p>
            {Object.keys(props.importPhotos).length > 0
                && <div><button type="button" onClick={() => importPhotos()}>Import Selected Photos</button></div>}
            <div>
                {Object.keys(props.importPhotos).length} photos are selected
            </div>
            <ul id="listOfselectedForImport">
                {Object.keys(props.importPhotos).map((l, i) => {
                    let rest = l.replace(/([^\/]+)$/, "");
                    let filename = RegExp.$1;
                    return (<li key={i}><a href="#" onClick={() => setImageInSelectedPhotos(l)}>{filename}</a></li>);
                })
                }
            </ul>
            <div>
                {props.lastSelected != "" && <img className="imageInSelectedPhotos" src={convertFileSrc(props.lastSelected)} />}
            </div>
        </div >
    );
}

export default SelectedPhotoInfo;