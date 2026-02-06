import { useCallback } from "react";
import { logger } from "../services/LoggerService.js";
import { getAllPersonsForList, getUnknownFacesCount } from "../services/FaceDetectionService.js";

/**
 * Hook for managing face-related operations in PhotosList
 */
export function usePhotoListFaces({
    setFacesList,
    setUnknownFacesCount,
    setCurrentPersonId,
    setCurrentPersonName,
    openPerson,
    loadPersonPhotos,
    openUnknownFaces,
    loadUnknownFacesPhotos
}) {
    // Reload faces list
    const reloadFaces = useCallback(async () => {
        try {
            logger.info('PhotosList', 'reload_faces_start', 'Loading faces list');
            const [persons, unknownCount] = await Promise.all([
                getAllPersonsForList(),
                getUnknownFacesCount()
            ]);
            setFacesList(persons);
            setUnknownFacesCount(unknownCount);
            logger.info('PhotosList', 'reload_faces_complete', 'Faces loaded', {
                personsCount: persons.length,
                unknownCount
            });
        } catch (error) {
            logger.error('PhotosList', 'reload_faces_error', 'Failed to load faces', { error: error.toString() });
        }
    }, [setFacesList, setUnknownFacesCount]);

    // Handle person click
    const handlePersonClick = useCallback((person) => {
        logger.info('PhotosList', 'person_click', 'User clicked on person', {
            personId: person.person_id,
            personName: person.person_name
        });
        setCurrentPersonId(person.person_id);
        setCurrentPersonName(person.person_name || 'Unknown');
        openPerson(person.person_id);
        loadPersonPhotos(person.person_id);
    }, [openPerson, setCurrentPersonId, setCurrentPersonName, loadPersonPhotos]);

    // Handle unknown face click
    const handleUnknownFaceClick = useCallback((face) => {
        logger.info('PhotosList', 'unknown_face_click', 'User clicked on unknown face to view photos', {
            faceId: face?.id,
            photoPath: face?.photo_path
        });
        openUnknownFaces();
        loadUnknownFacesPhotos();
    }, [openUnknownFaces, loadUnknownFacesPhotos]);

    return {
        reloadFaces,
        handlePersonClick,
        handleUnknownFaceClick
    };
}
