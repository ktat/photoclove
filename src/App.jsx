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
import RandomMessages from "./RandomMessages.jsx"
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
  const [showFirstView, setShowFirstView] = useState(true)

  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
  const [reloadDates, setReloadDates] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [showPhotosList, setShowPhotosList] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [footerMessages, setFooterMessages] = useState({});

  const [shortCutNavigation, setShortCutNavigation] = useState({
    onKeyDown: (e) => { console.log(e) },
    onKeyUp: (e) => { console.log(e) }
  });

  let in_db_creation = false;
  const listened = false;
  useEffect((e) => {
    // const sab = new SharedArrayBuffer(1024);
    const unlisten = listen("click_menu", (e) => {
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
  }, [listened]);

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
      setShowPhotosList(false);
      setShowPreferences(true);
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
            setShowFirstView={setShowFirstView}
            toggleImporter={toggleImporter}
            setCurrentDate={setCurrentDate}
            setReloadDates={setReloadDates}
            reloadDates={reloadDates}
            datePage={datePage}
          />
        </div>
        {showPhotosList && <PhotosList
          setCurrentDate={setCurrentDate}
          currentDate={currentDate}
          datePage={datePage}
          setDatePage={setDatePage}
          shortCutNavigation={shortCutNavigation}
        />}
        {showImporter && <Importer
          addFooterMessage={addFooterMessage}
          removeFooterMessage={removeFooterMessage}
        />}
        {showPreferences && <Preferences
          addFooterMessage={addFooterMessage}
          setShowPreferences={setShowPreferences}
        ></Preferences>}
      </div>
      <footer>
        <div id="footer-message">
          <span>&#x1f980;.｡o( </span>
          {Object.keys(footerMessages).length == 0
            ? <RandomMessages />
            : Object.keys(footerMessages).map((k, i) => {
              return (<React.Fragment key={i}>
                {i > 0 && " | "}
                <span className={k}>
                  {footerMessages[k]}</span>
              </React.Fragment>)
            })}
          <span> )</span>
        </div>
        <div id="copyright">
          PhotoClove &copy; ktat
        </div>
      </footer>
    </div>
  );
}

export default App;
