import React, { useState, useMemo } from 'react';
import { convertFileSrc } from "@tauri-apps/api/core";
import Scrollable from "../../Scrollable.jsx";
import { logger } from "../../services/LoggerService.js";
import { getTagColor } from "../../utils/tagColorUtils.js";
import { useOverlayMargin } from "../../hooks/useOverlayMargin.js";

/**
 * Unified list view component for albums and tags
 * Supports grid display with search, selection, and creation
 */
function GenericListView({
    items,
    itemType, // 'album' or 'tag'
    iconSize,
    selectedItems,
    onItemSelection,
    onItemClick,
    onNewItemClick,
    searchTerm,
    onSearchChange
}) {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
    const overlayMargin = useOverlayMargin();

    // Use provided search term if available, otherwise use local state
    const effectiveSearchTerm = searchTerm !== undefined ? searchTerm : localSearchTerm;
    const effectiveOnSearchChange = onSearchChange || setLocalSearchTerm;

    // Filter items based on search term
    const filteredItems = useMemo(() => {
        if (!effectiveSearchTerm.trim()) {
            return items;
        }
        return items.filter(item =>
            item.name.toLowerCase().includes(effectiveSearchTerm.toLowerCase())
        );
    }, [items, effectiveSearchTerm]);

    // Configure display based on item type
    const config = useMemo(() => ({
        album: {
            className: 'albums',
            tileClass: 'album-tile',
            newTileClass: 'new-album-tile',
            coverClass: 'album-cover',
            infoClass: 'album-info',
            nameClass: 'album-name',
            countClass: 'album-count',
            searchPlaceholder: 'Search albums...',
            searchInputClass: 'album-list-search-input',
            newItemText: '+ New Album',
            createItemText: 'Create New Album',
            emptyMessage: 'No albums found! Create your first album by clicking "New Album".',
            searchEmptyMessage: 'No albums found matching your search.',
            countSuffix: 'photos',
            defaultIcon: '📚',
            showCoverImage: true,
            backgroundColor: 'var(--color-bg-muted)'
        },
        tag: {
            className: 'tags',
            tileClass: 'tag-tile',
            newTileClass: 'new-tag-tile',
            coverClass: 'tag-cover',
            infoClass: 'tag-info',
            nameClass: 'tag-name',
            countClass: 'tag-count',
            searchPlaceholder: 'Search tags...',
            searchInputClass: 'tag-list-search-input',
            newItemText: '+ New Tag',
            createItemText: 'Create New Tag',
            emptyMessage: 'No tags found! Create your first tag by clicking "New Tag".',
            searchEmptyMessage: 'No tags found matching your search.',
            countSuffix: 'photos',
            defaultIcon: '🏷️',
            showCoverImage: false,
            backgroundColor: null // Uses item.color for tags
        }
    }), []);

    const currentConfig = config[itemType] || config.album;

    const renderSearchFilter = () => (
        <div style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '4px',
            border: '1px solid var(--color-border-default)'
        }}>
            <input
                type="text"
                placeholder={currentConfig.searchPlaceholder}
                value={effectiveSearchTerm}
                onChange={(e) => effectiveOnSearchChange(e.target.value)}
                className={currentConfig.searchInputClass}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-base)',
                    backgroundColor: 'var(--color-bg-muted)',
                    color: 'var(--color-text-primary)'
                }}
            />
        </div>
    );

    const renderItemGrid = () => {
        return (
            <Scrollable className={currentConfig.className}>
                {/* Add New Item Tile */}
                <div
                    key={`new-${itemType}`}
                    className={`${currentConfig.tileClass} ${currentConfig.newTileClass}`}
                    onClick={() => onNewItemClick()}
                    style={{
                        width: `${iconSize + 50}px`,
                        height: `${iconSize + 80}px`,
                        cursor: 'pointer',
                        border: '2px dashed var(--color-border-default)',
                        borderRadius: '8px',
                        margin: '10px',
                        padding: '10px',
                        display: 'inline-block',
                        verticalAlign: 'top',
                        backgroundColor: 'var(--color-bg-elevated)',
                        transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out'
                    }}
                >
                    <div className={currentConfig.coverClass} style={{
                        width: `${iconSize}px`,
                        height: `${iconSize}px`,
                        backgroundColor: itemType === 'tag' ? 'var(--color-bg-muted)' : 'var(--color-bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px dashed var(--color-border-default)'
                    }}>
                        <div style={{
                            fontSize: `${iconSize * 0.15}px`,
                            color: 'var(--color-text-muted)',
                            textAlign: 'center',
                            lineHeight: '1.2'
                        }}>{currentConfig.newItemText}</div>
                    </div>
                    <div className={currentConfig.infoClass} style={{
                        textAlign: 'center',
                        fontSize: 'var(--font-size-sm)'
                    }}>
                        <div className={currentConfig.nameClass} style={{
                            fontWeight: 'bold',
                            marginBottom: '4px',
                            wordWrap: 'break-word'
                        }}>
                            {currentConfig.createItemText}
                        </div>
                    </div>
                </div>

                {/* Existing Items */}
                {filteredItems.length === 0 ? (
                    <div style={{ margin: '20px', color: 'var(--color-text-muted)' }}>
                        {effectiveSearchTerm ? currentConfig.searchEmptyMessage : currentConfig.emptyMessage}
                    </div>
                ) : (
                    filteredItems.map((item) => {
                        // Calculate tag color for tags
                        const tagColorStyle = itemType === 'tag'
                            ? getTagColor(item.name, item.photoCount || 0, items)
                            : null;

                        logger.debug('GenericListView', 'render_item', 'Rendering item', {
                            itemId: item.id,
                            itemName: item.name,
                            itemType,
                            hasCoverPhoto: !!item.coverPhoto,
                            coverPhotoKeys: item.coverPhoto ? Object.keys(item.coverPhoto) : null
                        });
                        return (
                        <div
                            key={item.id}
                            className={currentConfig.tileClass}
                            style={{
                                width: `${iconSize + 50}px`,
                                height: `${iconSize + 80}px`,
                                cursor: 'pointer',
                                border: selectedItems.includes(item.id) ? '2px solid var(--color-primary)' : '1px solid var(--color-border-default)',
                                borderRadius: '8px',
                                margin: '10px',
                                padding: '10px',
                                display: 'inline-block',
                                verticalAlign: 'top',
                                backgroundColor: selectedItems.includes(item.id) ? 'var(--color-primary-selected)' : 'var(--color-bg-elevated)',
                                transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                                position: 'relative'
                            }}
                        >
                            {/* Selection Checkbox */}
                            <div style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                zIndex: 1
                            }}>
                                <input
                                    type="checkbox"
                                    id={`${itemType}-checkbox-${item.id}`}
                                    checked={selectedItems.includes(item.id)}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        onItemSelection(item.id, e.target.checked);
                                    }}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    className="checkbox checkbox-normal"
                                    htmlFor={`${itemType}-checkbox-${item.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        margin: 0,
                                        borderRadius: '3px',
                                        padding: '2px'
                                    }}
                                ></label>
                            </div>

                            {/* Item Content - onClick for navigation */}
                            <div onClick={() => onItemClick(item)} style={{ height: '100%' }}>
                                <div className={currentConfig.coverClass} style={{
                                    width: `${iconSize}px`,
                                    height: `${iconSize}px`,
                                    backgroundColor: currentConfig.backgroundColor || 'var(--color-bg-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '10px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--color-border-default)'
                                }}>
                                    {currentConfig.showCoverImage && item.coverPhoto ? (
                                        (() => {
                                            const imagePath = item.coverPhoto.thumbnail_path || item.coverPhoto.file?.path || '';
                                            logger.debug('GenericListView', 'render_cover_photo', 'Rendering album cover', {
                                                albumName: item.name,
                                                hasThumbnailPath: !!item.coverPhoto.thumbnail_path,
                                                thumbnailPath: item.coverPhoto.thumbnail_path,
                                                hasFilePath: !!item.coverPhoto.file?.path,
                                                filePath: item.coverPhoto.file?.path,
                                                finalPath: imagePath
                                            });
                                            return (
                                                <img
                                                    src={convertFileSrc(imagePath)}
                                                    alt={item.name}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover'
                                                    }}
                                                    onError={(e) => {
                                                        logger.error('GenericListView', 'cover_image_load_error', 'Failed to load cover image', {
                                                            albumName: item.name,
                                                            imagePath,
                                                            src: e.target.src
                                                        });
                                                    }}
                                                />
                                            );
                                        })()
                                    ) : (
                                        <div style={{
                                            fontSize: `${iconSize * 0.3}px`,
                                            color: tagColorStyle ? tagColorStyle.color : 'var(--color-text-muted)',
                                            fontWeight: tagColorStyle ? tagColorStyle.fontWeight : 'normal'
                                        }}>{currentConfig.defaultIcon}</div>
                                    )}
                                </div>
                                <div className={currentConfig.infoClass} style={{
                                    textAlign: 'center',
                                    fontSize: 'var(--font-size-sm)',
                                    overflow: 'hidden'
                                }}>
                                    <div className={currentConfig.nameClass} style={{
                                        fontWeight: tagColorStyle ? tagColorStyle.fontWeight : 'bold',
                                        marginBottom: '2px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        color: tagColorStyle ? tagColorStyle.color : 'inherit'
                                    }} title={item.name}>
                                        {item.name}
                                    </div>
                                    <div className={currentConfig.countClass} style={{
                                        color: 'var(--color-text-muted)',
                                        fontSize: 'var(--font-size-xs)'
                                    }}>
                                        {item.photoCount} {currentConfig.countSuffix}
                                    </div>
                                </div>
                            </div>
                        </div>
                        );
                    })
                )}
            </Scrollable>
        );
    };

    return (
        <div
            className={`${itemType}-list-view`}
            style={{ marginLeft: overlayMargin > 0 ? `${overlayMargin}px` : undefined }}
        >
            {renderSearchFilter()}
            {renderItemGrid()}
        </div>
    );
}

export default GenericListView;
