import { useState,useEffect } from "react";
import { invoke,convertFileSrc } from "@tauri-apps/api/tauri";
import "./App.css";
import ReactPlayer from 'react-player';
import { tauri } from "@tauri-apps/api";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [dateList, setDateList] = useState([]);
  const [photos, setPhotoList] = useState("");
  const [photoInfo, setPhotoInfo] = useState("");
  const [name, setName] = useState("");
  const [scrollLock, setScrollLock] = useState(false);
  const [icon_size, setIconSize] = useState(100);
  const [sort_of_photos, setSort] = useState(0);
  const [num_of_photo, setNumOfPhoto] = useState(20);
  const [datePage, setDatePage] = useState({});
  const [photoZoom, setPhotoZoom] = useState("100%");
  const [currentDate, setCurrentDate] = useState("");
  const [currentPhotoPath, setCurrentPhotoPath] = useState("");
  const [photoDisplayClass, setPhotoDisplayClass] = useState("photoDisplayHidden");
  const [importDisplayClass, setImportDisplayClass] = useState("importDisplayHidden");
  const [rightMenuClass, setRightMenuClass] = useState("rightMenu");
  const [centerDisplayClass, setCenterDisplayClass] = useState("centerDisplay");
  const [importer, setImporter] = useState({"has_next_files": false, "dirs_files":{dir:{"path":""}, "dirs": {"dirs": []}, "files": {"files": []}}});
  const [selectedForImport, setSelectedForImport] = useState({});
  const [selectedPhotosClass, setSelectedPhotosClass] = useState("selectedPhotosHidden");
  const [imageInSelectedPhotos, setImageInSelectedPhotos] = useState("");
  const [importPhotosPage, setImportPhotosPage] = useState(1);
  const [pathPage, setPathPage] = useState({});
  const [currentImportPath, setCurrentImportPath] = useState("");

  const getDates = () => {
    invoke("get_dates").then((r) => {
     let l = JSON.parse(r);
     setDateList(l);
    });
  };

  useEffect( (e) => {
    if (currentDate != "") {
      setDatePage({});
      getPhotos(undefined, sort_of_photos, num_of_photo, 1);
    }
  }, [num_of_photo, sort_of_photos, icon_size]);

  function photosScroll(e) {
    if (scrollLock) {
      return;
    }
    setScrollLock(true);
    
    if (currentDate == "") {
      return
    }
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
    if (! isForward) {
      page -= 1;
      if (page <= 0) {
        page = 1;
      }
    } else {
      page += 1;
    }
    datePage[date] = page;
    setDatePage(datePage);
    getPhotos(e)
  }

  function nextImportPhotosList(e, isForward) {
    let target = document.getElementById("importPhotosList");
    let page = target.getAttribute("data-page");
    let path = target.getAttribute("data-path");
    if (!page || page == "NaN") {
      page = 0;
    }
    page = parseInt(page);
    if (! isForward) {
      page -= 1;
      if (page <= 0) {
        page = 1;
      }
    } else {
      page += 1;
    }
    pathPage[path] = page;
    setPathPage(pathPage);
    showImporter(currentImportPath, page, 20);
  }

function photoNavigation(e) {
  if (e.keyCode === 39) {
    nextPhoto(currentPhotoPath)
  } else if (e.keyCode === 37) {
    prevPhoto(currentPhotoPath)
  }
}

function importPhotos() {
  invoke("import_photos", {files: Object.keys(selectedForImport)}).then((r) => {
    setSelectedForImport({})
  });
}

// TODO: not correct scroll adjustment.
function photoScroll(e) {
    let zoom = parseInt(photoZoom.replace("%",""));
    let display = e.currentTarget.parentElement;

    let x = e.clientX - document.getElementById("leftMenu").clientWidth;
    let y = e.clientY - 100;
    let img = new Image();
    img.src = e.currentTarget.src;
    let realX = img.width;
    let realY = img.height;
    if (x > display.clientWidth) {
      x = display.clientWidth;
    }
    if (y > display.clientHeight) {
      y = display.clientHeight;
    }

    if (e.deltaY > 0) {
      zoom -= 10;
      if (zoom <= 100) {
        zoom = 100;
      }
    } else {
      zoom += 10;
    }

    let posX = (realX - display.scrollLeft * zoom / 100) * (zoom / 100) * (x / display.clientWidth);
    let posY = (realY - display.scrollTop * zoom / 100)  * (zoom / 100) * (y / display.clientHeight);
    display.scrollTop  = posY;
    display.scrollLeft = posX;

    setPhotoZoom(zoom + "%");
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
    setCurrentPhotoPath(f);
    toggleCenterDisplay(true);
    document.getElementById("photoDisplay").focus();
    getPhotoInfo(f);
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
    if (!path) {
      path = currentImportPath;
    }
    page = pathPage[path] ||= 1;
    let args = {pathStr: path, page: page, num: num || 20};
    await invoke("show_importer", args).then((r) => {
      let data = JSON.parse(r);
      setCurrentImportPath(path);
      setPathPage(pathPage);
      setImporter(data);
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
    await invoke("get_prev_photo", {path: f, dateStr: currentDate, sortValue: parseInt(sort_of_photos)}).then((r) => {
      if (r !== "")  {
        setPhotoZoom("100%");
        setCurrentPhotoPath(r);
      }
    });
  }

  async function nextPhoto(f) {
    await invoke("get_next_photo", {path: f, dateStr: currentDate, sortValue: parseInt(sort_of_photos)}).then((r) => {
      if (r !== "")  {
        setPhotoZoom("100%");
        setCurrentPhotoPath(r);
      }
    });
  }

  async function getPhotos(e, givenSort, givenNum, givenPage) {
    toggleCenterDisplay();
    let sort = sort_of_photos;
    let target = document.getElementById("photoList");
    if (givenNum !== undefined) {sort = givenSort}
    let num = num_of_photo;
    if (givenNum !== undefined) {num = givenNum}
    let date;
    if (e && e.currentTarget && e.currentTarget.getAttribute("data-date")) {
      date = e.currentTarget.getAttribute("data-date");
     } else {
      date = currentDate;
     }
    let page = datePage[date];
    setCurrentDate(date)
    if (!page || page == "NaN") {
      page = 1;
    }
    if (givenPage !== undefined) {
      page = givenPage;
    }
    page = parseInt(page);
    await invoke("get_photos", {dateStr: date, sortValue: parseInt(sort), page: page, num: parseInt(num)}).then((r) => {
      let data = JSON.parse(r);
      let l = data.files;
      let tags = [];
      if (l.length > 0) {
        if (data.has_prev) {
          tags.push(<><a href="#" onClick={(e) => nextPhotosList(e, false)}>Prev</a>&nbsp;&nbsp;</>)
        }
        if (data.has_next) {
          tags.push(<>&nbsp;&nbsp;<a href="#" onClick={(e) => nextPhotosList(e, true)}>Next</a></>)
        }
        tags.push(<><br /><br /></>)
        for (let i in l) {
          if (l[i].file.path.match(/\.(mp4|webm)/i)) {
            // tags.push(<><ReactPlayer controls={true} width={icon_size} url={l[i].file.path} /></>)
          } else if (l[i].file.path.match(/\.(png|jpe?g|gif)/i)) {
            tags.push(<li><a href="#"  onClick={() => {displayPhoto(l[i].file.path)}}><img width={icon_size} src={convertFileSrc(l[i].file.path)} /></a>
            <a href="#" onClick={() => getPhotoInfo(l[i].file.path)} >(&#8505;)</a></li>);
          }
        }
        setPhotoList(tags);
      } else {
        page -= 1;
      }
      datePage[date] = page;
      setDatePage(datePage);
      setTimeout(() => {setScrollLock(false)}, 500);
    });
  };

  async function getPhotoInfo(path) {
    await invoke("get_photo_info", {pathStr: path}).then((r) => {
      let data = JSON.parse(r);
      let tag = (<table>
        <tr><th>ISO</th><td>{data.ISO}</td></tr>
        <tr><th>FNumber</th><td>{data.FNumber}</td></tr>
        <tr><th>LensModel</th><td>{data.LensModel}</td></tr>
        <tr><th>LensMake</th><td>{data.LensMake}</td></tr>
        <tr><th>Make</th><td>{data.Make}</td></tr>
        <tr><th>Model</th><td>{data.Model}</td></tr>
        <tr><th>Date & Time</th><td>{data.DateTime}</td></tr>
      </table>)
      setPhotoInfo(tag);
    });
  };

  function selectPhoto (path) {
    selectedForImport[path] = !selectedForImport[path];
    if (!selectedForImport[path]) {
      setImageInSelectedPhotos("");
      delete selectedForImport[path];
    } else {
      setImageInSelectedPhotos(path);
    }
    let files = [];
    let removes = [];
    Object.keys(selectedForImport).forEach(path => {
      if (selectedForImport[path]) {
        files.push(path);
      }
    });
    invoke("select_file", {selected: files}).then((r) => {
      setSelectedForImport(selectedForImport);
      showImporter(path.replace(/[^\/]+$/, ""));
    })
  }

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }
	
  return (
    <div className="container" onKeyDown={(e) => photoNavigation(e)}>
      <div id="leftMenu" className="leftMenu">
        <h1>Photoclove&#x1f980;</h1>
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

        <p>List of Date <a href="#" onClick={() => getDates()}>load dates</a></p>
        <div className="dateList">
          <ul>
            {dateList.map((l,i) => {
              let date = l.year + '/' + l.month + '/' + l.day;
              return (<li><a key={i} href="#" onClick={(e) => getPhotos(e)} data-date={date} data-page={datePage[date]}>{date}</a></li> )
              })
            }
          </ul>
        </div>
      </div>
      
      {/* CENTER DISPLAY */}
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
              <option value={0}>time</option>
              <option value={1}>name</option>
            </select>
            Num:<select name="num" defaultValue="20" onChange={(e) => changeNumOfPhoto(e, e.target.value)}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <div className="photos">{photos}</div>
      </div>
      {/* PHOTO DISPLAY */}
      <div id="photoDisplay" autoFocus={true} className={photoDisplayClass}>
        <p>Photo Viewer</p>
        <a href="#" onClick={() => prevPhoto(currentPhotoPath)}>&lt;&lt; prev</a>&nbsp;&nbsp;
        || <a href="#" onClick={() => toggleCenterDisplay()}>close</a> ||&nbsp;&nbsp;
        <a href="#" onClick={() => nextPhoto(currentPhotoPath)}>next &gt;&gt;</a><br /><br />
        <div className="photo">
        <img src={convertFileSrc(currentPhotoPath)} width={photoZoom} onWheel={(e) => photoScroll(e)} />
        </div>
        </div>
      {/* IMPORT DISPLAY */}
      <div className={importDisplayClass} id="importPhotosList" data-path={currentImportPath} data-page={pathPage[currentImportPath]}>
        <p>Import Photos</p>
        <p>Directories:</p>
        <ul>
        {(importer.dirs_files.dirs.dirs.length == 0 || importer.dirs_files.dirs.dirs[0].path.match("^/[^\/]+/.+$")) &&
          <li><a href="#" onClick={() => showImporter(importer.dirs_files.dir.path + "/..")}>..</a></li>
        }
        {importer.dirs_files.dirs.dirs.map((l,i) => {
            return (
                <li key={i}>&#128193;
                <a href="#" onClick={() => showImporter(l.path)}>{l.path.replace(/^.+\//, '')}</a>
                </li>
              );
          })
        }
        </ul>
        <p>Files:</p>
        <div>
        {importer.dirs_files.has_prev_file && (<span><a href="#" onClick={(e) => nextImportPhotosList(e, false)}>&lt;&lt; Prev&nbsp;</a></span>)}
        {importer.dirs_files.has_next_file && (<span><a href="#" onClick={(e) => nextImportPhotosList(e, true)}>&nbsp;Next &gt;&gt;</a></span>)}
        </div>
        <div className="photos">
        <ul>
        {importer.dirs_files.files.files.map((l,i) => {
            return (
              <li key={i} className={selectedForImport[l.path] ? "selected" : "notSelected"}><a href="#" id={l.path} onClick={() => selectPhoto(l.path)}><img src={convertFileSrc(l.path)} width="100" /></a></li>
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
        <ul>
        {Object.keys(selectedForImport).map((l, i) => {
          let rest = l.replace(/([^\/]+)$/, "");
          let filename = RegExp.$1;
          return (<li key={i}><a href="#" onClick={() => setImageInSelectedPhotos(l)}>{filename}</a></li>);
        })
        }
        </ul>
        <div>
        {imageInSelectedPhotos != "" && <img className="imageInSelectedPhotos" src={convertFileSrc(imageInSelectedPhotos)}/>}
        </div>
      </div>
      {/* PHOTO INFO */}
      <div className={rightMenuClass}>
        <p>Photo Info</p>
        <div>{photoInfo}</div>
      </div>
    </div>
  );
}

export default App;
