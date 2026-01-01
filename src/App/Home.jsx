import React, { useState } from "react";
import { useUI } from "../context/UIContext.jsx";
import "./Home.css";

function Home(props) {
    const [showWelcome, setShowWelcome] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const { toggleSearchPage } = useUI();
    const message = ``;

    const handleQuickSearch = () => {
        if (searchQuery.trim()) {
            toggleSearchPage(true, searchQuery);
        }
    };

    const handleAdvancedSearch = () => {
        toggleSearchPage(true, "", true); // isAdvanced = true
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleQuickSearch();
        }
    };

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
                <div className="home-search-container">
                    <div className="home-search-bar">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Search photos..."
                            className="home-search-input"
                        />
                        <button 
                            onClick={handleQuickSearch}
                            className="home-search-button"
                            disabled={!searchQuery.trim()}
                        >
                            Search
                        </button>
                        <button
                            onClick={handleAdvancedSearch}
                            className="home-advanced-search-button"
                        >
                            Detailed Search
                        </button>
                    </div>
                </div>
                <div className="splash-container">
                    <img className="splash" src={props.welcomeImage} width="100%"
                    />
                </div>
            </div>
        </div >
    )
}

export default Home;
