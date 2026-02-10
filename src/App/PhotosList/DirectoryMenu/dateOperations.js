/**
 * Date operations for DirectoryMenu
 * Handles date maintenance operations
 */
import { useCallback, useRef } from 'react';
import { logger } from "../../../services/LoggerService.js";
import { invokeWithErrorHandling } from "../../../services/TauriService.js";

/**
 * Hook for date maintenance operations
 */
export function useDateOperations({
    currentDate,
    setCurrentDateNum,
    dateNum,
    setDateNum,
    dateList,
    setDateList,
    config,
    dialog
}) {
    const lockRef = useRef(false);
    const lockThumbnailRef = useRef(false);

    /**
     * Create database entries for photos in the current date
     */
    const createDbInDate = useCallback(async () => {
        if (lockRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        const answer = await dialog.confirm({ title: 'Warning', message: 'This takes long time if you have many photos.', kind: 'warning' });
        if (answer) {
            lockRef.current = true;
            try {
                const data = await invokeWithErrorHandling(
                    "create_db_in_date",
                    { dateStr: currentDate },
                    'dateOperations',
                    { parseJson: true }
                );
                lockRef.current = false;
                setCurrentDateNum?.(data[currentDate.replace(/\//g, "-")]);
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, setCurrentDateNum, dialog]);

    /**
     * Move photos to directories based on their EXIF dates
     */
    const movePhotosToExifDate = useCallback(async () => {
        if (lockRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        const answer = await dialog.confirm({ title: 'Warning', message: 'This takes long time if you have many photos.', kind: 'warning' });
        if (answer) {
            lockRef.current = true;
            try {
                await invokeWithErrorHandling(
                    "move_photos_to_exif_date",
                    { dateStr: currentDate },
                    'dateOperations'
                );
                lockRef.current = false;
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, dialog]);

    /**
     * Create thumbnails for photos in the current date
     */
    const createThumbnails = useCallback(async () => {
        if (lockThumbnailRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        const answer = await dialog.confirm({ title: 'Warning', message: 'This takes long time if you have many photos.', kind: 'warning' });
        if (answer) {
            lockThumbnailRef.current = true;
            try {
                await invokeWithErrorHandling(
                    "create_thumbnails_in_date",
                    { dateStr: currentDate },
                    'dateOperations'
                );
                lockThumbnailRef.current = false;
            } catch (error) {
                lockThumbnailRef.current = false;
                throw error;
            }
        }
    }, [currentDate, dialog]);

    /**
     * Recalculate burst groups for photos in the current date
     */
    const recalculateGroupsInDate = useCallback(async () => {
        if (lockRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        // Use config values or defaults
        const thresholdSeconds = config?.grouping?.burst_threshold_seconds ?? 2;
        const minGroupSize = config?.grouping?.min_group_size ?? 2;

        const answer = await dialog.confirm({
            title: 'Recalculate Groups',
            message: `This will recalculate auto burst groups for photos in this date.\nThreshold: ${thresholdSeconds} seconds, Min group size: ${minGroupSize}\nManual groups will be preserved.`,
            kind: 'info',
        });
        if (answer) {
            lockRef.current = true;
            try {
                const newGroups = await invokeWithErrorHandling(
                    "recalculate_grouping_in_date",
                    {
                        dateStr: currentDate,
                        thresholdSeconds,
                        minGroupSize
                    },
                    'dateOperations'
                );
                lockRef.current = false;
                logger.info('dateOperations', 'groups_recalculated', 'Burst groups recalculated for date', {
                    date: currentDate,
                    thresholdSeconds,
                    minGroupSize,
                    newGroups
                });
                await dialog.message({ title: 'Groups Recalculated', message: `Created ${newGroups} burst group(s)`, kind: 'success' });
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, config, dialog]);

    /**
     * Run face detection for photos in the current date
     */
    const runFaceDetectionInDate = useCallback(async () => {
        if (lockRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        // Check if face detection models are available
        try {
            const statusJson = await invokeWithErrorHandling(
                "get_face_detection_model_status",
                {},
                'dateOperations',
                { parseJson: true }
            );

            if (!statusJson.is_ready) {
                await dialog.message({
                    title: 'Face Detection Not Ready',
                    message: "Face detection models are not available.\n\nTo use this feature:\n1. Go to Preferences (File menu \u2192 Preferences)\n2. Select the 'Face Detection' tab\n3. Download the required models\n4. Try again",
                    kind: 'warning',
                });
                return;
            }
        } catch (error) {
            await dialog.message({ title: 'Error', message: 'Failed to check face detection model status: ' + error, kind: 'error' });
            return;
        }

        const answer = await dialog.confirm({
            title: 'Run Face Detection',
            message: "This will run face detection for photos in this date.\nDetected faces will be stored for person recognition.",
            kind: 'info',
        });
        if (answer) {
            lockRef.current = true;
            try {
                const result = await invokeWithErrorHandling(
                    "run_face_detection_for_date",
                    { date: currentDate },
                    'dateOperations',
                    { parseJson: true }
                );
                lockRef.current = false;

                if (result.result === "no_photos" || result.result === "no_images") {
                    await dialog.message({ title: 'Face Detection', message: 'No photos found for face detection in this date.', kind: 'info' });
                } else {
                    logger.info('dateOperations', 'face_detection_started', 'Face detection job started for date', {
                        date: currentDate,
                        jobUnitId: result.job_unit_id,
                        photoCount: result.photo_count
                    });
                    await dialog.message({ title: 'Face Detection Started', message: `Face detection started for ${result.photo_count} photos. Check progress in footer.`, kind: 'success' });
                }
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, dialog]);

    /**
     * Run AI tagging for photos in the current date
     */
    const runAiTaggingInDate = useCallback(async () => {
        if (lockRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        // Check if AI tagging is enabled
        if (!config?.ai_tagging?.enabled) {
            await dialog.message({
                title: 'AI Tagging Not Enabled',
                message: "AI Auto-Tagging is not enabled.\n\nTo use this feature:\n1. Go to Preferences (File menu \u2192 Preferences)\n2. Select the 'AI Tagging' tab\n3. Enable 'AI Auto-Tagging'\n4. Save your settings",
                kind: 'warning',
            });
            return;
        }

        const answer = await dialog.confirm({
            title: 'Run AI Tagging',
            message: "This will run AI auto-tagging for photos in this date.\nTags will be prefixed with 'ai:' (e.g., ai:dog, ai:beach).",
            kind: 'info',
        });
        if (answer) {
            lockRef.current = true;
            try {
                const result = await invokeWithErrorHandling(
                    "run_ai_tagging_for_date",
                    { date: currentDate },
                    'dateOperations',
                    { parseJson: true }
                );
                lockRef.current = false;

                if (result.result === "no_photos" || result.result === "no_images") {
                    await dialog.message({ title: 'AI Tagging', message: 'No photos found for AI tagging in this date.', kind: 'info' });
                } else {
                    logger.info('dateOperations', 'ai_tagging_started', 'AI tagging job started for date', {
                        date: currentDate,
                        jobUnitId: result.job_unit_id,
                        photoCount: result.photo_count
                    });
                    await dialog.message({ title: 'AI Tagging Started', message: `AI tagging started for ${result.photo_count} photos. Check progress in footer.`, kind: 'success' });
                }
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, config, dialog]);

    /**
     * Sync photos in the current date to S3
     */
    const syncToS3InDate = useCallback(async () => {
        if (lockRef.current) {
            await dialog.message({ title: 'This operation is locked', message: 'Currently, this operation is locked. Please wait for a while', kind: 'warning' });
            return;
        }

        // Check if S3 backup is enabled
        if (!config?.s3?.enabled) {
            await dialog.message({
                title: 'S3 Backup Not Enabled',
                message: "S3 Backup is not enabled.\n\nTo use this feature:\n1. Go to Preferences (File menu \u2192 Preferences)\n2. Select the 'S3 Backup' tab\n3. Enable and configure S3 backup\n4. Save your settings",
                kind: 'warning',
            });
            return;
        }

        const answer = await dialog.confirm({
            title: 'Sync to S3',
            message: "This will sync all photos in this date to S3.\nPhotos will be uploaded to your configured S3 bucket.",
            kind: 'info',
        });
        if (answer) {
            lockRef.current = true;
            try {
                const result = await invokeWithErrorHandling(
                    "enqueue_s3_sync_by_date",
                    { date: currentDate },
                    'dateOperations',
                    { parseJson: true }
                );
                lockRef.current = false;

                if (result.result === "no_photos_to_sync") {
                    await dialog.message({ title: 'S3 Sync', message: 'No photos to sync in this date (all photos are already synced).', kind: 'info' });
                } else if (result.result === "started") {
                    logger.info('dateOperations', 's3_sync_started', 'S3 sync job started for date', {
                        date: currentDate,
                        jobUnitId: result.job_unit_id,
                        toSync: result.to_sync
                    });
                    await dialog.message({ title: 'S3 Sync Started', message: `S3 sync started for ${result.to_sync} photos. Check progress in footer.`, kind: 'success' });
                }
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, config, dialog]);

    /**
     * Apply date count changes from batch operation result to local state
     * @param {Object} dateChanges - Map of date -> count delta from backend
     */
    const applyDateChanges = useCallback((dateChanges) => {
        if (!dateNum || !setDateNum || !dateChanges) {
            return;
        }

        const updatedDateNum = { ...dateNum };

        for (const [date, delta] of Object.entries(dateChanges)) {
            updatedDateNum[date] = (updatedDateNum[date] || 0) + delta;

            if (updatedDateNum[date] <= 0) {
                delete updatedDateNum[date];
            }
        }

        setDateNum(updatedDateNum);

        if (setDateList && dateList) {
            const newDateList = [...dateList];
            setDateList(newDateList);
        }

        logger.info('dateOperations', 'date_counts_updated', 'Applied date changes from batch operation', {
            changedDates: Object.keys(dateChanges).length,
            dateChanges
        });
    }, [dateNum, setDateNum, dateList, setDateList]);

    return {
        createDbInDate,
        movePhotosToExifDate,
        createThumbnails,
        recalculateGroupsInDate,
        runAiTaggingInDate,
        runFaceDetectionInDate,
        syncToS3InDate,
        applyDateChanges
    };
}
