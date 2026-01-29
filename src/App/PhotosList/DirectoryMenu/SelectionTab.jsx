import React, { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * SelectionTab Component
 *
 * Handles photo, album, tag, and person selection operations
 * Extracted from DirectoryMenu.jsx to reduce file size
 *
 * @param {Object} props
 * @param {Object} props.viewModeObj - View mode object with mode checking methods
 * @param {Object} props.selectionState - Selection state group
 * @param {Array} props.selectionState.photoSelection - Selected photo paths
 * @param {Array} props.selectionState.selectedAlbums - Selected album IDs
 * @param {Array} props.selectionState.selectedTags - Selected tag IDs
 * @param {Array} props.selectionState.selectedPersons - Selected person IDs
 * @param {Object} props.handlers - Handler functions group
 * @param {Function} props.handlers.doOperation - Operation dispatcher
 * @param {Function} props.handlers.selectAllPhotoToSelection - Select all photos handler
 * @param {Function} props.handlers.clearPhotoSelection - Clear photo selection
 * @param {Function} props.handlers.deleteSelectedAlbums - Delete selected albums
 * @param {Function} props.handlers.clearAlbumSelection - Clear album selection
 * @param {Function} props.handlers.deleteSelectedTags - Delete selected tags
 * @param {Function} props.handlers.clearTagSelection - Clear tag selection
 * @param {Function} props.handlers.deleteSelectedPersons - Delete selected persons
 * @param {Function} props.handlers.clearPersonSelection - Clear person selection
 * @param {Object} props.importState - Import state with progress tracking
 * @param {Array} props.albumsList - List of all albums
 * @param {Array} props.tagsList - List of all tags
 * @param {Array} props.facesList - List of all persons/faces
 * @param {Object} props.dropdownRef - Ref for operations dropdown (tutorial positioning)
 * @param {Object} props.tabClass - Tab CSS classes
 */
function SelectionTab({
    viewModeObj,
    selectionState,
    handlers,
    importState,
    albumsList,
    tagsList,
    facesList = [],
    dropdownRef,
    tabClass
}) {
    // Local state for photo preview
    const [photoIndex, setPhotoIndex] = useState(-1);
    const [showBigPhoto, setShowBigPhoto] = useState(false);

    // Destructure from state groups
    const { photoSelection, selectedAlbums, selectedTags, persons: selectedPersons = [] } = selectionState;
    const {
        doOperation,
        selectAllPhotoToSelection,
        clearPhotoSelection,
        deleteSelectedAlbums,
        clearAlbumSelection,
        deleteSelectedTags,
        clearTagSelection,
        deleteSelectedPersons = () => {},
        clearPersonSelection = () => {}
    } = handlers;

    return (
        <>
            <div id="tab-selection" className={tabClass['selection'] ? "tab-active" : "tab"}>
                {/* Photo Selection (default mode) */}
                {viewModeObj?.shouldShowPhotoSelection() && (
                    <>
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                            <button onClick={() => selectAllPhotoToSelection()}>Select all photos in page</button>
                        </div>
                        {photoSelection.length == 0
                            ?
                            <div><br />Photos are not selected.</div>
                            :
                            <div>
                                <div className="operation">
                                    <select ref={dropdownRef} onChange={(e) => doOperation(e)}>
                                        <option value="select">Select an Operation</option>

                                        {/* Import-specific operations (only in import mode) */}
                                        {viewModeObj?.shouldShowImportOperations() && (
                                            <>
                                                {viewModeObj?.showImportSelected() && <option value="importSelected">📥 Import Selected Photos</option>}
                                                {viewModeObj?.showSelectAllInDirectory() && <option value="selectAllInDirectory">✅ Select All in This Directory</option>}
                                                <option value="unselectAll">❎ Unselect All</option>
                                            </>
                                        )}

                                        {/* Album-specific operations (only in album mode) */}
                                        {viewModeObj?.shouldShowAlbumOperations() && (
                                            <>
                                                {viewModeObj?.showRemoveFromAlbum() && <option value="removeFromAlbum">📤 Remove from Album</option>}
                                            </>
                                        )}

                                        {/* Tag-specific operations (only in tag mode) */}
                                        {viewModeObj?.shouldShowTagOperations() && (
                                            <>
                                                {viewModeObj?.showRemoveFromTag() && <option value="removeFromTag">🏷️ Remove from Tag</option>}
                                            </>
                                        )}

                                        {/* Trash mode operations */}
                                        {viewModeObj?.isTrashMode() && (
                                            <>
                                                {viewModeObj?.showRestoreFromTrash() && <option value="restoreFromTrash">♻️ Restore</option>}
                                                {viewModeObj?.showPermanentDelete() && <option value="permanentDelete">🗑️ Delete Permanently</option>}
                                            </>
                                        )}

                                        {/* Standard operations (non-import, non-trash modes) */}
                                        {viewModeObj?.shouldShowStandardOperations() && !viewModeObj?.isTrashMode() && (
                                            <>
                                                {viewModeObj?.showUploadToGooglePhotos() && <option value="uploadToGooglePhotos">☁️ Upload to Google Photos</option>}
                                                {viewModeObj?.showDeleteFiles() && <option value="deleteFiles">🗑️ Delete files</option>}

                                                {/* Album operations (all modes) */}
                                                {viewModeObj?.showCreateAlbum() && <option value="createAlbum">📚 Create Album</option>}
                                                {viewModeObj?.showAddToAlbum() && <option value="addToAlbum">📚 Add to Existing Album</option>}

                                                {/* Tag operations */}
                                                {viewModeObj?.showAddTags() && <option value="addTags">🏷️ Add Tags</option>}

                                                {/* Burst group operations */}
                                                {viewModeObj?.showCreateBurstGroup() && photoSelection.length >= 2 && (
                                                    <option value="createBurstGroup">📸 Create Burst Group</option>
                                                )}
                                                {viewModeObj?.showRemoveFromBurstGroup() && (
                                                    <option value="removeFromBurstGroup">📤 Remove from Burst Group</option>
                                                )}

                                                {/* Startup image operation */}
                                                <option value="addToStartupImages">🚀 Add to Startup Images</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <ul className="list-of-selected">
                                    {photoSelection.map((v, i) => {
                                        return <li key={v}><a href="#" onClick={() => setPhotoIndex(i)}>{v.replace(/^.+\//, "")}</a></li>
                                    })}
                                </ul>
                                <button onClick={() => clearPhotoSelection()}>Clear Selection</button>

                                {/* Import Progress Display - Import Mode Only */}
                                {viewModeObj?.shouldShowImportProgress() && importState?.importProgress && (
                                    <div className="import-progress" style={{
                                        marginTop: 'var(--space-4)',
                                        padding: 'var(--space-3)',
                                        backgroundColor: 'var(--color-bg-elevated)',
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: 'var(--space-1)' }}>Import Progress</div>
                                        <div>Progress: {importState.importProgress.progress}%</div>
                                        <div>Current: {importState.importProgress.current_file}</div>
                                        {importState.importProgress.error && (
                                            <div style={{ color: 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
                                                Error: {importState.importProgress.error}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        }
                        {photoIndex >= 0 &&
                            <img
                                onMouseOver={() => setShowBigPhoto(true)}
                                src={convertFileSrc(photoSelection[photoIndex])}
                            />}
                    </>
                )}

                {/* Album Selection (album list mode) */}
                {viewModeObj?.shouldShowAlbumSelection() && (
                    <div>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>Selected Albums</h3>
                        </div>
                        {selectedAlbums.length === 0 ? (
                            <div><br />No albums selected.</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: 'var(--space-4)' }}>
                                    <button
                                        onClick={deleteSelectedAlbums}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-danger)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            marginRight: 'var(--space-3)'
                                        }}
                                    >
                                        Delete Selected Albums
                                    </button>
                                    <button
                                        onClick={() => clearAlbumSelection()}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-bg-elevated)',
                                            color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-border-default)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {selectedAlbums.map((albumId) => {
                                        const album = albumsList.find(a => a.id === albumId);
                                        return album ? (
                                            <li key={albumId}>
                                                <span>{album.name} ({album.photoCount} photos)</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Tag Selection (tag list mode) */}
                {viewModeObj?.shouldShowTagSelection() && (
                    <div>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>Selected Tags</h3>
                        </div>
                        {selectedTags.length === 0 ? (
                            <div><br />No tags selected.</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: 'var(--space-4)' }}>
                                    <button
                                        onClick={deleteSelectedTags}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-danger)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            marginRight: 'var(--space-3)'
                                        }}
                                    >
                                        Delete Selected Tags
                                    </button>
                                    <button
                                        onClick={() => clearTagSelection()}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-bg-elevated)',
                                            color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-border-default)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {selectedTags.map((tagId) => {
                                        const tag = tagsList.find(t => t.id === tagId);
                                        return tag ? (
                                            <li key={tagId}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: 'var(--space-3)',
                                                    height: 'var(--space-3)',
                                                    backgroundColor: tag.color || 'var(--color-bg-muted)',
                                                    borderRadius: '50%',
                                                    marginRight: 'var(--space-2)'
                                                }}></span>
                                                <span>{tag.name} ({tag.photoCount} photos)</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Person Selection (face list mode) */}
                {viewModeObj?.shouldShowPersonSelection() && (
                    <div>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>Selected Persons</h3>
                        </div>
                        {selectedPersons.length === 0 ? (
                            <div><br />No persons selected.</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: 'var(--space-4)' }}>
                                    <button
                                        onClick={deleteSelectedPersons}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-danger)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            marginRight: 'var(--space-3)'
                                        }}
                                    >
                                        Delete Selected Persons
                                    </button>
                                    <button
                                        onClick={() => clearPersonSelection()}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-bg-elevated)',
                                            color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-border-default)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {selectedPersons.map((personId) => {
                                        const person = facesList.find(p => p.person_id === personId);
                                        return person ? (
                                            <li key={personId}>
                                                <span>{person.person_name || 'Unknown'} ({person.face_count || 0} faces)</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="big-photo-in-selection" style={{ display: showBigPhoto ? "block" : "none" }}
                onMouseLeave={() => setShowBigPhoto(false)}
                onClick={() => setShowBigPhoto(false)}
            >
                <img src={convertFileSrc(photoSelection[photoIndex])} />
            </div>
        </>
    );
}

export default SelectionTab;
