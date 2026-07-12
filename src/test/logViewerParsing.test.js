import { describe, it, expect } from 'vitest';
import { parseBackendLogs, isWithinSince } from '../App/LogViewer.jsx';

describe('parseBackendLogs', () => {
    it('parses standard log lines into structured entries', () => {
        const raw = [
            '2026-07-12 10:00:00.123 [INFO] repository::sqlite - connected; path=/db',
            '2026-07-12 10:00:01.456 [ERROR] domain::photo - decode_failed; path=/a.jpg'
        ].join('\n');

        const parsed = parseBackendLogs(raw);
        expect(parsed).toHaveLength(2);
        expect(parsed[0]).toMatchObject({
            level: 'INFO',
            component: 'repository::sqlite',
            message: 'connected; path=/db',
            source: 'backend'
        });
        expect(parsed[0].timestamp).toBe('2026-07-12T10:00:00.123Z');
        expect(parsed[1].level).toBe('ERROR');
    });

    it('merges continuation lines (stack traces) into the previous entry', () => {
        const raw = [
            '2026-07-12 10:00:00.123 [ERROR] app - panic',
            '  at some_function',
            '  at main'
        ].join('\n');

        const parsed = parseBackendLogs(raw);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].message).toBe('panic\n  at some_function\n  at main');
    });

    it('keeps unrecognized standalone lines as INFO entries', () => {
        const parsed = parseBackendLogs('random output line');
        expect(parsed).toHaveLength(1);
        expect(parsed[0].message).toBe('random output line');
        expect(parsed[0].level).toBe('INFO');
    });

    it('returns empty array for empty input', () => {
        expect(parseBackendLogs('')).toEqual([]);
    });
});

describe('isWithinSince', () => {
    it('always passes with "all"', () => {
        expect(isWithinSince('1970-01-01T00:00:00Z', 'all')).toBe(true);
    });

    it('filters by relative windows', () => {
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
        expect(isWithinSince(twoMinutesAgo, '5m')).toBe(true);
        expect(isWithinSince(tenMinutesAgo, '5m')).toBe(false);
        expect(isWithinSince(tenMinutesAgo, '1h')).toBe(true);
    });
});
