import React from "react";
import { useTranslation } from 'react-i18next';
import SelectionHeader from "./SelectionHeader.jsx";

/**
 * AlbumSelectionSection - Album selection UI
 */
function AlbumSelectionSection({ selectedAlbums, albumsList, handlers }) {
    const { t } = useTranslation(['directoryMenu']);
    const { deleteSelectedAlbums, clearAlbumSelection } = handlers;

    return (
        <div>
            <SelectionHeader
                count={selectedAlbums.length}
                labelKey="directoryMenu:album.albumsSelected"
                onClear={clearAlbumSelection}
            />
            {selectedAlbums.length === 0 ? (
                <div><br />{t('directoryMenu:album.noAlbumsSelected')}</div>
            ) : (
                <div>
                    <div className="operation" style={{ marginBottom: 'var(--space-4)' }}>
                        <button
                            onClick={deleteSelectedAlbums}
                            style={{
                                width: '100%',
                                padding: 'var(--space-2) var(--space-3)',
                                backgroundColor: 'var(--color-danger)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer'
                            }}
                        >
                            🗑️ {t('directoryMenu:album.deleteSelectedAlbums')}
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
    );
}

export default AlbumSelectionSection;
