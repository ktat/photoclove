/**
 * CollageOrderEditor - Drag-and-drop reorder of collage photos.
 *
 * Renders the collage's input photos as a horizontal row of numbered
 * thumbnail tiles. Dragging a tile to another slot swaps positions,
 * which drives the collage layout order via onReorder.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/core';
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
    horizontalListSortingStrategy,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './CollageOrderEditor.module.css';

function SortableTile({ id, index, displayPath }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 2 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={styles.tile}
            {...attributes}
            {...listeners}
        >
            <img
                src={convertFileSrc(displayPath)}
                alt={`Photo ${index + 1}`}
                draggable={false}
                className={styles.tileImage}
            />
            <span className={styles.tileBadge}>{index + 1}</span>
        </div>
    );
}

function CollageOrderEditor({ paths, onReorder }) {
    const { t } = useTranslation(['directoryMenu']);
    const sensors = useSensors(
        // Require a 5px drag before starting so a plain click on a tile
        // (e.g. for keyboard focus) doesn't trigger a phantom drag.
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = paths.indexOf(active.id);
        const newIndex = paths.indexOf(over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        onReorder(arrayMove(paths, oldIndex, newIndex));
    };

    if (paths.length < 2) return null;

    return (
        <div className={styles.editor}>
            <div className={styles.hint}>
                {t('directoryMenu:share.dragToReorder', 'Drag to reorder')}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={paths} strategy={horizontalListSortingStrategy}>
                    <div className={styles.tileRow}>
                        {paths.map((path, i) => (
                            <SortableTile key={path} id={path} index={i} displayPath={path} />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </div>
    );
}

export default CollageOrderEditor;
