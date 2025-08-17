import React from 'react';

/**
 * Shared header component for list views (Albums, Tags)
 * Displays item count and icon size selector
 */
function ListViewHeader({ title, count, itemType, iconSize, onIconSizeChange }) {
    return (
        <div className="photo-list-header">
            <div className="photo-page-info">
                <span>{title} ({count} {itemType})</span>
            </div>
            <div className="photo-operation">
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