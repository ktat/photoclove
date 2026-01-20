import React from 'react';

/**
 * Shared header component for list views (Albums, Tags)
 * Displays item count, icon size selector, and optional view mode toggle for tags
 *
 * @param {Object} props
 * @param {string} props.title - Header title
 * @param {number} props.count - Item count
 * @param {string} props.itemType - Type of items (albums/tags)
 * @param {number} props.iconSize - Current icon size
 * @param {Function} props.onIconSizeChange - Icon size change handler
 * @param {string} [props.viewMode] - Current view mode for tags (list/cloud)
 * @param {Function} [props.onViewModeChange] - View mode change handler for tags
 * @param {boolean} [props.showViewModeToggle] - Whether to show view mode toggle
 */
function ListViewHeader({
    title,
    count,
    itemType,
    iconSize,
    onIconSizeChange,
    viewMode,
    onViewModeChange,
    showViewModeToggle = false
}) {
    return (
        <div className="photo-list-header">
            <div className="photo-page-info">
                <span>{title} ({count} {itemType})</span>
            </div>
            <div className="photo-operation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                {/* View mode toggle for tags */}
                {showViewModeToggle && (
                    <div style={{
                        display: 'flex',
                        gap: '2px',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => onViewModeChange('list')}
                            title="Grid view"
                            style={{
                                width: '32px',
                                height: '28px',
                                margin: 0,
                                border: 'none',
                                background: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                color: viewMode === 'list' ? 'white' : 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 'var(--font-size-base)',
                                transition: 'all 0.2s ease-out'
                            }}
                        >
                            ☰
                        </button>
                        <button
                            onClick={() => onViewModeChange('cloud')}
                            title="Cloud view"
                            style={{
                                width: '32px',
                                height: '28px',
                                margin: 0,
                                border: 'none',
                                background: viewMode === 'cloud' ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                                color: viewMode === 'cloud' ? 'white' : 'var(--color-text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 'var(--font-size-base)',
                                transition: 'all 0.2s ease-out'
                            }}
                        >
                            ☁
                        </button>
                    </div>
                )}
                Icon:<select name="icon_size" value={iconSize} onChange={(e) => onIconSizeChange(parseInt(e.target.value))}>
                    <option value={50}>small</option>
                    <option value={100}>normal</option>
                    <option value={200}>large</option>
                    <option value={300}>huge</option>
                </select>
            </div>
        </div>
    );
}

export default ListViewHeader;