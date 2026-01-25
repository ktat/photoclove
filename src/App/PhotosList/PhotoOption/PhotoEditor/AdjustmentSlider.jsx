/**
 * AdjustmentSlider - Reusable slider control for PhotoEditor adjustments
 * Handles range input, number input, and reset button in a unified component
 */
import React from 'react';
import styles from '../PhotoEditor.module.css';

/**
 * AdjustmentSlider component
 * @param {Object} props
 * @param {string} props.label - Label text for the control
 * @param {number} props.value - Current value
 * @param {Function} props.onChange - Value change handler
 * @param {Function} props.onReset - Reset handler
 * @param {number} props.min - Minimum value
 * @param {number} props.max - Maximum value
 * @param {React.ReactNode} [props.extraRow] - Optional extra row content (e.g., quick buttons)
 */
function AdjustmentSlider({
    label,
    value,
    onChange,
    onReset,
    min,
    max,
    extraRow
}) {
    const handleChange = (e) => {
        onChange(e.target.value);
    };

    return (
        <>
            <tr>
                <td rowSpan={extraRow ? 2 : 1} className={styles['label-cell']}>{label}:</td>
                <td rowSpan={extraRow ? 2 : 1}>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        value={value}
                        className={styles['editor-slider']}
                        onChange={handleChange}
                    />
                </td>
                <td>
                    <input
                        type="number"
                        min={min}
                        max={max}
                        value={value}
                        className={styles['value-input']}
                        onChange={handleChange}
                    />
                </td>
                <td>
                    <button
                        className={styles['reset-btn']}
                        onClick={onReset}
                        title={`Reset ${typeof label === 'string' ? label.toLowerCase() : 'value'}`}
                    >
                        ↻
                    </button>
                </td>
            </tr>
            {extraRow && (
                <tr>
                    <td colSpan="2" className={styles['shortcuts-cell']}>
                        {extraRow}
                    </td>
                </tr>
            )}
        </>
    );
}

export default AdjustmentSlider;
