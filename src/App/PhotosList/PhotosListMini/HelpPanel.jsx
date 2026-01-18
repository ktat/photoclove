/**
 * HelpPanel - Keyboard shortcuts help panel for PhotosListMini
 */
import React from 'react';

// Disabled row style for burst restrictions
const disabledRowStyle = {
    opacity: 0.5,
    color: 'var(--color-text-muted)',
};

const disabledKeyStyle = {
    color: 'var(--color-text-muted)',
    textDecoration: 'line-through',
};

const disabledNoteStyle = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-warning)',
    fontStyle: 'italic',
};

/**
 * HelpPanel component displays keyboard shortcuts
 * @param {Object} props
 * @param {boolean} props.show - Whether to show the help panel
 * @param {Function} props.onClose - Function to close the panel
 * @param {boolean} props.isImportMode - Whether in import mode
 * @param {boolean} props.isTrashMode - Whether in trash mode
 * @param {boolean} props.isAlbumMode - Whether in album mode
 * @param {boolean} props.burstRestrictionsActive - Whether burst restrictions are active
 */
function HelpPanel({ show, onClose, isImportMode, isTrashMode, isAlbumMode, burstRestrictionsActive }) {
    const handleClick = () => {
        onClose();
        document.querySelector("#dummy-for-focus")?.focus();
    };

    // Helper to render a shortcut row with optional disabled state
    const ShortcutRow = ({ shortcut, description, disabled, disabledReason }) => (
        <tr style={disabled ? disabledRowStyle : {}}>
            <th style={disabled ? disabledKeyStyle : {}}>{shortcut}</th>
            <td>
                {description}
                {disabled && disabledReason && (
                    <div style={disabledNoteStyle}>{disabledReason}</div>
                )}
            </td>
        </tr>
    );

    const burstDisabledReason = burstRestrictionsActive ? "Disabled for burst group photo" : null;

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
                    <ShortcutRow
                        shortcut="C"
                        description="toggle photo selection"
                        disabled={burstRestrictionsActive}
                        disabledReason={burstDisabledReason}
                    />

                    {/* Hide metadata shortcuts in import mode and trash mode */}
                    {!isImportMode && !isTrashMode && (
                        <>
                            <ShortcutRow
                                shortcut="S"
                                description="increase star"
                                disabled={burstRestrictionsActive}
                                disabledReason={burstDisabledReason}
                            />
                            <ShortcutRow
                                shortcut="D"
                                description="decrease star"
                                disabled={burstRestrictionsActive}
                                disabledReason={burstDisabledReason}
                            />
                            <ShortcutRow
                                shortcut="F"
                                description="favorite (select + 5 stars)"
                                disabled={burstRestrictionsActive}
                                disabledReason={burstDisabledReason}
                            />
                            <ShortcutRow
                                shortcut="Del"
                                description={isAlbumMode ? "remove from album" : "move to trash can"}
                                disabled={burstRestrictionsActive}
                                disabledReason={burstDisabledReason}
                            />
                            {isAlbumMode && (
                                <ShortcutRow
                                    shortcut="Ctrl + Del"
                                    description="delete file permanently"
                                    disabled={burstRestrictionsActive}
                                    disabledReason={burstDisabledReason}
                                />
                            )}
                        </>
                    )}

                    {/* Trash mode specific shortcuts */}
                    {isTrashMode && (
                        <ShortcutRow
                            shortcut="Del"
                            description="permanently delete"
                            disabled={burstRestrictionsActive}
                            disabledReason={burstDisabledReason}
                        />
                    )}

                    <tr><th>I</th><td>toggle photo info</td></tr>
                    <tr><th>?</th><td>toggle showing this help</td></tr>
                </tbody>
            </table>
        </div>
    );
}

export default HelpPanel;
