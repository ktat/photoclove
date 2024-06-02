import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { ask, message, confirm } from '@tauri-apps/api/dialog';
import { relaunch } from "@tauri-apps/api/process";

function Preferences(props) {
    const [config, setConfig] = useState({});
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
        if (config.export_from) {
            config.export_from.push("");
        }
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
        let isFirstView = false;
        if (config.use_count == 0) {
            isFirstView = true;
            config.use_count = 1;
        }
        config.use_count = parseInt(config.use_count);
        invoke("save_config", { config: config }).then((e) => {
            if (isFirstView) {
                props.togglePreferences(false);
            } else {
                setConfigLoaded(!configLoaded);
            }

        })
        message("Changes are not reflected until restart application.").then((t) => {
            props.addFooterMessage("restartRequired", "Preference changes are not reflected until restart app.");
        });
    }

    return (
        <div id="preferences" className="preferences">
            <h1>Preferences</h1>
            <div className="preferences-input">
                <div className="row2">DataPath: </div><div className="row3"><input value={config.data_path} type="text" onChange={(e) => { config.data_path = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row2">TrashPath:</div><div className="row3"><input value={config.trash_path} type="text" onChange={(e) => { config.trash_path = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row2">ImportTo: </div><div className="row3"><input value={config.import_to} type="text" onChange={(e) => { config.import_to = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row0">ExportFrom: </div>
                {config.export_from && config.export_from.map((v, i) => {
                    return (<React.Fragment key={i}>
                        < div className="row2" ></div><div className="row3"><input type="text" value={config.export_from[i]} onChange={(e) => { config.export_from[i] = e.currentTarget.value; setNewConfig(config); }} /></div>
                    </React.Fragment>)
                })}
                <div className="row2"></div><div className="row3"><a href="#" onClick={() => setAdditionalExportFrom(additionalExportFrom + 1)}>+</a></div>
                <div className="row0">Thumbnail:</div>

                <div className="row1"></div><div className="row1">StorePath: </div><div className="row4"><input value={config.thumbnail_store} type="text" onChange={(e) => { config.thumbnail_store = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row1"></div><div className="row1">CompressQuality: </div><div className="row4">
                    <select value={config.thumbnail_compression_quality} onChange={(e) => { config.thumbnail_compression_quality = parseFloat(e.currentTarget.value); setNewConfig(config) }}>
                        {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => {
                            return (
                                <option key={i} value={v / 100}>{v}%</option>
                            )
                        })}
                    </select>
                </div>
                <div className="row1"></div><div className="row1">MinimizeRatio: </div><div className="row4">
                    <select value={config.thumbnail_ratio} onChange={(e) => { config.thumbnail_ratio = parseFloat(e.currentTarget.value); setNewConfig(config) }}>
                        {[1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((v, i) => {
                            return (
                                <option key={i} value={v / 100}>{v}%</option>
                            )
                        })}
                    </select>
                </div>
                <div className="row1"></div><div className="row1">IgnoreFileSize: </div><div className="row4">
                    <select value={config.thumbnail_ignore_file_size} onChange={(e) => { config.thumbnail_ignore_file_size = parseFloat(e.currentTarget.value); setNewConfig(config) }}>
                        {[0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => {
                            return (
                                <option key={i} value={1024 * 1024 * v}>{v}MB</option>
                            )
                        })}
                    </select>
                </div>
                <div className="row0">Num of Parallel:</div>
                <div className="row1"></div><div className="row1">Import: </div><div className="row4"><input value={config.copy_parallel} type="text" onChange={(e) => { config.copy_parallel = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row1"></div><div className="row1">Thumbnail: </div><div className="row4"><input value={config.thumbnail_parallel} type="text" onChange={(e) => { config.thumbnail_parallel = e.currentTarget.value; setNewConfig(config); }} /></div>
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