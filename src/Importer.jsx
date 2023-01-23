import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import SelectedPhotoInfo from "./SelectedPhotoInfo.jsx"

function Importer(props) {
    const [scrollLock, setScrollLock] = useState(false);
    const [importProgress, setImportProgress] = useState({});
    const [importPhotosPage, setImportPhotosPage] = useState(1);
    const [importPaths, setImportPaths] = useState([]);
    const [currentImportPath, setCurrentImportPath] = useState("");
    const [importer, setImporter] = useState({ "has_next_files": false, "dirs_files": { dir: { "path": "" }, "dirs": { "dirs": [] }, "files": { "files": [] } } });
    const [pathPage, setPathPage] = useState({});
    const [selectedForImport, setSelectedForImport] = useState({});
    const [imageInSelectedPhotos, setImageInSelectedPhotos] = useState("");

    useEffect(() => {
        showImporter(props.path, pathPage[props.path], 20);
    }, [props.path]);

    function importPhotosScroll(e) {
        if (scrollLock || currentImportPath === "") {
            return;
        }
        setScrollLock(true);
        let isForward = true;
        if (e.deltaY < 0) {
            isForward = false;
        }
        nextImportPhotosList(e, isForward)
    }

    function nextImportPhotosList(e, isForward) {
        let target = document.getElementById("importPhotosDisplay");
        let page = target.getAttribute("data-page");
        if (!page || page == "NaN") {
            page = 0;
        }
        page = parseInt(page);
        if (!isForward) {
            page -= 1;
            if (page <= 0) {
                page = 1;
            }
        } else {
            page += 1;
        }
        showImporter(currentImportPath, page, 20);
    }

    function selectPhoto(path) {
        if (path !== undefined) {
            selectedForImport[path] = !selectedForImport[path];
            if (!selectedForImport[path]) {
                setImageInSelectedPhotos("");
                delete selectedForImport[path];
            } else {
                setImageInSelectedPhotos(path);
            }
        }
        let files = [];
        Object.keys(selectedForImport).forEach(path => {
            if (selectedForImport[path]) {
                files.push(path);
            }
        });
        setSelectedForImport(selectedForImport);
        if (files.length > 0) {
            let target = document.getElementById("importPhotosDisplay");
            let page = target.getAttribute("data-page");
            showImporter(files[0].replace(/[^\/]+$/, ""), page, 20);
        }
    }

    function selectAllInThisPage() {
        let photos = document.getElementsByClassName("importPhoto");
        _selectAll(photos);
    }

    function selectAll() {
        console.log(currentImportPath)
        if (currentImportPath != "") {
            invoke("get_photos_path_to_import_under_directory", { pathStr: currentImportPath }).then((r) => {
                let files = JSON.parse(r);
                let photos = [];
                for (let i = 0; i < files.length; i++) {
                    photos.push({ id: files[i] });
                }
                _selectAll(photos);
            });
        }
    }

    function _selectAll(photos) {
        let lastFile = '';
        for (let i = 0; i < photos.length; i++) {
            selectedForImport[photos[i].id] = true;
            lastFile = photos[i].id;
        }
        selectPhoto(undefined);
        setImageInSelectedPhotos(lastFile);
    }

    function unselectAll() {
        setSelectedForImport({});
        setImageInSelectedPhotos("");
    }

    async function showImporter(path, page, num) {
        if ((!path || path === "") && currentImportPath !== "") {
            path = currentImportPath;
        }
        if (!page && path && path !== "") {
            page = pathPage[path];
        }
        page ||= 1;
        let args = { page: parseInt(page), num: num || 20 };
        if (path !== "") {
            args["pathStr"] = path;
        }
        await invoke("show_importer", args).then((r) => {
            let data = JSON.parse(r);
            let path = data.dirs_files.dir.path;
            setImportPaths(data.paths);
            setCurrentImportPath(path);
            if (data.dirs_files.files.files.length > 0 || page == 1) {
                pathPage[path] = page;
                setPathPage(pathPage);
                setImporter(data);
            } else {
                importer.dirs_files.dirs = data.dirs_files.dirs;
                importer.dirs_files.dirs.path = path;
                setImporter(importer);
            }
            setTimeout(() => { setScrollLock(false) }, 200);
        });
    }

    return (
        <>
            <div id="importPhotosDisplay" className="importDisplay"
                onWheel={(e) => importPhotosScroll(e)}
                data-path={props.path}
                data-page={pathPage[props.path]}>
                <p>Import Photos</p>
                <ul className="list-of-import-path">
                    {importPaths.map((p, i) => {
                        return <li key={i}><a href="#" onClick={() => showImporter(p)}>{p}</a></li>
                    })}
                </ul>
                {importProgress.now_importing && (<>
                    <span>Now Importing...</span>
                    <span>{importProgress.progress} / {importProgress.num}</span><br />
                    <span>({parseInt(importProgress.num_per_sec * 1000) / 1000} /sec : {parseInt((importProgress.num - importProgress.progress) / (importProgress.num_per_sec))} secs left)</span>
                </>)}
                {!importProgress.now_importing && importProgress.start_time && importProgress.start_time.secs_since_epoch && (<>
                    <span>Last Import: {new Date(importProgress.start_time.secs_since_epoch * 1000).toLocaleString("default", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </>)}
                <p>Directories (path: {currentImportPath}):</p>
                <ul>
                    {(importer.dirs_files.dirs.dirs.length == 0 || importer.dirs_files.dirs.dirs[0].path.match("^/[^\/]+/.+$")) &&
                        <li><a href="#" onClick={() => showImporter(importer.dirs_files.dir.path + "/..")}>..</a></li>
                    }
                    {importer.dirs_files.dirs.dirs.map((l, i) => {
                        return (
                            <li key={i}>&#128193;
                                <a href="#" onClick={() => showImporter(l.path)}>{l.path.replace(/^.+\//, '')}</a>
                            </li>
                        );
                    })
                    }
                </ul>
                {importer.dirs_files.files.files.length > 0 && (
                    <>
                        <p>Files(page. {pathPage[currentImportPath]}):</p>
                        <div>
                            Filter: <br />
                            Created Date: after <input id="filterDate" name="date" type="date" /><br />
                            <button onClick={() => filterImporter()}>Filter</button><br />
                            <button onClick={() => selectAllInThisPage()}>Select All photos in this page</button>
                            <button onClick={() => selectAll()}>Select All photos in all pages</button>
                            <button onClick={() => unselectAll()}>Unselect All</button>
                            <br /><br />
                        </div>
                    </>
                )}
                {importer.dirs_files.has_prev_file && (<span><a href="#" onClick={(e) => nextImportPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
                {importer.dirs_files.has_next_file && (<span><a href="#" onClick={(e) => nextImportPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}

                <div className="photos">
                    <ul id="importPhotosList">
                        {importer.dirs_files.files.files.map((l, i) => {
                            return (
                                <li key={i} className={selectedForImport[l.path] ? "selected" : "notSelected"}><a href="#" id={l.path} className="importPhoto" onClick={() => selectPhoto(l.path)}><img src={convertFileSrc(l.path)} width="100" /></a></li>
                            );
                        })
                        }
                    </ul>
                </div>
            </div>
            <SelectedPhotoInfo
                selectedForImport={selectedForImport}
                setSelectedForImport={setSelectedForImport}
                lastSelected={imageInSelectedPhotos}
                setImportProgress={setImportProgress}
            />
        </>
    )

}

export default Importer;