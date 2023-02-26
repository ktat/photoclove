import React, { useState, useEffect } from "react";
import { register } from "@tauri-apps/api/globalShortcut";
import { invoke, convertFileSrc } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/shell";
import { listen } from "@tauri-apps/api/event";
import { ask, message, confirm } from '@tauri-apps/api/dialog';
import "./App.css";
import PhotosList from "./PhotosList.jsx"
import DateList from "./DateList.jsx"
import Importer from "./Importer.jsx"
import Preferences from "./Preferences.jsx"
import Welcome from "./Welcome.jsx"
import Home from "./Home.jsx"
import Footer from "./Footer.jsx"
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
  const [useCount, setUseCount] = useState(0)

  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
  const [reloadDates, setReloadDates] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showPhotosList, setShowPhotosList] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [footerMessages, setFooterMessages] = useState({});
  const [dateNum, setDateNum] = useState({});

  const [shortCutNavigation, setShortCutNavigation] = useState({
    onKeyDown: (e) => { console.log(e) },
    onKeyUp: (e) => { console.log(e) }
  });

  function setCurrentDateNum(num) {
    const newDateNum = {};
    Object.keys(dateNum).map((k) => {
      newDateNum[k] = dateNum[k];
    });
    newDateNum[currentDate.replace(/\//g, "-")] = num;
    setDateNum(newDateNum)
  }
  let in_db_creation = false;

  useEffect((e) => {
    invoke("get_config", {},).then((e) => {
      const json = JSON.parse(e);
      setUseCount(json.use_count);
    });

    // const sab = new SharedArrayBuffer(1024);
    const unlisted1 = listen("create_db", (e) => {
      console.log(e);
      if (e.payload === "start") {
        addFooterMessage("create_db", "Database (re)creation is started", 10000);
      } else if (e.payload === "finish") {
        addFooterMessage("create_db", "Database is created :)", 10000);
      }
    });
    const unlisted3 = listen("move_files", (e) => {
      if (e.payload === "start") {
        addFooterMessage("move_files", "Start moving files");
      } else if (e.payload === "ned_move") {
        addFooterMessage("move_files", "Finish moving files");
      } else {
        addFooterMessage("move_files", "Finish (re)creating DB", 10000);
      }
    });

    const unlisten2 = listen("click_menu", (e) => {
      console.log(e);
      if (e.payload === "load_dates") {
        console.log(reloadDates);
        setReloadDates(true);
      } else if (e.payload === "import") {
        toggleImporter(true);
      } else if (e.payload === "pref") {
        togglePreferences(true);
      } else if (e.payload === "create_db") {
        // BUG: event is called twice in same time. I don't know the reason why.
        invoke("lock", { t: true }).then((e) => {
          if (e) {
            if (in_db_creation) {
              message("DB creation in progress");
              invoke("lock", { t: false });
            } else {
              ask("It may cost long time.\nAre you OK?", "Create DB?").then((e) => {
                invoke("lock", { t: false });
                if (e) {
                  in_db_creation = true;
                  invoke("create_db").then(() => {
                    in_db_creation = false;
                  });
                }
              }).catch((e) => {
                invoke("lock", { t: false });
                console.log("error: " + e);
              })
            }
          }
        });
      }
    });
  }, []);

  function addFooterMessage(k, v, deleteAfter) {
    const newMessages = {};
    Object.keys(footerMessages).map((k, i) => {
      newMessages[k] = footerMessages[k];
    })
    newMessages[k] = v;
    setFooterMessages(newMessages)
    if (deleteAfter) {
      setTimeout(() => { removeFooterMessage(k) }, deleteAfter);
    }
  }

  function removeFooterMessage(targetKey, timeAfter) {
    const newMessages = {};
    if (!timeAfter) {
      timeAfter = 0;
    }
    setTimeout(() => {
      delete footerMessages[targetKey];
      Object.keys(footerMessages).map((k, i) => {
        newMessages[k] = footerMessages[k];
      })
      setFooterMessages(newMessages);
    }, timeAfter);
  }

  function toggleImporter(t) {
    if (t) {
      setShowImporter(true);
      setShowPhotosList(false);
      setShowPreferences(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowPhotosList(true);
    }
  }

  function togglePreferences(t) {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowPreferences(true);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowPhotosList(true);
    }
  }

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }

  if (!showPreferences && !showImporter && useCount <= 2) {
    return (
      <>
        <Welcome
          setUseCount={setUseCount}
          useCount={useCount}
          togglePreferences={togglePreferences}
          toggleImporter={toggleImporter}
        />
        <Footer addFooterMessage={addFooterMessage} footerMessages={footerMessages} />
      </>
    );
  }
  return (
    <div className="container"
    // onKeyDown={(e) => { shortCutNavigation.onKeyDown(e) }}
    // onKeyUp={(e) => { shortCutNavigation.onKeyUp(e) }}
    >
      <div className="inner-container">
        <div id="leftMenu" className="leftMenu">
          <a href="#" onClick={() => toggleImporter(true)}>&#10145;import</a>
          <div className="row">
            <div>
              <input
                id="search-input"
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
            toggleImporter={toggleImporter}
            setCurrentDate={setCurrentDate}
            setReloadDates={setReloadDates}
            reloadDates={reloadDates}
            datePage={datePage}
            dateNum={dateNum}
            setDateNum={setDateNum}
          />
        </div>
        {
          (currentDate && showPhotosList)
            ?
            <PhotosList
              setCurrentDate={setCurrentDate}
              currentDate={currentDate}
              datePage={datePage}
              setDatePage={setDatePage}
              shortCutNavigation={shortCutNavigation}
              addFooterMessage={addFooterMessage}
              dateNum={dateNum}
              setCurrentDateNum={setCurrentDateNum}
            />
            :
            showImporter
              ?
              <Importer
                addFooterMessage={addFooterMessage}
                removeFooterMessage={removeFooterMessage}
              />
              :
              showPreferences
                ?
                <Preferences
                  togglePreferences={togglePreferences}
                  addFooterMessage={addFooterMessage}
                  setShowPreferences={setShowPreferences}
                ></Preferences>
                :
                <Home />
        }
      </div>
      <Footer addFooterMessage={addFooterMessage} footerMessages={footerMessages} />
    </div>
  );
}

export default App;
