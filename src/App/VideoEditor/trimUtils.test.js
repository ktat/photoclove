import { describe, it, expect } from 'vitest';
import {
    addRange,
    effectiveRanges,
    formatClipTime,
    isInsideAnyRange,
    nextRangeStart,
    rangeContaining,
    toMergePayload,
    totalKeptSeconds,
} from './trimUtils.js';

/** Ranges as `start-end` pairs, so an assertion reads like the range list does. */
const asPairs = (ranges) => ranges.map((r) => `${r.start_sec}-${r.end_sec}`);

describe('addRange', () => {
    it('keeps ranges sorted by start time', () => {
        const ranges = addRange(addRange([], 40, 50), 10, 20);
        expect(asPairs(ranges)).toEqual(['10-20', '40-50']);
    });

    it('folds a range whose end runs into the next one', () => {
        const existing = addRange(addRange([], 10, 20), 40, 50);
        expect(asPairs(addRange(existing, 30, 45))).toEqual(['10-20', '30-50']);
    });

    it('collapses every range a new one spans', () => {
        const existing = addRange(addRange([], 10, 20), 40, 50);
        expect(asPairs(addRange(existing, 5, 45))).toEqual(['5-50']);
    });

    it('folds ranges that merely touch, so the output has no seam', () => {
        const existing = addRange([], 10, 20);
        expect(asPairs(addRange(existing, 20, 30))).toEqual(['10-30']);
    });

    it('normalizes a range marked back to front', () => {
        expect(asPairs(addRange([], 50, 20))).toEqual(['20-50']);
    });
});

describe('isInsideAnyRange', () => {
    const ranges = addRange(addRange([], 10, 20), 40, 50);

    it('reports positions inside a kept range', () => {
        expect(isInsideAnyRange(ranges, 15)).toBe(true);
    });

    it('reports the boundaries as inside, so a start cannot butt against one', () => {
        expect(isInsideAnyRange(ranges, 10)).toBe(true);
        expect(isInsideAnyRange(ranges, 20)).toBe(true);
    });

    it('leaves the gaps free to start in', () => {
        expect(isInsideAnyRange(ranges, 30)).toBe(false);
        expect(isInsideAnyRange([], 30)).toBe(false);
    });
});

describe('effectiveRanges', () => {
    it('treats a source with nothing marked as the whole file', () => {
        const ranges = effectiveRanges({ id: 's', duration_sec: 120, ranges: [] });
        expect(asPairs(ranges)).toEqual(['0-120']);
    });

    it('contributes nothing until the duration is known', () => {
        expect(effectiveRanges({ id: 's', duration_sec: 0, ranges: [] })).toEqual([]);
    });

    it('uses the marked ranges once there are any', () => {
        const marked = addRange([], 10, 20);
        const ranges = effectiveRanges({ id: 's', duration_sec: 120, ranges: marked });
        expect(asPairs(ranges)).toEqual(['10-20']);
    });
});

describe('range playback helpers', () => {
    const ranges = addRange(addRange([], 10, 20), 40, 50);

    it('finds the range covering a position', () => {
        expect(rangeContaining(ranges, 15).start_sec).toBe(10);
        expect(rangeContaining(ranges, 30)).toBeNull();
    });

    it('points at the next range to jump to, and past the last returns null', () => {
        expect(nextRangeStart(ranges, 25)).toBe(40);
        expect(nextRangeStart(ranges, 55)).toBeNull();
    });
});

describe('toMergePayload', () => {
    it('flattens sources in row order and ranges in time order', () => {
        const sources = [
            { id: 's1', path: '/a.mp4', duration_sec: 100, ranges: addRange(addRange([], 40, 50), 10, 20) },
            { id: 's2', path: '/b.mp4', duration_sec: 60, ranges: [] },
        ];
        expect(toMergePayload(sources)).toEqual([
            { path: '/a.mp4', start_sec: 10, end_sec: 20 },
            { path: '/a.mp4', start_sec: 40, end_sec: 50 },
            { path: '/b.mp4', start_sec: 0, end_sec: 60 },
        ]);
    });
});

describe('totalKeptSeconds', () => {
    it('adds up every kept range across sources', () => {
        const sources = [
            { id: 's1', path: '/a.mp4', duration_sec: 100, ranges: addRange(addRange([], 40, 50), 10, 20) },
            { id: 's2', path: '/b.mp4', duration_sec: 60, ranges: [] },
        ];
        expect(totalKeptSeconds(sources)).toBe(80);
    });
});

describe('formatClipTime', () => {
    it('formats as HH:MM:SS.d', () => {
        expect(formatClipTime(0)).toBe('00:00:00.0');
        expect(formatClipTime(5.25)).toBe('00:00:05.3');
        expect(formatClipTime(3661.25)).toBe('01:01:01.3');
    });

    it('carries the rounding into minutes and hours', () => {
        expect(formatClipTime(59.96)).toBe('00:01:00.0');
        expect(formatClipTime(3599.96)).toBe('01:00:00.0');
        expect(formatClipTime(3659.96)).toBe('01:01:00.0');
    });

    it('falls back for values a player has not reported yet', () => {
        expect(formatClipTime(NaN)).toBe('00:00:00.0');
        expect(formatClipTime(-1)).toBe('00:00:00.0');
    });
});
