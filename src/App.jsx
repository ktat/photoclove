import React, { useState, useEffect } from "react";
import { register } from '@tauri-apps/plugin-global-shortcut';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { ask, message, confirm } from '@tauri-apps/plugin-dialog';
import "./App.css";
import PhotosList from "./App/PhotosList.jsx"
import DateList from "./App/DateList.jsx"
import Importer from "./App/Importer.jsx"
import Preferences from "./App/Preferences.jsx"
import JobQueue from "./App/JobQueue.jsx"
import Welcome from "./Welcome.jsx"
import Home from "./App/Home.jsx"
import loginGoogle from "./App/Login.jsx"
import Footer from "./App/Footer.jsx"
import WelcomeImage from "./WelcomeImage.jsx";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [useCount, setUseCount] = useState(0)

  const [dateList, setDateList] = useState([]);
  const [datePage, setDatePage] = useState({});
  const [currentDate, setCurrentDate] = useState("");
  const [showImporter, setShowImporter] = useState(false);
  const [showPhotosList, setShowPhotosList] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showJobQueue, setShowJobQueue] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [footerMessages, setFooterMessages] = useState({});
  const [dateNum, setDateNum] = useState({});
  const [showPhotoDisplay, setShowPhotoDisplay] = useState({});
  const [hideLoading, setHideLoading] = useState(false);
  const [welcomeImage, setWelcomeImage] = useState("");

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

    const unlisten0 = listen("click_menu_static", (e) => {
      invoke("lock", { t: true }).then((le) => {
        if (le) {
          if (e.payload === "about") {
            message("PhotoClove is an application to manage photos.\n (c)ktat");
          } else if (e.payload === "github") {
            open("https://github.com/ktat/photoclove/");
          } else {
            console.log("not match" + e.payload)
          }
          setTimeout(() => {
            invoke("lock", { t: false })
          }, 1000);
        }
      })
    });

    // const sab = new SharedArrayBuffer(1024);
    const unlisten1 = listen("create_db", (e) => {
      console.log(e);
      if (e.payload === "start") {
        addFooterMessage("create_db", "Database (re)creation is started", false, 10000);
      } else if (e.payload === "finish") {
        addFooterMessage("create_db", "Database is created :)", true, 10000);
      }
    });

    const unlisten4 = listen("create_thumbnails", (e) => {
      console.log(e);
      if (e.payload === "start") {
        addFooterMessage("create_thumbnail", "Thumbnail creation is started", false, 10000);
      } else if (e.payload === "finish") {
        addFooterMessage("create_thumbnail", "Thumbnail is created :)", true, 10000);
      }
    });

    const unlisten3 = listen("move_files", (e) => {
      if (e.payload === "start") {
        addFooterMessage("move_files", "Start moving files");
      } else if (e.payload === "ned_move") {
        addFooterMessage("move_files", "Finish moving files");
      } else {
        addFooterMessage("move_files", "Finish (re)creating DB", true, 10000);
      }
    });

    const unlisten2 = listen("click_menu", (e) => {
      console.log(e)
      invoke("lock", { t: true }).then((le) => {
        if (le) {
          if (e.payload === "load_dates") {
            getDates();
          } else if (e.payload === "HOME") {
            setCurrentDate("");
            setShowPhotosList(false);
            setShowImporter(false);
            setShowPreferences(false);
            setWelcomeImage(WelcomeImage());
          } else if (e.payload === "import") {
            toggleImporter(true);
          } else if (e.payload === "pref") {
            togglePreferences(true);
          } else if (e.payload === "job_queue") {
            toggleJobQueue(true);
          } else if (e.payload == "login") {
            loginGoogle();
          }
          setTimeout(() => {
            invoke("lock", { t: false });
          }, 1000);
        }
      });
      if (e.payload === "create_db") {
        invoke("lock", { t: true }).then((le) => {
          if (le) {
            // BUG: event is called twice in same time. I don't know the reason why.
            if (in_db_creation) {
              message("DB creation in progress");
              setTimeout(() => {
                invoke("lock", { t: false });
              }, 1000);
            } else {
              ask("It may cost long time.\nAre you OK?", "Create DB?").then((e) => {
                if (e) {
                  in_db_creation = true;
                  invoke("create_db").then(() => {
                    in_db_creation = false;
                  });
                }
              }).catch((e) => {
                setTimeout(() => {
                  invoke("lock", { t: false });
                }, 1000);
                console.log("error: " + e);
              })
            }
          }
        })
      }
    });
  }, []);

  function getDates() {
    setHideLoading(false);
    invoke("get_dates").then((r) => {
      let l = JSON.parse(r);
      setDateList(l);
      let datesStr = "";
      const newDateNum = {};
      let n = 0;
      const promises = [];
      l.map((v, i) => {
        n += 1;
        datesStr += v.year
        if (v.month < 10) {
          datesStr += "-0" + v.month;
        } else {
          datesStr += "-" + v.month;
        }
        if (v.day < 10) {
          datesStr += "-0" + v.day;
        } else {
          datesStr += "-" + v.day;
        }
        if (i !== l.length - 1 && n < 20) {
          datesStr += ",";
        }
        if (n == 20 || i == l.length - 1) {
          const reqDatesStr = datesStr;
          n = 0;
          datesStr = "";
          const promise = new Promise((resolve, reject) => {
            invoke("get_dates_num", { datesStr: reqDatesStr }).then((r) => {
              console.log(r);
              let l = JSON.parse(r);
              return resolve(l);
            }).catch((e) => { console.log(e) });
          });
          promises.push(promise);
        }
      });
      Promise.all(promises).then((results) => {
        results.map((result) => {
          Object.keys(result).map((k) => {
            newDateNum[k] = result[k];
          })
          setDateNum(newDateNum);
          setHideLoading(true);
        });
      })
    });
  };

  function addFooterMessage(k, v, withDialog, deleteAfter) {
    const newMessages = {};
    Object.keys(footerMessages).map((k, i) => {
      newMessages[k] = footerMessages[k];
    })
    newMessages[k] = v;
    if (withDialog) {
      invoke("lock", { t: true }).then((e) => {
        if (e) {
          message(v).then((e) => {
            invoke("lock", { t: false });
          });
        }
      });
    }
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
      setShowJobQueue(false);
      setShowLogin(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
    }
  }

  // login page is not used now.
  function toggleLogin(t) {
    if (t) {
      setShowLogin(true);
      setShowImporter(false);
      setShowPhotosList(false);
      setShowPreferences(false);
      setShowJobQueue(false);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(false);
    }
  }
  /*
    HTML code for login page
            <div style={{ display: showLogin ? "block" : "none" }}>
              <Login />
            </div>
  */

  function togglePreferences(t) {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowJobQueue(false);
      setShowPreferences(true);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
      setShowPhotosList(true);
    }
  }

  function toggleJobQueue(t) {
    if (t) {
      setShowImporter(false);
      setShowPhotosList(false);
      setShowLogin(false);
      setShowPreferences(false);
      setShowJobQueue(true);
    } else {
      setShowImporter(false);
      setShowPreferences(false);
      setShowJobQueue(false);
      setShowLogin(false);
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
          welcomeImage={welcomeImage}
          setWelcomeImage={setWelcomeImage}
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
            <div style={{ display: "none" }}>
              <input
                id="search-input"
                onChange={(e) => setName(e.currentTarget.value)}
                placeholder="Enter wrods for search"
              />
              <button type="button" onClick={() => greet()}>
                Search
              </button>
              <p>{greetMsg}</p>
            </div>
          </div>
          <DateList
            getDates={getDates}
            dateList={dateList}
            setDateList={setDateList}
            toggleImporter={toggleImporter}
            setCurrentDate={setCurrentDate}
            datePage={datePage}
            dateNum={dateNum}
            setDateNum={setDateNum}
            setShowPhotoDisplay={setShowPhotoDisplay}
            hideLoading={hideLoading}
          />
        </div>
        {(currentDate && showPhotosList) ? <>
          <PhotosList
            dateList={dateList}
            setDateList={setDateList}
            setShowPhotoDisplay={setShowPhotoDisplay}
            showPhotoDisplay={showPhotoDisplay}
            setCurrentDate={setCurrentDate}
            currentDate={currentDate}
            datePage={datePage}
            setDatePage={setDatePage}
            shortCutNavigation={shortCutNavigation}
            addFooterMessage={addFooterMessage}
            dateNum={dateNum}
            setDateNum={setDateNum}
            setCurrentDateNum={setCurrentDateNum}
          />
        </>
          :
          <>
            <div style={{ width: "100%", display: showImporter ? "flex" : "none" }}>
              <Importer
                getDates={getDates}
                addFooterMessage={addFooterMessage}
                removeFooterMessage={removeFooterMessage}
              />
            </div>
            <div style={{ display: showPreferences ? "block" : "none" }}>
              <Preferences
                togglePreferences={togglePreferences}
                addFooterMessage={addFooterMessage}
                setShowPreferences={setShowPreferences}
              ></Preferences>
            </div>
            <div style={{ display: showJobQueue ? "block" : "none" }}>
              <JobQueue
                toggleJobQueue={toggleJobQueue}
                addFooterMessage={addFooterMessage}
                setShowJobQueue={setShowJobQueue}
              ></JobQueue>
            </div>
            <div style={{ display: (!showImporter && !showLogin && !showPreferences && !showJobQueue && (!currentDate || !showPhotosList)) ? "block" : "none" }}>
              <Home welcomeImage={welcomeImage} setWelcomeImage={setWelcomeImage} />
            </div>
          </>
        }
      </div>
      <Footer addFooterMessage={addFooterMessage} footerMessages={footerMessages} />
    </div >
  );
}

export default App;
