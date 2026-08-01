/**
 * VideoMergeEditor
 *
 * Modal for turning the selected videos into one. Each row is a segment - one
 * kept range of one file - with its own preview + trim scrubber, and the
 * segments are concatenated top to bottom in the order shown. Drag a row by its
 * grip to reorder.
 *
 * Adding a range to a row gives another segment over the same file, so a single
 * video can be cut down to its good parts and stitched back together; with one
 * segment the job is simply a trim.
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
    createClip,
    duplicateClip,
    formatClipTime,
    totalKeptSeconds,
    MIN_MERGE_SEGMENTS
} from './trimUtils.js';
import { logger } from '../../services/LoggerService.js';

/** Drag only starts past this many pixels, so a click on the player still works. */
const DRAG_ACTIVATION_DISTANCE_PX = 5;

function SortableClip({ clip, index, onChange, onDuplicate, onRemove, canRemove }) {
    const { t } = useTranslation(['directoryMenu']);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: clip.id });

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
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-1) var(--space-2)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)'
            }}>
                {/* Only the grip carries the drag listeners: the scrubber below
                    needs its own pointer events for seeking and trimming, and
                    the buttons need their own clicks. */}
                <span
                    {...attributes}
                    {...listeners}
                    style={{ cursor: 'grab', touchAction: 'none' }}
                >⠿ {index + 1}</span>
                {/* The copy is positioned relative to this range's out point,
                    so it needs the duration the player has not reported yet. */}
                <button onClick={() => onDuplicate(clip)} disabled={!clip.duration_sec}>
                    ＋ {t('directoryMenu:videoMerge.addSegment')}
                </button>
                <button onClick={() => onRemove(clip)} disabled={!canRemove}>
                    ✕ {t('directoryMenu:videoMerge.removeSegment')}
                </button>
            </div>
            {/* Keyed so a different segment remounts with its own player state. */}
            <VideoTrimScrubber key={clip.id} clip={clip} onChange={onChange} />
        </div>
    );
}

/**
 * Mounted only while the editor is open, and keyed on the selection, so both
 * closing it and changing the selection give a fresh set of clips - no effect
 * has to reset state on the way in.
 */
function VideoMergeEditor({ videoPaths, onClose, onConfirm }) {
    const { t } = useTranslation(['directoryMenu']);
    const [clips, setClips] = useState(() => videoPaths.map(createClip));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const updateClip = useCallback((next) => {
        setClips((prev) => prev.map((clip) => (clip.id === next.id ? next : clip)));
    }, []);

    // The copy goes directly after its original, which is the order the user is
    // building up when they take several pieces out of one video.
    const duplicateSegment = useCallback((source) => {
        setClips((prev) => {
            const index = prev.findIndex((clip) => clip.id === source.id);
            if (index === -1) return prev;
            return [...prev.slice(0, index + 1), duplicateClip(source), ...prev.slice(index + 1)];
        });
    }, []);

    const removeSegment = useCallback((target) => {
        setClips((prev) => prev.filter((clip) => clip.id !== target.id));
    }, []);

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setClips((prev) => {
            const oldIndex = prev.findIndex((clip) => clip.id === active.id);
            const newIndex = prev.findIndex((clip) => clip.id === over.id);
            if (oldIndex === -1 || newIndex === -1) return prev;
            return arrayMove(prev, oldIndex, newIndex);
        });
    }, []);

    const totalSeconds = useMemo(() => totalKeptSeconds(clips), [clips]);
    // Durations arrive asynchronously from each player, so the merge button
    // stays disabled until every clip has a usable range.
    const isReady = clips.length >= MIN_MERGE_SEGMENTS
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
                    items={clips.map((clip) => clip.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {clips.map((clip, index) => (
                        <SortableClip
                            key={clip.id}
                            clip={clip}
                            index={index}
                            onChange={updateClip}
                            onDuplicate={duplicateSegment}
                            onRemove={removeSegment}
                            canRemove={clips.length > MIN_MERGE_SEGMENTS}
                        />
                    ))}
                </SortableContext>
            </DndContext>
        </BaseModal>
    );
}

export default VideoMergeEditor;
