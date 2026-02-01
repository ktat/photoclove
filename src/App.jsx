import React, { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { ask, message } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import "./App.css";
import "./components/search.css";
import "./App/LeftMenu.css";
import "./App/Import.css";
import "./components/HelpDialog.css";
import "./components/FormControls.css";
import "./App/Footer.css";
import "./components/Splash.css";
import "./components/PhotoLoading.css";
import PhotosList from "./App/PhotosList.jsx"
import DateList from "./App/DateList.jsx"
import Preferences from "./App/Preferences"
import JobQueue from "./App/JobQueue.jsx"
import Welcome from "./Welcome.jsx"
import Home from "./App/Home.jsx"
// import SearchPage from "./App/SearchPage.jsx" // Now using PhotosList directly for search
import loginGoogle from "./App/Login.jsx"
import Footer from "./App/Footer.jsx"
import WelcomeImage, { getMemoriesStartupImage } from "./WelcomeImage.jsx";
import ErrorDisplay from "./components/ErrorDisplay.jsx";
import LogViewer from "./App/LogViewer.jsx";
import DocumentViewer from "./components/DocumentViewer.jsx";
import LicensesView from "./App/LicensesView.jsx";
import RecoveryQueueModal from "./App/RecoveryQueueModal.jsx";
import InsightsModal from "./App/InsightsModal.jsx";
import AchievementsView from "./App/AchievementsView.jsx";
import AchievementPopup from "./components/AchievementPopup.jsx";
import Tooltip from "./components/Tooltip.jsx";
import NavigationIcons from "./App/NavigationIcons.jsx";
import { useError } from "./context/ErrorContext.jsx";
import { logger } from "./services/LoggerService.js";
import { checkAllAchievements } from "./services/AchievementService.js";
import { useUI } from "./context/UIContext.jsx";
import { usePhoto } from "./context/PhotoContext.jsx";
import { useDateNavigation } from "./hooks/useDateNavigation.js";
import { useAppConfig } from "./hooks/useAppConfig.js";
import { useRef } from "react";

function App() {
  const { t } = useTranslation('common');
  const { handleTauriError } = useError();
  const {
    showImporter,
    showPhotosList,
    showPreferences,
    showLogin,
    showSearchPage,
    isAdvancedSearchMode,
    footerMessages,
    welcomeImage,
    setWelcomeImage,
    toggleImporter,
    togglePreferences,
    toggleSearchPage,
    toggleHome,
    toggleAlbumListMode,
    openTagsList,
    openFacesList,
    openTrash,
    addFooterMessage
  } = useUI();
  const {
    currentDate,
    updateCurrentDate,
    resetPhotoState,
    setCurrentDateNum,
    recentPhotosMode
  } = usePhoto();
  const { getDates } = useDateNavigation();
  const { useCount, setUseCount, config, loadConfig } = useAppConfig();

  // Use ref to access current config in event listeners (avoids stale closure)
  const configRef = useRef(config);
  configRef.current = config;
  
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [rightMenuOpen, setRightMenuOpen] = useState(true);
  const [leftMenuCollapsed, setLeftMenuCollapsed] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);
  const [showJobQueueModal, setShowJobQueueModal] = useState(false);
  const [showLicenses, setShowLicenses] = useState(false);
  const [showRecoveryQueueModal, setShowRecoveryQueueModal] = useState(false);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [tooltipText, setTooltipText] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0 });

  const [shortCutNavigation, setShortCutNavigation] = useState({
    onKeyDown: (e) => { logger.debug('App', 'key_down', 'Key down event', { key: e.key, code: e.code }) },
    onKeyUp: (e) => { logger.debug('App', 'key_up', 'Key up event', { key: e.key, code: e.code }) }
  });

  let in_db_creation = false;

  // Tooltip handlers
  const handleMouseEnter = (text, event) => {
    if (leftMenuCollapsed && event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      const top = rect.top + (rect.height / 2);
      setTooltipPosition({ top });
      setTooltipText(text);
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    setTooltipText("");
  };

  // Update welcome image when config loads (ensures custom images work on startup)
  useEffect(() => {
    if (config) {
      const mode = config?.startup_images?.mode;
      if (mode === 'memories') {
        // Fetch memories photo asynchronously
        getMemoriesStartupImage().then((memoriesImage) => {
          if (memoriesImage) {
            setWelcomeImage(memoriesImage);
          } else {
            // Fallback based on user preference
            const fallback = config?.startup_images?.memories_fallback || 'default';
            if (fallback === 'custom') {
              // Use custom images as fallback
              setWelcomeImage(WelcomeImage({ ...config, startup_images: { ...config.startup_images, mode: 'custom' } }));
            } else {
              // Fallback to default images
              setWelcomeImage(WelcomeImage(null));
            }
          }
        });
      } else {
        setWelcomeImage(WelcomeImage(config));
      }
    }
  }, [config, setWelcomeImage]);

  // Initialize logger from config on app start
  useEffect(() => {
    const initializeLogging = async () => {
      try {
        await logger.initializeFromConfig();
        logger.info('App', 'initialization', 'Logger initialized from config');
      } catch (error) {
        logger.warn('App', 'logger_init_failed', 'Failed to initialize logger from config', { error: error.message });
      }
    };
    initializeLogging();

    // Clear import thumbnail cache on startup
    const clearImportCache = async () => {
      try {
        const removedCount = await invoke('clear_import_cache');
        logger.info('App', 'startup_cache_cleared', 'Import thumbnail cache cleared on startup', {
          removedFiles: removedCount
        });
      } catch (error) {
        logger.warn('App', 'startup_cache_clear_failed', 'Failed to clear import cache on startup', {
          error: error.message
        });
      }
    };
    clearImportCache();

    // Cleanup old discarded recovery queue items (older than 30 days)
    const cleanupRecoveryQueue = async () => {
      try {
        const deletedCount = await invoke('cleanup_recovery_items');
        if (deletedCount > 0) {
          logger.info('App', 'recovery_queue_cleanup', 'Old recovery items cleaned up', {
            deletedCount
          });
        }
      } catch (error) {
        logger.warn('App', 'recovery_queue_cleanup_failed', 'Failed to cleanup recovery queue', {
          error: error.message
        });
      }
    };
    cleanupRecoveryQueue();
  }, []);

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

  // Add keyboard shortcut for Job Queue (Ctrl+Shift+J)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'J') {
        event.preventDefault();
        setShowJobQueueModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Add keyboard shortcut for Recovery Queue (Ctrl+Shift+R)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        setShowRecoveryQueueModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-collapse/expand left menu based on window width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1000) {
        setLeftMenuCollapsed(true);
      } else {
        setLeftMenuCollapsed(false);
      }
    };

    window.addEventListener('resize', handleResize);
    // Check on mount
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);


  useEffect((e) => {

    let unlisten0, unlisten1, unlisten2, unlisten3, unlisten4, unlisten5, menuUnlisten, unlistenImport, unlistenAchievement;

    const setupListeners = async () => {
      // Listen for new menu events (Privacy Policy and Terms of Use)
      menuUnlisten = await listen("menu", (e) => {
        logger.debug('App', 'menu_event', 'Menu event received', { event: e });
        
        // Extract menu ID from the event structure
        const menuId = e.payload?.id || e.id;
        
        if (menuId === "privacy_policy") {
          setShowPrivacyPolicy(true);
        } else if (menuId === "terms_of_use") {
          setShowTermsOfUse(true);
        }
      });

      unlisten0 = await listen("click_menu_static", (e) => {
        logger.debug('App', 'static_menu_event', 'Static menu event received', { event: e });
      invoke("lock", { t: true }).then((le) => {
        if (le) {
          if (e.payload === "show_log") {
            setShowLogViewer(true);
          } else if (e.payload === "about") {
            message("PhotoClove is an application to manage photos.\n (c)ktat");
          } else if (e.payload === "github") {
            open("https://github.com/ktat/photoclove/");
          } else if (e.payload === "sponsor") {
            open("https://github.com/sponsors/ktat");
          } else if (e.payload === "privacy_policy") {
            setShowPrivacyPolicy(true);
          } else if (e.payload === "terms_of_use") {
            setShowTermsOfUse(true);
          } else if (e.payload === "licenses") {
            setShowLicenses(true);
          } else if (e.payload === "achievements") {
            setShowAchievementsModal(true);
          } else {
            logger.warn('App', 'unhandled_menu_event', 'Unmatched menu payload', { payload: e.payload })
          }
          setTimeout(() => {
            invoke("lock", { t: false })
          }, 1000);
        }
      })
    });

      // const sab = new SharedArrayBuffer(1024);
      unlisten1 = await listen("create_db", (e) => {
      logger.error('App', 'app_error', 'Application error', { error: e });
      if (e.payload === "start") {
        addFooterMessage("create_db", "Database (re)creation is started", false, 10000);
      } else if (e.payload === "finish") {
        addFooterMessage("create_db", "Database is created :)", true, 10000);
      }
    });

      unlisten4 = await listen("create_thumbnails", (e) => {
      logger.error('App', 'app_error', 'Application error', { error: e });
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

      // Listen for pending jobs found at startup
      unlisten5 = await listen("pending_jobs_found", async (e) => {
        const pendingCount = e.payload;
        logger.info('App', 'pending_jobs_found', 'Pending jobs found at startup', { count: pendingCount });

        // Ask user if they want to view/manage pending jobs
        const shouldOpen = await ask(
          `${pendingCount} pending job(s) found from previous session.\nWould you like to open the Job Queue to manage them?`,
          { title: 'Pending Jobs Found', kind: 'info' }
        );

        if (shouldOpen) {
          setShowJobQueueModal(true);
        }
      });

      // Listen for import finish to check achievements
      unlistenImport = await listen("import", async (e) => {
        if (e.payload === "finish") {
          logger.info('App', 'import_finish', 'Import finished, checking achievements');
          try {
            const result = await checkAllAchievements();
            if (result.newly_achieved?.length > 0) {
              logger.info('App', 'new_achievements', 'New achievements unlocked', {
                count: result.newly_achieved.length,
              });
              setAchievementQueue((prev) => [...prev, ...result.newly_achieved]);
            }
          } catch (error) {
            logger.error('App', 'achievement_check_error', 'Failed to check achievements', {
              error: error.toString(),
            });
          }
        }
      });

      // Listen for achievement_unlocked event from backend (first-action achievements)
      unlistenAchievement = await listen("achievement_unlocked", (e) => {
        logger.info('App', 'achievement_unlocked', 'Achievement unlocked from backend', {
          achievement: e.payload?.id,
        });
        if (e.payload) {
          setAchievementQueue((prev) => [...prev, e.payload]);
        }
      });

      unlisten2 = await listen("click_menu", (e) => {
      logger.debug('App', 'menu_click_event', 'Menu click event received', { event: e });
      invoke("lock", { t: true }).then((le) => {
        if (le) {
          if (e.payload === "load_dates") {
            getDates();
          } else if (e.payload === "HOME") {
            updateCurrentDate("");
            resetPhotoState();
            toggleHome();
            // Handle memories mode for welcome image
            const currentConfig = configRef.current;
            const mode = currentConfig?.startup_images?.mode;
            if (mode === 'memories') {
              getMemoriesStartupImage().then((memoriesImage) => {
                if (memoriesImage) {
                  setWelcomeImage(memoriesImage);
                } else {
                  const fallback = currentConfig?.startup_images?.memories_fallback || 'default';
                  if (fallback === 'custom') {
                    setWelcomeImage(WelcomeImage({ ...currentConfig, startup_images: { ...currentConfig.startup_images, mode: 'custom' } }));
                  } else {
                    setWelcomeImage(WelcomeImage(null));
                  }
                }
              });
            } else {
              setWelcomeImage(WelcomeImage(currentConfig));
            }
          } else if (e.payload === "import") {
            toggleImporter(true);
          } else if (e.payload === "pref") {
            togglePreferences(true);
          } else if (e.payload === "job_queue") {
            setShowJobQueueModal(true);
          } else if (e.payload == "login") {
            loginGoogle();
          } else if (e.payload === "create_db") {
            // BUG: event is called twice in same time. I don't know the reason why.
            if (in_db_creation) {
              message("DB creation in progress");
            } else {
              ask("It may cost long time.\nAre you OK?", "Create DB?").then((e) => {
                if (e) {
                  in_db_creation = true;
                  invoke("create_db").then(() => {
                    in_db_creation = false;
                  });
                }
              }).catch((e) => {
                logger.error('App', 'create_db_error', 'Create DB error', { error: e });
              })
            }
          }
          setTimeout(() => {
            invoke("lock", { t: false });
          }, 1000);
        }
      });
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
      if (menuUnlisten) menuUnlisten();
      if (unlisten0) unlisten0();
      if (unlisten1) unlisten1();
      if (unlisten2) unlisten2();
      if (unlisten3) unlisten3();
      if (unlisten4) unlisten4();
      if (unlisten5) unlisten5();
      if (unlistenImport) unlistenImport();
      if (unlistenAchievement) unlistenAchievement();
      window.removeEventListener('refreshDates', handleRefreshDates);
    };
  }, []);



  // login page is not used now.
  function toggleLogin(t) {
    // This function is kept for backward compatibility but should be refactored
    logger.debug('App', 'login_toggle', 'Login toggle called', { enabled: t });
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


  // Wait for config to load before deciding what to show
  if (useCount === null) {
    return (
      <div className="loading-container">
        <div className="loading-scene">
          <div className="loading-flash"></div>
          <div className="loading-crab">&#x1f980;</div>
          <div className="loading-camera">&#x1f4f7;</div>
          <div className="loading-camera">&#x1f4f7;</div>
          <div className="loading-camera">&#x1f4f7;</div>
        </div>
        <div className="loading-text">{t('status.loading')}</div>
      </div>
    );
  }

  if (!showPreferences && !showImporter && !showSearchPage && useCount <= 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Welcome
          welcomeImage={welcomeImage}
          setWelcomeImage={setWelcomeImage}
          useCount={useCount}
          setUseCount={setUseCount}
          togglePreferences={togglePreferences}
          toggleImporter={toggleImporter}
          config={config}
        />
        <Footer onRecoveryQueueClick={() => setShowRecoveryQueueModal(true)} />
        {showLogViewer && (
          <LogViewer onClose={() => setShowLogViewer(false)} />
        )}
        {showRecoveryQueueModal && (
          <RecoveryQueueModal onClose={() => setShowRecoveryQueueModal(false)} addFooterMessage={addFooterMessage} />
        )}
        <Tooltip show={leftMenuCollapsed && showTooltip} text={tooltipText} position={tooltipPosition} />
      </div>
    );
  }

  // Determine if PhotosList should be shown (including search mode)
  const shouldShowPhotosList = showPhotosList || showImporter || showSearchPage;

  return (
    <div className="container"
    // onKeyDown={(e) => { shortCutNavigation.onKeyDown(e) }}
    // onKeyUp={(e) => { shortCutNavigation.onKeyUp(e) }}
    >
      <div className={`inner-container ${rightMenuOpen ? 'menu-open' : 'menu-closed'} ${leftMenuCollapsed ? 'left-menu-collapsed' : ''}`}>
        <div id="leftMenu" className={`leftMenu ${leftMenuCollapsed ? 'collapsed' : ''}`} aria-label="Main navigation sidebar" role="navigation">
          <NavigationIcons
            updateCurrentDate={updateCurrentDate}
            resetPhotoState={resetPhotoState}
            toggleHome={toggleHome}
            setWelcomeImage={setWelcomeImage}
            toggleSearchPage={toggleSearchPage}
            toggleImporter={toggleImporter}
            toggleAlbumListMode={toggleAlbumListMode}
            openTagsList={openTagsList}
            openFacesList={openFacesList}
            openTrash={openTrash}
            setShowInsightsModal={setShowInsightsModal}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
            config={config}
          />
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
            toggleSearchPage={toggleSearchPage}
            leftMenuCollapsed={leftMenuCollapsed}
            setLeftMenuCollapsed={setLeftMenuCollapsed}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
            showTooltip={showTooltip}
            tooltipText={tooltipText}
            tooltipPosition={tooltipPosition}
          />
        </div>
        {(() => {
          logger.debug('App', 'render_decision', 'App render decision', {
            showPhotosList, showImporter, showPreferences, showJobQueueModal,
            showSearchPage, currentDate, recentPhotosMode, shouldShowPhotosList
          });
          if (shouldShowPhotosList) {
            logger.debug('App', 'rendering_photos_list', 'Rendering PhotosList component', {
              isImportMode: showImporter,
              isSearchMode: showSearchPage
            });
          }
          return shouldShowPhotosList;
        })() ? <>
          <PhotosList
            config={config}
            shortCutNavigation={shortCutNavigation}
            addFooterMessage={addFooterMessage}
            onRightMenuToggle={setRightMenuOpen}
            searchMode={showSearchPage}
            isAdvancedSearchMode={isAdvancedSearchMode}
            setShowJobQueueModal={setShowJobQueueModal}
            getDatesNum={getDates}
          />
        </>
          :
          <>{(() => {
            logger.debug('App', 'not_rendering_photos_list', 'NOT rendering PhotosList - showing other components');
            return null;
          })()}
            <div style={{ display: showPreferences ? "block" : "none" }}>
              <Preferences
                togglePreferences={togglePreferences}
                reloadConfig={loadConfig}
              ></Preferences>
            </div>
            <div style={{ display: (() => {
              const willShowHome = (!showImporter && !showLogin && !showPreferences && !showJobQueueModal && !showSearchPage && ((!currentDate && !recentPhotosMode) || !showPhotosList));
              logger.debug('App', 'home_display_condition', 'Home display condition evaluated', { 
                showImporter, showLogin, showPreferences, showJobQueueModal, showSearchPage, 
                currentDate, recentPhotosMode, showPhotosList, willShowHome 
              });
              return willShowHome ? "block" : "none";
            })() }}>
              {(() => {
                logger.debug('App', 'rendering_home', 'Rendering Home component');
                return null;
              })()}
              <Home welcomeImage={welcomeImage} setWelcomeImage={setWelcomeImage} config={config} />
            </div>
          </>
        }
      </div>
      <Footer onRecoveryQueueClick={() => setShowRecoveryQueueModal(true)} />
      <ErrorDisplay />
      {showLogViewer && (
        <LogViewer onClose={() => setShowLogViewer(false)} />
      )}
      {showPrivacyPolicy && (
        <DocumentViewer
          title="Privacy Policy"
          fileName="privacy-policy"
          onClose={() => setShowPrivacyPolicy(false)}
        />
      )}
      {showTermsOfUse && (
        <DocumentViewer
          title="Terms of Use"
          fileName="terms-of-use"
          onClose={() => setShowTermsOfUse(false)}
        />
      )}
      {showJobQueueModal && (
        <JobQueue onClose={() => setShowJobQueueModal(false)} addFooterMessage={addFooterMessage} />
      )}
      {showLicenses && (
        <LicensesView onClose={() => setShowLicenses(false)} />
      )}
      {showRecoveryQueueModal && (
        <RecoveryQueueModal onClose={() => setShowRecoveryQueueModal(false)} addFooterMessage={addFooterMessage} />
      )}
      {showInsightsModal && (
        <InsightsModal onClose={() => setShowInsightsModal(false)} />
      )}
      {showAchievementsModal && (
        <AchievementsView onClose={() => setShowAchievementsModal(false)} />
      )}
      {achievementQueue.length > 0 && (
        <AchievementPopup
          achievement={achievementQueue[0]}
          onClose={() => setAchievementQueue((prev) => prev.slice(1))}
        />
      )}
      <Tooltip show={leftMenuCollapsed && showTooltip} text={tooltipText} position={tooltipPosition} />
    </div >
  );
}

export default App;
