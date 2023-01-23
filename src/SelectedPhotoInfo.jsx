import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";

async function importPhotos(props) {
    const fn = (f) => {
        invoke("get_import_progress").then((r) => {
            let data = JSON.parse(r);
            props.setImportProgress(data);
            if (data.now_importing) {
                setTimeout(() => { f(f) }, 1000);
            }
        })
    };
    await invoke("import_photos", { files: Object.keys(props.selectedForImport) }).then((r) => {
        props.setSelectedForImport({});
        setTimeout(() => { fn(fn) }, 1);
    });
}

function SelectedPhotoInfo(props) {
    return (
        <div className="selectedPhoto">
            <p>Selected Photos for import</p>
            {Object.keys(props.selectedForImport).length > 0
                && <div><button type="button" onClick={() => importPhotos(props)}>Import Selected Photos</button></div>}
            <div>
                {Object.keys(props.selectedForImport).length} photos are selected
            </div>
            <ul id="listOfselectedForImport">
                {Object.keys(props.selectedForImport).map((l, i) => {
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