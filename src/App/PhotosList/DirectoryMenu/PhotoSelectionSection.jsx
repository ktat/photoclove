import React, { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useTranslation } from 'react-i18next';
import SelectionHeader from "./SelectionHeader.jsx";

/**
 * PhotoSelectionSection - Photo selection UI
 */
function PhotoSelectionSection({
    photoSelection,
    viewModeObj,
    handlers,
    importState,
    dropdownRef
}) {
    const { t } = useTranslation(['directoryMenu']);
    const [photoIndex, setPhotoIndex] = useState(-1);
    const [showBigPhoto, setShowBigPhoto] = useState(false);

    const { doOperation, selectAllPhotoToSelection, clearPhotoSelection } = handlers;

    return (
        <>
            <SelectionHeader
                count={photoSelection.length}
                labelKey="directoryMenu:selection.photosSelected"
                onClear={clearPhotoSelection}
            />
            <div style={{ marginBottom: 'var(--space-3)' }}>
                <button onClick={() => selectAllPhotoToSelection()}>
                    {t('directoryMenu:selection.selectAllInPage')}
                </button>
            </div>
            {photoSelection.length === 0 ? (
                <div><br />{t('directoryMenu:selection.photosNotSelected')}</div>
            ) : (
                <div>
                    {/* Import mode: Show button instead of dropdown */}
                    {viewModeObj?.shouldShowImportOperations() ? (
                        <div className="operation" style={{ marginBottom: 'var(--space-3)' }}>
                            <button
                                ref={dropdownRef}
                                onClick={() => doOperation({ target: { value: 'importSelected' } })}
                                style={{
                                    padding: 'var(--space-2) var(--space-4)',
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-base)'
                                }}
                            >
                                📥 {t('directoryMenu:operations.importSelected')}
                            </button>
                        </div>
                    ) : (
                        <div className="operation">
                            <select ref={dropdownRef} onChange={(e) => doOperation(e)}>
                                <option value="select">{t('directoryMenu:selection.selectOperation')}</option>

                                {/* Album-specific operations */}
                                {viewModeObj?.shouldShowAlbumOperations() && viewModeObj?.showRemoveFromAlbum() && (
                                    <option value="removeFromAlbum">📤 {t('directoryMenu:operations.removeFromAlbum')}</option>
                                )}

                                {/* Tag-specific operations */}
                                {viewModeObj?.shouldShowTagOperations() && viewModeObj?.showRemoveFromTag() && (
                                    <option value="removeFromTag">🏷️ {t('directoryMenu:operations.removeFromTag')}</option>
                                )}

                                {/* Trash mode operations */}
                                {viewModeObj?.isTrashMode() && (
                                    <>
                                        {viewModeObj?.showRestoreFromTrash() && <option value="restoreFromTrash">♻️ {t('directoryMenu:operations.restore')}</option>}
                                        {viewModeObj?.showPermanentDelete() && <option value="permanentDelete">🗑️ {t('directoryMenu:operations.deletePermanently')}</option>}
                                    </>
                                )}

                                {/* Standard operations */}
                                {viewModeObj?.shouldShowStandardOperations() && !viewModeObj?.isTrashMode() && (
                                    <>
                                        {viewModeObj?.showUploadToGooglePhotos() && <option value="uploadToGooglePhotos">☁️ {t('directoryMenu:operations.uploadToGooglePhotos')}</option>}
                                        {viewModeObj?.showDeleteFiles() && <option value="deleteFiles">🗑️ {t('directoryMenu:operations.deleteFiles')}</option>}
                                        {viewModeObj?.showCreateAlbum() && <option value="createAlbum">📚 {t('directoryMenu:operations.createAlbum')}</option>}
                                        {viewModeObj?.showAddToAlbum() && <option value="addToAlbum">📚 {t('directoryMenu:operations.addToAlbum')}</option>}
                                        {viewModeObj?.showAddTags() && <option value="addTags">🏷️ {t('directoryMenu:operations.addTags')}</option>}
                                        {viewModeObj?.showCreateBurstGroup() && photoSelection.length >= 2 && (
                                            <option value="createBurstGroup">📸 {t('directoryMenu:operations.createBurstGroup')}</option>
                                        )}
                                        {viewModeObj?.showRemoveFromBurstGroup() && (
                                            <option value="removeFromBurstGroup">📤 {t('directoryMenu:operations.removeFromBurstGroup')}</option>
                                        )}
                                        <option value="addToStartupImages">🚀 {t('directoryMenu:operations.addToStartupImages')}</option>
                                    </>
                                )}
                            </select>
                        </div>
                    )}
                    <ul className="list-of-selected">
                        {photoSelection.map((v, i) => (
                            <li key={v}><a href="#" onClick={() => setPhotoIndex(i)}>{v.replace(/^.+\//, "")}</a></li>
                        ))}
                    </ul>

                    {/* Import Progress Display */}
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
            )}
            {photoIndex >= 0 && (
                <>
                    <img
                        src={convertFileSrc(photoSelection[photoIndex])}
                        style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }}
                    />
                    <a
                        className="enlarge-link"
                        onClick={() => setShowBigPhoto(true)}
                    >
                        {t('directoryMenu:share.enlarge', 'Enlarge preview')}
                    </a>
                    {showBigPhoto && (
                        <div
                            className="big-photo-in-selection"
                            onMouseLeave={() => setShowBigPhoto(false)}
                            onClick={() => setShowBigPhoto(false)}
                        >
                            <img src={convertFileSrc(photoSelection[photoIndex])} />
                        </div>
                    )}
                </>
            )}
        </>
    );
}

export default PhotoSelectionSection;
