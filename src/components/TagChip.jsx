import React from 'react';
import classNames from 'classnames';
import styles from './TagChip.module.css';

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

    return (
        <span
            className={classNames(styles.tagChip, { [styles.tagChipClickable]: onClick })}
            onClick={handleClick}
            title={tag.name}
        >
            <span className={styles.tagChipText}>{tag.name}</span>
            {isRemovable && (
                <button
                    className={styles.tagChipRemove}
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