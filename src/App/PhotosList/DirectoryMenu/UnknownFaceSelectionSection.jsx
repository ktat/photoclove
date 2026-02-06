import React, { useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useTranslation } from 'react-i18next';
import FaceThumbnail from "../../../components/FaceThumbnail.jsx";
import SelectionHeader from "./SelectionHeader.jsx";

/**
 * UnknownFaceSelectionSection - Unknown faces selection UI
 */
function UnknownFaceSelectionSection({ selectedUnknownFaces, facesList, handlers }) {
    const { t } = useTranslation(['directoryMenu']);
    const [showPersonSelector, setShowPersonSelector] = useState(false);
    const [newPersonName, setNewPersonName] = useState('');
    const [showNewPersonInput, setShowNewPersonInput] = useState(false);

    const {
        clearUnknownFaceSelection = () => {},
        deleteUnknownFacesBatch = () => {},
        assignUnknownFacesToPerson = () => {}
    } = handlers;

    const handleUnknownFacesOperation = async (e) => {
        const operation = e.target.value;
        e.target.value = 'select';

        if (operation === 'delete') {
            const confirmed = await confirm(
                t('directoryMenu:face.confirmDelete', { count: selectedUnknownFaces.length }),
                { title: t('directoryMenu:face.delete') }
            );
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

    const handleCreateAndAssign = () => {
        if (newPersonName.trim()) {
            assignUnknownFacesToPerson(selectedUnknownFaces, null, newPersonName.trim());
            setNewPersonName('');
            setShowNewPersonInput(false);
        }
    };

    const handleAssignToExistingPerson = (personId) => {
        assignUnknownFacesToPerson(selectedUnknownFaces, personId, null);
        setShowPersonSelector(false);
    };

    return (
        <div>
            <SelectionHeader
                count={selectedUnknownFaces.length}
                labelKey="directoryMenu:face.facesSelected"
                onClear={clearUnknownFaceSelection}
            />
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
                            <div style={{ marginBottom: 'var(--space-2)', fontWeight: 'bold' }}>
                                {t('directoryMenu:face.createNewPerson')}
                            </div>
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
                            <div style={{
                                marginBottom: 'var(--space-2)',
                                fontWeight: 'bold',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
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
                </div>
            )}
        </div>
    );
}

export default UnknownFaceSelectionSection;
