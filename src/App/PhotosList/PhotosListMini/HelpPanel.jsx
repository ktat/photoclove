/**
 * HelpPanel - Keyboard shortcuts help panel for PhotosListMini
 */
import React from 'react';

/**
 * HelpPanel component displays keyboard shortcuts
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the help panel
 * @param {Function} props.onClose - Function to close the panel
 * @param {boolean} props.isImportMode - Whether in import mode
 * @param {boolean} props.isTrashMode - Whether in trash mode
 * @param {boolean} props.isAlbumMode - Whether in album mode
 */
function HelpPanel({ show, onClose, isImportMode, isTrashMode, isAlbumMode }) {
    const handleClick = () => {
        onClose();
        document.querySelector("#dummy-for-focus")?.focus();
    };

    return (
        <div
            id="help"
            className={show ? "" : "hidden"}
            onClick={handleClick}
        >
            <h1>Help</h1>
            <table>
                <tbody>
                    <tr><th>Right/Left Arrow</th><td>navigate photos</td></tr>
                    <tr><th>Up Arrow/Down Arrow</th><td>Open/Close mini list</td></tr>
                    <tr><th>Ctrl + Mouse Wheel</th><td>zoom photo</td></tr>
                    <tr><th>Ctrl + Drag</th><td>drag photo while zooming</td></tr>
                    <tr><th>Ctrl + 0</th><td>reset zoom</td></tr>
                    <tr><th>C</th><td>toggle photo selection</td></tr>

                    {/* Hide metadata shortcuts in import mode and trash mode */}
                    {!isImportMode && !isTrashMode && (
                        <>
                            <tr><th>S</th><td>increase star</td></tr>
                            <tr><th>D</th><td>decrease star</td></tr>
                            <tr><th>F</th><td>favorite (select + 5 stars)</td></tr>
                            <tr><th>Del</th><td>{isAlbumMode ? "remove from album" : "move to trash can"}</td></tr>
                            {isAlbumMode && <tr><th>Ctrl + Del</th><td>delete file permanently</td></tr>}
                        </>
                    )}

                    {/* Trash mode specific shortcuts */}
                    {isTrashMode && (
                        <tr><th>Del</th><td>permanently delete</td></tr>
                    )}

                    <tr><th>I</th><td>toggle photo info</td></tr>
                    <tr><th>?</th><td>toggle showing this help</td></tr>
                </tbody>
            </table>
        </div>
    );
}

export default HelpPanel;
