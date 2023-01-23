import { useState, useEffect } from "react";
import { register } from "@tauri-apps/api/globalShortcut";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/shell";
import { listen } from "@tauri-apps/api/event";
import { ask, message, confirm } from '@tauri-apps/api/dialog';
import "./App.css";
import PhotosList from "./PhotosList.jsx"
import PhotoLoading from "./PhotoLoading.jsx"
import DateList from "./DateList.jsx"
import Importer from "./Importer.jsx"
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
  // example
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [showFirstView, setShowFirstView] = useState(true)

  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
  const [reloadDates, setReloadDates] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showPhotosList, setShowPhotosList] = useState(true);

  const [photoLoading, setPhotoLoading] = useState(false);
  const [shortCutNavigation, setShortCutNavigation] = useState({
    onKeyDown: (e) => { console.log(e) },
    onKeyUp: (e) => { console.log(e) }
  });

  const listened = false;
  useEffect((e) => {
    const unlisten = listen("click_menu", (e) => {
      console.log(e);
      if (e.payload === "load_dates") {
        console.log(reloadDates);
        setReloadDates(true);
      } else if (e.payload === "import") {
        toggleImporter(true);
      }
    });
  }, [listened]);

  function toggleImporter(t) {
    if (t) {
      setShowImporter(true);
      setShowPhotosList(false);
    } else {
      setShowImporter(false);
      setShowPhotosList(true);
    }
  }

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="container"
    // onKeyDown={(e) => { shortCutNavigation.onKeyDown(e) }}
    // onKeyUp={(e) => { shortCutNavigation.onKeyUp(e) }}
    >
      <div id="leftMenu" className="leftMenu">
        <h1>PhotoClove&#x1f980;</h1>
        <a href="#" onClick={() => toggleImporter(true)}>&#10145;import</a>
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
        <DateList
          setShowFirstView={setShowFirstView}
          toggleImporter={toggleImporter}
          setCurrentDate={setCurrentDate}
          setReloadDates={setReloadDates}
          reloadDates={reloadDates}
          datePage={datePage}
        />
      </div>
      {photoLoading && <PhotoLoading />}
      {showPhotosList && <PhotosList
        setPhotoLoading={setPhotoLoading}
        setCurrentDate={setCurrentDate}
        currentDate={currentDate}
        datePage={datePage}
        setDatePage={setDatePage}
        shortCutNavigation={shortCutNavigation}
      />}
      {showImporter && <Importer
        setPhotoLoading={setPhotoLoading}
      />}
    </div>
  );
}

export default App;
