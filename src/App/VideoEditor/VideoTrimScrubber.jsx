/**
 * VideoTrimScrubber
 *
 * One source file: a seekable preview, a timeline showing every kept range, and
 * the controls that mark them.
 *
 * Marking is a two-step: park the playhead and press start, move on and press
 * end. Repeat anywhere else in the file to keep another piece. A start may not
 * land inside a range that is already kept, and an end that runs into one folds
 * the two together - see addRange in trimUtils.
 *
 * The player streams through the warp video server, which answers Range
 * requests; the asset protocol does not, and without them none of this can
 * seek.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getVideoStreamUrl } from '../../services/VideoService.js';
import { logger } from '../../services/LoggerService.js';
import VideoRangeList from './VideoRangeList.jsx';
import {
    addRange,
    effectiveRanges,
    formatClipTime,
    isInsideAnyRange,
    nextRangeStart,
    rangeContaining,
    MIN_SEGMENT_LENGTH_SEC
} from './trimUtils.js';

/** Arrow keys nudge the playhead by this much, Shift+arrow by the coarse step. */
const FINE_STEP_SEC = 0.1;
const COARSE_STEP_SEC = 1;

function VideoTrimScrubber({ source, onChange }) {
    const { t } = useTranslation(['directoryMenu']);
    const videoRef = useRef(null);
    const trackRef = useRef(null);
    const isSeekingRef = useRef(false);
    const [streamUrl, setStreamUrl] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    // True while playback is skipping the gaps between kept ranges.
    const [isRangePlayback, setIsRangePlayback] = useState(false);
    // Where the current mark started, once the user has pressed start.
    const [pendingStart, setPendingStart] = useState(null);

    const duration = source.duration_sec || 0;
    const ranges = effectiveRanges(source);
    const isWholeFile = source.ranges.length === 0;

    // The component is keyed on source.id, so a different file arrives as a
    // fresh mount and there is no previous URL to clear here.
    useEffect(() => {
        let cancelled = false;

        getVideoStreamUrl(source.path)
            .then((url) => {
                if (!cancelled) setStreamUrl(url);
            })
            .catch((error) => {
                if (cancelled) return;
                logger.error('VideoTrimScrubber', 'stream_url_failed',
                    'Failed to resolve video stream URL', { path: source.path, error: String(error) });
                setLoadError(String(error));
            });

        return () => { cancelled = true; };
    }, [source.path]);

    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(video.duration)) return;
        onChange({ ...source, duration_sec: video.duration });
    }, [source, onChange]);

    const seekTo = useCallback((seconds) => {
        const video = videoRef.current;
        if (!video) return;
        const clamped = Math.min(Math.max(seconds, 0), duration || video.duration || 0);
        video.currentTime = clamped;
        setCurrentTime(clamped);
    }, [duration]);

    // In range playback the gaps are skipped: whenever the playhead leaves a
    // kept range it jumps to the next one, and stops after the last.
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        setCurrentTime(video.currentTime);

        if (!isRangePlayback || isSeekingRef.current) return;
        if (rangeContaining(ranges, video.currentTime)) return;

        const next = nextRangeStart(ranges, video.currentTime);
        if (next == null) {
            video.pause();
            setIsRangePlayback(false);
            return;
        }
        // Guard the jump: seeking fires more timeupdates, and acting on those
        // before the seek lands would chain jumps through every later range.
        isSeekingRef.current = true;
        video.currentTime = next;
    }, [isRangePlayback, ranges]);

    const handleSeeked = useCallback(() => {
        isSeekingRef.current = false;
    }, []);

    const play = useCallback((rangesOnly) => {
        const video = videoRef.current;
        if (!video) return;
        setIsRangePlayback(rangesOnly);
        // Starting outside a kept range would immediately skip forward, so land
        // on the right piece first.
        if (rangesOnly && !rangeContaining(ranges, video.currentTime)) {
            const next = nextRangeStart(ranges, video.currentTime) ?? ranges[0]?.start_sec ?? 0;
            video.currentTime = next;
        }
        video.play().catch((error) => {
            logger.warn('VideoTrimScrubber', 'play_failed', 'Video playback was rejected',
                { path: source.path, error: String(error) });
        });
    }, [ranges, source.path]);

    const pause = useCallback(() => {
        videoRef.current?.pause();
    }, []);

    const markStart = useCallback(() => {
        setPendingStart(currentTime);
    }, [currentTime]);

    const markEnd = useCallback(() => {
        if (pendingStart == null) return;
        onChange({ ...source, ranges: addRange(source.ranges, pendingStart, currentTime) });
        setPendingStart(null);
    }, [pendingStart, currentTime, source, onChange]);

    const removeRange = useCallback((target) => {
        onChange({ ...source, ranges: source.ranges.filter((range) => range.id !== target.id) });
    }, [source, onChange]);

    /** Convert a pointer position on the track into a time offset. */
    const timeFromPointer = useCallback((event) => {
        const track = trackRef.current;
        if (!track || !duration) return 0;
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        return ratio * duration;
    }, [duration]);

    const handleTrackPointerDown = useCallback((event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        seekTo(timeFromPointer(event));
    }, [seekTo, timeFromPointer]);

    const handleTrackPointerMove = useCallback((event) => {
        // buttons is a bitmask; 1 means the primary button is still held.
        if (event.buttons & 1) seekTo(timeFromPointer(event));
    }, [seekTo, timeFromPointer]);

    const handleKeyDown = useCallback((event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = event.shiftKey ? COARSE_STEP_SEC : FINE_STEP_SEC;
        seekTo(currentTime + (event.key === 'ArrowRight' ? step : -step));
    }, [currentTime, seekTo]);

    const percent = (seconds) => (duration > 0 ? (seconds / duration) * 100 : 0);
    const fileName = source.path.replace(/^.+\//, '');
    // A start inside an existing range could only extend what is already kept.
    const canMarkStart = duration > 0 && !isInsideAnyRange(source.ranges, currentTime);
    const canMarkEnd = pendingStart != null
        && currentTime >= pendingStart + MIN_SEGMENT_LENGTH_SEC;

    return (
        <div style={{
            padding: 'var(--space-3)',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: 'var(--radius-sm)'
        }}>
            <div style={{
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                overflowWrap: 'anywhere'
            }}>
                {fileName}
                {source.recorded_at && (
                    <span style={{ marginLeft: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                        {new Date(source.recorded_at).toLocaleString()}
                    </span>
                )}
            </div>

            {loadError ? (
                <div style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                    {t('directoryMenu:videoMerge.loadFailed')}
                </div>
            ) : (
                <video
                    ref={videoRef}
                    src={streamUrl || undefined}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onSeeked={handleSeeked}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    style={{
                        width: '100%',
                        // Relative to the viewport so several sources still fit
                        // in the modal on a short screen.
                        maxHeight: '40vh',
                        backgroundColor: 'var(--color-bg-base)',
                        borderRadius: 'var(--radius-sm)'
                    }}
                />
            )}

            {/* Timeline: the whole file as the track, every kept range banded. */}
            <div
                ref={trackRef}
                onPointerDown={handleTrackPointerDown}
                onPointerMove={handleTrackPointerMove}
                style={{
                    position: 'relative',
                    height: 'var(--space-6)',
                    marginTop: 'var(--space-3)',
                    backgroundColor: 'var(--color-bg-muted)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    touchAction: 'none'
                }}
            >
                {ranges.map((range) => (
                    <div
                        key={range.id}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${percent(range.start_sec)}%`,
                            width: `${Math.max(percent(range.end_sec - range.start_sec), 0)}%`,
                            backgroundColor: 'var(--color-primary-selected)'
                        }}
                    />
                ))}

                {pendingStart != null && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${percent(pendingStart)}%`,
                        width: 'var(--space-1)',
                        backgroundColor: 'var(--color-warning)'
                    }} />
                )}

                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${percent(currentTime)}%`,
                    width: 'var(--space-1)',
                    backgroundColor: 'var(--color-text-primary)'
                }} />
            </div>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)'
            }}>
                {isPlaying ? (
                    <button onClick={pause}>⏸ {t('directoryMenu:videoMerge.pause')}</button>
                ) : (
                    <>
                        <button onClick={() => play(false)} disabled={!streamUrl}>
                            ▶ {t('directoryMenu:videoMerge.playAll')}
                        </button>
                        <button onClick={() => play(true)} disabled={!streamUrl || ranges.length === 0}>
                            ▶ {t('directoryMenu:videoMerge.playRanges')}
                        </button>
                    </>
                )}
                <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                    {formatClipTime(currentTime)} / {formatClipTime(duration)}
                </span>
            </div>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)'
            }}>
                <button onClick={markStart} disabled={!canMarkStart}>
                    {t('directoryMenu:videoMerge.markStart')}
                </button>
                <button onClick={markEnd} disabled={!canMarkEnd}>
                    {t('directoryMenu:videoMerge.markEnd')}
                </button>
                {pendingStart != null && (
                    <>
                        <span style={{ fontFamily: 'monospace', color: 'var(--color-warning)' }}>
                            {t('directoryMenu:videoMerge.marking', {
                                start: formatClipTime(pendingStart)
                            })}
                        </span>
                        <button onClick={() => setPendingStart(null)}>
                            {t('directoryMenu:videoMerge.cancelMark')}
                        </button>
                    </>
                )}
                {pendingStart == null && !canMarkStart && duration > 0 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                        {t('directoryMenu:videoMerge.startInsideRange')}
                    </span>
                )}
            </div>

            <VideoRangeList
                ranges={ranges}
                isWholeFile={isWholeFile}
                onSeek={seekTo}
                onRemove={removeRange}
            />
        </div>
    );
}

export default VideoTrimScrubber;
