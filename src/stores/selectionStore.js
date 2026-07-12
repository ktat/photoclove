/**
 * selectionStore
 *
 * Per-path selection store for the photo grid. The grid used to receive the
 * whole `photoSelectionDict` object as a react-window `cellProps` field, so
 * every checkbox toggle changed that object's identity and forced ALL mounted
 * PhotoCards to re-render (measured: ~90-120 card renders per single toggle).
 *
 * This store lets each card subscribe to ONLY its own path via
 * `useIsSelected(path)` (useSyncExternalStore). `usePhotoSelection` mirrors its
 * React selection state into this store; `replace()` diffs old vs new membership
 * and notifies only the paths that actually changed — so a single toggle
 * re-renders exactly one card.
 *
 * The React selection state (photoSelection array / photoSelectionDict) remains
 * the source of truth for the side panel, counts, and operations; this store is
 * a read-optimized mirror used only by the grid.
 */
import { useCallback, useSyncExternalStore } from 'react';

class SelectionStore {
    constructor() {
        this.set = new Set();
        this.pathListeners = new Map(); // path -> Set<callback>
    }

    has(path) {
        return this.set.has(path);
    }

    subscribePath(path, cb) {
        if (path == null) return () => {};
        let listeners = this.pathListeners.get(path);
        if (!listeners) {
            listeners = new Set();
            this.pathListeners.set(path, listeners);
        }
        listeners.add(cb);
        return () => {
            listeners.delete(cb);
            if (listeners.size === 0) this.pathListeners.delete(path);
        };
    }

    _notify(path) {
        const listeners = this.pathListeners.get(path);
        if (listeners) listeners.forEach(cb => cb());
    }

    /**
     * Replace the selected set from a dict ({ path: true }) or array of paths.
     * Only paths whose membership changed are notified.
     */
    replace(dictOrArray) {
        const next = new Set(
            Array.isArray(dictOrArray) ? dictOrArray : Object.keys(dictOrArray || {})
        );
        const changed = [];
        for (const p of next) if (!this.set.has(p)) changed.push(p);
        for (const p of this.set) if (!next.has(p)) changed.push(p);
        // Update state BEFORE notifying so getSnapshot() reads the fresh value.
        this.set = next;
        for (const p of changed) this._notify(p);
    }
}

export const selectionStore = new SelectionStore();

/**
 * Subscribe a component to a single path's selected state.
 * @param {string|undefined} path
 * @returns {boolean}
 */
export function useIsSelected(path) {
    const subscribe = useCallback(
        (cb) => selectionStore.subscribePath(path, cb),
        [path]
    );
    const getSnapshot = useCallback(() => selectionStore.has(path), [path]);
    return useSyncExternalStore(subscribe, getSnapshot);
}
