import React from 'react';
import { ViewMode } from '../domain/ViewMode.js';
import { logger } from '../services/LoggerService.js';

/**
 * Back navigation link component for empty states
 * Displays appropriate back link based on current view mode
 */
function BackNavigationLink({
    viewModeObj,
    clearSearch,
    toggleAlbumListMode,
    openTagsList,
    openFacesList,
    toggleHome
}) {
    const backNavInfo = viewModeObj.getBackNavigationInfo();
    
    if (!backNavInfo) {
        return null;
    }
    
    const handleBackClick = (e) => {
        e.preventDefault();
        
        switch (backNavInfo.action) {
            case 'clearSearch':
                clearSearch();
                break;
            case 'toggleAlbumListMode':
                toggleAlbumListMode();
                break;
            case 'openTagsList':
                openTagsList();
                break;
            case 'openFacesList':
                openFacesList();
                break;
            case 'toggleHome':
                toggleHome();
                break;
            default:
                logger.warn('BackNavigationLink', 'unknown_action', 'Unknown back navigation action', {
                    action: backNavInfo.action
                });
        }
    };
    
    return (
        <div style={{ float: "left", marginBottom: "10px" }}>
            <a 
                className="back-to-home" 
                onClick={handleBackClick} 
                href="#"
                aria-label={backNavInfo.label}
            >
                {backNavInfo.label}
            </a>
        </div>
    );
}

export default BackNavigationLink;