import { useState } from "react";
import PhotoInfo from "./PhotoOption/PhotoInfo.jsx";
import PhotoEditor from "./PhotoOption/PhotoEditor.jsx";

function PhotoOption(props) {
    // Set default active tab based on search mode
    const defaultTab = props.searchMode ? "search" : "info";
    const [activeTab, setActiveTab] = useState(defaultTab);

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        // Show the side menu when a tab is clicked
        if (!props.showSideMenu) {
            props.setShowSideMenu(true);
        }
        document.querySelector("#dummy-for-focus").focus();
    };

    const handleCloseTab = () => {
        props.setShowSideMenu(false);
        document.querySelector("#dummy-for-focus").focus();
    };

    return (
        <>
            {/* Vertical tabs replacing the toggle */}
            <div className={`vertical-tabs ${props.showSideMenu ? 'menu-open' : 'menu-closed'}`}>
                {props.searchMode && (
                    <button 
                        className={activeTab === "search" ? "vertical-tab-button active" : "vertical-tab-button"}
                        onClick={() => handleTabClick("search")}
                        title="Search Tools"
                    >
                        <span className="vertical-text">Search</span>
                    </button>
                )}
                <button 
                    className={activeTab === "info" ? "vertical-tab-button active" : "vertical-tab-button"}
                    onClick={() => handleTabClick("info")}
                    title="Photo Information"
                >
                    <span className="vertical-text">Info</span>
                </button>
                <button 
                    className={activeTab === "editor" ? "vertical-tab-button active" : "vertical-tab-button"}
                    onClick={() => handleTabClick("editor")}
                    title="Photo Editor"
                >
                    <span className="vertical-text">Editor</span>
                </button>
                {props.showSideMenu && (
                    <button 
                        className="vertical-tab-button close-tab"
                        onClick={handleCloseTab}
                        title="Close Panel"
                    >
                        ×
                    </button>
                )}
            </div>
            
            {/* Content area */}
            {props.currentPhotoPath && props.showSideMenu && (
                <div className="tab-content">
                    {activeTab === "info" && (
                        <PhotoInfo 
                            currentPhotoPath={props.currentPhotoPath}
                            showSideMenu={props.showSideMenu}
                            imgCacheMap={props.imgCacheMap}
                            star={props.star}
                            setStar={props.setStar}
                            addFooterMessage={props.addFooterMessage}
                            onCommentUpdate={props.onCommentUpdate}
                        />
                    )}
                    {activeTab === "editor" && (
                        <PhotoEditor 
                            currentPhotoPath={props.currentPhotoPath}
                            showSideMenu={props.showSideMenu}
                            addFooterMessage={props.addFooterMessage}
                            onPhotosRefresh={props.onPhotosRefresh}
                        />
                    )}
                    {activeTab === "search" && props.searchMode && (
                        <div className="search-tools-tab">
                            <div className="search-tools-content">
                                <h3>Search Tools</h3>
                                <div className="search-info">
                                    <div className="search-query-info">
                                        <strong>Query:</strong> "{props.searchQuery}"
                                    </div>
                                    <div className="search-results-info">
                                        <strong>Results:</strong> {props.searchResultsCount || 0} photo{(props.searchResultsCount || 0) !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                
                                {/* Search Tools - passed from parent */}
                                {props.searchTools && (
                                    <div className="search-tools-section">
                                        {props.searchTools}
                                    </div>
                                )}
                                
                                <div className="search-actions">
                                    {props.onClearSearch && (
                                        <button 
                                            onClick={props.onClearSearch} 
                                            className="clear-search-button"
                                            style={{ 
                                                marginTop: "10px", 
                                                padding: "8px 16px", 
                                                backgroundColor: "#ff4444",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "4px",
                                                cursor: "pointer"
                                            }}
                                        >
                                            Clear Search
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export default PhotoOption;