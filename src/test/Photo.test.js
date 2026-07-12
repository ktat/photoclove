import { describe, it, expect } from 'vitest';
import { Photo } from '../domain/Photo.js';

const config = {
    import_to: '/library',
    thumbnail_store: '/thumbs',
    trash_path: '/trash'
};

function makePhoto(overrides = {}) {
    return new Photo({
        file: { path: '2024-05-13/uuid/photo.jpg', name: 'photo.jpg' },
        path: '2024-05-13/uuid/photo.jpg',
        has_thumbnail: true,
        star: 2,
        comment: 'a comment',
        css_style: 'rotate90',
        tags: [{ id: 1, name: 'trip', color: '#fff' }],
        created_at: '2024-05-13 10:20:30',
        meta_data: { orientation: 'Rotate 90 CW' },
        burst_group_id: 'bg-1',
        burst_count: 5,
        inTrashBin: false,
        inAlbum: true,
        albumId: 'album-1',
        import_source: false,
        ...overrides
    }, config);
}

// All fields that must survive any with*/moveToTrash/restoreFromTrash call
function expectFieldsPreserved(updated, original, except = []) {
    const fields = [
        'originalPath', 'name', 'hasThumbnail', 'star', 'comment', 'cssStyle',
        'tags', 'created_at', 'meta_data', 'burst_group_id', 'burst_count',
        'inTrashBin', 'inAlbum', 'albumId', 'import_source'
    ];
    for (const field of fields) {
        if (except.includes(field)) continue;
        expect(updated[field], `field "${field}" should be preserved`).toEqual(original[field]);
    }
    expect(updated.config).toBe(original.config);
}

describe('Photo immutable updates preserve all fields', () => {
    it('withStar updates star and preserves created_at / burst info', () => {
        const photo = makePhoto();
        const updated = photo.withStar(5);
        expect(updated.star).toBe(5);
        expectFieldsPreserved(updated, photo, ['star']);
    });

    it('withComment updates comment and preserves created_at / burst info', () => {
        const photo = makePhoto();
        const updated = photo.withComment('new comment');
        expect(updated.comment).toBe('new comment');
        expectFieldsPreserved(updated, photo, ['comment']);
    });

    it('moveToTrash sets inTrashBin and preserves created_at / burst info', () => {
        const photo = makePhoto();
        const updated = photo.moveToTrash();
        expect(updated.inTrashBin).toBe(true);
        expectFieldsPreserved(updated, photo, ['inTrashBin']);
    });

    it('restoreFromTrash clears inTrashBin and preserves created_at / burst info', () => {
        const photo = makePhoto({ inTrashBin: true });
        const updated = photo.restoreFromTrash();
        expect(updated.inTrashBin).toBe(false);
        expectFieldsPreserved(updated, photo, ['inTrashBin']);
    });

    it('returns a new instance and does not mutate the original', () => {
        const photo = makePhoto();
        const updated = photo.withStar(5);
        expect(updated).not.toBe(photo);
        expect(photo.star).toBe(2);
    });
});

describe('Photo thumbnailPath video handling', () => {
    const UUID = '12345678-1234-1234-1234-123456789abc';
    function videoPhoto(name) {
        return new Photo({
            file: { path: `2024-05-13/${UUID}/${name}`, name },
            path: `2024-05-13/${UUID}/${name}`,
            has_thumbnail: true
        }, config);
    }

    it.each(['clip.mp4', 'clip.webm', 'clip.mov', 'clip.avi', 'clip.MOV'])(
        'appends .jpg to the full name for video %s',
        (name) => {
            const p = videoPhoto(name);
            expect(p.thumbnailPath()).toBe(`/thumbs/2024-05-13/${UUID}/${name}.jpg`);
        }
    );

    it('still lowercases the extension for regular images', () => {
        const p = videoPhoto('photo.JPG');
        expect(p.thumbnailPath()).toBe(`/thumbs/2024-05-13/${UUID}/photo.jpg`);
    });
});
