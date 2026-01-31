import React, { useState, useEffect, useRef } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { logger } from '../../../services/LoggerService.js';
import FaceDetectionService from '../../../services/FaceDetectionService.js';
import { useFaceDetection } from '../../../context/FaceDetectionContext.jsx';
import FaceThumbnail from '../../../components/FaceThumbnail.jsx';
import styles from './PhotoFaces.module.css';

function PhotoFaces({ currentPhotoPath, addFooterMessage }) {
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
                message: `Detected ${detectedFaces.length} face${detectedFaces.length !== 1 ? 's' : ''}`
            });

            logger.info('PhotoFaces', 'detect_faces_complete', 'Face detection complete', {
                photoPath: currentPhotoPath,
                faceCount: detectedFaces.length
            });

            if (addFooterMessage) {
                addFooterMessage('faces', `Detected ${detectedFaces.length} face${detectedFaces.length !== 1 ? 's' : ''} in photo`);
            }
        } catch (error) {
            logger.error('PhotoFaces', 'detect_faces_error', 'Face detection failed', {
                photoPath: currentPhotoPath,
                error: error.toString()
            });

            setStatus({
                type: 'error',
                message: `Detection failed: ${error}`
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
        const confirmed = await confirm('Delete this face detection? This cannot be undone.', { title: 'Delete Face' });
        if (!confirmed) return;

        try {
            await FaceDetectionService.deleteFace(face.id);

            // Remove from local state
            const newFaces = faces.filter(f => f.id !== face.id);
            setFaces(newFaces);
            updateFaces(newFaces);

            logger.info('PhotoFaces', 'face_deleted', 'Face deleted successfully', { faceId: face.id });

            if (addFooterMessage) {
                addFooterMessage('faces', 'Face removed');
            }
        } catch (error) {
            logger.error('PhotoFaces', 'delete_face_error', 'Failed to delete face', {
                faceId: face.id,
                error: error.toString()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', `Failed to delete face: ${error}`);
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
                addFooterMessage('faces', `Named face as "${editingName.trim()}"`);
            }
        } catch (error) {
            logger.error('PhotoFaces', 'save_person_name_error', 'Failed to save person name', {
                faceId: face.id,
                error: error.toString()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', `Failed to save name: ${error}`);
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
                addFooterMessage('faces', `Assigned face to "${personName}"`);
            }
        } catch (error) {
            logger.error('PhotoFaces', 'assign_face_error', 'Failed to assign face', {
                faceId: face.id,
                personId,
                error: error.toString()
            });

            if (addFooterMessage) {
                addFooterMessage('faces', `Failed to assign face: ${error}`);
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
                    <h3>Face Detection</h3>
                </div>
                <div className={styles['photo-faces-loading']}>Loading...</div>
            </div>
        );
    }

    const modelsReady = modelStatus?.is_ready;

    return (
        <div className={styles['photo-faces-container']}>
            <div className={styles['photo-faces-header']}>
                <h3>Face Detection</h3>
                <p className={styles['photo-faces-description']}>
                    Detect and recognize faces in this photo.
                </p>
            </div>

            <div className={styles['photo-faces-content']}>
                {/* Model status warning */}
                {!modelsReady && (
                    <div className={styles['model-warning']}>
                        Face detection models are not downloaded.
                        Go to Preferences → Face Detection to download the required models.
                    </div>
                )}

                {/* Detect button */}
                <div className={styles['photo-faces-actions']}>
                    <button
                        className={`${styles['detect-button']} ${isDetecting ? styles['detecting'] : ''}`}
                        onClick={handleDetectFaces}
                        disabled={!modelsReady || isDetecting}
                    >
                        {isDetecting ? '⏳ Detecting...' : 'Detect Faces'}
                    </button>
                    {/* Use Full Image option */}
                    <label
                        className={styles['use-full-image-option']}
                        title="Use full resolution image for detection. More accurate for small faces but takes longer."
                    >
                        <input
                            type="checkbox"
                            className={styles['use-full-image-checkbox']}
                            checked={useFullImage}
                            onChange={(e) => setUseFullImage(e.target.checked)}
                            disabled={isDetecting}
                        />
                        <span>High Accuracy (Slow)</span>
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
                    <h4>Detected Faces ({faces.length})</h4>

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
                                            photoPath={currentPhotoPath}
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
                                                        placeholder="Enter name or select below..."
                                                    />
                                                    {/* Existing persons list */}
                                                    {isLoadingPersons ? (
                                                        <div className={styles['persons-loading']}>Loading...</div>
                                                    ) : filteredPersons.length > 0 ? (
                                                        <div className={styles['persons-list']}>
                                                            {filteredPersons.map((person) => (
                                                                <button
                                                                    key={person.person_id}
                                                                    type="button"
                                                                    className={styles['person-option-btn']}
                                                                    onClick={() => handleAssignToPerson(face, person.person_id)}
                                                                    title={`Assign to ${person.person_name}`}
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
                                                        {editingName.trim() ? 'Press Enter to create new person' : 'Click a person or type a new name'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span
                                                    className={face.person_name ? styles['face-name-editable'] : styles['face-unknown']}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartEditing(face);
                                                    }}
                                                    title="Click to edit name"
                                                >
                                                    {face.person_name || 'Unknown person'}
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles['face-confidence']}>
                                            Confidence: {Math.round((face.confidence || 0) * 100)}%
                                        </div>
                                    </div>
                                    <button
                                        className={styles['face-delete-btn']}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFace(face, index);
                                        }}
                                        title="Delete this face detection"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className={styles['photo-faces-empty']}>
                            <p>No faces detected yet.</p>
                            <p>Click "Detect Faces" to analyze this photo.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PhotoFaces;
