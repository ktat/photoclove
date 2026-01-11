import React from "react";

/**
 * Tutorial Content Generator
 *
 * Generates tutorial content for DirectoryMenu selection operations
 * Extracted from DirectoryMenu.jsx to reduce file size
 *
 * @param {string} context - Tutorial context ('albumMode', 'dateMode', or 'trashMode')
 * @param {number} photoCount - Number of selected photos
 * @param {boolean} isTrashMode - Whether currently in trash mode
 * @returns {JSX.Element} Tutorial content JSX
 */
export const getTutorialContent = (context, photoCount, isTrashMode = false) => {
    const photoText = `${photoCount} photo${photoCount !== 1 ? 's' : ''}`;

    // Trash mode has completely different operations
    if (isTrashMode) {
        return (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    💡 Selected {photoText} from trash
                </div>
                <div>You can now:</div>
                <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                    <li>♻️ Restore - Restore files from trash</li>
                    <li>🗑️ Delete Permanently - Permanently remove files</li>
                </ul>
            </div>
        );
    }

    // Normal modes (date/album)
    const deleteText = '🗑️ Move to Trash - Move files to trash';

    if (context === 'albumMode') {
        return (
            <div>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                    💡 Selected {photoText} from this album
                </div>
                <div>You can now:</div>
                <ul style={{ margin: '8px 0', paddingLeft: '16px' }}>
                    <li>❌ Remove from Album - Remove from current album</li>
                    <li>⬆️ Upload to Google Photos - Sync with Google</li>
                    <li>{deleteText}</li>
                    <li>📚 Create Album - Make a new album</li>
                    <li>📚 Add to Album - Add to a different album</li>
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
                    <li>⬆️ Upload to Google Photos - Sync with Google</li>
                    <li>{deleteText}</li>
                    <li>📚 Create Album - Make a new album</li>
                    <li>📚 Add to Album - Add to existing album</li>
                </ul>
            </div>
        );
    }
};
