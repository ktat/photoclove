import { useState } from "react";
import PhotoInfo from "./PhotoOption/PhotoInfo.jsx";
import PhotoEditor from "./PhotoOption/PhotoEditor.jsx";

function PhotoOption(props) {
    const [activeTab, setActiveTab] = useState("info");

    return (
        <>
            <div className="togglePhotoInfo">
                <a href="#" onClick={() => {
                    props.setShowSideMenu(!props.showSideMenu);
                    document.querySelector("#dummy-for-focus").focus();
                }}>
                    {props.showSideMenu ? ">" : "<"}
                </a>
            </div>
            <div className="photo-info-tabs">
                <div className="tab-header">
                    <button 
                        className={activeTab === "info" ? "tab-button active" : "tab-button"}
                        onClick={() => setActiveTab("info")}
                    >
                        📷 Info
                    </button>
                    <button 
                        className={activeTab === "editor" ? "tab-button active" : "tab-button"}
                        onClick={() => setActiveTab("editor")}
                    >
                        🎨 Editor
                    </button>
                </div>
            </div>
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