import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { message } from '@tauri-apps/plugin-dialog';
import classNames from 'classnames';
import { logger } from "../../services/LoggerService.js";
import GeneralTab from "./tabs/GeneralTab.jsx";
import AppearanceTab from "./tabs/AppearanceTab.jsx";
import StartupTab from "./tabs/StartupTab.jsx";
import ThumbnailTab from "./tabs/ThumbnailTab.jsx";
import GroupingTab from "./tabs/GroupingTab.jsx";
import AITaggingTab from "./tabs/AITaggingTab.jsx";
import FaceDetectionTab from "./tabs/FaceDetectionTab.jsx";
import PerformanceTab from "./tabs/PerformanceTab.jsx";
import LoggingTab from "./tabs/LoggingTab.jsx";
import S3BackupTab from "./tabs/S3BackupTab.jsx";
import AdvancedTab from "./tabs/AdvancedTab.jsx";
import styles from './Preferences.module.css';


function Preferences(props) {
    const [config, setConfig] = useState({
        export_from: [],
        copy_parallel: '',
        thumbnail_parallel: '',
        thumbnail_compression_quality: '',
        thumbnail_ratio: '',
        thumbnail_ignore_file_size: '',
        max_photos_per_fetch: '',
        use_count: 0,
        logging_enabled: false,
        logging_level: 'info',
        use_exif_thumbnail: false,
        google_auth_auto_reauth: false,
        photo_grid_theme: 'default',
        color_theme: 'dark',
        ai_tagging: {
            enabled: false,
            auto_tag_on_import: false,
            confidence_threshold: 0.7,
            max_tags_per_image: 5,
            model_type: 'mobilenet',
            model_preset: 'standard',
            enabled_categories: [],
            custom_labels: []
        }
    });
    const [additionalExportFrom, setAdditionalExportFrom] = useState(0);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [useCount, setUseCount] = useState(-1);
    const [activeTab, setActiveTab] = useState('general');
    const [isRecalculatingGroups, setIsRecalculatingGroups] = useState(false);
    const [groupingProgress, setGroupingProgress] = useState({ message: '', progress: 0 });

    // Listen for grouping progress events
    useEffect(() => {
        let unlistenProgress;
        let unlistenComplete;

        const setupListeners = async () => {
            unlistenProgress = await listen('grouping_progress', (event) => {
                const [jobUnitId, message, progress] = event.payload;
                setGroupingProgress({ message, progress });
                logger.debug('Preferences', 'grouping_progress', 'Grouping progress update', { jobUnitId, message, progress });
            });

            unlistenComplete = await listen('grouping_recalculate_complete', (event) => {
                const newGroups = event.payload;
                setIsRecalculatingGroups(false);
                setGroupingProgress({ message: '', progress: 0 });
                props.addFooterMessage("grouping", `Recalculation complete: ${newGroups} groups created`);
                logger.info('Preferences', 'grouping_complete', 'Grouping recalculation complete', { newGroups });
            });
        };

        setupListeners();

        return () => {
            if (unlistenProgress) unlistenProgress();
            if (unlistenComplete) unlistenComplete();
        };
    }, []);

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            if (useCount === -1) {
                setUseCount(json.use_count);
            }
            setNewConfig(json);
        });
    }, [configLoaded]);

    useEffect((e) => {
        setConfig(prev => ({
            ...prev,
            export_from: [...prev.export_from, ""]
        }));
    }, [additionalExportFrom]);

    function setNewConfig(config) {
        const newConfig = {};
        Object.keys(config).map((k) => {
            newConfig[k] = config[k];
        });

        // Preserve current visual theme state (user may have changed without saving)
        const currentColorTheme = document.documentElement.getAttribute('data-theme');
        const currentGridTheme = document.documentElement.getAttribute('data-grid-theme');

        if (currentColorTheme) {
            newConfig.color_theme = currentColorTheme;
        } else if (config.color_theme) {
            document.documentElement.setAttribute('data-theme', config.color_theme);
        }

        if (currentGridTheme) {
            newConfig.photo_grid_theme = currentGridTheme;
        } else if (config.photo_grid_theme) {
            document.documentElement.setAttribute('data-grid-theme', config.photo_grid_theme);
        }

        setConfig(newConfig);
    }

    function saveConfig() {
        const isFirstView = config.use_count == 0;
        const updatedConfig = {
            ...config,
            copy_parallel: parseInt(config.copy_parallel) || 0,
            thumbnail_parallel: parseInt(config.thumbnail_parallel) || 0,
            thumbnail_compression_quality: parseFloat(config.thumbnail_compression_quality) || 0,
            thumbnail_minimize_rate: parseFloat(config.thumbnail_minimize_rate) || 0,
            max_photos_per_fetch: parseInt(config.max_photos_per_fetch) || 1000,
            use_count: isFirstView ? 1 : parseInt(config.use_count),
            ai_tagging: {
                enabled: config.ai_tagging?.enabled || false,
                auto_tag_on_import: config.ai_tagging?.auto_tag_on_import || false,
                confidence_threshold: parseFloat(config.ai_tagging?.confidence_threshold) || 0.7,
                max_tags_per_image: parseInt(config.ai_tagging?.max_tags_per_image) || 5,
                model_type: config.ai_tagging?.model_type || 'mobilenet',
                model_preset: config.ai_tagging?.model_preset || 'standard',
                enabled_categories: config.ai_tagging?.enabled_categories || [],
                custom_labels: config.ai_tagging?.custom_labels || [],
                use_exif_thumbnail: config.ai_tagging?.use_exif_thumbnail ?? true,
                min_thumbnail_size: parseInt(config.ai_tagging?.min_thumbnail_size) || 160
            }
        };

        invoke("save_config", { config: updatedConfig }).then(() => {
            setConfig(updatedConfig);
            logger.setEnabled(updatedConfig.logging_enabled);
            logger.info('Preferences', 'config_saved', 'Configuration saved successfully', { updatedConfig });

            // Reload config in parent to apply changes without restart
            if (props.reloadConfig) {
                props.reloadConfig();
            }

            if (isFirstView) {
                props.togglePreferences(false);
            }
        }).catch((error) => {
            logger.error('Preferences', 'config_save_failed', 'Failed to save configuration', { error: error.message });
            message("Failed to save configuration. Please try again.");
        });
        message("Some changes may require restart to take effect.").then((t) => {
            props.addFooterMessage("configSaved", "Configuration saved.");
        });
    }

    const tabs = [
        { id: 'general', label: 'General', icon: '⚙️' },
        { id: 'appearance', label: 'Appearance', icon: '🎨' },
        { id: 'startup', label: 'Startup', icon: '🚀' },
        { id: 'thumbnail', label: 'Thumbnail', icon: '🖼️' },
        { id: 'grouping', label: 'Grouping', icon: '📸' },
        { id: 'ai_tagging', label: 'AI Tagging', icon: '🤖' },
        { id: 'face_detection', label: 'Face Detection', icon: '👤' },
        { id: 'performance', label: 'Performance', icon: '⚡' },
        { id: 'logging', label: 'Logging', icon: '📝' },
        { id: 's3_backup', label: 'S3 Backup', icon: '☁️' },
        { id: 'advanced', label: 'Advanced', icon: '🔧' }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <GeneralTab
                        config={config}
                        setConfig={setConfig}
                        additionalExportFrom={additionalExportFrom}
                        setAdditionalExportFrom={setAdditionalExportFrom}
                    />
                );
            case 'appearance':
                return <AppearanceTab config={config} setConfig={setConfig} />;
            case 'startup':
                return <StartupTab config={config} setConfig={setConfig} />;
            case 'thumbnail':
                return <ThumbnailTab config={config} setConfig={setConfig} />;
            case 'grouping':
                return (
                    <GroupingTab
                        config={config}
                        setConfig={setConfig}
                        isRecalculatingGroups={isRecalculatingGroups}
                        setIsRecalculatingGroups={setIsRecalculatingGroups}
                        groupingProgress={groupingProgress}
                        setGroupingProgress={setGroupingProgress}
                        addFooterMessage={props.addFooterMessage}
                    />
                );
            case 'ai_tagging':
                return (
                    <AITaggingTab
                        config={config}
                        setConfig={setConfig}
                        addFooterMessage={props.addFooterMessage}
                    />
                );
            case 'face_detection':
                return (
                    <FaceDetectionTab
                        config={config}
                        setConfig={setConfig}
                        addFooterMessage={props.addFooterMessage}
                    />
                );
            case 'performance':
                return <PerformanceTab config={config} setConfig={setConfig} />;
            case 'logging':
                return <LoggingTab config={config} setConfig={setConfig} />;
            case 's3_backup':
                return (
                    <S3BackupTab
                        config={config}
                        setConfig={setConfig}
                        addFooterMessage={props.addFooterMessage}
                    />
                );
            case 'advanced':
                return <AdvancedTab config={config} setConfig={setConfig} useCount={useCount} />;
            default:
                return null;
        }
    };

    return (
        <div id="preferences" className={styles.preferences}>
            <div className={styles['preferences-header']}>
                <h1>Preferences</h1>
                <p className={styles['preferences-subtitle']}>Customize PhotoClove settings</p>
            </div>

            {/* Tab Navigation */}
            <div className={styles['preferences-tabs']}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={classNames(styles['preferences-tab'], { [styles.active]: activeTab === tab.id })}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className={styles['tab-icon']}>{tab.icon}</span>
                        <span className={styles['tab-label']}>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={styles['preferences-content']}>
                {renderTabContent()}
            </div>

            {/* Save Button */}
            <div className={styles['preferences-footer']}>
                <button className={styles['btn-primary']} onClick={saveConfig}>
                    Save Changes
                </button>
            </div>
        </div>
    )
}

export default Preferences;
