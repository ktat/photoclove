/**
 * VideoMergeEditor
 *
 * Modal for turning the selected videos into one. Each row is a source file
 * with its own player, timeline and list of kept ranges; the output is every
 * source's ranges, in the order the rows are shown. Drag a row by its grip to
 * reorder the files.
 *
 * A source with nothing marked keeps the whole file, so merging videos whole
 * takes no marking at all, and one source with several marked ranges cuts a
 * single video down to its good parts.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    closestCenter,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    verticalListSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import BaseModal from '../../components/BaseModal.jsx';
import VideoTrimScrubber from './VideoTrimScrubber.jsx';
import {
    createSource,
    effectiveRanges,
    formatClipTime,
    totalKeptSeconds,
    MIN_MERGE_SEGMENTS
} from './trimUtils.js';
import { logger } from '../../services/LoggerService.js';

/** Drag only starts past this many pixels, so a click on the player still works. */
const DRAG_ACTIVATION_DISTANCE_PX = 5;

function SortableSource({ source, index, onChange }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: source.id });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.4 : 1,
                marginBottom: 'var(--space-4)'
            }}
        >
            {/* Only the grip carries the drag listeners: everything below needs
                its own pointer events for seeking, marking and playback. */}
            <div
                {...attributes}
                {...listeners}
                style={{
                    display: 'inline-block',
                    padding: 'var(--space-1) var(--space-2)',
                    cursor: 'grab',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    touchAction: 'none'
                }}
            >⠿ {index + 1}</div>
            {/* Keyed so a different file remounts with its own player state. */}
            <VideoTrimScrubber key={source.id} source={source} onChange={onChange} />
        </div>
    );
}

/**
 * Mounted only while the editor is open, and keyed on the selection, so both
 * closing it and changing the selection give a fresh set of sources - no effect
 * has to reset state on the way in.
 */
function VideoMergeEditor({ videoPaths, onClose, onConfirm }) {
    const { t } = useTranslation(['directoryMenu']);
    const [sources, setSources] = useState(() => videoPaths.map(createSource));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const updateSource = useCallback((next) => {
        setSources((prev) => prev.map((source) => (source.id === next.id ? next : source)));
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setSources((prev) => {
            const oldIndex = prev.findIndex((source) => source.id === active.id);
            const newIndex = prev.findIndex((source) => source.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    }, []);

    const totalSeconds = useMemo(() => totalKeptSeconds(sources), [sources]);
    // Durations arrive asynchronously from each player, and a source with no
    // duration yet cannot contribute a range, so the button waits for them.
    const isReady = sources.length >= MIN_MERGE_SEGMENTS
        && sources.every((source) => effectiveRanges(source).length > 0);

    const handleConfirm = useCallback(async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(sources);
        } catch (error) {
            logger.error('VideoMergeEditor', 'merge_submit_failed', 'Failed to submit merge job', {
                sourceCount: sources.length,
                error: String(error)
            });
            setIsSubmitting(false);
        }
    }, [sources, onConfirm]);

    return (
        <BaseModal
            title={t('directoryMenu:videoMerge.title')}
            onClose={onClose}
            footerNote={t('directoryMenu:videoMerge.outputLength', {
                length: formatClipTime(totalSeconds)
            })}
            footer={
                <>
                    <button onClick={onClose} disabled={isSubmitting}>
                        {t('directoryMenu:videoMerge.cancel')}
                    </button>
                    <button onClick={handleConfirm} disabled={!isReady || isSubmitting}>
                        {isSubmitting
                            ? t('directoryMenu:videoMerge.submitting')
                            : t('directoryMenu:videoMerge.merge')}
                    </button>
                </>
            }
        >
            <div style={{
                marginBottom: 'var(--space-3)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)'
            }}>
                {t('directoryMenu:videoMerge.hint')}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                    items={sources.map((source) => source.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {sources.map((source, index) => (
                        <SortableSource
                            key={source.id}
                            source={source}
                            index={index}
                            onChange={updateSource}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </BaseModal>
    );
}

export default VideoMergeEditor;
