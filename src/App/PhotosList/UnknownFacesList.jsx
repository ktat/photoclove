import React, { useState, useEffect, useCallback, useRef } from 'react';
import Scrollable from "../../Scrollable.jsx";
import FaceThumbnail from "../../components/FaceThumbnail.jsx";
import { getUnknownFaces, assignFaceToPerson } from "../../services/FaceDetectionService.js";
import { logger } from "../../services/LoggerService.js";

const PAGE_SIZE = 50;

/**
 * UnknownFacesList component - Displays unknown (unassigned) faces with infinite scroll
 * Sorted by detection time (newest first)
 */
function UnknownFacesList({
    iconSize,
    onFaceClick,
    onAssignFace,
    persons = [],
    selectedFaces = [],
    onFaceSelection
}) {
    const [faces, setFaces] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState(null);
    const [assignDropdownFaceId, setAssignDropdownFaceId] = useState(null);
    const observerRef = useRef(null);
    const loadingRef = useRef(false);

    // Load initial faces
    useEffect(() => {
        loadFaces(0, true);
    }, []);

    const loadFaces = useCallback(async (offset, reset = false) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const newFaces = await getUnknownFaces(PAGE_SIZE, offset);

            if (reset) {
                setFaces(newFaces);
            } else {
                setFaces(prev => [...prev, ...newFaces]);
            }

            setHasMore(newFaces.length === PAGE_SIZE);
            logger.debug('UnknownFacesList', 'faces_loaded', 'Loaded unknown faces', {
                offset,
                count: newFaces.length,
                hasMore: newFaces.length === PAGE_SIZE
            });
        } catch (err) {
            logger.error('UnknownFacesList', 'load_faces_failed', 'Failed to load faces', {
                error: err.toString()
            });
            setError(err.message || 'Failed to load faces');
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, []);

    // Infinite scroll observer
    const lastFaceRef = useCallback(node => {
        if (loading) return;
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
                loadFaces(faces.length);
            }
        });

        if (node) observerRef.current.observe(node);
    }, [loading, hasMore, faces.length, loadFaces]);

    const handleFaceSelection = useCallback((faceId, checked) => {
        if (onFaceSelection) {
            onFaceSelection(faceId, checked);
        }
    }, [onFaceSelection]);

    const handleAssignToPerson = useCallback(async (faceId, personId) => {
        try {
            await assignFaceToPerson(faceId, personId);
            // Remove the assigned face from the list
            setFaces(prev => prev.filter(f => f.id !== faceId));
            // Also remove from selection via parent handler
            if (onFaceSelection) {
                onFaceSelection(faceId, false);
            }
            setAssignDropdownFaceId(null);

            if (onAssignFace) {
                onAssignFace(faceId, personId);
            }

            logger.info('UnknownFacesList', 'face_assigned', 'Face assigned to person', {
                faceId,
                personId
            });
        } catch (err) {
            logger.error('UnknownFacesList', 'assign_failed', 'Failed to assign face', {
                faceId,
                personId,
                error: err.toString()
            });
        }
    }, [onAssignFace, onFaceSelection]);

    const renderAssignDropdown = (faceId) => {
        const namedPersons = persons.filter(p => p.person_name);

        return (
            <div
                style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    zIndex: 100,
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {namedPersons.length === 0 ? (
                    <div style={{
                        padding: 'var(--space-3)',
                        color: 'var(--color-text-muted)',
                        fontSize: 'var(--font-size-sm)',
                        textAlign: 'center'
                    }}>
                        No named persons yet
                    </div>
                ) : (
                    namedPersons.map(person => (
                        <div
                            key={person.person_id}
                            onClick={() => handleAssignToPerson(faceId, person.person_id)}
                            style={{
                                padding: 'var(--space-2) var(--space-3)',
                                cursor: 'pointer',
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--color-text-primary)',
                                borderBottom: '1px solid var(--color-border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--color-bg-muted)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                            {person.photo_path && (
                                <FaceThumbnail
                                    faceId={person.representative_face_id}
                                    photoPath={person.photo_path}
                                    bbox={{
                                        bbox_x: person.bbox_x,
                                        bbox_y: person.bbox_y,
                                        bbox_width: person.bbox_width,
                                        bbox_height: person.bbox_height
                                    }}
                                    size={24}
                                    borderRadius="50%"
                                />
                            )}
                            {person.person_name}
                        </div>
                    ))
                )}
            </div>
        );
    };

    if (error) {
        return (
            <div style={{
                padding: 'var(--space-4)',
                color: 'var(--color-danger)',
                textAlign: 'center'
            }}>
                Error: {error}
            </div>
        );
    }

    return (
        <Scrollable className="unknown-faces-list">
            {faces.length === 0 && !loading ? (
                <div style={{
                    margin: '20px',
                    color: 'var(--color-text-muted)',
                    textAlign: 'center'
                }}>
                    No unknown faces. All faces have been assigned to persons.
                </div>
            ) : (
                <>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        padding: 'var(--space-2)'
                    }}>
                        {faces.map((face, index) => {
                            const isLast = index === faces.length - 1;
                            const isSelected = selectedFaces.includes(face.id);
                            const showDropdown = assignDropdownFaceId === face.id;

                            return (
                                <div
                                    key={face.id}
                                    ref={isLast ? lastFaceRef : null}
                                    style={{
                                        width: `${iconSize + 30}px`,
                                        height: `${iconSize + 80}px`,
                                        cursor: 'pointer',
                                        border: isSelected
                                            ? '2px solid var(--color-primary)'
                                            : '1px solid var(--color-border-default)',
                                        borderRadius: 'var(--radius-md)',
                                        margin: 'var(--space-2)',
                                        padding: 'var(--space-2)',
                                        display: 'inline-block',
                                        verticalAlign: 'top',
                                        backgroundColor: 'var(--color-bg-elevated)',
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                    onClick={() => onFaceClick && onFaceClick(face)}
                                >
                                    {/* Selection Checkbox */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '4px',
                                            zIndex: 1
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            id={`face-checkbox-${face.id}`}
                                            checked={isSelected}
                                            onChange={(e) => {
                                                handleFaceSelection(face.id, e.target.checked);
                                            }}
                                            style={{ display: 'none' }}
                                        />
                                        <label
                                            className="checkbox checkbox-normal"
                                            htmlFor={`face-checkbox-${face.id}`}
                                            style={{
                                                margin: 0,
                                                borderRadius: '3px',
                                                padding: '2px'
                                            }}
                                        />
                                    </div>

                                    {/* Face Thumbnail */}
                                    <div style={{
                                        width: `${iconSize}px`,
                                        height: `${iconSize}px`,
                                        backgroundColor: 'var(--color-bg-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 'var(--space-2)',
                                        borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                        border: '1px solid var(--color-border-default)'
                                    }}>
                                        <FaceThumbnail
                                            faceId={face.id}
                                            photoPath={face.photo_path}
                                            bbox={{
                                                bbox_x: face.bbox_x,
                                                bbox_y: face.bbox_y,
                                                bbox_width: face.bbox_width,
                                                bbox_height: face.bbox_height
                                            }}
                                            size={iconSize}
                                            borderRadius="var(--radius-md)"
                                        />
                                    </div>

                                    {/* Assign Button */}
                                    <div style={{ position: 'relative', width: `${iconSize}px` }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAssignDropdownFaceId(showDropdown ? null : face.id);
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: 'var(--space-1) var(--space-2)',
                                                backgroundColor: 'var(--color-bg-muted)',
                                                border: '1px solid var(--color-border-default)',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--color-text-primary)',
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            Assign
                                        </button>
                                        {showDropdown && renderAssignDropdown(face.id)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {loading && (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-4)',
                            color: 'var(--color-text-muted)'
                        }}>
                            Loading...
                        </div>
                    )}
                </>
            )}
        </Scrollable>
    );
}

export default UnknownFacesList;
