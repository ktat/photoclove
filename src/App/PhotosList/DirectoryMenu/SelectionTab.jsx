import React from "react";
import { useTranslation } from 'react-i18next';
import PhotoSelectionSection from "./PhotoSelectionSection.jsx";
import AlbumSelectionSection from "./AlbumSelectionSection.jsx";
import TagSelectionSection from "./TagSelectionSection.jsx";
import PersonSelectionSection from "./PersonSelectionSection.jsx";
import UnknownFaceSelectionSection from "./UnknownFaceSelectionSection.jsx";

/**
 * SelectionTab Component
 *
 * Handles photo, album, tag, and person selection operations
 * Delegates to specialized section components for each selection type
 */
function SelectionTab({
    viewModeObj,
    selectionState,
    handlers,
    importState,
    appConfig,
    albumsList,
    tagsList,
    facesList = [],
    faceViewType = 'persons',
    dropdownRef,
    tabClass
}) {
    const { t } = useTranslation(['directoryMenu']);

    const {
        photoSelection,
        selectedAlbums,
        selectedTags,
        persons: selectedPersons = [],
        unknownFaces: selectedUnknownFaces = []
    } = selectionState;

    return (
        <div id="tab-selection" className={tabClass['selection'] ? "tab-active" : "tab"}>
            {/* Photo Selection */}
            {viewModeObj?.shouldShowPhotoSelection() && (
                <PhotoSelectionSection
                    photoSelection={photoSelection}
                    viewModeObj={viewModeObj}
                    handlers={handlers}
                    importState={importState}
                    appConfig={appConfig}
                    dropdownRef={dropdownRef}
                />
            )}

            {/* Album Selection */}
            {viewModeObj?.shouldShowAlbumSelection() && (
                <AlbumSelectionSection
                    selectedAlbums={selectedAlbums}
                    albumsList={albumsList}
                    handlers={handlers}
                />
            )}

            {/* Tag Selection */}
            {viewModeObj?.shouldShowTagSelection() && (
                <TagSelectionSection
                    selectedTags={selectedTags}
                    tagsList={tagsList}
                    handlers={handlers}
                />
            )}

            {/* Person Selection (Persons tab) */}
            {viewModeObj?.shouldShowPersonSelection() && faceViewType === 'persons' && (
                <PersonSelectionSection
                    selectedPersons={selectedPersons}
                    facesList={facesList}
                    handlers={handlers}
                />
            )}

            {/* Unknown Faces Selection (Unknown tab) */}
            {viewModeObj?.shouldShowPersonSelection() && faceViewType === 'unknown' && (
                <UnknownFaceSelectionSection
                    selectedUnknownFaces={selectedUnknownFaces}
                    facesList={facesList}
                    handlers={handlers}
                />
            )}
        </div>
    );
}

export default SelectionTab;
