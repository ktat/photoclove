import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../../services/LoggerService.js';
import { useDialog } from '../../../context/DialogContext.jsx';
import FaceDetectionService from '../../../services/FaceDetectionService.js';
import { useFaceDetection } from '../../../context/FaceDetectionContext.jsx';
import FaceThumbnail from '../../../components/FaceThumbnail.jsx';
import styles from './PhotoFaces.module.css';

function PhotoFaces({ currentPhoto, addFooterMessage }) {
    const { t } = useTranslation('common');
    const currentPhotoPath = currentPhoto?.originalPath;
    const currentDisplayPath = currentPhoto?.displayPath();
    const isRaw = currentPhoto?.isRawFormat?.() ?? false;
    const dialog = useDialog();
    const [faces, setFaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDetecting, setIsDetecting] = useState(false);
    const [modelStatus, setModelStatus] = useState(null);
    const [status, setStatus] = useState(null);
    const [editingFaceId, setEditingFaceId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [existingPersons, setExistingPersons] = useState([]);
    const [isLoadingPersons, setIsLoadingPersons] = useState(false);
    const [useFullImage, setUseFullImage] = useState(false);
    const inputRef = useRef(null);

    // Get face detection context for sharing state with PhotoDisplay
    const { updateFaces, setHoveredFaceId, hoveredFaceId } = useFaceDetection();

    // Reset useFullImage when switching to a RAW file
    useEffect(() => {
        if (isRaw) {
            setUseFullImage(false);
        }
    }, [isRaw]);

    // Load model status and existing faces on mount
    useEffect(() => {
        const init = async () => {
            try {
                const [modelStat, existingFaces] = await Promise.all([
                    FaceDetectionService.getModelStatus(),
                    currentPhotoPath ? FaceDetectionService.getDetectedFaces(currentPhotoPath) : []
                ]);
                setModelStatus(modelStat);
                setFaces(existingFaces || []);
                // Update context for PhotoDisplay to show bounding boxes
                updateFaces(existingFaces || []);
            } catch (error) {
                logger.error('PhotoFaces', 'init_error', 'Failed to initialize', { error: error.toString() });
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, [currentPhotoPath, updateFaces]);

    const handleDetectFaces = async () => {
        if (!currentPhotoPath || !modelStatus?.is_ready) return;

        setIsDetecting(true);
        setStatus(null);

        // Wait for UI to update before starting heavy processing
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            logger.info('PhotoFaces', 'detect_faces_start', 'Starting face detection', { photoPath: currentPhotoPath });

            const detectedFaces = await FaceDetectionService.detectFaces(currentPhotoPath, true, useFullImage);
            setFaces(detectedFaces);
            // Update context for PhotoDisplay to show bounding boxes
            updateFaces(detectedFaces);

            setStatus({
                type: 'success',
                message: t('photoFaces.detectedCount', { count: detectedFaces.length })
            });

            logger.info('PhotoFaces', 'detect_faces_complete', 'Face detection complete', {
                photoPath: currentPhotoPath,
                faceCount: detectedFaces.length
            });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.detectedInPhoto', { count: detectedFaces.length }));
            }
        } catch (error) {
            logger.error('PhotoFaces', 'detect_faces_error', 'Face detection failed', {
                photoPath: currentPhotoPath,
                error: error.toString()
            });

            setStatus({
                type: 'error',
                message: t('photoFaces.detectionFailed', { error: error.toString() })
            });
        } finally {
            setIsDetecting(false);
        }
    };

    const handleDeleteFace = async (face, index) => {
        if (!face.id) {
            logger.warn('PhotoFaces', 'delete_face_no_id', 'Cannot delete face without ID', { index });
            return;
        }

        // Ask for confirmation
        const confirmed = await dialog.confirm({
            title: t('photoFaces.deleteFaceTitle'),
            message: t('photoFaces.deleteFaceMessage'),
            kind: 'warning',
        });
        if (!confirmed) return;

        try {
            await FaceDetectionService.deleteFace(face.id);

            // Remove from local state
            const newFaces = faces.filter(f => f.id !== face.id);
            setFaces(newFaces);
            updateFaces(newFaces);

            logger.info('PhotoFaces', 'face_deleted', 'Face deleted successfully', { faceId: face.id });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.faceRemoved'));
            }
        } catch (error) {
            logger.error('PhotoFaces', 'delete_face_error', 'Failed to delete face', {
                faceId: face.id,
                error: error.toString()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.deleteFaceFailed', { error: error.toString() }));
            }
        }
    };

    const handleStartEditing = async (face) => {
        if (!face.id) return;
        setEditingFaceId(face.id);
        setEditingName(face.person_name || '');
        setIsLoadingPersons(true);

        try {
            // Load existing persons with similarity to this face
            const persons = await FaceDetectionService.getPersonsWithFaces(face.id);
            setExistingPersons(persons);
        } catch (error) {
            logger.error('PhotoFaces', 'load_persons_error', 'Failed to load persons', {
                faceId: face.id,
                error: error.toString()
            });
            setExistingPersons([]);
        } finally {
            setIsLoadingPersons(false);
        }

        // Focus the input after state update
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleSavePersonName = async (face) => {
        if (!face.id) {
            setEditingFaceId(null);
            return;
        }

        // Create new person with entered name
        if (!editingName.trim()) {
            setEditingFaceId(null);
            return;
        }

        try {
            await FaceDetectionService.setFacePersonName(face.id, editingName.trim());

            // Update local state
            const updatedFaces = faces.map(f =>
                f.id === face.id ? { ...f, person_name: editingName.trim() } : f
            );
            setFaces(updatedFaces);
            updateFaces(updatedFaces);

            logger.info('PhotoFaces', 'person_name_saved', 'Person name saved', {
                faceId: face.id,
                name: editingName.trim()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.namedFace', { name: editingName.trim() }));
            }
        } catch (error) {
            logger.error('PhotoFaces', 'save_person_name_error', 'Failed to save person name', {
                faceId: face.id,
                error: error.toString()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.saveNameFailed', { error: error.toString() }));
            }
        } finally {
            setEditingFaceId(null);
            setExistingPersons([]);
        }
    };

    const handleAssignToPerson = async (face, personId) => {
        if (!face.id || !personId) return;

        const person = existingPersons.find(p => p.person_id === personId);
        const personName = person?.person_name || 'Unknown';

        try {
            await FaceDetectionService.assignFaceToPerson(face.id, personId);

            // Update local state with the person name
            const updatedFaces = faces.map(f =>
                f.id === face.id ? { ...f, person_id: personId, person_name: personName } : f
            );
            setFaces(updatedFaces);
            updateFaces(updatedFaces);

            logger.info('PhotoFaces', 'face_assigned', 'Face assigned to person', {
                faceId: face.id,
                personId,
                personName
            });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.assignedFace', { name: personName }));
            }
        } catch (error) {
            logger.error('PhotoFaces', 'assign_face_error', 'Failed to assign face', {
                faceId: face.id,
                personId,
                error: error.toString()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', t('photoFaces.assignFaceFailed', { error: error.toString() }));
            }
        } finally {
            setEditingFaceId(null);
            setExistingPersons([]);
        }
    };

    const handleKeyDown = (e, face) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSavePersonName(face);
        } else if (e.key === 'Escape') {
            setEditingFaceId(null);
            setExistingPersons([]);
        }
    };

    // Filter persons by input text
    const filteredPersons = existingPersons.filter(p =>
        !editingName.trim() ||
        (p.person_name && p.person_name.toLowerCase().includes(editingName.toLowerCase()))
    );

    if (isLoading) {
        return (
            <div className={styles['photo-faces-container']}>
                <div className={styles['photo-faces-header']}>
                    <h3>{t('photoFaces.title')}</h3>
                </div>
                <div className={styles['photo-faces-loading']}>{t('photoFaces.loading')}</div>
            </div>
        );
    }

    const modelsReady = modelStatus?.is_ready;

    return (
        <div className={styles['photo-faces-container']}>
            <div className={styles['photo-faces-header']}>
                <h3>{t('photoFaces.title')}</h3>
                <p className={styles['photo-faces-description']}>
                    {t('photoFaces.description')}
                </p>
            </div>

            <div className={styles['photo-faces-content']}>
                {/* Model status warning */}
                {!modelsReady && (
                    <div className={styles['model-warning']}>
                        {t('photoFaces.modelWarning')}
                    </div>
                )}

                {/* Detect button */}
                <div className={styles['photo-faces-actions']}>
                    <button
                        className={`${styles['detect-button']} ${isDetecting ? styles['detecting'] : ''}`}
                        onClick={handleDetectFaces}
                        disabled={!modelsReady || isDetecting}
                    >
                        {isDetecting ? `⏳ ${t('photoFaces.detecting')}` : t('photoFaces.detectFaces')}
                    </button>
                    {/* Use Full Image option */}
                    <label
                        className={styles['use-full-image-option']}
                        title={isRaw ? t('aiTagging.highAccuracyRawDisabled') : t('aiTagging.highAccuracyTooltip')}
                    >
                        <input
                            type="checkbox"
                            className={styles['use-full-image-checkbox']}
                            checked={useFullImage}
                            onChange={(e) => setUseFullImage(e.target.checked)}
                            disabled={isDetecting || isRaw}
                        />
                        <span>{t('aiTagging.highAccuracy')}</span>
                    </label>
                </div>

                {/* Status message */}
                {status && (
                    <div className={`${styles['photo-faces-status']} ${styles[status.type]}`}>
                        {status.message}
                    </div>
                )}

                {/* Faces list */}
                <div className={styles['photo-faces-section']}>
                    <h4>{t('photoFaces.detectedFaces', { count: faces.length })}</h4>

                    {faces.length > 0 ? (
                        <div className={styles['faces-list']}>
                            {faces.map((face, index) => (
                                <div
                                    key={face.id || index}
                                    className={`${styles['face-item']} ${hoveredFaceId === (face.id || index) ? styles['face-item-hovered'] : ''}`}
                                    onMouseEnter={() => setHoveredFaceId(face.id || index)}
                                    onMouseLeave={() => setHoveredFaceId(null)}
                                >
                                    <div className={styles['face-preview']}>
                                        <FaceThumbnail
                                            faceId={face.id}
                                            photoPath={currentDisplayPath}
                                            bbox={face}
                                            size={50}
                                        />
                                        {/* Fallback icon if thumbnail fails to load */}
                                        <div className={styles['face-preview-fallback']}>
                                            👤
                                        </div>
                                    </div>
                                    <div className={styles['face-info']}>
                                        <div className={styles['face-person']}>
                                            {editingFaceId === face.id ? (
                                                <div className={styles['face-editing-container']}>
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        className={styles['face-name-input']}
                                                        value={editingName}
                                                        onChange={(e) => setEditingName(e.target.value)}
                                                        onKeyDown={(e) => handleKeyDown(e, face)}
                                                        placeholder={t('photoFaces.enterName')}
                                                    />
                                                    {/* Existing persons list */}
                                                    {isLoadingPersons ? (
                                                        <div className={styles['persons-loading']}>{t('photoFaces.loading')}</div>
                                                    ) : filteredPersons.length > 0 ? (
                                                        <div className={styles['persons-list']}>
                                                            {filteredPersons.map((person) => (
                                                                <button
                                                                    key={person.person_id}
                                                                    type="button"
                                                                    className={styles['person-option-btn']}
                                                                    onClick={() => handleAssignToPerson(face, person.person_id)}
                                                                    title={t('photoFaces.assignTo', { name: person.person_name })}
                                                                >
                                                                    <FaceThumbnail
                                                                        faceId={person.representative_face_id}
                                                                        photoPath={person.photo_path}
                                                                        bbox={person}
                                                                        size={32}
                                                                    />
                                                                    <span className={styles['person-name']}>
                                                                        {person.person_name}
                                                                    </span>
                                                                    {person.similarity > 0 && (
                                                                        <span className={styles['person-similarity']}>
                                                                            {Math.round(person.similarity * 100)}%
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                    <div className={styles['face-editing-hint']}>
                                                        {editingName.trim() ? t('photoFaces.pressEnterHint') : t('photoFaces.clickOrTypeHint')}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span
                                                    className={face.person_name ? styles['face-name-editable'] : styles['face-unknown']}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEditing(face);
                                                    }}
                                                    title={t('photoFaces.clickToEdit')}
                                                >
                                                    {face.person_name || t('photoFaces.unknownPerson')}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles['face-confidence']}>
                                            {t('photoFaces.confidence', { value: Math.round((face.confidence || 0) * 100) })}
                                        </div>
                                    </div>
                                    <button
                                        className={styles['face-delete-btn']}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFace(face, index);
                                        }}
                                        title={t('photoFaces.deleteFaceTooltip')}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles['photo-faces-empty']}>
                            <p>{t('photoFaces.noFaces')}</p>
                            <p>{t('photoFaces.noFacesHint')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PhotoFaces;
