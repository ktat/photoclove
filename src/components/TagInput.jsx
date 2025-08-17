import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import { logger } from '../services/LoggerService.js';
import './TagInput.css';

const TagInput = ({ onTagCreated, placeholder = "Create new tag..." }) => {
    const [inputValue, setInputValue] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const [isCreating, setIsCreating] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const inputRef = useRef(null);

    const predefinedColors = [
        '#3b82f6', // blue
        '#ef4444', // red  
        '#10b981', // green
        '#f59e0b', // yellow
        '#8b5cf6', // purple
        '#f97316', // orange
        '#ec4899', // pink
        '#6b7280', // gray
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const tagName = inputValue.trim();
        if (!tagName) {
            return;
        }

        setIsCreating(true);
        logger.info('TagInput', 'create_tag_attempt', 'Creating new tag using unified collections', { 
            name: tagName, 
            color: selectedColor 
        });

        try {
            const newTag = await UnifiedPhotoCollection.create('tag', {
                name: tagName,
                color: selectedColor
            });

            logger.info('TagInput', 'create_tag_success', 'Tag created successfully via unified collection', { 
                id: newTag.id, 
                name: newTag.name 
            });
            
            if (onTagCreated) {
                onTagCreated(newTag);
            }

            setInputValue('');
            setShowColorPicker(false);
            inputRef.current?.focus();

        } catch (error) {
            logger.error('TagInput', 'create_tag_error', 'Failed to create tag', { 
                error: error.toString() 
            });
            alert('Failed to create tag: ' + error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        } else if (e.key === 'Escape') {
            setInputValue('');
            setShowColorPicker(false);
        }
    };

    return (
        <div className="tag-input-container">
            <form onSubmit={handleSubmit} className="tag-input-form">
                <div className="tag-input-wrapper">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={isCreating}
                        className="tag-input-field"
                        maxLength={50}
                    />
                    
                    <button
                        type="button"
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="tag-color-button"
                        style={{ backgroundColor: selectedColor }}
                        title="Choose tag color"
                        disabled={isCreating}
                    >
                        <span className="tag-color-indicator"></span>
                    </button>
                    
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isCreating}
                        className="tag-create-button"
                        title="Create tag"
                    >
                        {isCreating ? '...' : '+'}
                    </button>
                </div>

                {showColorPicker && (
                    <div className="tag-color-picker">
                        {predefinedColors.map(color => (
                            <button
                                key={color}
                                type="button"
                                className={`tag-color-option ${selectedColor === color ? 'selected' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setSelectedColor(color);
                                    setShowColorPicker(false);
                                }}
                                title={`Select ${color}`}
                            />
                        ))}
                    </div>
                )}
            </form>
        </div>
    );
};

export default TagInput;