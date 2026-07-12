import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index.js';
import PhotoInfo from '../App/PhotosList/PhotoOption/PhotoInfo.jsx';

const baseProps = {
    imgCacheMap: {},
    showSideMenu: true,
    star: [false, false, false, false, false],
    setStar: vi.fn(),
    isImportMode: false,
    isTrashMode: false,
    addFooterMessage: vi.fn()
};

function makePhoto({ isVideo }) {
    return {
        originalPath: isVideo ? '2024-05-13/clip.mp4' : '2024-05-13/photo.jpg',
        name: isVideo ? 'clip.mp4' : 'photo.jpg',
        displayPath: () => (isVideo ? '2024-05-13/clip.mp4' : '2024-05-13/photo.jpg'),
        isVideo: () => isVideo
    };
}

function renderWithI18n(ui) {
    return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('PhotoInfo video vs photo rows', () => {
    beforeEach(() => {
        global.mockTauriInvoke.mockReset();
    });

    it('hides photo-only EXIF rows and shows video rows for a video', async () => {
        global.mockTauriInvoke.mockResolvedValue(JSON.stringify({
            original_path: '2024-05-13/clip.mp4',
            current_path: '/library/2024-05-13/clip.mp4',
            is_trashed: false,
            file_size: 12345,
            meta: null,
            exif: { date_time: '2026-06-29 18:48:43', make: 'DJI', model: 'FC7303', xresolution: '3840', yresolution: '2160' },
            video: { duration_secs: 12.3, codec: 'hevc', gps_latitude: 35.1234, gps_longitude: -139.1234 }
        }));

        renderWithI18n(<PhotoInfo {...baseProps} currentPhoto={makePhoto({ isVideo: true })} />);

        await waitFor(() => {
            expect(screen.queryByText('ISO')).not.toBeInTheDocument();
        });
        expect(screen.queryByText('FNumber')).not.toBeInTheDocument();
        expect(screen.getByText('Resolution')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();
        expect(screen.getByText('Codec')).toBeInTheDocument();
        expect(screen.getByText('GPS')).toBeInTheDocument();
    });

    it('shows the full EXIF table and no video rows for a photo', async () => {
        global.mockTauriInvoke.mockResolvedValue(JSON.stringify({
            original_path: '2024-05-13/photo.jpg',
            current_path: '/library/2024-05-13/photo.jpg',
            is_trashed: false,
            file_size: 54321,
            meta: null,
            exif: { iso: '200', fnumber: '2.8' },
            video: null
        }));

        renderWithI18n(<PhotoInfo {...baseProps} currentPhoto={makePhoto({ isVideo: false })} />);

        await waitFor(() => {
            expect(screen.getByText('ISO')).toBeInTheDocument();
        });
        expect(screen.getByText('FNumber')).toBeInTheDocument();
        expect(screen.queryByText('Duration')).not.toBeInTheDocument();
        expect(screen.queryByText('Codec')).not.toBeInTheDocument();
    });
});
