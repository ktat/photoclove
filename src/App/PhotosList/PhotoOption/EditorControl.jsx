/**
 * Reusable editor control component for PhotoEditor
 * Provides slider + number input + reset button pattern
 */
import React from 'react';
import styles from './PhotoEditor.module.css';

/**
 * EditorControl - A reusable control component with range slider, number input, and reset button
 * @param {Object} props
 * @param {string} props.label - Control label text
 * @param {number} props.value - Current value
 * @param {number} props.min - Minimum value
 * @param {number} props.max - Maximum value
 * @param {function} props.onChange - Called with new value when slider or input changes
 * @param {function} props.onReset - Called when reset button is clicked
 * @param {string} [props.resetTitle] - Title for reset button tooltip
 * @param {React.ReactNode} [props.children] - Additional content below the control row
 */
function EditorControl({ label, value, min, max, onChange, onReset, resetTitle, children }) {
    const handleChange = (e) => {
        onChange(e.target.value);
    };

    return (
        <div className={styles['editor-control']}>
            <div className={styles['control-row']}>
                <label>{label}</label>
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    className={styles['editor-slider']}
                    onChange={handleChange}
                />
                <input
                    type="number"
                    min={min}
                    max={max}
                    value={value}
                    className={styles['value-input']}
                    onChange={handleChange}
                />
                <button
                    className={styles['reset-btn']}
                    onClick={onReset}
                    title={resetTitle || `Reset ${label.toLowerCase()}`}
                >
                    ↻
                </button>
            </div>
            {children}
        </div>
    );
}

export default EditorControl;
