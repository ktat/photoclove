import React, { useState, useMemo, useRef, useCallback } from 'react';
import Scrollable from "../../Scrollable.jsx";
import { logger } from "../../services/LoggerService.js";
import { getTagColor } from "../../utils/tagColorUtils.js";

/**
 * Check if a tag is an AI-generated tag
 */
const isAITag = (tagName) => tagName?.startsWith('ai:');

/**
 * Get display name for a tag (removes ai: prefix for cleaner display)
 */
const getTagDisplayName = (tagName) => {
    if (isAITag(tagName)) {
        return tagName.substring(3); // Remove 'ai:' prefix
    }
    return tagName;
};

/**
 * Tag Cloud View Component
 * Displays tags in a word cloud format with size based on photo count
 *
 * @param {Object} props
 * @param {Array} props.items - Array of tag objects with id, name, color, photoCount
 * @param {Array} props.selectedItems - Array of selected tag IDs
 * @param {Function} props.onItemSelection - Handler for tag selection (id, isSelected)
 * @param {Function} props.onItemClick - Handler when tag is clicked
 * @param {string} props.searchTerm - Current search filter term
 * @param {Function} props.onSearchChange - Search term change handler
 * @param {Function} props.onNewItemClick - Handler for creating new tag
 */
function TagCloudView({
    items,
    selectedItems = [],
    onItemSelection,
    onItemClick,
    searchTerm,
    onSearchChange,
    onNewItemClick
}) {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');

    // Long press detection
    const longPressTimeout = useRef(null);
    const isLongPress = useRef(false);
    const LONG_PRESS_DURATION = 200; // milliseconds

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

    // Calculate font size for tag cloud based on photo count
    const calculateTagSize = (photoCount) => {
        const minSize = 14;
        const maxSize = 48;
        const counts = items.map(t => t.photoCount || 0);
        const maxPhotoCount = Math.max(...counts, 1);
        const minPhotoCount = Math.min(...counts, 0);

        if (maxPhotoCount === minPhotoCount) {
            return (minSize + maxSize) / 2;
        }
        const ratio = (photoCount - minPhotoCount) / (maxPhotoCount - minPhotoCount);
        return minSize + ratio * (maxSize - minSize);
    };

    // Calculate tag color using shared utility
    const calculateTagColor = useCallback((tagName, photoCount) => {
        return getTagColor(tagName, photoCount, items);
    }, [items]);


    // Calculate positions for all tags to avoid overlaps
    const calculateTagPositions = useMemo(() => {
        const sortedTags = [...filteredItems].sort((a, b) => (b.photoCount || 0) - (a.photoCount || 0));
        const positions = [];

        // Estimate tag dimensions based on font size and name length
        const estimateTagSize = (tag) => {
            const fontSize = calculateTagSize(tag.photoCount || 0);
            const charWidth = fontSize * 0.6; // Approximate character width
            const width = tag.name.length * charWidth + 40; // Add padding
            const height = fontSize + 20; // Add padding
            return { width, height };
        };

        // Check if two rectangles overlap
        const overlaps = (pos1, size1, pos2, size2) => {
            const margin = 8; // Gap between tags
            return !(pos1.x + size1.width / 2 + margin < pos2.x - size2.width / 2 ||
                     pos1.x - size1.width / 2 - margin > pos2.x + size2.width / 2 ||
                     pos1.y + size1.height / 2 + margin < pos2.y - size2.height / 2 ||
                     pos1.y - size1.height / 2 - margin > pos2.y + size2.height / 2);
        };

        // Place each tag
        sortedTags.forEach((tag, index) => {
            const size = estimateTagSize(tag);
            let placed = false;

            if (index === 0) {
                // Center tag (largest)
                positions.push({ tag, x: 0, y: 0, rotation: 0, size });
                return;
            }

            // Try spiral positions until we find one without overlap
            let spiralIndex = 0;
            while (!placed && spiralIndex < 200) {
                const angle = spiralIndex * 137.5 * (Math.PI / 180); // Golden angle
                const radius = 60 + spiralIndex * 15;

                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                // Check for overlaps with all placed tags
                let hasOverlap = false;
                for (const placedPos of positions) {
                    if (overlaps({ x, y }, size, placedPos, placedPos.size)) {
                        hasOverlap = true;
                        break;
                    }
                }

                if (!hasOverlap) {
                    // Random rotation for visual interest
                    const rotations = [-8, -4, 0, 0, 4, 8];
                    const rotation = rotations[index % rotations.length];
                    positions.push({ tag, x, y, rotation, size });
                    placed = true;
                }

                spiralIndex++;
            }

            // Fallback: place at the last tried position if no space found
            if (!placed) {
                const angle = (index * 2) * 137.5 * (Math.PI / 180);
                const radius = 100 + index * 30;
                positions.push({
                    tag,
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                    rotation: 0,
                    size
                });
            }
        });

        return positions;
    }, [filteredItems, items]);

    // Handle long press start
    const handlePressStart = useCallback((tag) => {
        isLongPress.current = false;
        longPressTimeout.current = setTimeout(() => {
            isLongPress.current = true;
            // Toggle selection on long press
            if (onItemSelection) {
                const isCurrentlySelected = selectedItems.includes(tag.id);
                logger.info('TagCloudView', 'tag_long_press', 'Tag long-pressed for selection', {
                    tagId: tag.id,
                    tagName: tag.name,
                    willSelect: !isCurrentlySelected
                });
                onItemSelection(tag.id, !isCurrentlySelected);
            }
        }, LONG_PRESS_DURATION);
    }, [selectedItems, onItemSelection]);

    // Handle press end (cancel long press if not completed)
    const handlePressEnd = useCallback(() => {
        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = null;
        }
    }, []);

    // Handle tag click (only if not a long press)
    const handleTagClick = useCallback((tag) => {
        // If it was a long press, don't trigger click
        if (isLongPress.current) {
            isLongPress.current = false;
            return;
        }

        logger.info('TagCloudView', 'tag_click', 'Tag clicked in cloud view', {
            tagId: tag.id,
            tagName: tag.name
        });
        onItemClick(tag);
    }, [onItemClick]);

    return (
        <div className="tag-cloud-view">
            {/* Search filter */}
            <div style={{
                marginBottom: 'var(--space-3)',
                padding: '10px',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '4px',
                border: '1px solid var(--color-border-default)'
            }}>
                <input
                    type="text"
                    placeholder="Search tags..."
                    value={effectiveSearchTerm}
                    onChange={(e) => effectiveOnSearchChange(e.target.value)}
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

            {/* New Tag Button */}
            <div style={{ marginBottom: 'var(--space-4)', textAlign: 'left' }}>
                <button
                    onClick={() => onNewItemClick()}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--color-bg-surface)',
                        color: 'var(--color-text-primary)',
                        cursor: 'pointer',
                        border: '1px solid var(--color-border-default)',
                        fontSize: 'var(--font-size-base)',
                        transition: 'all 0.2s ease-out',
                        whiteSpace: 'nowrap'
                    }}
                    title="Create new tag"
                >
                    + New Tag
                </button>
            </div>

            {/* Tag Cloud */}
            <Scrollable className="tag-cloud-container">
                <div style={{
                    position: 'relative',
                    minHeight: '500px',
                    width: '100%'
                }}>
                    {filteredItems.length === 0 ? (
                        <div style={{
                            color: 'var(--color-text-muted)',
                            fontStyle: 'italic',
                            padding: 'var(--space-4)',
                            textAlign: 'center'
                        }}>
                            {effectiveSearchTerm
                                ? 'No tags found matching your search.'
                                : 'No tags found! Create your first tag.'}
                        </div>
                    ) : (
                        <div style={{
                            position: 'relative',
                            width: '100%',
                            height: '500px',
                            overflow: 'hidden'
                        }}>
                            {calculateTagPositions.map((pos, index) => {
                                const { tag, x, y, rotation } = pos;
                                const fontSize = calculateTagSize(tag.photoCount || 0);
                                const tagColor = calculateTagColor(tag.name, tag.photoCount || 0);
                                const isSelected = selectedItems.includes(tag.id);

                                return (
                                    <span
                                        key={tag.id}
                                        onClick={() => handleTagClick(tag)}
                                        onMouseDown={() => handlePressStart(tag)}
                                        onMouseUp={handlePressEnd}
                                        onMouseLeave={(e) => {
                                            handlePressEnd();
                                            e.currentTarget.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg) scale(1)`;
                                            e.currentTarget.style.zIndex = index === 0 ? '10' : String(5 - Math.floor(index / 3));
                                        }}
                                        onTouchStart={() => handlePressStart(tag)}
                                        onTouchEnd={handlePressEnd}
                                        style={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: '50%',
                                            transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
                                            cursor: 'pointer',
                                            fontSize: `${fontSize}px`,
                                            fontWeight: tagColor.fontWeight,
                                            color: isSelected ? 'var(--color-primary)' : tagColor.color,
                                            transition: 'all 0.2s ease-out',
                                            whiteSpace: 'nowrap',
                                            zIndex: index === 0 ? 10 : 5 - Math.floor(index / 3),
                                            textDecoration: isSelected ? 'underline' : 'none'
                                        }}
                                        title={`${isAITag(tag.name) ? '🤖 AI: ' : ''}${getTagDisplayName(tag.name)} (${tag.photoCount || 0} photos) - Click to view, long press to select`}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg) scale(1.15)`;
                                            e.currentTarget.style.zIndex = '20';
                                        }}
                                    >
                                        {/* Selection indicator */}
                                        {isSelected && (
                                            <span style={{ marginRight: '4px' }}>✓</span>
                                        )}
                                        {/* AI tag indicator */}
                                        {isAITag(tag.name) && (
                                            <span style={{ marginRight: '4px', fontSize: '0.8em' }}>🤖</span>
                                        )}
                                        {getTagDisplayName(tag.name)}
                                        <span style={{
                                            fontSize: '0.6em',
                                            opacity: 0.7,
                                            marginLeft: '4px'
                                        }}>
                                            {tag.photoCount || 0}
                                        </span>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Scrollable>
        </div>
    );
}

export default TagCloudView;
