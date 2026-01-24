import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import fileUrl from "../../../PathUtil.jsx";
import { logger } from '../../../services/LoggerService.js';
import styles from '../PhotoOption.module.css';

function PhotoInfo(props) {
    const [photoInfo, setPhotoInfo] = useState({});
    const [comment, setComment] = useState("");

    useEffect((e) => {
        if (props.currentPhotoPath && props.currentPhotoPath !== "" && props.showSideMenu) {
            getPhotoInfo(props.currentPhotoPath).then((photoInfo) => {
            });
        }
    }, [props.currentPhotoPath, props.showSideMenu])

    async function getPhotoInfo(path) {
        if (props.imgCacheMap[path] && props.imgCacheMap[path][1]) {
            setPhotoInfo(props.imgCacheMap[path][1])
        } else if (props.showSideMenu) {
            await invoke("get_photo_info", { pathStr: path }).then((r) => {
                let data = JSON.parse(r);

                logger.debug('PhotoInfo', 'get_photo_info_response', 'Received photo info', {
                    is_trashed: data.is_trashed,
                    has_meta: !!data.meta,
                    has_exif: !!data.exif,
                    original_path: data.original_path,
                    current_path: data.current_path
                });

                if (data.meta) {
                    if (data.meta.star && data.meta.star.data > 0) {
                        const newStar = [false, false, false, false, false];
                        for (let i = 0; i < data.meta.star.data; i++) {
                            newStar[i] = true;
                        }
                        props.setStar(newStar);
                    } else {
                        props.setStar([false, false, false, false, false]);
                    }
                    if (data.meta.comment) {
                        setComment(data.meta.comment.data);
                    } else {
                        setComment("");
                    }
                } else {
                    props.setStar([false, false, false, false, false]);
                    setComment("");
                }
                setPhotoInfo(data);
            });
        }
    };

    function getCurrentStarRate() {
        return getStarRate(props.star);
    }

    function getStarRate(star) {
        let starIndex = 0;
        for (let i = 0; i < 5; i++) {
            if (star[i]) {
                starIndex = i + 1;
            } else {
                break;
            }
        }
        return starIndex;
    }

    function toggleStar(i) {
        const newStar = [false, false, false, false, false];
        const currentStarRate = getCurrentStarRate();

        // If clicking on an empty star or a star that's not the last filled one
        if (!props.star[i] || (i < 4 && props.star[i + 1])) {
            // Fill all stars up to and including the clicked one
            for (let j = 0; j <= i; j++) {
                newStar[j] = true;
            }
        } else if (props.star[i] && (i === 4 || !props.star[i + 1])) {
            // If clicking on the last filled star, toggle it off
            for (let j = 0; j < i; j++) {
                newStar[j] = true;
            }
            // newStar[i] remains false
        }

        const newStarRate = getStarRate(newStar);
        logger.info('PhotoInfo', 'star_clicked', 'Star rating changed', {
            index: i,
            currentRate: currentStarRate,
            newRate: newStarRate
        });

        invoke("save_star", { pathStr: props.currentPhotoPath, starNum: newStarRate });
        props.setStar(newStar);
    }

    function saveComment() {
        invoke("save_comment", { pathStr: props.currentPhotoPath, commentStr: comment });

        // Notify parent component about comment update
        if (props.onCommentUpdate) {
            props.onCommentUpdate(props.currentPhotoPath, comment && comment.trim() !== "");
        }
    }

    function renderCloudBackupStatus() {
        const storageSync = photoInfo.meta?.storage_sync;
        const googlePhotoUrl = photoInfo.meta?.google_photo_url;
        let syncData = null;

        if (storageSync) {
            try {
                syncData = JSON.parse(storageSync);
            } catch (e) {
                logger.error('PhotoInfo', 'parse_storage_sync', 'Failed to parse storage_sync', { error: e.message });
            }
        }

        const providers = [
            { key: 'aws_s3', name: 'AWS S3', icon: '☁️' },
            { key: 'wasabi', name: 'Wasabi', icon: '☁️' },
            { key: 'minio', name: 'MinIO', icon: '☁️' },
            { key: 'cloudflare_r2', name: 'Cloudflare R2', icon: '☁️' },
            { key: 'digitalocean', name: 'DO Spaces', icon: '☁️' },
            { key: 'custom', name: 'S3 Storage', icon: '☁️' },
        ];

        const syncedProviders = providers.filter(p => syncData && syncData[p.key]);
        const hasGooglePhotos = !!googlePhotoUrl;

        if (!syncedProviders.length && !hasGooglePhotos) {
            return (
                <div className={styles['backup-status-empty']}>
                    No cloud backup configured
                </div>
            );
        }

        return (
            <div className={styles['backup-status-list']}>
                {syncedProviders.map(provider => {
                    const info = syncData[provider.key];
                    const syncedAt = info.synced_at ? new Date(info.synced_at).toLocaleDateString() : '';
                    return (
                        <div key={provider.key} className={styles['backup-status-item']}>
                            <span className={styles['backup-provider']}>
                                {provider.icon} {provider.name}: <span className={styles['backup-synced']}>✓ Synced</span>
                                {syncedAt && <span className={styles['backup-date']}> ({syncedAt})</span>}
                            </span>
                            <button
                                className={styles['copy-url-btn']}
                                onClick={() => {
                                    writeText(info.url);
                                    props.addFooterMessage("clipboard", "S3 URL copied to clipboard", false, 5000);
                                }}
                                title="Copy S3 URL"
                            >
                                📋
                            </button>
                        </div>
                    );
                })}
                {hasGooglePhotos && (
                    <div className={styles['backup-status-item']}>
                        <span className={styles['backup-provider']}>
                            📤 Google Photos: <span className={styles['backup-synced']}>✓ Uploaded</span>
                        </span>
                        <button
                            className={styles['copy-url-btn']}
                            onClick={() => {
                                writeText(googlePhotoUrl);
                                props.addFooterMessage("clipboard", "Google Photos URL copied to clipboard", false, 5000);
                            }}
                            title="Copy URL"
                        >
                            📋
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={styles['info-tab']}>
            <div className={styles['photo-info-table-wrapper']}>
                <table className={styles['photo-info-table']}>
                    <tbody>
                        <tr><th>File Name</th>
                            <td>
                                <a href="#" onClick={() => {
                                    // Copy trash path if trashed, otherwise original path
                                    const pathToCopy = photoInfo.is_trashed
                                        ? photoInfo.current_path
                                        : props.currentPhotoPath;
                                    writeText(pathToCopy);
                                    props.addFooterMessage("clipboard", "Copy file path to clipboard", false, 5000);
                                }}>📋</a>
                                <a
                                    onMouseEnter={() => {
                                        const displayPath = photoInfo.is_trashed
                                            ? `${photoInfo.current_path} (trashed)`
                                            : props.currentPhotoPath;
                                        props.addFooterMessage("current_phtoo_path", "File Path: " + displayPath, false, 10000)
                                    }}>
                                    {props.currentPhotoPath.replace(/^.+\//, '')}
                                </a>
                                <a href="#" onClick={(e) => {
                                    e.preventDefault();
                                    // Open trash path if trashed, otherwise original path
                                    const pathToOpen = photoInfo.is_trashed
                                        ? photoInfo.current_path
                                        : props.currentPhotoPath;
                                    openUrl(fileUrl(pathToOpen));
                                }}>🚀</a>
                            </td></tr>
                        <tr><th>ISO</th><td>{photoInfo.exif ? photoInfo.exif.iso : ""}</td></tr>
                        <tr><th>FNumber</th><td>{photoInfo.exif ? photoInfo.exif.fnumber : ""}</td></tr>
                        <tr><th>Shutter Speed</th><td>{photoInfo.exif ? photoInfo.exif.exposure_time : ""}</td></tr>
                        <tr><th>LensModel</th><td>{photoInfo.exif ? photoInfo.exif.lens_model : ""}</td></tr>
                        <tr><th>LensMake</th><td>{photoInfo.exif ? photoInfo.exif.lens_make : ""}</td></tr>
                        <tr><th>Make</th><td>{photoInfo.exif ? photoInfo.exif.make : ""}</td></tr>
                        <tr><th>Model</th><td>{photoInfo.exif ? photoInfo.exif.model : ""}</td></tr>
                        <tr><th>Date & Time</th><td>{photoInfo.exif ? photoInfo.exif.date_time : ""}</td></tr>
                        <tr><th>Focal Length</th><td>{photoInfo.exif ?
                            photoInfo.exif.focal_length == photoInfo.exif.focal_length_in35mm_film
                                ? photoInfo.exif.focal_length
                                : photoInfo.exif.focal_length + "(" + photoInfo.exif.focal_length_in35mm_film + ")" : ""}
                        </td></tr>
                        <tr><th>Digital Zoom Ratio</th><td>{photoInfo.exif ? photoInfo.exif.digital_zoom_ratio : ""}</td></tr>
                        <tr><th>Exposure Mode</th><td>{photoInfo.exif ? photoInfo.exif.exposure_mode : ""}</td></tr>
                        <tr><th>WhiteBalance Mode</th><td>{photoInfo.exif ? photoInfo.exif.white_balance_mode : ""}</td></tr>
                        <tr><th>Orientation</th><td>{photoInfo.exif ? photoInfo.exif.orientation : ""}</td></tr>
                        <tr><th>Google Photos URL</th><td>{photoInfo.meta && photoInfo.meta.google_photo_url ? <a href={photoInfo.meta.google_photo_url} target="_blank" rel="noopener noreferrer">link</a> : ""}</td></tr>
                    </tbody>
                </table>
            </div>

            {/* Cloud Backup Status Section */}
            {photoInfo.meta && (
                <div className={styles['cloud-backup-section']}>
                    <div className={styles['section-header']}>Cloud Backup</div>
                    {renderCloudBackupStatus()}
                </div>
            )}

            {/* Only show stars/comment forms for non-import and non-trash photos */}
            {!props.isImportMode && !props.isTrashMode && (
                <>
                    <div>
                        Stars:
                        <span className="star">
                            {
                                [0, 1, 2, 3, 4].map((v, i) => {
                                    return <a key={i} href="#" value={v} onClick={(e) => { e.preventDefault(); toggleStar(v) }}>{props.star[i] ? "★" : "☆"}</a>
                                })
                            }
                        </span>
                    </div>
                    <div className="comment">
                        Comment:<br />
                        <textarea
                            onChange={(e) => setComment(e.target.value)}
                            value={comment}>
                        </textarea>
                        <button onClick={() => saveComment()}>SAVE</button>
                    </div>
                </>
            )}

            {/* Show informational message for import mode */}
            {props.isImportMode && (
                <div style={{ padding: "10px", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", fontStyle: "italic" }}>
                    Note: Stars and comments are not available for photos in import mode.
                    Import photos to your library to add metadata.
                </div>
            )}

            {/* Show informational message for trash mode */}
            {props.isTrashMode && (
                <div style={{ padding: "10px", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)", fontStyle: "italic" }}>
                    Note: Stars and comments cannot be edited for photos in trash.
                    Restore the photo to edit metadata.
                </div>
            )}
        </div>
    );
}

export default PhotoInfo;
