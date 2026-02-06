import React from "react";
import { useTranslation } from 'react-i18next';
import SelectionHeader from "./SelectionHeader.jsx";

/**
 * PersonSelectionSection - Person selection UI (named persons)
 */
function PersonSelectionSection({ selectedPersons, facesList, handlers }) {
    const { t } = useTranslation(['directoryMenu']);
    const { deleteSelectedPersons = () => {}, clearPersonSelection = () => {} } = handlers;

    return (
        <div>
            <SelectionHeader
                count={selectedPersons.length}
                labelKey="directoryMenu:person.personsSelected"
                onClear={clearPersonSelection}
            />
            {selectedPersons.length === 0 ? (
                <div><br />{t('directoryMenu:person.noPersonsSelected')}</div>
            ) : (
                <div>
                    <div className="operation" style={{ marginBottom: 'var(--space-4)' }}>
                        <button
                            onClick={deleteSelectedPersons}
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
                            🗑️ {t('directoryMenu:person.deleteSelectedPersons')}
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
    );
}

export default PersonSelectionSection;
