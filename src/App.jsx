import React, { useState, useEffect } from "react";
import { register } from '@tauri-apps/plugin-global-shortcut';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { ask, message, confirm } from '@tauri-apps/plugin-dialog';
import "./App.css";
import "./components/search.css";
import PhotosList from "./App/PhotosList.jsx"
import DateList from "./App/DateList.jsx"
import Importer from "./App/Importer.jsx"
import Preferences from "./App/Preferences.jsx"
import JobQueue from "./App/JobQueue.jsx"
import Welcome from "./Welcome.jsx"
import Home from "./App/Home.jsx"
// import SearchPage from "./App/SearchPage.jsx" // Now using PhotosList directly for search
import loginGoogle from "./App/Login.jsx"
import Footer from "./App/Footer.jsx"
import WelcomeImage from "./WelcomeImage.jsx";
import ErrorDisplay from "./components/ErrorDisplay.jsx";
import LogViewer from "./App/LogViewer.jsx";
import { useError } from "./context/ErrorContext.jsx";
import { useUI } from "./context/UIContext.jsx";
import { usePhoto } from "./context/PhotoContext.jsx";
import { useDateNavigation } from "./hooks/useDateNavigation.js";
import { useAppConfig } from "./hooks/useAppConfig.js";

function App() {
  const { handleTauriError } = useError();
  const {
    showImporter,
    showPhotosList,
    showPreferences,
    showJobQueue,
    showLogin,
    showSearchPage,
    isAdvancedSearchMode,
    footerMessages,
    welcomeImage,
    setWelcomeImage,
    toggleImporter,
    togglePreferences,
    toggleJobQueue,
    addFooterMessage
  } = useUI();
  const {
    currentDate,
    updateCurrentDate,
    resetPhotoState,
    setCurrentDateNum
  } = usePhoto();
  const { getDates } = useDateNavigation();
  const { useCount } = useAppConfig();
  
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [rightMenuOpen, setRightMenuOpen] = useState(true);
  const [showLogViewer, setShowLogViewer] = useState(false);

  const [shortCutNavigation, setShortCutNavigation] = useState({
    onKeyDown: (e) => { console.log(e) },
    onKeyUp: (e) => { console.log(e) }
  });

  let in_db_creation = false;

  // Add keyboard shortcut for LogViewer (Ctrl+Shift+L)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        setShowLogViewer(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect((e) => {

    let unlisten0, unlisten1, unlisten2, unlisten3, unlisten4;

    const setupListeners = async () => {
      unlisten0 = await listen("click_menu_static", (e) => {
      invoke("lock", { t: true }).then((le) => {
        if (le) {
          if (e.payload === "show_log") {
            setShowLogViewer(true);
          } else if (e.payload === "about") {
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
      unlisten1 = await listen("create_db", (e) => {
      console.log(e);
      if (e.payload === "start") {
        addFooterMessage("create_db", "Database (re)creation is started", false, 10000);
      } else if (e.payload === "finish") {
        addFooterMessage("create_db", "Database is created :)", true, 10000);
      }
    });

      unlisten4 = await listen("create_thumbnails", (e) => {
      console.log(e);
      if (e.payload === "start") {
        addFooterMessage("create_thumbnail", "Thumbnail creation is started", false, 10000);
      } else if (e.payload === "finish") {
        addFooterMessage("create_thumbnail", "Thumbnail is created :)", true, 10000);
      }
    });

      unlisten3 = await listen("move_files", (e) => {
      if (e.payload === "start") {
        addFooterMessage("move_files", "Start moving files");
      } else if (e.payload === "ned_move") {
        addFooterMessage("move_files", "Finish moving files");
      } else {
        addFooterMessage("move_files", "Finish (re)creating DB", true, 10000);
      }
    });

      unlisten2 = await listen("click_menu", (e) => {
      console.log(e)
      invoke("lock", { t: true }).then((le) => {
        if (le) {
          if (e.payload === "load_dates") {
            getDates();
          } else if (e.payload === "HOME") {
            updateCurrentDate("");
            resetPhotoState();
            toggleImporter(false);
            togglePreferences(false);
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
    };

    setupListeners();

    // Listen for refreshDates custom event from Save As Copy feature
    const handleRefreshDates = () => {
      getDates();
    };
    
    window.addEventListener('refreshDates', handleRefreshDates);

    // Cleanup function to remove event listeners
    return () => {
      if (unlisten0) unlisten0();
      if (unlisten1) unlisten1();
      if (unlisten2) unlisten2(); 
      if (unlisten3) unlisten3();
      if (unlisten4) unlisten4();
      window.removeEventListener('refreshDates', handleRefreshDates);
    };
  }, []);



  // login page is not used now.
  function toggleLogin(t) {
    // This function is kept for backward compatibility but should be refactored
    console.log("Login toggle called:", t);
  }
  /*
    HTML code for login page
            <div style={{ display: showLogin ? "block" : "none" }}>
              <Login />
            </div>
  */

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    setGreetMsg(await invoke("greet", { name }));
  }


  if (!showPreferences && !showImporter && !showSearchPage && useCount <= 2) {
    return (
      <>
        <Welcome
          welcomeImage={welcomeImage}
          setWelcomeImage={setWelcomeImage}
          useCount={useCount}
          togglePreferences={togglePreferences}
          toggleImporter={toggleImporter}
        />
        <Footer />
        {showLogViewer && (
          <LogViewer onClose={() => setShowLogViewer(false)} />
        )}
      </>
    );
  }
  
  // Show search page - now using PhotosList directly
  if (showSearchPage) {
    return (
      <>
        <div className="container">
          <div className={`inner-container ${rightMenuOpen ? 'menu-open' : 'menu-closed'}`}>
            <div id="leftMenu" className="leftMenu">
              <div className="navigation-icons">
                <a href="#" onClick={() => {
                  updateCurrentDate("");
                  resetPhotoState();
                  toggleImporter(false);
                  togglePreferences(false);
                  setWelcomeImage(WelcomeImage());
                }} title="HOME">🏠</a>
                <a href="#" onClick={() => {
                  // Search functionality - currently using PhotosList with search mode
                  console.log("Search icon clicked");
                }} title="Search">🔍</a>
                <a href="#" onClick={() => toggleImporter(true)} title="Import">📥</a>
              </div>
              <div className="row">
                <div style={{ display: "none" }}>
                  <input
                    id="greet-input"
                    onChange={(e) => setName(e.currentTarget.value)}
                    placeholder="Enter a name..."
                  />
                  <button type="button" onClick={() => greet()}>
                    Search
                  </button>
                  <p>{greetMsg}</p>
                </div>
              </div>
              <DateList
                getDates={getDates}
                toggleImporter={toggleImporter}
              />
            </div>
            <PhotosList
              shortCutNavigation={shortCutNavigation}
              addFooterMessage={addFooterMessage}
              onRightMenuToggle={setRightMenuOpen}
              searchMode={true}
              isAdvancedSearchMode={isAdvancedSearchMode}
            />
          </div>
        </div>
        <Footer />
        <ErrorDisplay />
        {showLogViewer && (
          <LogViewer onClose={() => setShowLogViewer(false)} />
        )}
      </>
    );
  }
  
  return (
    <div className="container"
    // onKeyDown={(e) => { shortCutNavigation.onKeyDown(e) }}
    // onKeyUp={(e) => { shortCutNavigation.onKeyUp(e) }}
    >
      <div className={`inner-container ${rightMenuOpen ? 'menu-open' : 'menu-closed'}`}>
        <div id="leftMenu" className="leftMenu">
          <div className="navigation-icons">
            <a href="#" onClick={() => {
              updateCurrentDate("");
              resetPhotoState();
              toggleImporter(false);
              togglePreferences(false);
              setWelcomeImage(WelcomeImage());
            }} title="HOME">🏠</a>
            <a href="#" onClick={() => {
              // Search functionality - currently using PhotosList with search mode
              console.log("Search icon clicked");
            }} title="Search">🔍</a>
            <a href="#" onClick={() => toggleImporter(true)} title="Import">📥</a>
          </div>
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
            toggleImporter={toggleImporter}
          />
        </div>
        {(currentDate && showPhotosList) ? <>
          <PhotosList
            shortCutNavigation={shortCutNavigation}
            addFooterMessage={addFooterMessage}
            onRightMenuToggle={setRightMenuOpen}
          />
        </>
          :
          <>
            <div style={{ width: "100%", display: showImporter ? "flex" : "none" }}>
              <Importer
                getDates={getDates}
              />
            </div>
            <div style={{ display: showPreferences ? "block" : "none" }}>
              <Preferences
                togglePreferences={togglePreferences}
              ></Preferences>
            </div>
            <div style={{ display: showJobQueue ? "block" : "none" }}>
              <JobQueue
                toggleJobQueue={toggleJobQueue}
              ></JobQueue>
            </div>
            <div style={{ display: (!showImporter && !showLogin && !showPreferences && !showJobQueue && !showSearchPage && (!currentDate || !showPhotosList)) ? "block" : "none" }}>
              <Home welcomeImage={welcomeImage} setWelcomeImage={setWelcomeImage} />
            </div>
          </>
        }
      </div>
      <Footer />
      <ErrorDisplay />
      {showLogViewer && (
        <LogViewer onClose={() => setShowLogViewer(false)} />
      )}
    </div >
  );
}

export default App;
