/**
 * Date operations for DirectoryMenu
 * Handles date maintenance operations
 */
import { useCallback, useRef } from 'react';
import { message, confirm } from "@tauri-apps/plugin-dialog";
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
    config
}) {
    const lockRef = useRef(false);
    const lockThumbnailRef = useRef(false);

    /**
     * Create database entries for photos in the current date
     */
    const createDbInDate = useCallback(async () => {
        if (lockRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
            return;
        }

        const answer = await confirm("This takes long time if you have many photos.", "Warning");
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
    }, [currentDate, setCurrentDateNum]);

    /**
     * Move photos to directories based on their EXIF dates
     */
    const movePhotosToExifDate = useCallback(async () => {
        if (lockRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
            return;
        }

        const answer = await confirm("This takes long time if you have many photos.", "Warning");
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
    }, [currentDate]);

    /**
     * Create thumbnails for photos in the current date
     */
    const createThumbnails = useCallback(async () => {
        if (lockThumbnailRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
            return;
        }

        const answer = await confirm("This takes long time if you have many photos.", "Warning");
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
    }, [currentDate]);

    /**
     * Recalculate burst groups for photos in the current date
     */
    const recalculateGroupsInDate = useCallback(async () => {
        if (lockRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
            return;
        }

        // Use config values or defaults
        const thresholdSeconds = config?.grouping?.burst_threshold_seconds ?? 2;
        const minGroupSize = config?.grouping?.min_group_size ?? 2;

        const answer = await confirm(
            `This will recalculate auto burst groups for photos in this date.\n` +
            `Threshold: ${thresholdSeconds} seconds, Min group size: ${minGroupSize}\n` +
            `Manual groups will be preserved.`,
            "Recalculate Groups"
        );
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
                message(`Created ${newGroups} burst group(s)`, "Groups Recalculated");
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, config]);

    /**
     * Run face detection for photos in the current date
     */
    const runFaceDetectionInDate = useCallback(async () => {
        if (lockRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
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
                message(
                    "Face detection models are not available.\n\n" +
                    "To use this feature:\n" +
                    "1. Go to Preferences (File menu → Preferences)\n" +
                    "2. Select the 'Face Detection' tab\n" +
                    "3. Download the required models\n" +
                    "4. Try again",
                    "Face Detection Not Ready"
                );
                return;
            }
        } catch (error) {
            message("Failed to check face detection model status: " + error, "Error");
            return;
        }

        const answer = await confirm(
            "This will run face detection for photos in this date.\n" +
            "Detected faces will be stored for person recognition.",
            "Run Face Detection"
        );
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
                    message("No photos found for face detection in this date.", "Face Detection");
                } else {
                    logger.info('dateOperations', 'face_detection_started', 'Face detection job started for date', {
                        date: currentDate,
                        jobUnitId: result.job_unit_id,
                        photoCount: result.photo_count
                    });
                    message(`Face detection started for ${result.photo_count} photos. Check progress in footer.`, "Face Detection Started");
                }
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate]);

    /**
     * Run AI tagging for photos in the current date
     */
    const runAiTaggingInDate = useCallback(async () => {
        if (lockRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
            return;
        }

        // Check if AI tagging is enabled
        if (!config?.ai_tagging?.enabled) {
            message(
                "AI Auto-Tagging is not enabled.\n\n" +
                "To use this feature:\n" +
                "1. Go to Preferences (File menu → Preferences)\n" +
                "2. Select the 'AI Tagging' tab\n" +
                "3. Enable 'AI Auto-Tagging'\n" +
                "4. Save your settings",
                "AI Tagging Not Enabled"
            );
            return;
        }

        const answer = await confirm(
            "This will run AI auto-tagging for photos in this date.\n" +
            "Tags will be prefixed with 'ai:' (e.g., ai:dog, ai:beach).",
            "Run AI Tagging"
        );
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
                    message("No photos found for AI tagging in this date.", "AI Tagging");
                } else {
                    logger.info('dateOperations', 'ai_tagging_started', 'AI tagging job started for date', {
                        date: currentDate,
                        jobUnitId: result.job_unit_id,
                        photoCount: result.photo_count
                    });
                    message(`AI tagging started for ${result.photo_count} photos. Check progress in footer.`, "AI Tagging Started");
                }
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, config]);

    /**
     * Sync photos in the current date to S3
     */
    const syncToS3InDate = useCallback(async () => {
        if (lockRef.current) {
            message("Currently, this operation is locked. Please wait for a while", "This operation is locked");
            return;
        }

        // Check if S3 backup is enabled
        if (!config?.s3?.enabled) {
            message(
                "S3 Backup is not enabled.\n\n" +
                "To use this feature:\n" +
                "1. Go to Preferences (File menu → Preferences)\n" +
                "2. Select the 'S3 Backup' tab\n" +
                "3. Enable and configure S3 backup\n" +
                "4. Save your settings",
                "S3 Backup Not Enabled"
            );
            return;
        }

        const answer = await confirm(
            "This will sync all photos in this date to S3.\n" +
            "Photos will be uploaded to your configured S3 bucket.",
            "Sync to S3"
        );
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
                    message("No photos to sync in this date (all photos are already synced).", "S3 Sync");
                } else if (result.result === "started") {
                    logger.info('dateOperations', 's3_sync_started', 'S3 sync job started for date', {
                        date: currentDate,
                        jobUnitId: result.job_unit_id,
                        toSync: result.to_sync
                    });
                    message(`S3 sync started for ${result.to_sync} photos. Check progress in footer.`, "S3 Sync Started");
                }
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate, config]);

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
