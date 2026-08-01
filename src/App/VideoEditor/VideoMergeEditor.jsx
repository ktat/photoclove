/**
 * VideoMergeEditor
 *
 * Modal for merging several videos into one. Each selected clip gets its own
 * preview + trim scrubber, and the clips are concatenated top to bottom in the
 * order shown - drag a clip by its handle to change that order.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { createClip, formatClipTime, totalKeptSeconds } from './trimUtils.js';
import { logger } from '../../services/LoggerService.js';

/** Merging fewer than this is not a merge; mirrors MIN_MERGE_CLIPS in Rust. */
const MIN_MERGE_CLIPS = 2;
/** Drag only starts past this many pixels, so a click on the player still works. */
const DRAG_ACTIVATION_DISTANCE_PX = 5;

function SortableClip({ clip, index, onChange }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: clip.path });

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
            {/* Only the handle carries the drag listeners: the scrubber below
                needs its own pointer events for seeking and trimming. */}
            <div
                {...attributes}
                {...listeners}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-1) var(--space-2)',
                    cursor: 'grab',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    touchAction: 'none'
                }}
            >
                <span>⠿</span>
                <span>{index + 1}</span>
            </div>
            <VideoTrimScrubber clip={clip} onChange={onChange} />
        </div>
    );
}

function VideoMergeEditor({ isOpen, videoPaths, onClose, onConfirm }) {
    const { t } = useTranslation(['directoryMenu']);
    const [clips, setClips] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Re-seed whenever the modal opens on a different selection; editing state
    // from a previous merge must not leak into the next one.
    useEffect(() => {
        if (!isOpen) return;
        setClips(videoPaths.map(createClip));
        setIsSubmitting(false);
    }, [isOpen, videoPaths]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const updateClip = useCallback((next) => {
        setClips((prev) => prev.map((clip) => (clip.path === next.path ? next : clip)));
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setClips((prev) => {
            const oldIndex = prev.findIndex((clip) => clip.path === active.id);
            const newIndex = prev.findIndex((clip) => clip.path === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    }, []);

    const totalSeconds = useMemo(() => totalKeptSeconds(clips), [clips]);
    // Durations arrive asynchronously from each player, so the merge button
    // stays disabled until every clip has a usable range.
    const isReady = clips.length >= MIN_MERGE_CLIPS
        && clips.every((clip) => clip.end_sec > clip.start_sec);

    const handleConfirm = useCallback(async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(clips);
        } catch (error) {
            logger.error('VideoMergeEditor', 'merge_submit_failed', 'Failed to submit merge job', {
                clipCount: clips.length,
                error: String(error)
            });
            setIsSubmitting(false);
        }
    }, [clips, onConfirm]);

    if (!isOpen) return null;

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
                    items={clips.map((clip) => clip.path)}
                    strategy={verticalListSortingStrategy}
                >
                    {clips.map((clip, index) => (
                        <SortableClip
                            key={clip.path}
                            clip={clip}
                            index={index}
                            onChange={updateClip}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </BaseModal>
    );
}

export default VideoMergeEditor;
