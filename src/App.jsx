import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/shell";
import { listen } from "@tauri-apps/api/event";
import { ask, message, confirm } from '@tauri-apps/api/dialog';
import "./App.css";
import ReactPlayer from 'react-player';
import { tauri } from "@tauri-apps/api";

const unlisten = listen("click_menu_static", (e) => {
  if (e.payload === "about") {
    message("PhotoClove is an application to manage photos.\n (c)ktat");
  } else if (e.payload === "github") {
    open("https://github.com/ktat/photoclove/");
  }
});

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  // left menu
  const [dateList, setDateList] = useState([]);

  // photos list
  const [photos, setPhotosList] = useState({ "files": [] });
  const [icon_size, setIconSize] = useState(100);
  const [sort_of_photos, setSort] = useState(0);
  const [num_of_photo, setNumOfPhoto] = useState(20);
  const [datePage, setDatePage] = useState({});
  const [photoZoom, setPhotoZoom] = useState("100%");
  const [currentDate, setCurrentDate] = useState("");
  const [pathPage, setPathPage] = useState({});

  // photo info
  const [photoInfo, setPhotoInfo] = useState({});

  // photo display
  const [currentPhotoPath, setCurrentPhotoPath] = useState("");
  const [photoDisplayClass, setPhotoDisplayClass] = useState("photoDisplayHidden");

  // import display
  const [importDisplayClass, setImportDisplayClass] = useState("importDisplayHidden");
  const [importer, setImporter] = useState({ "has_next_files": false, "dirs_files": { dir: { "path": "" }, "dirs": { "dirs": [] }, "files": { "files": [] } } });
  const [selectedForImport, setSelectedForImport] = useState({});
  const [selectedPhotosClass, setSelectedPhotosClass] = useState("selectedPhotosHidden");
  const [imageInSelectedPhotos, setImageInSelectedPhotos] = useState("");
  const [currentImportPath, setCurrentImportPath] = useState("");
  const [importProgress, setImportProgress] = useState({});
  const [importPaths, setImportPaths] = useState([]);
  const [importPhotosPage, setImportPhotosPage] = useState(1);


  const [rightMenuClass, setRightMenuClass] = useState("rightMenu");
  const [centerDisplayClass, setCenterDisplayClass] = useState("centerDisplay");
  const [photoDisplayImgClass, setPhotoDisplayImgClass] = useState("");

  const [photoLoading, setPhotoLoading] = useState(false);
  const [dragPhotoInfo, setDragPhotoInfo] = useState([]);
  const [scrollLock, setScrollLock] = useState(false);
  const [moveHistory, setMoveHistrogy] = useState([]);

  const getDates = () => {
    invoke("get_dates").then((r) => {
      let l = JSON.parse(r);
      setDateList(l);
    });
  };

  useEffect((e) => {
    if (currentDate != "") {
      delete datePage[currentDate];
      photos.files = [];
      setPhotosList({ "files": [] });
      setDatePage({});
      getPhotos(undefined, true);
    }
    const unlisten = listen("click_menu", (e) => {
      if (e.payload === "load_dates") {
        getDates();
      } else if (e.payload === "import") {
        showImporter();
      }
    });
  }, [num_of_photo, sort_of_photos, icon_size]);

  function photosScroll(e) {
    if (scrollLock || currentDate === "") {
      return;
    }

    setScrollLock(true);

    let isForward = true;
    if (e.deltaY < 0) {
      isForward = false;
    }
    nextPhotosList(e, isForward)
  }

  function nextPhotosList(e, isForward) {
    let target = document.getElementById("photoList");
    let page = target.getAttribute("data-page");
    let date = target.getAttribute("data-date");
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
    datePage[date] = page;
    setDatePage(datePage);
    getPhotos(e, isForward)
  }

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

  function moveToTrashCan(f) {
    invoke("move_to_trash", { dateStr: currentDate, pathStr: f, sortValue: parseInt(sort_of_photos) }).then((r) => {
      console.log("target:", r);
      if (!r) {
        setCurrentDate("");
        getPhotos(undefined, undefined);
        setCurrentPhotoPath("");
      } else {
        setCurrentPhotoPath(r);
        console.log("select photo:", r);
        displayPhoto(r)
      }
    });
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

  function photoNavigation(e) {
    if (e.keyCode === 39) { // right arrow
      nextPhoto(currentPhotoPath)
    } else if (e.keyCode === 37) { // left arrow
      prevPhoto(currentPhotoPath)
    } else if (e.keyCode === 46) { // Del
      moveToTrashCan(currentPhotoPath)
    } else if (e.ctrlKey && e.keyCode === 48) { // ctrl+0
      setPhotoZoom("100%");
    }
  }

  async function importPhotos() {
    const fn = (f) => {
      invoke("get_import_progress").then((r) => {
        let data = JSON.parse(r);
        setImportProgress(data);
        if (data.now_importing) {
          setTimeout(() => { f(f) }, 1000);
        }
      })
    };
    console.log("invoke import_photos");
    await invoke("import_photos", { files: Object.keys(selectedForImport) }).then((r) => {
      setSelectedForImport({});
      setTimeout(() => { fn(fn) }, 1);
    });
  }

  function dragPhotoStart(e) {
    setPhotoDisplayImgClass("photo_dragging");
    setDragPhotoInfo({ is_dragging: true, x: e.clientX, y: e.clientY });
  }

  function dragPhoto(e) {
    if (dragPhotoInfo.is_dragging) {
      let x = e.clientX - dragPhotoInfo.x;
      let y = e.clientY - dragPhotoInfo.y;
      let display = e.currentTarget.parentElement;
      display.scrollTop -= y / 20;
      display.scrollLeft -= x / 20;
    } else {
      console.log(e.clientY - document.getElementsByClassName("photo")[0].children[0].offsetTop);
      console.log(e.clientX - document.getElementsByClassName("photo")[0].children[0].offsetLeft);
      console.log([e.clientX, e.clientY])
    }
  }

  function dragPhotoEnd(e) {
    setPhotoDisplayImgClass("");
    setDragPhotoInfo({});
  }

  // TODO: not correct scroll adjustment.
  function photoScroll(e) {
    let zoom = parseInt(photoZoom.replace("%", ""));

    const imgTag = document.querySelector(".photo img");
    const display = e.currentTarget.parentElement;

    let x = e.clientX - imgTag.offsetLeft + display.scrollLeft;
    let y = e.clientY - imgTag.offsetTop + display.scrollTop;

    let xPos = x / imgTag.width;
    let yPos = y / imgTag.height;

    console.log(['percent', yPos, xPos]);

    if (e.deltaY > 0) {
      zoom -= 10;
      if (zoom <= 100) {
        zoom = 100;
      }
    } else {
      zoom += 10;
    }

    setPhotoZoom(zoom + "%");

    const sTop = (imgTag.height * yPos - display.clientHeight * yPos);
    const sLeft = (imgTag.width * xPos - display.clientWidth * xPos);
    display.scrollTop = sTop - sTop % 10;
    display.scrollLeft = sLeft - sLeft % 10;
  }

  function changeSort(e, value) {
    setSort(value);
  }

  function changeNumOfPhoto(e, value) {
    console.log("set: " + value);
    setNumOfPhoto(value)
  }

  function displayPhoto(f) {
    setPhotoZoom("100%");
    getPhotoInfo(f);
    setCurrentPhotoPath(f);
    toggleCenterDisplay(true);
    document.getElementById("photoDisplay").focus();
  }

  function toggleCenterDisplay(t) {
    if (t) {
      setCenterDisplayClass("centerDisplayHidden");
      setImportDisplayClass("importDisplayHidden");
      setSelectedPhotosClass("selectedPhotosHidden");
      setPhotoDisplayClass("photoDisplay");
      setRightMenuClass("rightMenu");
    } else {
      setPhotoDisplayClass("photoDisplayHidden");
      setImportDisplayClass("importDisplayHidden");
      setSelectedPhotosClass("selectedPhotosHidden");
      setCenterDisplayClass("centerDisplay");
      setRightMenuClass("rightMenu");
    }
  }

  async function showImporter(path, page, num) {
    toggleShowImporter(true);
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

  function toggleShowImporter(t) {
    if (t) {
      setCenterDisplayClass("centerDisplayHidden");
      setPhotoDisplayClass("photoDisplayHidden");
      setRightMenuClass("rightMenuHidden");
      setImportDisplayClass("importDisplay");
      setSelectedPhotosClass("selectedPhotos");
    } else {
      setPhotoDisplayClass("photoDisplayHidden");
      setImportDisplayClass("importDisplayHidden");
      setRightMenuClass("rightMenu");
      setCenterDisplayClass("centerDisplay");
      setSelectedPhotosClass("selectedPhotosHidden");
    }
  }

  async function prevPhoto(f) {
    await invoke("get_prev_photo", { path: f, dateStr: currentDate, sortValue: parseInt(sort_of_photos) }).then((r) => {
      if (r !== "") {
        setPhotoZoom("100%");
        setCurrentPhotoPath(r);
        getPhotoInfo(r);
      }
    });
  }

  async function nextPhoto(f) {
    await invoke("get_next_photo", { path: f, dateStr: currentDate, sortValue: parseInt(sort_of_photos) }).then((r) => {
      if (r !== "") {
        setPhotoZoom("100%");
        setCurrentPhotoPath(r);
        getPhotoInfo(r);
      }
    });
  }

  async function getPhotos(e, isForward) {
    setPhotoLoading(true);
    setPhotosList({ files: [] });
    toggleCenterDisplay();
    let sort = sort_of_photos;
    let num = num_of_photo;
    let date;
    if (e && e.currentTarget && e.currentTarget.getAttribute("data-date")) {
      date = e.currentTarget.getAttribute("data-date");
    } else {
      date = currentDate;
    }
    if (!date || date == "") {
      return;
    }
    let page = datePage[date];
    setCurrentDate(date)
    if (!page || page == "NaN") {
      page = 1;
    }
    page = parseInt(page);
    await invoke("get_photos", { dateStr: date, sortValue: parseInt(sort), page: page, num: parseInt(num) }).then((r) => {
      let data = JSON.parse(r);
      let l = data.files;
      let tags = [];
      if (l.length > 0) {
        setPhotosList(data);
      } else {
        page -= 1;
      }
      datePage[date] = page;
      setDatePage(datePage);
      setPhotoLoading(false);
      setTimeout(() => { setScrollLock(false) }, 200);
    });
  };

  async function getPhotoInfo(path) {
    await invoke("get_photo_info", { pathStr: path }).then((r) => {
      let data = JSON.parse(r);
      setPhotoInfo(data);
    });
  };

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

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="container" onKeyDown={(e) => photoNavigation(e)}>
      <div id="leftMenu" className="leftMenu">
        <h1>PhotoClove&#x1f980;</h1>
        <a href="#" onClick={() => showImporter()}>&#10145;import</a>
        <div className="row">
          <div>
            <input
              id="greet-input"
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="Enter wrods for search"
            />
            <button type="button" onClick={() => greet()}>
              Search
            </button>
          </div>
        </div>

        <p>{greetMsg}</p>

        <p>List of Date <a href="#" onClick={() => getDates()}>⟳</a></p>
        <div className="dateList">
          <ul>
            {dateList.map((l, i) => {
              let date = new Date(l.year + '/' + l.month + '/' + l.day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
              return (<li key={i} >
                <a href="#" onClick={(e) => getPhotos(e, undefined)} data-date={date} data-page={datePage[date]}>
                  {date}
                </a></li>)
            })
            }
          </ul>
        </div>
      </div>

      {/* CENTER DISPLAY */}
      <div id="photoLoading" className={photoLoading ? "photoLoadingOn" : "photoLoadingOff"}>
        <h1>Now Loading Photos ...</h1>
        <div className="lds-dual-ring"></div>
      </div>
      <div className={centerDisplayClass} id="photoList" onWheel={(e) => photosScroll(e)} data-date={currentDate} data-page={datePage[currentDate]}>
        <div>
          List of Photos
          <div className="photoPageInfo">{currentDate} page:{datePage[currentDate]}</div>
          <div className="photoOperation">
            Icon:<select name="icon_size" defaultValue="100" onChange={(e) => setIconSize(e.target.value)}>
              <option value={50}>small</option>
              <option value={100}>normal</option>
              <option value={200}>large</option>
              <option value={300}>huge</option>
            </select>
            Sort:<select name="sort" onChange={(e) => changeSort(e, e.target.value)}>
              <option value={0}>photo time</option>
              <option value={1}>time</option>
              <option value={2}>name</option>
            </select>
            Num:<select name="num" defaultValue="20" onChange={(e) => changeNumOfPhoto(e, e.target.value)}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
            </select>
          </div>
        </div>
        <div className="navigation">
          {photos.has_prev && (<span><a href="#" onClick={(e) => nextPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
          {photos.has_next && (<span><a href="#" onClick={(e) => nextPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}
        </div>
        <div className="photos">
          {photos.files.map((l, i) => {
            return <li key={i}><a href="#" onClick={() => { displayPhoto(l.file.path) }}><img style={{ maxWidth: icon_size + 'px', maxHeight: icon_size + 'px' }} src={convertFileSrc(l.file.path)} /></a>
              <a href="#" onClick={() => getPhotoInfo(l.file.path)} >(&#8505;)</a></li>
          })}
        </div>
      </div>
      {/* PHOTO DISPLAY */}
      <div id="photoDisplay" autoFocus={true} className={photoDisplayClass}>
        <p>Photo Viewer</p>
        <a href="#" onClick={() => prevPhoto(currentPhotoPath)}>&lt;&lt; prev</a>&nbsp;&nbsp;
        || <a href="#" onClick={() => toggleCenterDisplay()}>close</a> ||&nbsp;&nbsp;
        <a href="#" onClick={() => nextPhoto(currentPhotoPath)}>next &gt;&gt;</a><br /><br />
        <a href="#" onClick={() => moveToTrashCan(currentPhotoPath)}>&#128465;</a>
        <div className="photo">
          <img className={photoDisplayImgClass} src={convertFileSrc(currentPhotoPath)} width={photoZoom}
            onMouseDown={(e) => dragPhotoStart(e)}
            onMouseMove={(e) => dragPhoto(e)}
            onMouseUp={(e) => dragPhotoEnd(e)}
            onWheel={(e) => photoScroll(e)} />
        </div>
      </div>
      {/* IMPORT DISPLAY */}
      <div className={importDisplayClass} id="importPhotosDisplay" onWheel={(e) => importPhotosScroll(e)} data-path={currentImportPath} data-page={pathPage[currentImportPath]}>
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
      {/* SELECTED PHOTO INFO */}
      <div className={selectedPhotosClass}>
        <p>Selected Photos for import</p>
        {Object.keys(selectedForImport).length > 0 && <div><button type="button" onClick={() => importPhotos()}>Import Selected Photos</button></div>}
        <div>
          {Object.keys(selectedForImport).length} photos are selected
        </div>
        <ul id="listOfselectedForImport">
          {Object.keys(selectedForImport).map((l, i) => {
            let rest = l.replace(/([^\/]+)$/, "");
            let filename = RegExp.$1;
            return (<li key={i}><a href="#" onClick={() => setImageInSelectedPhotos(l)}>{filename}</a></li>);
          })
          }
        </ul>
        <div>
          {imageInSelectedPhotos != "" && <img className="imageInSelectedPhotos" src={convertFileSrc(imageInSelectedPhotos)} />}
        </div>
      </div>
      {/* PHOTO INFO */}
      <div className={rightMenuClass}>
        <p>Photo Info</p>
        <div>
          {currentPhotoPath && (
            <table>
              <tbody>
                <tr><th>File Name</th>{currentPhotoPath.replace(/^.+\//, '')}</tr>
                <tr><th>ISO</th><td>{photoInfo.ISO}</td></tr>
                <tr><th>FNumber</th><td>{photoInfo.FNumber}</td></tr>
                <tr><th>LensModel</th><td>{photoInfo.LensModel}</td></tr>
                <tr><th>LensMake</th><td>{photoInfo.LensMake}</td></tr>
                <tr><th>Make</th><td>{photoInfo.Make}</td></tr>
                <tr><th>Model</th><td>{photoInfo.Model}</td></tr>
                <tr><th>Date & Time</th><td>{photoInfo.DateTime}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
