import React from "react";
import { useTranslation } from 'react-i18next';

/**
 * SelectionHeader - Common header for selection sections
 * Displays count and clear button
 */
function SelectionHeader({ count, labelKey, onClear }) {
    const { t } = useTranslation(['directoryMenu']);

    if (count === 0) return null;

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-3)',
            paddingBottom: 'var(--space-2)',
            borderBottom: '1px solid var(--color-border-subtle)'
        }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                <strong style={{ color: 'var(--color-primary)' }}>{count}</strong> {t(labelKey)}
            </span>
            <button
                onClick={onClear}
                style={{
                    background: 'transparent',
                    color: 'var(--color-danger)',
                    border: 'none',
                    padding: 'var(--space-1) var(--space-2)',
                    fontSize: 'var(--font-size-xs)',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)'
                }}
                title={t('directoryMenu:selection.clearSelection')}
            >
                ✕ {t('directoryMenu:selection.clear')}
            </button>
        </div>
    );
}

export default SelectionHeader;
