/**
 * Custom hook for App-level Tauri event listeners
 * Extracted from App.jsx to reduce file size and improve maintainability
 */

import { useEffect, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { logger } from '../services/LoggerService.js';
import { checkAllAchievements } from '../services/AchievementService.js';
import WelcomeImage, { getMemoriesStartupImage } from '../WelcomeImage.jsx';
import loginGoogle from '../App/Login.jsx';
import { MENU_ACTIONS, MENU_EVENTS } from '../App/constants/menuActions.js';

/**
 * Setup all App-level event listeners
 */
export function useAppEventListeners({
    config,
    setShowLogViewer,
    setShowPrivacyPolicy,
    setShowTermsOfUse,
    setShowLicenses,
    setShowAchievementsModal,
    setShowJobQueueModal,
    setShowNotificationCenter,
    setAchievementQueue,
    addFooterMessage,
    getDates,
    updateCurrentDate,
    resetPhotoState,
    toggleHome,
    setWelcomeImage,
    toggleImporter,
    togglePreferences,
    toggleSearchPage,
    dialog,
}) {
    // Use ref to access current config in event listeners (avoids stale closure)
    const configRef = useRef(config);
    configRef.current = config;

    useEffect(() => {
        let menuUnlisten, unlisten0, unlisten1, unlisten2, unlisten3, unlisten4, unlisten5, unlistenImport, unlistenAchievement;

        const setupListeners = async () => {
            // Listen for new menu events (Privacy Policy and Terms of Use)
            menuUnlisten = await listen(MENU_EVENTS.MENU, (e) => {
                logger.debug('App', 'menu_event', 'Menu event received', { event: e });
                const menuId = e.payload?.id || e.id;

                if (menuId === MENU_ACTIONS.PRIVACY_POLICY) {
                    setShowPrivacyPolicy(true);
                } else if (menuId === MENU_ACTIONS.TERMS_OF_USE) {
                    setShowTermsOfUse(true);
                }
            });

            // Static menu handler
            unlisten0 = await listen(MENU_EVENTS.CLICK_MENU_STATIC, (e) => {
                logger.debug('App', 'static_menu_event', 'Static menu event received', { event: e });
                invoke("lock", { t: true }).then((le) => {
                    if (le) {
                        try {
                            handleStaticMenuAction(e.payload, {
                                setShowLogViewer,
                                setShowPrivacyPolicy,
                                setShowTermsOfUse,
                                setShowLicenses,
                                setShowAchievementsModal,
                                setShowNotificationCenter,
                                dialog,
                            });
                        } catch (err) {
                            logger.error('App', 'static_menu_error', 'Static menu handler error', { error: err.toString() });
                        } finally {
                            setTimeout(() => invoke("lock", { t: false }), 1000);
                        }
                    }
                });
            });

            // DB creation events
            unlisten1 = await listen(MENU_EVENTS.CREATE_DB, (e) => {
                logger.debug('App', 'create_db_event', 'Create DB event', { payload: e.payload });
                if (e.payload === "start") {
                    addFooterMessage("create_db", "Database (re)creation is started", false, 10000);
                } else if (e.payload === "finish") {
                    addFooterMessage("create_db", "Database is created :)", true, 10000);
                }
            });

            // Thumbnail creation events
            unlisten4 = await listen(MENU_EVENTS.CREATE_THUMBNAILS, (e) => {
                logger.debug('App', 'create_thumbnails_event', 'Create thumbnails event', { payload: e.payload });
                if (e.payload === "start") {
                    addFooterMessage("create_thumbnail", "Thumbnail creation is started", false, 10000);
                } else if (e.payload === "finish") {
                    addFooterMessage("create_thumbnail", "Thumbnail is created :)", true, 10000);
                }
            });

            // Move files events
            unlisten3 = await listen(MENU_EVENTS.MOVE_FILES, (e) => {
                if (e.payload === "start") {
                    addFooterMessage("move_files", "Start moving files");
                } else if (e.payload === "ned_move") {
                    addFooterMessage("move_files", "Finish moving files");
                } else {
                    addFooterMessage("move_files", "Finish (re)creating DB", true, 10000);
                }
            });

            // Pending jobs found at startup
            unlisten5 = await listen(MENU_EVENTS.PENDING_JOBS_FOUND, async (e) => {
                const pendingCount = e.payload;
                logger.info('App', 'pending_jobs_found', 'Pending jobs found at startup', { count: pendingCount });

                const shouldOpen = await dialog.confirm({
                    title: 'Pending Jobs Found',
                    message: `${pendingCount} pending job(s) found from previous session.\nWould you like to open the Job Queue to manage them?`,
                    kind: 'info',
                });

                if (shouldOpen) {
                    setShowJobQueueModal(true);
                }
            });

            // Import finish events
            unlistenImport = await listen(MENU_EVENTS.IMPORT, async (e) => {
                if (e.payload === "finish") {
                    logger.info('App', 'import_finish', 'Import finished, refreshing dates and checking achievements');
                    getDates();
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

            // Achievement unlocked events (Tauri event from backend)
            unlistenAchievement = await listen(MENU_EVENTS.ACHIEVEMENT_UNLOCKED, (e) => {
                logger.info('App', 'achievement_unlocked', 'Achievement unlocked from backend Tauri event', {
                    achievement: e.payload?.id,
                });
                if (e.payload) {
                    setAchievementQueue((prev) => [...prev, e.payload]);
                }
            });

            // Dynamic menu handler
            unlisten2 = await listen(MENU_EVENTS.CLICK_MENU, (e) => {
                logger.debug('App', 'menu_click_event', 'Menu click event received', { event: e });
                invoke("lock", { t: true }).then((le) => {
                    if (le) {
                        try {
                            handleDynamicMenuAction(e.payload, {
                                configRef,
                                getDates,
                                updateCurrentDate,
                                resetPhotoState,
                                toggleHome,
                                setWelcomeImage,
                                toggleImporter,
                                togglePreferences,
                                toggleSearchPage,
                                setShowJobQueueModal,
                            });
                        } catch (err) {
                            logger.error('App', 'dynamic_menu_error', 'Dynamic menu handler error', { error: err.toString() });
                        } finally {
                            setTimeout(() => invoke("lock", { t: false }), 1000);
                        }
                    }
                });
            });
        };

        setupListeners();

        // Listen for refreshDates custom event
        const handleRefreshDates = () => getDates();
        window.addEventListener('refreshDates', handleRefreshDates);

        // Listen for achievement unlocked via window event (from AchievementService.js)
        // Window events are synchronous, avoiding race condition where Tauri event listeners
        // may not be registered yet during early initialization (e.g., Quick View mode)
        const achievedIds = new Set();
        const handleAchievementUnlocked = (e) => {
            const achievements = e.detail;
            if (Array.isArray(achievements)) {
                const newAchievements = achievements.filter(a => !achievedIds.has(a.id));
                newAchievements.forEach(a => achievedIds.add(a.id));
                if (newAchievements.length > 0) {
                    logger.info('App', 'achievement_unlocked_window', 'Achievement unlocked via window event', {
                        achievements: newAchievements.map(a => a.id),
                    });
                    setAchievementQueue((prev) => [...prev, ...newAchievements]);
                }
            }
        };
        window.addEventListener('achievementUnlocked', handleAchievementUnlocked);

        // Cleanup
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
            window.removeEventListener('achievementUnlocked', handleAchievementUnlocked);
        };
    }, []);

    return configRef;
}

/**
 * Handle static menu actions (Help menu items)
 */
function handleStaticMenuAction(payload, handlers) {
    const { setShowLogViewer, setShowPrivacyPolicy, setShowTermsOfUse, setShowLicenses, setShowAchievementsModal, setShowNotificationCenter, dialog } = handlers;

    switch (payload) {
        case MENU_ACTIONS.SHOW_LOG:
            setShowLogViewer(true);
            break;
        case MENU_ACTIONS.ABOUT:
            dialog.message({ title: 'About', message: "PhotoClove is an application to manage photos.\n (c)ktat", kind: 'info' });
            break;
        case MENU_ACTIONS.GITHUB:
            open("https://github.com/ktat/photoclove/");
            break;
        case MENU_ACTIONS.SPONSOR:
            open("https://github.com/sponsors/ktat");
            break;
        case MENU_ACTIONS.PRIVACY_POLICY:
            setShowPrivacyPolicy(true);
            break;
        case MENU_ACTIONS.TERMS_OF_USE:
            setShowTermsOfUse(true);
            break;
        case MENU_ACTIONS.LICENSES:
            setShowLicenses(true);
            break;
        case MENU_ACTIONS.ACHIEVEMENTS:
            setShowAchievementsModal(true);
            break;
        case MENU_ACTIONS.NOTIFICATION:
            setShowNotificationCenter(true);
            break;
        default:
            logger.warn('App', 'unhandled_menu_event', 'Unmatched menu payload', { payload });
    }
}

/**
 * Handle dynamic menu actions (main menu items)
 */
function handleDynamicMenuAction(payload, handlers) {
    const {
        configRef,
        getDates,
        updateCurrentDate,
        resetPhotoState,
        toggleHome,
        setWelcomeImage,
        toggleImporter,
        togglePreferences,
        toggleSearchPage,
        setShowJobQueueModal,
    } = handlers;

    switch (payload) {
        case MENU_ACTIONS.HOME:
            updateCurrentDate("");
            resetPhotoState();
            toggleHome();
            handleHomeWelcomeImage(configRef.current, setWelcomeImage);
            break;

        case MENU_ACTIONS.SEARCH:
            toggleSearchPage(true, "", true);
            break;

        case MENU_ACTIONS.IMPORT:
            toggleImporter(true);
            break;

        case MENU_ACTIONS.PREFERENCES:
            togglePreferences(true);
            break;

        case MENU_ACTIONS.JOB_QUEUE:
            setShowJobQueueModal(true);
            break;

        case MENU_ACTIONS.LOGIN:
            loginGoogle();
            break;

        default:
            logger.debug('App', 'unhandled_dynamic_menu', 'Unhandled dynamic menu action', { payload });
    }
}

/**
 * Handle welcome image for Home navigation
 */
function handleHomeWelcomeImage(config, setWelcomeImage) {
    const mode = config?.startup_images?.mode;
    if (mode === 'memories') {
        getMemoriesStartupImage().then((memoriesImage) => {
            if (memoriesImage) {
                setWelcomeImage(memoriesImage);
            } else {
                const fallback = config?.startup_images?.memories_fallback || 'default';
                if (fallback === 'custom') {
                    setWelcomeImage(WelcomeImage({ ...config, startup_images: { ...config.startup_images, mode: 'custom' } }));
                } else {
                    setWelcomeImage(WelcomeImage(null));
                }
            }
        });
    } else {
        setWelcomeImage(WelcomeImage(config));
    }
}

export default useAppEventListeners;
