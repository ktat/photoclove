import { useState,useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";
import { tauri } from "@tauri-apps/api";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [dateList, setDateList] = useState("");
  const [photos, setPhotoList] = useState("");
  const [photoInfo, setPhotoInfo] = useState("");
  const [name, setName] = useState("");
  const [sort, setSort] = useState(0);
  const [num, setNum] = useState(20);
  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
  const [currentPhotoPath, setCurrentPhotoPath] = useState("");
  const [photoDisplayClass, setPhotoDisplayClass] = useState("photoDisplayHidden");
  const [rightMenuClass, setRightMenuClass] = useState("rightMenu");
  const [centerDisplayClass, setCenterDisplayClass] = useState("centerDisplay");
  const getDates = () => {
    invoke("get_dates").then((r) => {
     let l = JSON.parse(r);
     let tags = [];
     for (let i in l) {
       let date = l[i].year + '/' + l[i].month + '/' + l[i].day;
       tags.push(<li><a href="#" onClick={(e) => getPhotos(e)} data-date={date} data-page={datePage[date]}>{date}</a></li>);
     }
     setDateList(tags);
    });
  };

  function photoScroll(e) {
    let page = e.currentTarget.getAttribute("data-page")
    let date = e.currentTarget.getAttribute("data-date")
    if (!page || page == "NaN") {
      page = 0;
    }
    page = parseInt(page);
    if (e.deltaY < 0) {
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

  function changeSort(e) {
    let value = e.currentTarget.value;
    setSort(value)
    setDatePage({})
  }

  function changeNum(e) {
    let value = e.currentTarget.value;
    setNum(value)
    setDatePage({})
  }

  function displayPhoto(f) {
    console.log(f)
    setCurrentPhotoPath(f);
    toggleCenterDisplay(true);
    getPhotoInfo(f);
  }

  function toggleCenterDisplay(t) {
    if (t) {
      setCenterDisplayClass("centerDisplayHidden");
      setPhotoDisplayClass("photoDisplay");
    } else {
      setPhotoDisplayClass("photoDisplayHidden");
      setCenterDisplayClass("centerDisplay");
    }
  }

  async function prevPhoto(f) {
    await invoke("get_prev_photo", {path: f, dateStr: currentDate, sortValue: parseInt(sort)}).then((r) => {
      if (r !== "")  {
        setCurrentPhotoPath(r);
      }
    });
  }

  async function nextPhoto(f) {
    console.log(f);
    await invoke("get_next_photo", {path: f, dateStr: currentDate, sortValue: parseInt(sort)}).then((r) => {
      if (r !== "")  {
        setCurrentPhotoPath(r);
      }
    });
  }
  
  async function getPhotos(e) {
    toggleCenterDisplay();
    let date = e.currentTarget.getAttribute("data-date");
    let page = datePage[date];
    setCurrentDate(date)
    if (!page || page == "NaN") {
      page = 1;
    }
    page = parseInt(page);
    await invoke("get_photos", {dateStr: date, sortValue: parseInt(sort), page: page, num: parseInt(num)}).then((r) => {
      let l = JSON.parse(r);
      let tags = [];
      if (l.length > 0) {
        for (let i in l) {
          tags.push(<li><a href="#"  onClick={() => {displayPhoto(l[i].file.path)}}><img width="100" src={l[i].file.path} /></a>
          <a href="#" onClick={() => getPhotoInfo(l[i].file.path)} >(info)</a></li>);
        }
        setPhotoList(tags);
      } else {
        page -= 1;
      }
      datePage[date] = page;
      setDatePage(datePage);
    });
  };

  async function getPhotoInfo(path) {
    await invoke("get_photo_info", {pathStr: path}).then((r) => {
      let data = JSON.parse(r);
      let tag = (<table>
        <tr><th>ISO</th><td>{data.ISO}</td></tr>
        <tr><th>FNumber</th><td>{data.FNumber}</td></tr>
        <tr><th>Date & Time</th><td>{data.DateTime}</td></tr>
      </table>)
      setPhotoInfo(tag);
    });
  };

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="container">
      <div className="leftMenu">
        <h1>Photoclove</h1>
  
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
        <ul>
          {dateList}
        </ul>
      </div>
      
      <div className={centerDisplayClass} onWheel={(e) => photoScroll(e)} data-date={currentDate} data-page={datePage[currentDate]}>
        <p>
          List of Photos {currentDate} page:{datePage[currentDate]}
          <div className="photoOperation">
            
            Sort:<select name="sort" value={sort} onChange={(e) => changeSort(e)}>
              <option value={0}>time</option>
              <option value={1}>name</option>
            </select>
            Num:<select name="num" value={num} onChange={(e) => changeNum(e)}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </div>

        </p>
        <div>{photos}</div>
      </div>
      <div className={photoDisplayClass}>
        <p>Photo Viewer</p>
        <img src={currentPhotoPath} />
        <a href="#" onClick={() => prevPhoto(currentPhotoPath)}>&lt;&lt; prev</a>&nbsp;|&nbsp;
        <a href="#" onClick={() => nextPhoto(currentPhotoPath)}>next &gt;&gt;</a><br /><br />
        || <a href="#" onClick={() => toggleCenterDisplay()}>close</a> ||
      </div>
      <div className={rightMenuClass}>
        <p>Photo Info</p>
        <div>{photoInfo}</div>
      </div>
    </div>
  );
}

export default App;
