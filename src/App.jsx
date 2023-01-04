import { useState,useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";


function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [dateList, setDateList] = useState("");
  const [photos, setPhotoList] = useState("");
  const [photoInfo, setPhotoInfo] = useState("");
  const [name, setName] = useState("");
  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
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
  
  async function getPhotos(e) {
    let date = e.currentTarget.getAttribute("data-date");
    let page = datePage[date];
    setCurrentDate(date)
    if (!page || page == "NaN") {
      page = 1;
    }
    page = parseInt(page);
    await invoke("get_photos", {dateStr: date, sortStr: "time", page: page}).then((r) => {
      let l = JSON.parse(r);
      let tags = [];
      if (l.length > 0) {
        for (let i in l) {
          tags.push(<li><img width="100" src={l[i].file.path}></img><a href="#" onClick={() => getPhotoInfo(l[i].file.path)} >(info)</a></li>);
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
      setPhotoInfo(r);
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
      
      <div className="centerDisplay" onWheel={(e) => photoScroll(e)} data-date={currentDate} data-page={datePage[currentDate]}>
        <p>
          List of Photos {currentDate} page:{datePage[currentDate]}
          <div className="photoOperation">
            
            Sort:
            Num:
          </div>

        </p>
        <div>{photos}</div>
      </div>

      <div className="rightMenu">
        <p>Photo Info</p>
        <div>{photoInfo}</div>
      </div>
    </div>
  );
}

export default App;
