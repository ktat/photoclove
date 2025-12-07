import React, { useState, useMemo } from 'react';
import { convertFileSrc } from "@tauri-apps/api/core";
import Scrollable from "../../Scrollable.jsx";
import { logger } from "../../services/LoggerService.js";

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
            backgroundColor: '#374151'
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
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '4px',
            border: '1px solid var(--border)'
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
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: '#374151',
                    color: 'var(--text)'
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
                        border: '2px dashed var(--border)',
                        borderRadius: '8px',
                        margin: '10px',
                        padding: '10px',
                        display: 'inline-block',
                        verticalAlign: 'top',
                        backgroundColor: 'var(--bg-elevated)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                >
                    <div className={currentConfig.coverClass} style={{
                        width: `${iconSize}px`,
                        height: `${iconSize}px`,
                        backgroundColor: itemType === 'tag' ? '#374151' : 'var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '10px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px dashed var(--border)'
                    }}>
                        <div style={{
                            fontSize: `${iconSize * 0.15}px`,
                            color: '#999',
                            textAlign: 'center',
                            lineHeight: '1.2'
                        }}>{currentConfig.newItemText}</div>
                    </div>
                    <div className={currentConfig.infoClass} style={{
                        textAlign: 'center',
                        fontSize: '12px'
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
                    <div style={{ margin: '20px', color: '#666' }}>
                        {effectiveSearchTerm ? currentConfig.searchEmptyMessage : currentConfig.emptyMessage}
                    </div>
                ) : (
                    filteredItems.map((item) => (
                        <div
                            key={item.id}
                            className={currentConfig.tileClass}
                            style={{
                                width: `${iconSize + 50}px`,
                                height: `${iconSize + 80}px`,
                                cursor: 'pointer',
                                border: selectedItems.includes(item.id) ? '2px solid var(--accent)' : '1px solid var(--border)',
                                borderRadius: '8px',
                                margin: '10px',
                                padding: '10px',
                                display: 'inline-block',
                                verticalAlign: 'top',
                                backgroundColor: selectedItems.includes(item.id) ? 'var(--accent)' : 'var(--bg-elevated)',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease, background-color 0.2s ease',
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
                                    backgroundColor: currentConfig.backgroundColor || item.color || '#374151',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '10px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--border)'
                                }}>
                                    {currentConfig.showCoverImage && item.coverPhoto ? (
                                        <img
                                            src={convertFileSrc(
                                                item.coverPhoto.has_thumbnail && item.coverPhoto.file?.path
                                                    ? item.coverPhoto.file.path.replace(
                                                        new RegExp('^' + item.coverPhoto.import_to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
                                                        item.coverPhoto.thumbnail_store
                                                      ).replace(/\.(?:jpe?g|JPE?G)$/i, '.jpg')
                                                    : item.coverPhoto.file?.path || ''
                                            )}
                                            alt={item.name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            fontSize: `${iconSize * 0.3}px`,
                                            color: itemType === 'tag' && item.color ? '#fff' : '#999'
                                        }}>{currentConfig.defaultIcon}</div>
                                    )}
                                </div>
                                <div className={currentConfig.infoClass} style={{
                                    textAlign: 'center',
                                    fontSize: '12px'
                                }}>
                                    <div className={currentConfig.nameClass} style={{
                                        fontWeight: 'bold',
                                        marginBottom: '4px',
                                        wordWrap: 'break-word'
                                    }}>
                                        {item.name}
                                    </div>
                                    <div className={currentConfig.countClass} style={{
                                        color: '#666'
                                    }}>
                                        {item.photoCount} {currentConfig.countSuffix}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </Scrollable>
        );
    };

    return (
        <div className={`${itemType}-list-view`}>
            {renderSearchFilter()}
            {renderItemGrid()}
        </div>
    );
}

export default GenericListView;
