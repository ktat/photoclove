/**
 * SharedModals Component
 *
 * Renders modals shared between PhotoOption and DirectoryMenu operations.
 * Extracted from PhotosList.jsx to reduce file size.
 */

import AlbumCreationModal from "../../components/AlbumCreationModal.jsx";
import CollectionSelectorModal from "../../components/CollectionSelectorModal.jsx";
import ContextualDeleteModal from "../../components/ContextualDeleteModal.jsx";
import VideoMergeEditor from "../VideoEditor/VideoMergeEditor.jsx";

/**
 * @param {Object} props
 * @param {Object} props.modalState - Modal state from usePhotoOptionOperations
 * @param {number} props.photoSelectionCount - Number of selected photos
 */
function SharedModals({ modalState, photoSelectionCount }) {
    if (!modalState) return null;

    return (
        <>
            {/* Album Creation Modal */}
            <AlbumCreationModal
                isOpen={modalState.showAlbumCreationModal}
                onClose={() => modalState.setShowAlbumCreationModal(false)}
                onConfirm={modalState.createAlbumFromSelection}
                selectedPhotosCount={photoSelectionCount}
            />

            {/* Album Selector Modal */}
            <CollectionSelectorModal
                isOpen={modalState.showAlbumSelectorModal}
                onClose={() => modalState.setShowAlbumSelectorModal(false)}
                onConfirm={modalState.addPhotosToAlbum}
                selectedPhotosCount={photoSelectionCount}
                collectionType="album"
                selectionMode="single"
            />

            {/* Bulk Tag Selector Modal */}
            <CollectionSelectorModal
                isOpen={modalState.showBulkTagModal}
                onClose={() => modalState.setShowBulkTagModal(false)}
                onConfirm={modalState.addTagsToPhotos}
                selectedPhotosCount={photoSelectionCount}
                collectionType="tag"
                selectionMode="multiple"
                allowCreate={true}
            />

            {/* Video Merge Editor - mounted only while open, and keyed on the
                selection, so the editor always starts from untrimmed clips. */}
            {modalState.showVideoMergeModal && (
                <VideoMergeEditor
                    key={(modalState.selectedVideoPaths || []).join('|')}
                    videoPaths={modalState.selectedVideoPaths || []}
                    onClose={() => modalState.setShowVideoMergeModal(false)}
                    onConfirm={modalState.submitVideoMerge}
                />
            )}

            {/* Contextual Delete Modal */}
            <ContextualDeleteModal
                isOpen={modalState.showDeleteModal}
                operation={modalState.deleteModalConfig?.operation}
                photoCount={modalState.deleteModalConfig?.count}
                onConfirm={modalState.deleteModalConfig?.onConfirm}
                onCancel={() => modalState.setShowDeleteModal(false)}
            />
        </>
    );
}

export default SharedModals;
