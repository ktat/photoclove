/**
 * VideoTrimScrubber
 *
 * Preview + trim UI for a single clip of a merge. The player streams through
 * the warp video server so the <video> element can actually seek, letting the
 * user park the playhead anywhere and mark it as the in or out point.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getVideoStreamUrl } from '../../services/VideoService.js';
import { logger } from '../../services/LoggerService.js';
import { formatClipTime } from './trimUtils.js';

/** Arrow keys nudge the playhead by this much, Shift+arrow by the coarse step. */
const FINE_STEP_SEC = 0.1;
const COARSE_STEP_SEC = 1;
/** Smallest keepable clip, so a handle can never cross (or meet) the other. */
const MIN_CLIP_LENGTH_SEC = 0.1;

function VideoTrimScrubber({ clip, onChange }) {
    const { t } = useTranslation(['directoryMenu']);
    const videoRef = useRef(null);
    const trackRef = useRef(null);
    // Which handle a pointer drag is currently moving ('start' | 'end' | 'playhead').
    const draggingRef = useRef(null);
    const [streamUrl, setStreamUrl] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    const duration = clip.duration_sec || 0;

    // The component is keyed on clip.path, so a different clip arrives as a
    // fresh mount and there is no previous URL to clear here.
    useEffect(() => {
        let cancelled = false;

        getVideoStreamUrl(clip.path)
            .then((url) => {
                if (!cancelled) setStreamUrl(url);
            })
            .catch((error) => {
                if (cancelled) return;
                logger.error('VideoTrimScrubber', 'stream_url_failed',
                    'Failed to resolve video stream URL', { path: clip.path, error: String(error) });
                setLoadError(String(error));
            });

        return () => { cancelled = true; };
    }, [clip.path]);

    // The duration only becomes known once the browser has the metadata, and
    // an untrimmed clip's out point has to follow it to cover the whole file.
    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(video.duration)) return;
        onChange({
            ...clip,
            duration_sec: video.duration,
            end_sec: clip.end_sec > 0 ? Math.min(clip.end_sec, video.duration) : video.duration
        });
    }, [clip, onChange]);

    const seekTo = useCallback((seconds) => {
        const video = videoRef.current;
        if (!video) return;
        const clamped = Math.min(Math.max(seconds, 0), duration || video.duration || 0);
        video.currentTime = clamped;
        setCurrentTime(clamped);
    }, [duration]);

    // Playback is confined to the kept range so the preview shows what the
    // merged output will actually contain.
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.currentTime > clip.end_sec) {
            video.pause();
            video.currentTime = clip.end_sec;
        }
        setCurrentTime(video.currentTime);
    }, [clip.end_sec]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            // Restarting from outside the range would immediately re-pause.
            if (video.currentTime < clip.start_sec || video.currentTime >= clip.end_sec) {
                video.currentTime = clip.start_sec;
            }
            video.play().catch((error) => {
                logger.warn('VideoTrimScrubber', 'play_failed', 'Video playback was rejected',
                    { path: clip.path, error: String(error) });
            });
        } else {
            video.pause();
        }
    }, [clip.start_sec, clip.end_sec, clip.path]);

    const setTrimPoint = useCallback((which) => {
        if (which === 'start') {
            onChange({ ...clip, start_sec: Math.min(currentTime, clip.end_sec - MIN_CLIP_LENGTH_SEC) });
        } else {
            onChange({ ...clip, end_sec: Math.max(currentTime, clip.start_sec + MIN_CLIP_LENGTH_SEC) });
        }
    }, [clip, currentTime, onChange]);

    /** Convert a pointer position on the track into a time offset. */
    const timeFromPointer = useCallback((event) => {
        const track = trackRef.current;
        if (!track || !duration) return 0;
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        return ratio * duration;
    }, [duration]);

    const applyDrag = useCallback((event) => {
        const target = draggingRef.current;
        if (!target) return;
        const time = timeFromPointer(event);
        // Seek to where the handle actually landed, not where the pointer was,
        // so the preview frame matches the cut once the clamp kicks in.
        if (target === 'start') {
            const start = Math.min(time, clip.end_sec - MIN_CLIP_LENGTH_SEC);
            onChange({ ...clip, start_sec: start });
            seekTo(start);
        } else if (target === 'end') {
            const end = Math.max(time, clip.start_sec + MIN_CLIP_LENGTH_SEC);
            onChange({ ...clip, end_sec: end });
            seekTo(end);
        } else {
            seekTo(time);
        }
    }, [clip, onChange, seekTo, timeFromPointer]);

    const startDrag = useCallback((target) => (event) => {
        event.preventDefault();
        // The handles sit inside the track, so without this the track's own
        // pointerdown would fire second and turn a handle drag into a seek.
        event.stopPropagation();
        draggingRef.current = target;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        applyDrag(event);
    }, [applyDrag]);

    const handlePointerMove = useCallback((event) => {
        if (draggingRef.current) applyDrag(event);
    }, [applyDrag]);

    const endDrag = useCallback((event) => {
        if (!draggingRef.current) return;
        draggingRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }, []);

    const handleKeyDown = useCallback((event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = event.shiftKey ? COARSE_STEP_SEC : FINE_STEP_SEC;
        seekTo(currentTime + (event.key === 'ArrowRight' ? step : -step));
    }, [currentTime, seekTo]);

    // The handles are the only way to set a trim point with a pointer, so they
    // need an equivalent for keyboard and screen reader users.
    const handleTrimKeyDown = useCallback((which) => (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const delta = (event.shiftKey ? COARSE_STEP_SEC : FINE_STEP_SEC)
            * (event.key === 'ArrowRight' ? 1 : -1);
        if (which === 'start') {
            const start = Math.max(
                Math.min(clip.start_sec + delta, clip.end_sec - MIN_CLIP_LENGTH_SEC), 0);
            onChange({ ...clip, start_sec: start });
            seekTo(start);
        } else {
            const end = Math.min(
                Math.max(clip.end_sec + delta, clip.start_sec + MIN_CLIP_LENGTH_SEC), duration);
            onChange({ ...clip, end_sec: end });
            seekTo(end);
        }
    }, [clip, duration, onChange, seekTo]);

    const percent = (seconds) => (duration > 0 ? (seconds / duration) * 100 : 0);
    const fileName = clip.path.replace(/^.+\//, '');

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
            }}>{fileName}</div>

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
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    style={{
                        width: '100%',
                        // Relative to the viewport so several clips still fit in
                        // the modal on a short screen.
                        maxHeight: '40vh',
                        backgroundColor: 'var(--color-bg-base)',
                        borderRadius: 'var(--radius-sm)'
                    }}
                />
            )}

            {/* Timeline: full clip as the track, the kept range highlighted. */}
            <div
                ref={trackRef}
                onPointerDown={startDrag('playhead')}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
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
                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${percent(clip.start_sec)}%`,
                    width: `${Math.max(percent(clip.end_sec - clip.start_sec), 0)}%`,
                    backgroundColor: 'var(--color-primary-selected)'
                }} />

                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${percent(currentTime)}%`,
                    width: 'var(--space-1)',
                    backgroundColor: 'var(--color-text-primary)'
                }} />

                {['start', 'end'].map((which) => (
                    <div
                        key={which}
                        role="slider"
                        aria-label={t(`directoryMenu:videoMerge.${which === 'start' ? 'trimStart' : 'trimEnd'}`)}
                        aria-valuenow={which === 'start' ? clip.start_sec : clip.end_sec}
                        aria-valuemin={0}
                        aria-valuemax={duration}
                        tabIndex={0}
                        onKeyDown={handleTrimKeyDown(which)}
                        onPointerDown={startDrag(which)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: `${percent(which === 'start' ? clip.start_sec : clip.end_sec)}%`,
                            width: 'var(--space-2)',
                            marginLeft: 'calc(var(--space-2) / -2)',
                            backgroundColor: 'var(--color-primary)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'ew-resize',
                            touchAction: 'none'
                        }}
                    />
                ))}
            </div>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)',
                fontSize: 'var(--font-size-sm)'
            }}>
                <button onClick={togglePlay} disabled={!streamUrl}>
                    {isPlaying ? `⏸ ${t('directoryMenu:videoMerge.pause')}` : `▶ ${t('directoryMenu:videoMerge.play')}`}
                </button>
                <button onClick={() => setTrimPoint('start')} disabled={!streamUrl}>
                    {t('directoryMenu:videoMerge.setStartHere')}
                </button>
                <button onClick={() => setTrimPoint('end')} disabled={!streamUrl}>
                    {t('directoryMenu:videoMerge.setEndHere')}
                </button>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                    {formatClipTime(currentTime)} / {formatClipTime(duration)}
                </span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                    {t('directoryMenu:videoMerge.keeping')}: {formatClipTime(clip.start_sec)} – {formatClipTime(clip.end_sec)}
                </span>
            </div>
        </div>
    );
}

export default VideoTrimScrubber;
