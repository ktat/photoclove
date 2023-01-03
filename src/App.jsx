import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";


function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [dateList, setDateList] = useState("");
  const [photos, setPhotoList] = useState("");
  const [photoInfo, setPhotoInfo] = useState("");
  const [name, setName] = useState("");
  const getDates = () => {
    invoke("get_dates").then((r) => {
     let l = JSON.parse(r);
     let tags = [];
     for (let i in l) {
       tags.push(<li><a href="#" onClick={(e) => getPhotos(e)}>{l[i].year}/{l[i].month}/{l[i].day}</a></li>);
     }
     setDateList(tags);
    });
  };
  
  async function getPhotos(e) {
    let date = e.currentTarget.innerHTML
    await invoke("get_photos", {dateStr: date}).then((r) => {
      let l = JSON.parse(r);
      let tags = [];
      for (let i in l) {
        tags.push(<li><img width="100" src={l[i].file.path}></img><a href="#" onClick={() => getPhotoInfo(l[i].file.path)} >(info)</a></li>);
      }
      setPhotoList(tags);
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
      
      <div className="centerDisplay">
        <p>List of Photos</p>
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
