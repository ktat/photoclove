import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@tauri-apps/plugin-opener', () => ({
    openUrl: vi.fn(),
}));

import PhotoCard from '../App/PhotosList/PhotoCard.jsx';

const CACHE_PATH = '/thumbs/cache/resolved.jpg';

function makeImportPhoto(path) {
    // Plain object mimicking a freshly (re)created Photo entity for import mode
    return {
        originalPath: path,
        import_source: true,
        star: 0,
        comment: '',
        tags: []
    };
}

const baseProps = {
    index: 0,
    iconSize: 100,
    isSelected: false,
    onAddSelection: vi.fn(),
    onDisplayPhoto: vi.fn(),
    onOpenBurstGroup: vi.fn(),
    setShowSideMenu: vi.fn(),
    importState: { currentImportPath: '/import/src' }
};

describe('PhotoCard thumbnail path resolution (import mode)', () => {
    beforeEach(() => {
        global.mockTauriInvoke.mockReset();
        global.mockTauriInvoke.mockImplementation((cmd) => {
            if (cmd === 'get_thumbnail_path') {
                return Promise.resolve(CACHE_PATH);
            }
            return Promise.resolve(null);
        });
    });

    it('resolves the thumbnail cache path and applies it to the img element', async () => {
        const path = '/import/src/apply-to-img.jpg';
        render(<PhotoCard {...baseProps} photo={makeImportPhoto(path)} />);

        await waitFor(() => {
            expect(screen.getByAltText(path).src).toContain(CACHE_PATH);
        });
        expect(global.mockTauriInvoke).toHaveBeenCalledWith('get_thumbnail_path', {
            photoPath: path,
            importDirectory: '/import/src'
        });
    });

    it('does not re-invoke when the photo entity is recreated for the same path', async () => {
        const path = '/import/src/entity-recreated.jpg';
        const { rerender } = render(
            <PhotoCard {...baseProps} photo={makeImportPhoto(path)} />
        );
        await waitFor(() => {
            expect(screen.getByAltText(path).src).toContain(CACHE_PATH);
        });
        const callsAfterFirstRender = global.mockTauriInvoke.mock.calls.length;

        // Filter/sort changes rebuild Photo entities: same path, new object
        rerender(<PhotoCard {...baseProps} photo={makeImportPhoto(path)} />);
        await waitFor(() => {
            expect(screen.getByAltText(path).src).toContain(CACHE_PATH);
        });

        expect(global.mockTauriInvoke.mock.calls.length).toBe(callsAfterFirstRender);
        expect(callsAfterFirstRender).toBe(1);
    });

    it('uses the original file directly for PNG/GIF without invoking', async () => {
        const path = '/import/src/native.png';
        render(<PhotoCard {...baseProps} photo={makeImportPhoto(path)} />);

        expect(screen.getByAltText(path).src).toContain(path);
        expect(global.mockTauriInvoke).not.toHaveBeenCalled();
    });
});
