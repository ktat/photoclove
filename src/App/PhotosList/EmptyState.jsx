import React from 'react';

/**
 * EmptyState Component
 *
 * Displays a cute empty state message based on the current view mode
 * with animations and friendly visuals
 */
function EmptyState({ viewModeObj, searchQuery, searchParams }) {
    const getEmptyStateConfig = () => {
        if (viewModeObj.isSearchMode()) {
            // Check if search query or any search params are set
            const hasSearchQuery = searchQuery?.trim();
            const hasSearchParams = searchParams && Object.keys(searchParams).some(key => {
                const value = searchParams[key];
                if (value === null || value === undefined || value === '') return false;
                if (Array.isArray(value) && value.length === 0) return false;
                return true;
            });

            if (hasSearchQuery || hasSearchParams) {
                return {
                    emoji: '🔍',
                    message: 'No results found',
                    subtext: 'Try different search terms'
                };
            }
            return {
                emoji: '🔍',
                message: 'Ready to search',
                subtext: 'Enter search terms to find photos'
            };
        }
        if (viewModeObj.isAlbumMode()) {
            const albumName = viewModeObj.getCollectionName() || 'this album';
            return {
                emoji: '📚',
                message: 'Album is empty',
                subtext: `Add some photos to ${albumName}`
            };
        }
        if (viewModeObj.isTagMode()) {
            const tagName = viewModeObj.getCollectionName() || 'this tag';
            return {
                emoji: '🏷️',
                message: 'No tagged photos',
                subtext: `No photos with tag: ${tagName}`
            };
        }
        if (viewModeObj.isTrashMode()) {
            return {
                emoji: '🗑️',
                message: 'Trash is empty',
                subtext: 'Nothing to see here!'
            };
        }
        if (viewModeObj.isImportMode()) {
            return {
                emoji: '📥',
                message: 'No photos to import',
                subtext: 'Select a folder with photos'
            };
        }
        if (viewModeObj.isDateMode()) {
            return {
                emoji: '📅',
                message: 'No photos',
                subtext: 'No photos found for this date'
            };
        }
        if (viewModeObj.isRecentMode()) {
            return {
                emoji: '🕐',
                message: 'No recent photos',
                subtext: 'Import some photos to get started'
            };
        }
        // Default
        return {
            emoji: '📷',
            message: 'No photos found',
            subtext: 'Try a different selection'
        };
    };

    const config = getEmptyStateConfig();

    return (
        <div className="empty-state-container">
            <div className="empty-state-content">
                <div className="empty-state-icon">
                    <span className="empty-state-emoji">{config.emoji}</span>
                </div>
                <h2 className="empty-state-text">{config.message}</h2>
                <p className="empty-state-subtext">{config.subtext}</p>
            </div>
        </div>
    );
}

export default EmptyState;
