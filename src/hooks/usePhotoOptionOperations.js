/**
 * usePhotoOptionOperations Hook
 *
 * Provides shared operation functions for PhotoOption and DirectoryMenu components.
 * These operations and modal state are lifted to PhotosList.jsx to avoid duplication.
 */

import { useState, useMemo } from "react";
import { useGooglePhotosUpload, useTrashOperations as useSelectionTrashOperations, useStartupImageOperations } from "../App/PhotosList/DirectoryMenu/photoOperations.js";
import { useAlbumOperations, useTagOperations } from "../App/PhotosList/DirectoryMenu/collectionOperations.js";
import { useGroupOperations } from "../App/PhotosList/DirectoryMenu/groupOperations.js";

/**
 * Hook to manage photo operations for PhotoOption
 * @param {Object} params - Hook parameters
 * @returns {Object} Operations and modal state
 */
export function usePhotoOptionOperations({
    photoSelection,
    clearPhotoSelection,
    addFooterMessage,
    handleTauriError,
    deletePhotos,
    restorePhotos,
    updatePhotosAfterTrashOperation,
    reloadCurrentModeData,
    refreshPhotosOnly,
    viewModeObj,
    removePhotoFromList,
    appConfig,
    saveConfigWithStartupImages,
    setShowJobQueueModal,
    dialog
}) {
    // Delete confirmation modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteModalConfig, setDeleteModalConfig] = useState({
        operation: null,
        count: 0,
        onConfirm: null
    });

    // Google Photos upload
    const { uploadToGooglePhotos } = useGooglePhotosUpload({
        photoSelection, clearPhotoSelection, addFooterMessage, setShowJobQueue: setShowJobQueueModal, dialog
    });

    // Trash operations
    const { deleteFiles, restoreSelectedFromTrash, permanentDeleteSelected } = useSelectionTrashOperations({
        photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError,
        deletePhotos, restorePhotos, updatePhotosAfterTrashOperation, reloadCurrentModeData,
        setDeleteModalConfig, setShowDeleteModal
    });

    // Album operations
    const {
        showAlbumCreationModal,
        setShowAlbumCreationModal,
        showAlbumSelectorModal,
        setShowAlbumSelectorModal,
        showCreateAlbumModal,
        showAddToAlbumModal,
        createAlbumFromSelection,
        addPhotosToAlbum,
        removeFromCurrentAlbum
    } = useAlbumOperations({
        photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError,
        viewModeObj, removePhotoFromList, dialog
    });

    // Tag operations
    const {
        showBulkTagModal,
        setShowBulkTagModal,
        showAddTagsModal,
        addTagsToPhotos,
        removeFromCurrentTag
    } = useTagOperations({
        photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError,
        onPhotosRefresh: refreshPhotosOnly, viewModeObj, removePhotoFromList, dialog
    });

    // Startup image operations
    const { addToStartupImages } = useStartupImageOperations({
        photoSelection, clearPhotoSelection, addFooterMessage,
        config: appConfig, saveConfigWithStartupImages
    });

    // Burst group operations
    const { createBurstGroup, removeFromBurstGroup } = useGroupOperations({
        photoSelection, clearPhotoSelection, addFooterMessage, handleTauriError,
        reloadPhotos: refreshPhotosOnly, dialog
    });

    // Operations object for PhotoOption and DirectoryMenu
    const operations = useMemo(() => ({
        deleteFiles,
        showCreateAlbumModal,
        showAddToAlbumModal,
        showAddTagsModal,
        uploadToGooglePhotos,
        addToStartupImages,
        createBurstGroup,
        removeFromBurstGroup,
        // DirectoryMenu-specific operations
        restoreSelectedFromTrash,
        permanentDeleteSelected,
        removeFromCurrentAlbum,
        removeFromCurrentTag
    }), [deleteFiles, showCreateAlbumModal, showAddToAlbumModal, showAddTagsModal,
        uploadToGooglePhotos, addToStartupImages, createBurstGroup, removeFromBurstGroup,
        restoreSelectedFromTrash, permanentDeleteSelected, removeFromCurrentAlbum, removeFromCurrentTag]);

    // Modal state for parent component
    const modalState = {
        showDeleteModal,
        setShowDeleteModal,
        deleteModalConfig,
        showAlbumCreationModal,
        setShowAlbumCreationModal,
        showAlbumSelectorModal,
        setShowAlbumSelectorModal,
        showBulkTagModal,
        setShowBulkTagModal,
        createAlbumFromSelection,
        addPhotosToAlbum,
        addTagsToPhotos
    };

    return {
        operations,
        modalState
    };
}

export default usePhotoOptionOperations;
