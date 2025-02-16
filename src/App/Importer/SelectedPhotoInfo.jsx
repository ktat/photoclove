import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";

async function importPhotos(props) {
    const fn = (f) => {
        invoke("get_import_progress").then((r) => {
            let data = JSON.parse(r);
            props.setImportProgress(data);
            if (data.now_importing) {
                let message = "Now importing: ";
                message += data.progress + "/" + data.num + " ";
                message += parseInt(data.num_per_sec * 1000) / 1000 + "/sec(";
                message += parseInt((data.num - data.progress) / (data.num_per_sec)) + " secs left)";
                props.addFooterMessage("importing", message);
                setTimeout(() => { f(f) }, 1000);
            } else {
                props.setLastSelected(undefined);
            }
        })
    };
    setTimeout(() => { fn(fn) }, 1000);
    await invoke("import_photos", { files: Object.keys(props.selectedForImport) }).then((r) => {
        props.setSelectedForImport({});
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
            <ul className="list-of-selected">
                {Object.keys(props.selectedForImport).map((l, i) => {
                    let rest = l.replace(/([^\/]+)$/, "");
                    let filename = RegExp.$1;
                    return (<li key={i}><a href="#" onClick={() => props.setImageInSelectedPhotos({ path: l })}>{filename}</a></li>);
                })
                }
            </ul>
            <div>
                {props.lastSelected !== undefined &&
                    <>
                        <img className="imageInSelectedPhotos" src={convertFileSrc(props.lastSelected.path)} /><br />
                        {props.lastSelected.created_at}
                    </>
                }

            </div>
        </div >
    );
}

export default SelectedPhotoInfo;