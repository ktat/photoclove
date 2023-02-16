import { invoke, tauri } from "@tauri-apps/api";
import React, { useState, useEffect } from "react";

function Home(props) {
    const [showWelcome, setShowWelcome] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const message = ``;


    useEffect((e) => {
    }, []);

    return (
        <div id="home-container">
            <div><pre style={{
                display: "inline-block",
                letterSpacing: "0em",
                lineHeight: "1em",
                whiteSpace: "pre",
                textAlign: "left",
                fontFamily: ["Lucida Console", "Monaco", "monospace"]
            }} >{message}</pre>

                <img src="/bird.jpg" width="100%" />
            </div>
        </div >
    )
}

export default Home;