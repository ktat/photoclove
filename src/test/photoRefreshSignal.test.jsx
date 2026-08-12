import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { PhotoProvider, usePhoto } from '../context/PhotoContext.jsx';
import { useDataSynchronization } from '../hooks/useDataSynchronization.js';

/**
 * Moving photos to their EXIF date and building thumbnails both happen outside
 * the photo list, so the list has no way to notice on its own: it keeps showing
 * photos under the date they just left, and new thumbnails never appear. The
 * refresh signal is how those jobs tell it to reload.
 */
function setup() {
    const loader = vi.fn().mockResolvedValue(undefined);
    const getDatesNum = vi.fn().mockResolvedValue(undefined);

    const wrapper = ({ children }) => <PhotoProvider>{children}</PhotoProvider>;
    const rendered = renderHook(
        () => ({
            sync: useDataSynchronization({
                modeLoaders: { date: loader },
                viewMode: 'date',
                getDatesNum,
                photoCollection: null,
                setPhotoCollection: vi.fn(),
            }),
            photo: usePhoto(),
        }),
        { wrapper }
    );
    return { ...rendered, loader, getDatesNum };
}

describe('photo refresh signal', () => {
    it('does not reload on mount', async () => {
        const { loader } = setup();
        // A list mounted after a job already ran must not reload redundantly -
        // on NFS every reload is a round of network round-trips.
        expect(loader).not.toHaveBeenCalled();
    });

    it('reloads the current view when a job requests a refresh', async () => {
        const { result, loader, getDatesNum } = setup();

        await act(async () => {
            result.current.photo.requestPhotoRefresh();
        });

        expect(loader).toHaveBeenCalledTimes(1);
        expect(getDatesNum).toHaveBeenCalledTimes(1);
    });

    it('reloads once per request, not once per render', async () => {
        const { result, rerender, loader } = setup();

        await act(async () => {
            result.current.photo.requestPhotoRefresh();
        });
        rerender();
        rerender();

        expect(loader).toHaveBeenCalledTimes(1);

        await act(async () => {
            result.current.photo.requestPhotoRefresh();
        });

        expect(loader).toHaveBeenCalledTimes(2);
    });
});
