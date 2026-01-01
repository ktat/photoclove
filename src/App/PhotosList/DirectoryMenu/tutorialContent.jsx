import React from "react";

/**
 * Tutorial Content Generator
 *
 * Generates tutorial content for DirectoryMenu selection operations
 * Extracted from DirectoryMenu.jsx to reduce file size
 *
 * @param {string} context - Tutorial context ('albumMode' or 'dateMode')
 * @param {number} photoCount - Number of selected photos
 * @returns {JSX.Element} Tutorial content JSX
 */
export const getTutorialContent = (context, photoCount) => {
    const photoText = `${photoCount} photo${photoCount !== 1 ? 's' : ''}`;

    if (context === 'albumMode') {
        return (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    💡 Selected {photoText} from this album
                </div>
                <div>You can now:</div>
                <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                    <li>📚 Create Album - Make a new album</li>
                    <li>📚 Add to Album - Add to a different album</li>
                    <li>❌ Remove from Album - Remove from current album</li>
                    <li>⬆️ Upload to Google Photos - Sync with Google</li>
                    <li>🗑️ Delete Files - Permanently remove files</li>
                </ul>
            </div>
        );
    } else {
        return (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    💡 Selected {photoText}
                </div>
                <div>You can now:</div>
                <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                    <li>📚 Create Album - Make a new album</li>
                    <li>📚 Add to Album - Add to existing album</li>
                    <li>⬆️ Upload to Google Photos - Sync with Google</li>
                    <li>🗑️ Delete Files - Permanently remove files</li>
                </ul>
            </div>
        );
    }
};
