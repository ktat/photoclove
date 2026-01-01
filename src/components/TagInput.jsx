import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { UnifiedPhotoCollection } from '../domain/UnifiedPhotoCollection.js';
import { logger } from '../services/LoggerService.js';
import './TagInput.css';

const TagInput = ({ onTagCreated, placeholder = "Create new tag..." }) => {
    const [inputValue, setInputValue] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const inputRef = useRef(null);

    // Color feature removed - tags now use default styling
    // const [selectedColor, setSelectedColor] = useState('#3b82f6');
    // const [showColorPicker, setShowColorPicker] = useState(false);
    // const predefinedColors = [...];

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const tagName = inputValue.trim();
        if (!tagName) {
            return;
        }

        setIsCreating(true);
        logger.info('TagInput', 'create_tag_attempt', 'Creating new tag using unified collections', {
            name: tagName
        });

        try {
            const newTag = await UnifiedPhotoCollection.create('tag', {
                name: tagName
                // color field removed - tags now use default styling
            });

            logger.info('TagInput', 'create_tag_success', 'Tag created successfully via unified collection', { 
                id: newTag.id, 
                name: newTag.name 
            });
            
            if (onTagCreated) {
                onTagCreated(newTag);
            }

            setInputValue('');
            // setShowColorPicker(false);
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
            // setShowColorPicker(false);
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

                    {/* Color button removed - tags now use default styling */}
                    {/* <button type="button" onClick={() => setShowColorPicker(!showColorPicker)} ... >
                        <span className="tag-color-indicator"></span>
                    </button> */}

                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isCreating}
                        className="tag-create-button"
                        title="Create tag"
                    >
                        {isCreating ? '...' : '+'}
                    </button>
                </div>

                {/* Color picker removed - tags now use default styling */}
                {/* {showColorPicker && (
                    <div className="tag-color-picker">
                        {predefinedColors.map(color => (
                            <button ... />
                        ))}
                    </div>
                )} */}
            </form>
        </div>
    );
};

export default TagInput;