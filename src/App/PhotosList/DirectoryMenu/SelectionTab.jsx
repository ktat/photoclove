import React, { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useTranslation } from 'react-i18next';
import FaceThumbnail from "../../../components/FaceThumbnail.jsx";

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
    faceViewType = 'persons',
    dropdownRef,
    tabClass
}) {
    const { t } = useTranslation(['directoryMenu']);
    // Local state for photo preview
    const [photoIndex, setPhotoIndex] = useState(-1);
    const [showBigPhoto, setShowBigPhoto] = useState(false);
    // State for unknown faces batch operations
    const [showPersonSelector, setShowPersonSelector] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');
    const [showNewPersonInput, setShowNewPersonInput] = useState(false);

    // Destructure from state groups
    const { photoSelection, selectedAlbums, selectedTags, persons: selectedPersons = [], unknownFaces: selectedUnknownFaces = [] } = selectionState;
    const {
        doOperation,
        selectAllPhotoToSelection,
        clearPhotoSelection,
        deleteSelectedAlbums,
        clearAlbumSelection,
        deleteSelectedTags,
        clearTagSelection,
        deleteSelectedPersons = () => {},
        clearPersonSelection = () => {},
        clearUnknownFaceSelection = () => {},
        deleteUnknownFacesBatch = () => {},
        assignUnknownFacesToPerson = () => {}
    } = handlers;

    // Handle unknown faces operation selection
    const handleUnknownFacesOperation = async (e) => {
        const operation = e.target.value;
        e.target.value = 'select'; // Reset dropdown first

        if (operation === 'delete') {
            const confirmed = await confirm(t('directoryMenu:face.confirmDelete', { count: selectedUnknownFaces.length }), { title: t('directoryMenu:face.delete') });
            if (confirmed) {
                deleteUnknownFacesBatch(selectedUnknownFaces);
            }
        } else if (operation === 'assignNew') {
            setShowNewPersonInput(true);
            setShowPersonSelector(false);
        } else if (operation === 'assignExisting') {
            setShowPersonSelector(true);
            setShowNewPersonInput(false);
        }
    };

    // Handle new person creation and assignment
    const handleCreateAndAssign = () => {
        if (newPersonName.trim()) {
            assignUnknownFacesToPerson(selectedUnknownFaces, null, newPersonName.trim());
            setNewPersonName('');
            setShowNewPersonInput(false);
        }
    };

    // Handle existing person assignment
    const handleAssignToExistingPerson = (personId) => {
        assignUnknownFacesToPerson(selectedUnknownFaces, personId, null);
        setShowPersonSelector(false);
    };

    return (
        <>
            <div id="tab-selection" className={tabClass['selection'] ? "tab-active" : "tab"}>
                {/* Photo Selection (default mode) */}
                {viewModeObj?.shouldShowPhotoSelection() && (
                    <>
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                            <button onClick={() => selectAllPhotoToSelection()}>{t('directoryMenu:selection.selectAllInPage')}</button>
                        </div>
                        {photoSelection.length == 0
                            ?
                            <div><br />{t('directoryMenu:selection.photosNotSelected')}</div>
                            :
                            <div>
                                <div className="operation">
                                    <select ref={dropdownRef} onChange={(e) => doOperation(e)}>
                                        <option value="select">{t('directoryMenu:selection.selectOperation')}</option>

                                        {/* Import-specific operations (only in import mode) */}
                                        {viewModeObj?.shouldShowImportOperations() && (
                                            <>
                                                {viewModeObj?.showImportSelected() && <option value="importSelected">📥 {t('directoryMenu:operations.importSelected')}</option>}
                                                {viewModeObj?.showSelectAllInDirectory() && <option value="selectAllInDirectory">✅ {t('directoryMenu:operations.selectAllInDirectory')}</option>}
                                                <option value="unselectAll">❎ {t('directoryMenu:operations.unselectAll')}</option>
                                            </>
                                        )}

                                        {/* Album-specific operations (only in album mode) */}
                                        {viewModeObj?.shouldShowAlbumOperations() && (
                                            <>
                                                {viewModeObj?.showRemoveFromAlbum() && <option value="removeFromAlbum">📤 {t('directoryMenu:operations.removeFromAlbum')}</option>}
                                            </>
                                        )}

                                        {/* Tag-specific operations (only in tag mode) */}
                                        {viewModeObj?.shouldShowTagOperations() && (
                                            <>
                                                {viewModeObj?.showRemoveFromTag() && <option value="removeFromTag">🏷️ {t('directoryMenu:operations.removeFromTag')}</option>}
                                            </>
                                        )}

                                        {/* Trash mode operations */}
                                        {viewModeObj?.isTrashMode() && (
                                            <>
                                                {viewModeObj?.showRestoreFromTrash() && <option value="restoreFromTrash">♻️ {t('directoryMenu:operations.restore')}</option>}
                                                {viewModeObj?.showPermanentDelete() && <option value="permanentDelete">🗑️ {t('directoryMenu:operations.deletePermanently')}</option>}
                                            </>
                                        )}

                                        {/* Standard operations (non-import, non-trash modes) */}
                                        {viewModeObj?.shouldShowStandardOperations() && !viewModeObj?.isTrashMode() && (
                                            <>
                                                {viewModeObj?.showUploadToGooglePhotos() && <option value="uploadToGooglePhotos">☁️ {t('directoryMenu:operations.uploadToGooglePhotos')}</option>}
                                                {viewModeObj?.showDeleteFiles() && <option value="deleteFiles">🗑️ {t('directoryMenu:operations.deleteFiles')}</option>}

                                                {/* Album operations (all modes) */}
                                                {viewModeObj?.showCreateAlbum() && <option value="createAlbum">📚 {t('directoryMenu:operations.createAlbum')}</option>}
                                                {viewModeObj?.showAddToAlbum() && <option value="addToAlbum">📚 {t('directoryMenu:operations.addToAlbum')}</option>}

                                                {/* Tag operations */}
                                                {viewModeObj?.showAddTags() && <option value="addTags">🏷️ {t('directoryMenu:operations.addTags')}</option>}

                                                {/* Burst group operations */}
                                                {viewModeObj?.showCreateBurstGroup() && photoSelection.length >= 2 && (
                                                    <option value="createBurstGroup">📸 {t('directoryMenu:operations.createBurstGroup')}</option>
                                                )}
                                                {viewModeObj?.showRemoveFromBurstGroup() && (
                                                    <option value="removeFromBurstGroup">📤 {t('directoryMenu:operations.removeFromBurstGroup')}</option>
                                                )}

                                                {/* Startup image operation */}
                                                <option value="addToStartupImages">🚀 {t('directoryMenu:operations.addToStartupImages')}</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <ul className="list-of-selected">
                                    {photoSelection.map((v, i) => {
                                        return <li key={v}><a href="#" onClick={() => setPhotoIndex(i)}>{v.replace(/^.+\//, "")}</a></li>
                                    })}
                                </ul>
                                <button style={{ marginTop: 'var(--space-3)' }} onClick={() => clearPhotoSelection()}>{t('directoryMenu:selection.clearSelection')}</button>

                                {/* Import Progress Display - Import Mode Only */}
                                {viewModeObj?.shouldShowImportProgress() && importState?.importProgress && (
                                    <div className="import-progress" style={{
                                        marginTop: 'var(--space-4)',
                                        padding: 'var(--space-3)',
                                        backgroundColor: 'var(--color-bg-elevated)',
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: 'var(--space-1)' }}>{t('directoryMenu:selection.importProgress')}</div>
                                        <div>{t('directoryMenu:selection.progress')}: {importState.importProgress.progress}%</div>
                                        <div>{t('directoryMenu:selection.current')}: {importState.importProgress.current_file}</div>
                                        {importState.importProgress.error && (
                                            <div style={{ color: 'var(--color-danger)', marginTop: 'var(--space-1)' }}>
                                                {t('directoryMenu:selection.error')}: {importState.importProgress.error}
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
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>{t('directoryMenu:album.selectedAlbums')}</h3>
                        </div>
                        {selectedAlbums.length === 0 ? (
                            <div><br />{t('directoryMenu:album.noAlbumsSelected')}</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <button
                                        onClick={deleteSelectedAlbums}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-danger)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('directoryMenu:album.deleteSelectedAlbums')}
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
                                        {t('directoryMenu:selection.clearSelection')}
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {selectedAlbums.map((albumId) => {
                                        const album = albumsList.find(a => a.id === albumId);
                                        return album ? (
                                            <li key={albumId}>
                                                <span>{album.name} ({t('directoryMenu:album.photoCount', { count: album.photoCount })})</span>
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
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>{t('directoryMenu:tag.selectedTags')}</h3>
                        </div>
                        {selectedTags.length === 0 ? (
                            <div><br />{t('directoryMenu:tag.noTagsSelected')}</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <button
                                        onClick={deleteSelectedTags}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-danger)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('directoryMenu:tag.deleteSelectedTags')}
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
                                        {t('directoryMenu:selection.clearSelection')}
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
                                                <span>{tag.name} ({t('directoryMenu:tag.photoCount', { count: tag.photoCount })})</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Person Selection (face list mode - Persons tab) */}
                {viewModeObj?.shouldShowPersonSelection() && faceViewType === 'persons' && (
                    <div>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>{t('directoryMenu:person.selectedPersons')}</h3>
                        </div>
                        {selectedPersons.length === 0 ? (
                            <div><br />{t('directoryMenu:person.noPersonsSelected')}</div>
                        ) : (
                            <div>
                                <div className="operation" style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <button
                                        onClick={deleteSelectedPersons}
                                        style={{
                                            padding: 'var(--space-2) var(--space-3)',
                                            backgroundColor: 'var(--color-danger)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('directoryMenu:person.deleteSelectedPersons')}
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
                                        {t('directoryMenu:selection.clearSelection')}
                                    </button>
                                </div>
                                <ul className="list-of-selected">
                                    {selectedPersons.map((personId) => {
                                        const person = facesList.find(p => p.person_id === personId);
                                        return person ? (
                                            <li key={personId}>
                                                <span>{person.person_name || t('directoryMenu:person.unknown')} ({t('directoryMenu:person.faceCount', { count: person.face_count || 0 })})</span>
                                            </li>
                                        ) : null;
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Unknown Faces Selection (face list mode - Unknown tab) */}
                {viewModeObj?.shouldShowPersonSelection() && faceViewType === 'unknown' && (
                    <div>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: 'var(--font-size-lg)' }}>{t('directoryMenu:face.selectedFaces', { count: selectedUnknownFaces.length })}</h3>
                        </div>
                        {selectedUnknownFaces.length === 0 ? (
                            <div><br />{t('directoryMenu:face.noFacesSelected')}</div>
                        ) : (
                            <div>
                                <div className="operation">
                                    <select onChange={handleUnknownFacesOperation}>
                                        <option value="select">{t('directoryMenu:selection.selectOperation')}</option>
                                        <option value="assignNew">👤 {t('directoryMenu:face.assignToNewPerson')}</option>
                                        <option value="assignExisting">👥 {t('directoryMenu:face.assignToExistingPerson')}</option>
                                        <option value="delete">🗑️ {t('directoryMenu:face.delete')}</option>
                                    </select>
                                </div>

                                {/* New Person Input */}
                                {showNewPersonInput && (
                                    <div style={{
                                        marginBottom: 'var(--space-4)',
                                        padding: 'var(--space-3)',
                                        backgroundColor: 'var(--color-bg-elevated)',
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <div style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold' }}>{t('directoryMenu:face.createNewPerson')}</div>
                                        <input
                                            type="text"
                                            value={newPersonName}
                                            onChange={(e) => setNewPersonName(e.target.value)}
                                            placeholder={t('directoryMenu:face.enterPersonName')}
                                            style={{
                                                width: '100%',
                                                padding: 'var(--space-2)',
                                                marginBottom: 'var(--space-2)',
                                                border: '1px solid var(--color-border-default)',
                                                borderRadius: 'var(--radius-sm)',
                                                backgroundColor: 'var(--color-bg-surface)',
                                                color: 'var(--color-text-primary)'
                                            }}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAssign()}
                                        />
                                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                            <button
                                                onClick={handleCreateAndAssign}
                                                style={{
                                                    padding: 'var(--space-2) var(--space-3)',
                                                    backgroundColor: 'var(--color-primary)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {t('directoryMenu:face.createAndAssign')}
                                            </button>
                                            <button
                                                onClick={() => setShowNewPersonInput(false)}
                                                style={{
                                                    padding: 'var(--space-2) var(--space-3)',
                                                    backgroundColor: 'var(--color-bg-elevated)',
                                                    color: 'var(--color-text-primary)',
                                                    border: '1px solid var(--color-border-default)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {t('directoryMenu:face.cancel')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Existing Person Selector */}
                                {showPersonSelector && (
                                    <div style={{
                                        marginBottom: 'var(--space-4)',
                                        padding: 'var(--space-3)',
                                        backgroundColor: 'var(--color-bg-elevated)',
                                        border: '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-sm)'
                                    }}>
                                        <div style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{t('directoryMenu:face.selectPerson')}</span>
                                            <button
                                                onClick={() => setShowPersonSelector(false)}
                                                style={{
                                                    padding: 'var(--space-1) var(--space-2)',
                                                    backgroundColor: 'transparent',
                                                    color: 'var(--color-text-muted)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: 'var(--font-size-lg)'
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                        <div style={{
                                            maxHeight: '300px',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 'var(--space-2)'
                                        }}>
                                            {facesList.filter(p => p.person_name).map((person) => (
                                                <div
                                                    key={person.person_id}
                                                    onClick={() => handleAssignToExistingPerson(person.person_id)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        padding: 'var(--space-2)',
                                                        backgroundColor: 'var(--color-bg-muted)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        border: '1px solid var(--color-border-default)',
                                                        textAlign: 'center',
                                                        transition: 'border-color 0.2s'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                                                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border-default)'}
                                                >
                                                    {person.photo_path && person.bbox_x !== null ? (
                                                        <FaceThumbnail
                                                            faceId={person.representative_face_id}
                                                            photoPath={person.photo_path}
                                                            bbox={{
                                                                bbox_x: person.bbox_x,
                                                                bbox_y: person.bbox_y,
                                                                bbox_width: person.bbox_width,
                                                                bbox_height: person.bbox_height
                                                            }}
                                                            size={60}
                                                            borderRadius="var(--radius-sm)"
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '60px',
                                                            height: '60px',
                                                            backgroundColor: 'var(--color-bg-surface)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: 'var(--font-size-xl)'
                                                        }}>
                                                            👤
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        marginTop: 'var(--space-1)',
                                                        fontSize: 'var(--font-size-xs)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: '70px'
                                                    }}>
                                                        {person.person_name}
                                                    </div>
                                                </div>
                                            ))}
                                            {facesList.filter(p => p.person_name).length === 0 && (
                                                <div style={{ color: 'var(--color-text-muted)', padding: 'var(--space-3)' }}>
                                                    {t('directoryMenu:face.noNamedPersons')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <button style={{ marginTop: 'var(--space-3)' }} onClick={() => clearUnknownFaceSelection()}>{t('directoryMenu:selection.clearSelection')}</button>
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
