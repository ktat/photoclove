import React, { useState } from "react";

function AICustomLabels({ customLabels = [], onAddLabel, onRemoveLabel }) {
    const [inputValue, setInputValue] = useState('');

    const handleAdd = () => {
        const label = inputValue.trim();
        if (label && !customLabels.includes(label)) {
            onAddLabel(label);
            setInputValue('');
        }
    };

    return (
        <div style={{ marginTop: 'var(--space-4)' }}>
            <h3 style={{ marginBottom: 'var(--space-2)' }}>Custom Labels</h3>
            <p style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-3)',
            }}>
                Add custom labels for detection (e.g., "a photo of a birthday party", "my cat").
                Leave empty to use default labels.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Enter a custom label..."
                    style={{
                        flex: 1,
                        padding: 'var(--space-2)',
                        background: 'var(--color-bg-surface)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-primary)',
                    }}
                />
                <button
                    onClick={handleAdd}
                    style={{
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--color-primary)',
                        color: 'var(--color-bg-base)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                    }}
                >
                    Add
                </button>
            </div>
            {customLabels.length > 0 && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-2)',
                }}>
                    {customLabels.map((label, idx) => (
                        <span
                            key={idx}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                                padding: 'var(--space-1) var(--space-2)',
                                background: 'var(--color-bg-muted)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 'var(--font-size-sm)',
                            }}
                        >
                            {label}
                            <button
                                onClick={() => onRemoveLabel(label)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-text-muted)',
                                    cursor: 'pointer',
                                    padding: '0 4px',
                                    fontSize: 'var(--font-size-sm)',
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AICustomLabels;
