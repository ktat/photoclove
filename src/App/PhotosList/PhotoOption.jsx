import { useState } from "react";
import PhotoInfo from "./PhotoOption/PhotoInfo.jsx";
import PhotoEditor from "./PhotoOption/PhotoEditor.jsx";

function PhotoOption(props) {
    const [activeTab, setActiveTab] = useState("info");

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
                <button 
                    className="vertical-tab-button close-tab"
                    onClick={handleCloseTab}
                    title="Close Panel"
                >
                    ×
                </button>
            </div>
            
            {/* Content area */}
            {props.currentPhotoPath && props.showSideMenu && (
                <div className="tab-content" style={{
                    position: 'fixed',
                    right: '0px',
                    top: '0px',
                    width: '320px',
                    height: 'calc(100vh - 25px)',
                    backgroundColor: '#1f1f1f',
                    paddingLeft: '20px',
                    paddingTop: '10px',
                    zIndex: 1000
                }}>
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
                </div>
            )}
        </>
    );
}

export default PhotoOption;