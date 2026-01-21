import React, { useState, useCallback } from 'react';
import { logger } from '../../services/LoggerService.js';

/**
 * Shared header component for list views (Albums, Tags)
 * Displays item count, icon size selector, reload button, and optional view mode toggle for tags
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
 * @param {Function} [props.onRefresh] - Refresh handler for reloading the list
 */
function ListViewHeader({
    title,
    count,
    itemType,
    iconSize,
    onIconSizeChange,
    viewMode,
    onViewModeChange,
    showViewModeToggle = false,
    onRefresh
}) {
    // Reload button state
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        if (!onRefresh || isRefreshing) return;

        logger.info('ListViewHeader', 'refresh_clicked', 'Reload button clicked', { itemType });
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    }, [onRefresh, isRefreshing, itemType]);

    // Reload button styles (matching StatusBar)
    const reloadButtonStyle = {
        background: 'transparent',
        border: 'none',
        color: 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-lg)',
        cursor: isRefreshing ? 'not-allowed' : 'pointer',
        padding: 'var(--space-1)',
        marginLeft: 'var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        lineHeight: 1,
        verticalAlign: 'middle',
        transition: 'color 0.2s, background-color 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isRefreshing ? 0.6 : 1,
        animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
    };
    return (
        <div className="photo-list-header">
            <div className="photo-page-info">
                <span>{title} ({count} {itemType})</span>
                {onRefresh && (
                    <button
                        style={reloadButtonStyle}
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        title={`Reload ${itemType}`}
                        aria-label={`Reload ${itemType}`}
                    >
                        ↻
                    </button>
                )}
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