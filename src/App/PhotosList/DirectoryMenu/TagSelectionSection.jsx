import React from "react";
import { useTranslation } from 'react-i18next';
import SelectionHeader from "./SelectionHeader.jsx";

/**
 * TagSelectionSection - Tag selection UI
 */
function TagSelectionSection({ selectedTags, tagsList, handlers }) {
    const { t } = useTranslation(['directoryMenu']);
    const { deleteSelectedTags, clearTagSelection } = handlers;

    return (
        <div>
            <SelectionHeader
                count={selectedTags.length}
                labelKey="directoryMenu:tag.tagsSelected"
                onClear={clearTagSelection}
            />
            {selectedTags.length === 0 ? (
                <div><br />{t('directoryMenu:tag.noTagsSelected')}</div>
            ) : (
                <div>
                    <div className="operation" style={{ marginBottom: 'var(--space-4)' }}>
                        <button
                            onClick={deleteSelectedTags}
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
                            🗑️ {t('directoryMenu:tag.deleteSelectedTags')}
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
    );
}

export default TagSelectionSection;
