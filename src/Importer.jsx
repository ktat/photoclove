import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
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
    const [imageInSelectedPhotos, setImageInSelectedPhotos] = useState(undefined);
    const [importerFilter, setImporterFilter] = useState("")

    const listened = false;

    useEffect(() => {
        const unlisten = listen("import", (e) => {
            if (e.payload == "finish") {
                props.addFooterMessage("importing", "Importing is finished", 5000);
            }
            console.log(e.payload);
        });
    }, [listened]);

    useEffect(() => {
        showImporter(props.path, pathPage[props.path], 20);
    }, [props.path, importerFilter]);

    let beforeScrollTop = -1;
    let isScrollBottom = 0;
    function importPhotosScroll(e) {
        if (scrollLock || currentImportPath === "") {
            return;
        }

        let isForward = true;
        const list = document.querySelector('.importer-photos');
        if (e.deltaY < 0) {
            isForward = false;
        } else if (beforeScrollTop == list.scrollTop && list.scrollTop !== 0) {
            isScrollBottom += 1;
        }
        if (
            list.offsetHeight === list.scrollHeight
            || (!isForward && list.scrollTop === 0)
            || (isForward && isScrollBottom > 5)
        ) {
            setScrollLock(true);
            beforeScrollTop = -1;
            isScrollBottom = 0;
            nextImportPhotosList(e, isForward);
        }
        beforeScrollTop = list.scrollTop;
    }

    function nextImportPhotosList(e, isForward) {
        let page = pathPage[currentImportPath]
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

    function selectPhoto(file) {
        if (file !== undefined && file.path !== undefined) {
            const path = file.path;
            if (!selectedForImport[path]) {
                selectedForImport[path] = file;
            } else {
                selectedForImport[path] = false;
            }
            if (!selectedForImport[path]) {
                setImageInSelectedPhotos(undefined);
                delete selectedForImport[path];
            } else {
                setImageInSelectedPhotos(file);
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
            let page = pathPage[currentImportPath]
            showImporter(files[0].replace(/[^\/]+$/, ""), page, 20);
        }
    }

    function selectAllInThisPage() {
        let photos = document.getElementsByClassName("import-photo");
        _selectAll(photos);
    }

    function selectAll() {
        if (currentImportPath != "") {
            invoke("get_photos_to_import_under_directory", { pathStr: currentImportPath, dateAfterStr: importerFilter }).then((r) => {
                let files = JSON.parse(r);
                let photos = [];
                for (let i = 0; i < files.length; i++) {
                    console.log(files[i]);
                    photos.push({ id: files[i].path, created_at: files[i].created_at });
                }
                _selectAll(photos);
            });
        }
    }

    function _selectAll(photos) {
        let lastFile = undefined;
        for (let i = 0; i < photos.length; i++) {
            console.log(photos[i])
            selectedForImport[photos[i].id] = photos[i];
            lastFile = photos[i];
        }
        selectPhoto(undefined);
        if (lastFile) {
            setImageInSelectedPhotos({ path: lastFile.id, created_at: lastFile.created_at || lastFile.dataset.createdAt });
        }
    }

    function unselectAll() {
        setSelectedForImport({});
        setImageInSelectedPhotos(undefined);
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
        if (importerFilter) {
            args["dateStr"] = importerFilter;
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

    function filterImporter(date) {
        setImporterFilter(date);
    }

    return (
        <>
            <div id="importPhotosDisplay" className="importDisplay"
                onWheel={(e) => importPhotosScroll(e)}
                data-page={pathPage[props.path]}>
                <ul className="list-of-import-path">
                    <li><strong>Import Photos From</strong>:</li>
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
                <div id="import-container">
                    <div id="importer-directories-list">
                        <p>{currentImportPath}:</p>
                        <ul>
                            {(importer.dirs_files.dirs.dirs.length == 0 || importer.dirs_files.dirs.dirs[0].path.match("^/[^\/]+/.+$")) &&
                                <li>
                                    <a href="#" onClick={() => showImporter(importer.dirs_files.dir.path + "/..")}>
                                        ..
                                    </a>
                                </li>
                            }
                            {importer.dirs_files.dirs.dirs.map((l, i) => {
                                return (
                                    <li key={i}>&#128193;
                                        <a title={l.created_at} href="#" onClick={() => showImporter(l.path)}>{l.path.replace(/^.+\//, '')}</a>
                                    </li>
                                );
                            })
                            }
                        </ul>
                    </div>
                    <div id="importer-files-list">
                        {(importer.dirs_files.files.files.length || (importerFilter !== undefined && importerFilter !== "")) > 0 && (
                            <>
                                <div className="row1">page. {pathPage[currentImportPath]}</div>
                                <div className="row1-right">
                                    Created Date: after <input id="filterDate" name="date" type="date" value={importerFilter} onChange={(e) => filterImporter(e.target.value)} />
                                </div>
                                {
                                    importer.dirs_files.files.files.length > 0 && <div className="row0-center">
                                        <button onClick={() => selectAllInThisPage()}>Select All photos in this page</button>
                                        <button onClick={() => selectAll()}>Select All photos in all pages</button>
                                        <button onClick={() => unselectAll()}>Unselect All</button>
                                    </div>
                                }
                            </>
                        )}
                        <div className="navigation">
                            {importer.dirs_files.has_prev_file && (<span><a href="#" onClick={(e) => nextImportPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
                            {importer.dirs_files.has_next_file && (<span><a href="#" onClick={(e) => nextImportPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}
                        </div>
                        <div className="importer-photos">
                            {importer.dirs_files.files.files.map((l, i) => {
                                return (
                                    <>
                                        <div key={i} className={selectedForImport[l.path] ? "row selected" : "row notSelected"} style={{ minWidth: "120px" }}>
                                            <a href="#" id={l.path} className="import-photo" onClick={() => selectPhoto(l)} data-created-at={l.created_at}>
                                                <img src={convertFileSrc(l.path)} style={{ width: "100px" }} />
                                            </a>
                                        </div>
                                    </>
                                );
                            })
                            }
                        </div>
                    </div>
                </div>
            </div>
            <SelectedPhotoInfo
                selectedForImport={selectedForImport}
                setSelectedForImport={setSelectedForImport}
                lastSelected={imageInSelectedPhotos}
                setLastSelected={setImageInSelectedPhotos}
                setImageInSelectedPhotos={setImageInSelectedPhotos}
                setImportProgress={setImportProgress}
                addFooterMessage={props.addFooterMessage}
                removeFooterMessage={props.removeFooterMessage}
            />
        </>
    )

}

export default Importer;