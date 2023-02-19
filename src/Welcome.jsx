import { invoke, tauri } from "@tauri-apps/api";
import React, { useState, useEffect } from "react";

function Welcome(props) {
    const [showWelcome, setShowWelcome] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    useEffect((e) => {
        setTimeout(() => {
            setShowSplash(false);
            setShowWelcome(true);
        }, props.useCount > 0 ? 0 : 1000);
    }, []);

    function getAndSaveConfig(useCount) {
        props.setUseCount(useCount);
        invoke("get_config", {}).then((r) => {
            const json = JSON.parse(r);
            json.use_count = useCount;
            invoke("save_config", { config: json });
        })
    }

    return (
        <div id="welcome-container">
            <h1>Wellcome to PhotoClove!</h1>
            {showSplash &&
                <div className="welcome-splash">
                    <img src="/bird.jpg" />
                </div>
            }
            {showWelcome &&
                <div id="welcome">
                    <div className="welcome">
                        <div className="photo-clove">
                            &#x1f980;
                        </div>
                        <div className="introduce">
                            PhotoClove is an application to manage photos.
                            It aims fast importing photos and fast viewing photos.
                        </div>
                        <ol className="tutorial">
                            <li><span className={"useCount-" + props.useCount}>At first, configure <a href="#"
                                onClick={() => {
                                    props.togglePreferences(true);
                                }
                                }>preferences</a>.</span></li>
                            <li>
                                <span className={"useCount-" + (props.useCount == 2 ? 2 : 0)}>If you don't have photos, <a href="#"
                                    onClick={() => {
                                        getAndSaveConfig(2);
                                        props.toggleImporter(true);
                                    }
                                    }>import photos</a>.
                                </span>
                                <br />
                                <span className={"useCount-" + (props.useCount == 3 ? 3 : 0)}>If you have photos in import to folder, go to <a href="#"
                                    onClick={() => {
                                        getAndSaveConfig(3);
                                        props.togglePreferences(false);
                                    }
                                    }>photo list</a>.
                                </span>
                            </li>
                        </ol>
                    </div>
                </div>
            }
        </div>
    )
}

export default Welcome;