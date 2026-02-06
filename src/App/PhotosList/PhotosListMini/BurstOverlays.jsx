import React from "react";
import { logger } from "../../../services/LoggerService.js";

/**
 * BurstBadge - Shows when viewing burst representative in burst mode
 * Clickable to open the burst group
 */
export function BurstBadge({
    burstGroupId,
    burstCount,
    currentViewMode,
    currentViewModeData,
    openBurstGroup
}) {
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        logger.info('PhotoDisplay', 'burst_badge_click', 'Burst badge clicked', {
            burstGroupId,
            currentViewMode,
            currentViewModeData,
            hasOpenBurstGroup: !!openBurstGroup
        });
        if (openBurstGroup) {
            // Pass current view mode and data so we can return to this photo
            openBurstGroup(burstGroupId, currentViewMode, currentViewModeData);
        }
    };

    return (
        <div
            onClick={handleClick}
            style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
            title="Click to view all photos in this burst group"
        >
            +{burstCount - 1} photos in group
        </div>
    );
}

/**
 * BurstGroupIndicator - Shows when inside burst group view
 * Clickable to exit burst group view
 */
export function BurstGroupIndicator({ goBackFromBurstGroup }) {
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (goBackFromBurstGroup) {
            goBackFromBurstGroup();
        }
    };

    return (
        <div
            onClick={handleClick}
            style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-primary-hover)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--color-primary)'}
            title="Click to exit burst group view"
        >
            Burst Group ✕
        </div>
    );
}

/**
 * FaceCountIndicator - Shows face count when Face tab is active
 */
export function FaceCountIndicator({ facesCount, showFaceBboxes, setShowFaceBboxes }) {
    return (
        <div
            onClick={() => setShowFaceBboxes(!showFaceBboxes)}
            style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                backgroundColor: showFaceBboxes ? 'var(--color-primary)' : 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.2s'
            }}
            title="Click to toggle face boxes (or press 'f')"
        >
            👤 {facesCount} face{facesCount !== 1 ? 's' : ''}
            <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)' }}>[F]</span>
        </div>
    );
}
