import { describe, it, expect } from 'vitest';
import { getPhotoSortComparator, isStarSort, findInsertIndex } from './PhotoSort.js';

describe('getPhotoSortComparator', () => {
    const photos = [
        { originalPath: 'a/1.jpg', star: 3, created_at: '2024-01-03T00:00:00Z', exif_date_time_original: '2023-12-03T00:00:00Z', name: '1.jpg' },
        { originalPath: 'a/2.jpg', star: 5, created_at: '2024-01-01T00:00:00Z', exif_date_time_original: '2023-12-01T00:00:00Z', name: '2.jpg' },
        { originalPath: 'a/3.jpg', star: 0, created_at: '2024-01-02T00:00:00Z', exif_date_time_original: '2023-12-02T00:00:00Z', name: '3.jpg' },
    ];

    it('sortValue=0 sorts by exif_date_time_original desc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(0));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/3.jpg', 'a/2.jpg']);
    });

    it('sortValue=1 sorts by exif_date_time_original asc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(1));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/2.jpg', 'a/3.jpg', 'a/1.jpg']);
    });

    it('sortValue=2 sorts by created_at desc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(2));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/3.jpg', 'a/2.jpg']);
    });

    it('sortValue=4 sorts by star desc, tie by created_at desc', () => {
        const tied = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-01T00:00:00Z' },
            { originalPath: 'a/2.jpg', star: 5, created_at: '2024-01-02T00:00:00Z' },
            { originalPath: 'a/3.jpg', star: 3, created_at: '2024-01-05T00:00:00Z' },
        ];
        const sorted = [...tied].sort(getPhotoSortComparator(4));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/2.jpg', 'a/1.jpg', 'a/3.jpg']);
    });

    it('sortValue=7 sorts by originalPath asc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(7));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/2.jpg', 'a/3.jpg']);
    });

    it('returns null for unknown sortValue', () => {
        expect(getPhotoSortComparator(999)).toBeNull();
    });

    it('sortValue=3 sorts by created_at asc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(3));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/2.jpg', 'a/3.jpg', 'a/1.jpg']);
    });

    it('sortValue=5 sorts by star asc, tie by created_at asc', () => {
        const tied = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-01T00:00:00Z' },
            { originalPath: 'a/2.jpg', star: 5, created_at: '2024-01-02T00:00:00Z' },
            { originalPath: 'a/3.jpg', star: 3, created_at: '2024-01-05T00:00:00Z' },
        ];
        const sorted = [...tied].sort(getPhotoSortComparator(5));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/3.jpg', 'a/1.jpg', 'a/2.jpg']);
    });

    it('sortValue=6 sorts by originalPath desc', () => {
        const sorted = [...photos].sort(getPhotoSortComparator(6));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/3.jpg', 'a/2.jpg', 'a/1.jpg']);
    });

    it('handles null exif_date_time_original (sorts to start under asc)', () => {
        const withNull = [
            { originalPath: 'a/1.jpg', exif_date_time_original: '2023-12-01T00:00:00Z' },
            { originalPath: 'a/2.jpg', exif_date_time_original: null },
            { originalPath: 'a/3.jpg', exif_date_time_original: '2023-12-03T00:00:00Z' },
        ];
        const sorted = [...withNull].sort(getPhotoSortComparator(1));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/2.jpg', 'a/1.jpg', 'a/3.jpg']);
    });

    it('handles null star as 0 in star desc', () => {
        const withNull = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-01T00:00:00Z' },
            { originalPath: 'a/2.jpg', star: null, created_at: '2024-01-02T00:00:00Z' },
            { originalPath: 'a/3.jpg', star: 3, created_at: '2024-01-03T00:00:00Z' },
        ];
        const sorted = [...withNull].sort(getPhotoSortComparator(4));
        expect(sorted.map(p => p.originalPath)).toEqual(['a/1.jpg', 'a/3.jpg', 'a/2.jpg']);
    });
});

describe('isStarSort', () => {
    it('returns true for sortValue 4 and 5', () => {
        expect(isStarSort(4)).toBe(true);
        expect(isStarSort(5)).toBe(true);
    });

    it('returns false for non-star sort values', () => {
        expect(isStarSort(0)).toBe(false);
        expect(isStarSort(2)).toBe(false);
        expect(isStarSort(7)).toBe(false);
    });
});

describe('findInsertIndex', () => {
    it('inserts at correct position for star desc', () => {
        const sorted = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-05T00:00:00Z' },
            { originalPath: 'a/2.jpg', star: 3, created_at: '2024-01-03T00:00:00Z' },
            { originalPath: 'a/3.jpg', star: 1, created_at: '2024-01-01T00:00:00Z' },
        ];
        const newPhoto = { originalPath: 'a/new.jpg', star: 4, created_at: '2024-01-04T00:00:00Z' };
        const idx = findInsertIndex(sorted, newPhoto, getPhotoSortComparator(4));
        expect(idx).toBe(1);
    });

    it('returns 0 when inserting at start', () => {
        const sorted = [
            { originalPath: 'a/1.jpg', star: 3, created_at: '2024-01-01T00:00:00Z' },
        ];
        const newPhoto = { originalPath: 'a/new.jpg', star: 5, created_at: '2024-01-02T00:00:00Z' };
        const idx = findInsertIndex(sorted, newPhoto, getPhotoSortComparator(4));
        expect(idx).toBe(0);
    });

    it('returns sorted.length when inserting at end', () => {
        const sorted = [
            { originalPath: 'a/1.jpg', star: 5, created_at: '2024-01-01T00:00:00Z' },
        ];
        const newPhoto = { originalPath: 'a/new.jpg', star: 1, created_at: '2024-01-02T00:00:00Z' };
        const idx = findInsertIndex(sorted, newPhoto, getPhotoSortComparator(4));
        expect(idx).toBe(1);
    });

    it('falls back to length when comparator is null', () => {
        const sorted = [{ originalPath: 'a/1.jpg' }];
        const newPhoto = { originalPath: 'a/new.jpg' };
        const idx = findInsertIndex(sorted, newPhoto, null);
        expect(idx).toBe(1);
    });
});
