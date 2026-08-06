/**
 * VideoRangeList
 *
 * The ranges kept from one source, as `HH:MM:SS.d - HH:MM:SS.d` rows. Clicking
 * a row seeks the player to that range; the ✕ drops it.
 *
 * A source with nothing marked keeps the whole file, which shows here as a
 * single row that cannot be removed - there is nothing to remove it down to.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatClipTime } from './trimUtils.js';

function VideoRangeList({ ranges, isWholeFile, onSeek, onRemove }) {
    const { t } = useTranslation(['directoryMenu']);

    if (ranges.length === 0) return null;

    return (
        <ul style={{
            listStyle: 'none',
            margin: 'var(--space-2) 0 0',
            padding: 0,
            fontSize: 'var(--font-size-sm)'
        }}>
            {ranges.map((range) => (
                <li
                    key={range.id}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-1) 0'
                    }}
                >
                    <button
                        onClick={() => onRemove(range)}
                        disabled={isWholeFile}
                        aria-label={t('directoryMenu:videoMerge.removeRange')}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: isWholeFile ? 'default' : 'pointer',
                            color: 'var(--color-text-muted)',
                            padding: 0,
                            lineHeight: 1
                        }}
                    >✕</button>
                    <button
                        onClick={() => onSeek(range.start_sec)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-text-primary)',
                            fontFamily: 'monospace',
                            padding: 0
                        }}
                    >
                        {formatClipTime(range.start_sec)} - {formatClipTime(range.end_sec)}
                    </button>
                    {isWholeFile && (
                        <span style={{ color: 'var(--color-text-muted)' }}>
                            {t('directoryMenu:videoMerge.wholeFile')}
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}

export default VideoRangeList;
