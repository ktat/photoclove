import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ask, message, confirm } from '@tauri-apps/plugin-dialog';
import { relaunch } from "@tauri-apps/plugin-process";
import PickFolderSingle from "../FolderPicker.jsx";
import { logger } from "../services/LoggerService.js";
// import TagManager from "../components/TagManager.jsx";
import './Preferences.css';


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
        google_auth_auto_reauth: false
    });
    const [additionalExportFrom, setAdditionalExportFrom] = useState(0);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [useCount, setUseCount] = useState(-1);
    const [activeTab, setActiveTab] = useState('general');

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
            use_count: isFirstView ? 1 : parseInt(config.use_count)
        };

        Promise.all([
            invoke("save_config", { config: updatedConfig }),
            invoke("set_logging_enabled", { enabled: updatedConfig.logging_enabled })
        ]).then(() => {
            setConfig(updatedConfig);
            logger.setEnabled(updatedConfig.logging_enabled);

            if (isFirstView) {
                props.togglePreferences(false);
            } else {
                setConfigLoaded(!configLoaded);
            }
        }).catch((error) => {
            logger.error('Preferences', 'config_save_failed', 'Failed to save configuration', { error: error.message });
            message("Failed to save configuration. Please try again.");
        });
        message("Changes are not reflected until restart application.").then((t) => {
            props.addFooterMessage("restartRequired", "Preference changes are not reflected until restart app.");
        });
    }

    const tabs = [
        { id: 'general', label: 'General', icon: '⚙️' },
        { id: 'thumbnail', label: 'Thumbnail', icon: '🖼️' },
        { id: 'performance', label: 'Performance', icon: '⚡' },
        { id: 'logging', label: 'Logging', icon: '📝' },
        // { id: 'tags', label: 'Tags', icon: '🏷️' },
        { id: 'advanced', label: 'Advanced', icon: '🔧' }
    ];

    return (
        <div id="preferences" className="preferences">
            <div className="preferences-header">
                <h1>Preferences</h1>
                <p className="preferences-subtitle">Customize PhotoClove settings</p>
            </div>

            {/* Tab Navigation */}
            <div className="preferences-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`preferences-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="preferences-content">
                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="preferences-section">
                        <h2 className="section-title">Path Settings</h2>
                        <div className="setting-group">
                            <PickFolderSingle
                                label="Data Path:"
                                folder={config.data_path}
                                setFunc={(folder) => setConfig(prev => ({ ...prev, data_path: folder }))}
                            />
                            <PickFolderSingle
                                label="Trash Path:"
                                folder={config.trash_path}
                                setFunc={(folder) => setConfig(prev => ({ ...prev, trash_path: folder }))}
                            />
                            <PickFolderSingle
                                label="Download Directory:"
                                folder={config.download_dir}
                                setFunc={(folder) => setConfig(prev => ({ ...prev, download_dir: folder }))}
                            />
                            <PickFolderSingle
                                label="Import To:"
                                folder={config.import_to}
                                setFunc={(folder) => setConfig(prev => ({ ...prev, import_to: folder }))}
                            />
                        </div>

                        <h2 className="section-title">Export From</h2>
                        <div className="setting-group">
                            {config.export_from.map((v, i) => (
                                <PickFolderSingle
                                    key={i}
                                    label={i === 0 ? "Export From:" : ""}
                                    folder={config.export_from[i]}
                                    setFunc={(folder) => {
                                        setConfig(prev => ({
                                            ...prev,
                                            export_from: prev.export_from.map((item, idx) =>
                                                idx === i ? folder : item
                                            )
                                        }))
                                    }}
                                />
                            ))}
                            <div className="add-export-path">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setAdditionalExportFrom(additionalExportFrom + 1)}
                                >
                                    + Add Path
                                </button>
                            </div>
                        </div>

                    </div>
                )}

                {/* Thumbnail Tab */}
                {activeTab === 'thumbnail' && (
                    <div className="preferences-section">
                        <h2 className="section-title">Thumbnail Settings</h2>
                        <div className="setting-group">
                            <PickFolderSingle
                                label="Store Path:"
                                folder={config.thumbnail_store}
                                setFunc={(folder) => setConfig(prev => ({ ...prev, thumbnail_store: folder }))}
                            />
                            <div className="setting-item">
                                <input
                                    type="checkbox"
                                    id="use-exif-thumbnail-check"
                                    checked={config.use_exif_thumbnail || false}
                                    onChange={(e) => setConfig(prev => ({ ...prev, use_exif_thumbnail: e.target.checked }))}
                                />
                                <label htmlFor="use-exif-thumbnail-check">
                                    Use EXIF thumbnails when available (faster import)
                                </label>
                            </div>
                        </div>

                        <h2 className="section-title">Compression</h2>
                        <div className="setting-group">
                            <div className="setting-row">
                                <label>Compress Quality:</label>
                                <select
                                    value={config.thumbnail_compression_quality || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_compression_quality: parseFloat(e.target.value) }))}
                                >
                                    {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => (
                                        <option key={i} value={v / 100}>{v}%</option>
                                    ))}
                                </select>
                            </div>
                            <div className="setting-row">
                                <label>Minimize Ratio:</label>
                                <select
                                    value={config.thumbnail_ratio || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_ratio: parseFloat(e.target.value) }))}
                                >
                                    {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => (
                                        <option key={i} value={v / 100}>{v}%</option>
                                    ))}
                                </select>
                            </div>
                            <div className="setting-row">
                                <label>Ignore File Size:</label>
                                <select
                                    value={config.thumbnail_ignore_file_size || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_ignore_file_size: parseFloat(e.target.value) }))}
                                >
                                    {[0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => (
                                        <option key={i} value={1024 * 1024 * v}>{v}MB</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Performance Tab */}
                {activeTab === 'performance' && (
                    <div className="preferences-section">
                        <h2 className="section-title">Parallel Processing</h2>
                        <div className="setting-group">
                            <div className="setting-row">
                                <label>Import Parallel:</label>
                                <input
                                    value={config.copy_parallel || ''}
                                    type="number"
                                    step="1"
                                    onChange={(e) => setConfig(prev => ({ ...prev, copy_parallel: e.target.value }))}
                                />
                            </div>
                            <div className="setting-row">
                                <label>Thumbnail Parallel:</label>
                                <input
                                    value={config.thumbnail_parallel || ''}
                                    type="number"
                                    step="1"
                                    onChange={(e) => setConfig(prev => ({ ...prev, thumbnail_parallel: e.target.value }))}
                                />
                            </div>
                        </div>

                        <h2 className="section-title">Display</h2>
                        <div className="setting-group">
                            <div className="setting-row">
                                <label>Max Photos Per Fetch:</label>
                                <input
                                    value={config.max_photos_per_fetch || ''}
                                    type="number"
                                    step="100"
                                    min="100"
                                    onChange={(e) => setConfig(prev => ({ ...prev, max_photos_per_fetch: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Logging Tab */}
                {activeTab === 'logging' && (
                    <div className="preferences-section">
                        <h2 className="section-title">Logging Configuration</h2>
                        <div className="setting-group">
                            <div className="setting-item">
                                <input
                                    type="checkbox"
                                    id="logging-enabled-check"
                                    checked={config.logging_enabled || false}
                                    onChange={(e) => setConfig(prev => ({ ...prev, logging_enabled: e.target.checked }))}
                                />
                                <label htmlFor="logging-enabled-check">
                                    Enable debug logging
                                </label>
                            </div>
                            <div className="setting-row">
                                <label>Log Level:</label>
                                <select
                                    value={config.logging_level || 'info'}
                                    onChange={(e) => setConfig(prev => ({ ...prev, logging_level: e.target.value }))}
                                    disabled={!config.logging_enabled}
                                >
                                    <option value="debug">Debug</option>
                                    <option value="info">Info</option>
                                    <option value="warn">Warning</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tags Tab */}
                {/* {activeTab === 'tags' && (
                    <div className="preferences-section">
                        <TagManager />
                    </div>
                )} */}

                {/* Advanced Tab */}
                {activeTab === 'advanced' && (
                    <div className="preferences-section">
                        <h2 className="section-title">Google Photos</h2>
                        <div className="setting-group">
                            <div className="setting-item">
                                <input
                                    type="checkbox"
                                    id="google-auth-auto-reauth-check"
                                    checked={config.google_auth_auto_reauth || false}
                                    onChange={(e) => setConfig(prev => ({ ...prev, google_auth_auto_reauth: e.target.checked }))}
                                />
                                <label htmlFor="google-auth-auto-reauth-check">
                                    Automatically prompt for Google Photos re-authentication on startup
                                </label>
                            </div>
                        </div>

                        <h2 className="section-title">Tutorial</h2>
                        <div className="setting-group">
                            <div className="setting-item">
                                <input
                                    type="checkbox"
                                    id="preference-check"
                                    value="1"
                                    onChange={(e) => setConfig(prev => ({ ...prev, use_count: e.target.checked ? 0 : useCount }))}
                                />
                                <label htmlFor="preference-check">
                                    Show Welcome tutorial again
                                </label>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div className="preferences-footer">
                <button className="btn-primary" onClick={saveConfig}>
                    Save Changes
                </button>
            </div>
        </div>
    )
}

export default Preferences;
