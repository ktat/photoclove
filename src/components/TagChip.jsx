import React from 'react';
import './TagChip.css';

const TagChip = ({ tag, onRemove, isRemovable = false, onClick }) => {
    const handleClick = (e) => {
        if (onClick) {
            e.stopPropagation();
            onClick(tag);
        }
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        if (onRemove) {
            onRemove(tag.id);
        }
    };

    const chipStyle = tag.color ? { backgroundColor: tag.color } : {};

    return (
        <span 
            className={`tag-chip ${onClick ? 'tag-chip-clickable' : ''}`} 
            style={chipStyle}
            onClick={handleClick}
            title={tag.name}
        >
            <span className="tag-chip-text">{tag.name}</span>
            {isRemovable && (
                <button 
                    className="tag-chip-remove" 
                    onClick={handleRemove}
                    aria-label={`Remove ${tag.name} tag`}
                >
                    ×
                </button>
            )}
        </span>
    );
};

export default TagChip;