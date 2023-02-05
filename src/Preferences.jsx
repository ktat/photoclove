import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { ask, message, confirm } from '@tauri-apps/api/dialog';
import { relaunch } from "@tauri-apps/api/process";

function Preferences(props) {
    const [config, setConfig] = useState({ export_from: [] });
    const [additionalExportFrom, setAdditionalExportFrom] = useState(0);
    const [configLoaded, setConfigLoaded] = useState(false);

    useEffect((e) => {
        invoke("get_config", {},).then((e) => {
            const json = JSON.parse(e);
            setNewConfig(json);
        });
    }, [configLoaded]);

    useEffect((e) => {
        config.export_from.push("");
        setNewConfig(config);
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
        invoke("save_config", { config: config }).then((e) => { setConfigLoaded(!configLoaded); })
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
                <div className="row2">ThumbnailStorePath: </div><div className="row3"><input value={config.thumbnail_store} type="text" onChange={(e) => { config.thumbnail_store = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row0">Num of Parallel:</div>
                <div className="row1"></div><div className="row1">Import: </div><div className="row3"><input value={config.copy_parallel} type="text" onChange={(e) => { config.copy_parallel = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row1"></div><div className="row1">Thumbnail: </div><div className="row3"><input value={config.thumbnail_parallel} type="text" onChange={(e) => { config.thumbnail_parallel = e.currentTarget.value; setNewConfig(config); }} /></div>
                <div className="row0">
                    <button name="save" value="save" onClick={(e) => saveConfig()}>SAVE</button>
                </div>
            </div >
        </div >
    )
}

export default Preferences;