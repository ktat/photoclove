import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import "./components/search.css";
import "./App/LeftMenu.css";
import "./App/Import.css";
import "./components/HelpDialog.css";
import "./components/FormControls.css";
import "./App/Footer.css";
import "./components/Splash.css";
import "./components/PhotoLoading.css";
import PhotosList from "./App/PhotosList.jsx";
import DateList from "./App/DateList.jsx";
import Preferences from "./App/Preferences";
import JobQueue from "./App/JobQueue.jsx";
import Welcome from "./Welcome.jsx";
import Home from "./App/Home.jsx";
import Footer from "./App/Footer.jsx";
import WelcomeImage from "./WelcomeImage.jsx";
import ErrorDisplay from "./components/ErrorDisplay.jsx";
import LogViewer from "./App/LogViewer.jsx";
import DocumentViewer from "./components/DocumentViewer.jsx";
import LicensesView from "./App/LicensesView.jsx";
import RecoveryQueueModal from "./App/RecoveryQueueModal.jsx";
const InsightsModal = lazy(() => import('./App/InsightsModal.jsx'));
import AchievementsView from "./App/AchievementsView.jsx";
import AchievementPopup from "./components/AchievementPopup.jsx";
import Tooltip from "./components/Tooltip.jsx";
import NavigationIcons from "./App/NavigationIcons.jsx";
import NotificationBell from "./components/NotificationBell.jsx";
import NotificationCenterModal from "./components/NotificationCenterModal.jsx";
import { logger } from "./services/LoggerService.js";
import { useUI } from "./context/UIContext.jsx";
import { usePhoto } from "./context/PhotoContext.jsx";
import { useDateNavigation } from "./hooks/useDateNavigation.js";
import { useAppConfig } from "./hooks/useAppConfig.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { useAppEventListeners } from "./hooks/useAppEventListeners.js";
import { useDialog } from "./context/DialogContext.jsx";
import { VIEW_MODES } from "./constants/viewModes.js";

function App() {
    const {
        showImporter,
        showPhotosList,
        showPreferences,
        showLogin,
        showSearchPage,
        showQuickView,
        isAdvancedSearchMode,
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
        addFooterMessage,
        transitionTo,
        notifications,
        unreadCount,
        markAllAsRead,
        clearAllNotifications
    } = useUI();

    const {
        currentDate,
        updateCurrentDate,
        resetPhotoState,
        recentPhotosMode
    } = usePhoto();

    const { getDates } = useDateNavigation();
    const { useCount, setUseCount, config, loadConfig } = useAppConfig();
    const dialog = useDialog();

    // Modal states
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
    const [showNotificationCenter, setShowNotificationCenter] = useState(false);
    const [achievementQueue, setAchievementQueue] = useState([]);

    // Tooltip state
    const [tooltipText, setTooltipText] = useState("");
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0 });

    // Keyboard shortcuts (consolidated into single hook)
    // Note: Ctrl+F (Search), Ctrl+I (Import), Ctrl+J (Job Queue), Ctrl+, (Preferences)
    // are handled by native menu accelerators in lib.rs
    const shortcuts = useMemo(() => ({
        logViewer: {
            ctrl: true,
            shift: true,
            key: 'L',
            action: () => setShowLogViewer(prev => !prev)
        },
        recoveryQueue: {
            ctrl: true,
            shift: true,
            key: 'R',
            action: () => setShowRecoveryQueueModal(prev => !prev)
        }
    }), []);

    useKeyboardShortcuts(shortcuts);

    // App-level event listeners (extracted to custom hook)
    useAppEventListeners({
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
    });

    // Initialize logger and cleanup on startup
    useEffect(() => {
        const initialize = async () => {
            try {
                await logger.initializeFromConfig();
                logger.info('App', 'initialization', 'Logger initialized from config');
            } catch (error) {
                logger.warn('App', 'logger_init_failed', 'Failed to initialize logger from config', { error: error.message });
            }

            // Clear import thumbnail cache
            try {
                const removedCount = await invoke('clear_import_cache');
                logger.info('App', 'startup_cache_cleared', 'Import thumbnail cache cleared on startup', { removedFiles: removedCount });
            } catch (error) {
                logger.warn('App', 'startup_cache_clear_failed', 'Failed to clear import cache on startup', { error: error.message });
            }

            // Cleanup old recovery queue items
            try {
                const deletedCount = await invoke('cleanup_recovery_items');
                if (deletedCount > 0) {
                    logger.info('App', 'recovery_queue_cleanup', 'Old recovery items cleaned up', { deletedCount });
                }
            } catch (error) {
                logger.warn('App', 'recovery_queue_cleanup_failed', 'Failed to cleanup recovery queue', { error: error.message });
            }

            // Check for CLI quick view path
            try {
                const quickviewPath = await invoke('get_quickview_path');
                if (quickviewPath) {
                    logger.info('App', 'cli_quickview', 'CLI quick view mode activated', { path: quickviewPath });
                    transitionTo(VIEW_MODES.QUICK_VIEW, { quickViewPath: quickviewPath });
                }
            } catch (error) {
                logger.debug('App', 'quickview_check_skip', 'No quickview path', { error: error.message });
            }
        };

        initialize();
    }, [transitionTo]);

    // Update welcome image when config loads
    useEffect(() => {
        if (config) {
            setWelcomeImage(WelcomeImage(config));
        }
    }, [config, setWelcomeImage]);

    // Auto-collapse left menu based on window width
    useEffect(() => {
        const handleResize = () => {
            setLeftMenuCollapsed(window.innerWidth <= 1000);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Tooltip handlers
    const handleMouseEnter = useCallback((text, event) => {
        if (leftMenuCollapsed && event?.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltipPosition({ top: rect.top + (rect.height / 2) });
            setTooltipText(text);
            setShowTooltip(true);
        }
    }, [leftMenuCollapsed]);

    const handleMouseLeave = useCallback(() => {
        setShowTooltip(false);
        setTooltipText("");
    }, []);

    // Render main content area
    const renderMainContent = () => {
        if (showQuickView) {
            return (
                <PhotosList
                    config={config}
                    addFooterMessage={addFooterMessage}
                    onRightMenuToggle={setRightMenuOpen}
                    searchMode={false}
                    isAdvancedSearchMode={false}
                    setShowJobQueueModal={setShowJobQueueModal}
                    getDatesNum={getDates}
                />
            );
        }

        const shouldShowPhotosList = showPhotosList || showImporter || showSearchPage;

        if (shouldShowPhotosList) {
            logger.debug('App', 'rendering_photos_list', 'Rendering PhotosList component', {
                isImportMode: showImporter,
                isSearchMode: showSearchPage
            });
            return (
                <PhotosList
                    config={config}
                    addFooterMessage={addFooterMessage}
                    onRightMenuToggle={setRightMenuOpen}
                    searchMode={showSearchPage}
                    isAdvancedSearchMode={isAdvancedSearchMode}
                    setShowJobQueueModal={setShowJobQueueModal}
                    getDatesNum={getDates}
                />
            );
        }

        logger.debug('App', 'not_rendering_photos_list', 'NOT rendering PhotosList - showing other components');

        const shouldShowHome = !showImporter && !showLogin && !showPreferences &&
            !showJobQueueModal && !showSearchPage &&
            ((!currentDate && !recentPhotosMode) || !showPhotosList);

        return (
            <>
                <div style={{ display: showPreferences ? "block" : "none" }}>
                    <Preferences
                        togglePreferences={togglePreferences}
                        reloadConfig={loadConfig}
                    />
                </div>
                <div style={{ display: shouldShowHome ? "block" : "none" }}>
                    <Home welcomeImage={welcomeImage} setWelcomeImage={setWelcomeImage} config={config} />
                </div>
            </>
        );
    };

    // Loading state
    if (useCount === null) {
        return (
            <div className="loading-container">
                <img className="loading-bg" src={welcomeImage} alt="" />
                <div className="loading-overlay"></div>
                <div className="loading-text">
                    PhotoClove is Loading
                    <span className="loading-dots">
                        <span className="dot">.</span>
                        <span className="dot">.</span>
                        <span className="dot">.</span>
                    </span>
                </div>
            </div>
        );
    }

    // Welcome screen for new users
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
                {showLogViewer && <LogViewer onClose={() => setShowLogViewer(false)} />}
                {showRecoveryQueueModal && (
                    <RecoveryQueueModal onClose={() => setShowRecoveryQueueModal(false)} addFooterMessage={addFooterMessage} />
                )}
                <Tooltip show={leftMenuCollapsed && showTooltip} text={tooltipText} position={tooltipPosition} />
            </div>
        );
    }

    // Quick View layout (no left sidebar)
    if (showQuickView) {
        return (
            <div className="container">
                <div className={`inner-container ${rightMenuOpen ? 'menu-open' : 'menu-closed'} left-menu-collapsed`}>
                    {renderMainContent()}
                </div>
                <Footer onRecoveryQueueClick={() => setShowRecoveryQueueModal(true)} />
                <ErrorDisplay />
                {showLogViewer && <LogViewer onClose={() => setShowLogViewer(false)} />}
                {showJobQueueModal && (
                    <JobQueue onClose={() => setShowJobQueueModal(false)} addFooterMessage={addFooterMessage} />
                )}
                {showRecoveryQueueModal && (
                    <RecoveryQueueModal onClose={() => setShowRecoveryQueueModal(false)} addFooterMessage={addFooterMessage} />
                )}
                {showPrivacyPolicy && (
                    <DocumentViewer title="Privacy Policy" fileName="privacy-policy" onClose={() => setShowPrivacyPolicy(false)} />
                )}
                {showTermsOfUse && (
                    <DocumentViewer title="Terms of Use" fileName="terms-of-use" onClose={() => setShowTermsOfUse(false)} />
                )}
                {showLicenses && <LicensesView onClose={() => setShowLicenses(false)} />}
                {showAchievementsModal && <AchievementsView onClose={() => setShowAchievementsModal(false)} />}
                {achievementQueue.length > 0 && (
                    <AchievementPopup
                        achievement={achievementQueue[0]}
                        onClose={() => setAchievementQueue((prev) => prev.slice(1))}
                    />
                )}
            </div>
        );
    }

    // Main app layout
    return (
        <div className="container">
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
                        handleMouseEnter={handleMouseEnter}
                        handleMouseLeave={handleMouseLeave}
                        config={config}
                    />
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
                        setShowInsightsModal={setShowInsightsModal}
                        setShowAchievementsModal={setShowAchievementsModal}
                    />
                    <NotificationBell
                        unreadCount={unreadCount}
                        onClick={() => setShowNotificationCenter(true)}
                        collapsed={leftMenuCollapsed}
                    />
                </div>
                {renderMainContent()}
            </div>
            <Footer onRecoveryQueueClick={() => setShowRecoveryQueueModal(true)} />
            <ErrorDisplay />

            {/* Modals */}
            {showLogViewer && <LogViewer onClose={() => setShowLogViewer(false)} />}
            {showPrivacyPolicy && (
                <DocumentViewer title="Privacy Policy" fileName="privacy-policy" onClose={() => setShowPrivacyPolicy(false)} />
            )}
            {showTermsOfUse && (
                <DocumentViewer title="Terms of Use" fileName="terms-of-use" onClose={() => setShowTermsOfUse(false)} />
            )}
            {showJobQueueModal && (
                <JobQueue onClose={() => setShowJobQueueModal(false)} addFooterMessage={addFooterMessage} />
            )}
            {showLicenses && <LicensesView onClose={() => setShowLicenses(false)} />}
            {showRecoveryQueueModal && (
                <RecoveryQueueModal onClose={() => setShowRecoveryQueueModal(false)} addFooterMessage={addFooterMessage} />
            )}
            {showInsightsModal && (
                <Suspense fallback={<div>Loading insights...</div>}>
                    <InsightsModal onClose={() => setShowInsightsModal(false)} />
                </Suspense>
            )}
            {showAchievementsModal && <AchievementsView onClose={() => setShowAchievementsModal(false)} />}
            {showNotificationCenter && (
                <NotificationCenterModal
                    notifications={notifications}
                    onClose={() => setShowNotificationCenter(false)}
                    onClearAll={clearAllNotifications}
                    markAllAsRead={markAllAsRead}
                />
            )}
            {achievementQueue.length > 0 && (
                <AchievementPopup
                    achievement={achievementQueue[0]}
                    onClose={() => setAchievementQueue((prev) => prev.slice(1))}
                />
            )}
            <Tooltip show={leftMenuCollapsed && showTooltip} text={tooltipText} position={tooltipPosition} />
        </div>
    );
}

export default App;
