import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ask, message, confirm } from '@tauri-apps/plugin-dialog';
import { relaunch } from "@tauri-apps/plugin-process";
import PickFolderSingle from "../FolderPicker.jsx";
import { logger } from "../services/LoggerService.js";


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
        logging_level: 'info'
    });
    const [additionalExportFrom, setAdditionalExportFrom] = useState(0);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [useCount, setUseCount] = useState(-1);

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
        config.export_from.push("");
    }, [additionalExportFrom]);

    function setNewConfig(config) {
        const newConfig = {};
        Object.keys(config).map((k) => {
            newConfig[k] = config[k];
        });
        setConfig(newConfig);
    }
    function saveConfig() {
        config.copy_parallel = parseInt(config.copy_parallel);
        config.thumbnail_parallel = parseInt(config.thumbnail_parallel);
        config.thumbnail_compression_quality = parseFloat(config.thumbnail_compression_quality);
        config.thumbnail_minimize_rate = parseFloat(config.thumbnail_minimize_rate);
        config.max_photos_per_fetch = parseInt(config.max_photos_per_fetch);
        let isFirstView = false;
        if (config.use_count == 0) {
            isFirstView = true;
            config.use_count = 1;
        }
        config.use_count = parseInt(config.use_count);
        
        // Save config and sync logging state
        Promise.all([
            invoke("save_config", { config: config }),
            invoke("set_logging_enabled", { enabled: config.logging_enabled })
        ]).then(() => {
            // Update frontend logger state
            logger.setEnabled(config.logging_enabled);
            
            if (isFirstView) {
                props.togglePreferences(false);
            } else {
                setConfigLoaded(!configLoaded);
            }
        }).catch((error) => {
            console.error("Failed to save configuration:", error);
            message("Failed to save configuration. Please try again.");
        });
        message("Changes are not reflected until restart application.").then((t) => {
            props.addFooterMessage("restartRequired", "Preference changes are not reflected until restart app.");
        });
    }

    return (
        <div id="preferences" className="preferences">
            <h1>Preferences</h1>
            <div className="preferences-input">
                <PickFolderSingle
                    label="DataPath:"
                    folder={config.data_path}
                    setFunc={
                        (folder) => {
                            config.data_path = folder;
                            setNewConfig(config)
                        }
                    } />
                <PickFolderSingle
                    label="TashPath:"
                    folder={config.trash_path}
                    setFunc={
                        (folder) => {
                            config.trash_path = folder;
                            setNewConfig(config)
                        }
                    } />
                <PickFolderSingle
                    label="DownloadDir:"
                    folder={config.download_dir}
                    setFunc={
                        (folder) => {
                            config.download_dir = folder;
                            setNewConfig(config)
                        }
                    } />
                <PickFolderSingle
                    label="ImportTo:"
                    folder={config.import_to}
                    setFunc={
                        (folder) => {
                            config.import_to = folder;
                            setNewConfig(config)
                        }
                    } />
                <div className="row0">ExportFrom: </div>
                {config.export_from.map((v, i) => {
                    return (<React.Fragment key={i}>
                        <PickFolderSingle
                            label=""
                            class1="row2"
                            class2="row3"
                            folder={config.export_from[i]}
                            setFunc={
                                (folder) => {
                                    config.export_from[i] = folder;
                                    setNewConfig(config)
                                }
                            } />
                    </React.Fragment>)
                })}
                <div className="row2"></div><div className="row3"><a href="#" onClick={() => setAdditionalExportFrom(additionalExportFrom + 1)}>+</a></div>
                <div className="row0">Thumbnail:</div>
                <div className="row1"></div>
                <PickFolderSingle
                    class1="row1"
                    class2="row4"
                    label="Store Path:"
                    folder={config.thumbnail_store}
                    setFunc={
                        (folder) => {
                            config.thumbnail_store = folder;
                            setNewConfig(config);
                        }
                    } />
                <div className="row1"></div><div className="row1">CompressQuality: </div><div className="row4">
                    <select value={config.thumbnail_compression_quality || ''} onChange={(e) => { config.thumbnail_compression_quality = parseFloat(e.currentTarget.value); setNewConfig(config) }}>
                        {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => {
                            return (
                                <option key={i} value={v / 100}>{v}%</option>
                            )
                        })}
                    </select>
                </div>
                <div className="row1"></div><div className="row1">MinimizeRatio: </div><div className="row4">
                    <select value={config.thumbnail_ratio || ''} onChange={(e) => { config.thumbnail_ratio = parseFloat(e.currentTarget.value); setNewConfig(config) }}>
                        {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => {
                            return (
                                <option key={i} value={v / 100}>{v}%</option>
                            )
                        })}
                    </select>
                </div>
                <div className="row1"></div><div className="row1">IgnoreFileSize: </div><div className="row4">
                    <select value={config.thumbnail_ignore_file_size || ''} onChange={(e) => { config.thumbnail_ignore_file_size = parseFloat(e.currentTarget.value); setNewConfig(config) }}>
                        {[0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => {
                            return (
                                <option key={i} value={1024 * 1024 * v}>{v}MB</option>
                            )
                        })}
                    </select>
                </div>
                <div className="row0">Num of Parallel:</div>
                <div className="row1"></div><div className="row1">Import: </div><div className="row4"><input value={config.copy_parallel || ''} type="number" step="1" onChange={(e) => { config.copy_parallel = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row1"></div><div className="row1">Thumbnail: </div><div className="row4"><input value={config.thumbnail_parallel || ''} type="number" step="1" onChange={(e) => { config.thumbnail_parallel = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row0">Performance:</div>
                <div className="row1"></div><div className="row1">Max Photos Per Fetch: </div><div className="row4"><input value={config.max_photos_per_fetch || ''} type="number" step="100" min="100" onChange={(e) => { config.max_photos_per_fetch = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row2"></div>
                <div className="row0">Logging:</div>
                <div className="row1"></div>
                <div className="row0">
                    <input 
                        type="checkbox" 
                        id="logging-enabled-check" 
                        checked={config.logging_enabled || false}
                        onChange={(e) => { 
                            config.logging_enabled = e.target.checked; 
                            setNewConfig(config);
                        }} 
                    />
                    <label className="checkbox checkbox-normal" htmlFor="logging-enabled-check">
                        Enable debug logging
                    </label>
                </div>
                <div className="row1"></div><div className="row1">Log Level: </div><div className="row4">
                    <select 
                        value={config.logging_level || 'info'} 
                        onChange={(e) => { 
                            config.logging_level = e.currentTarget.value; 
                            setNewConfig(config);
                        }}
                        disabled={!config.logging_enabled}
                    >
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warn">Warning</option>
                        <option value="error">Error</option>
                    </select>
                </div>
                <div className="row2"></div>
                <div className="row0">
                    <input type="checkbox" id="preference-check" value="1" onChange={(e) => { config.use_count = e.target.checked ? 0 : useCount; setNewConfig(config) }} />
                    <label className="checkbox checkbox-normal" htmlFor="preference-check">Show Welcome tutorial again?</label>
                </div>
                <div className="row0">
                    <button name="save" value="save" onClick={(e) => saveConfig()}>SAVE</button>
                </div>
            </div >
        </div >
    )
}

export default Preferences;
