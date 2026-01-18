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
    setDateList
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

        const answer = await confirm("This will recalculate auto burst groups for photos in this date. Manual groups will be preserved.", "Recalculate Groups");
        if (answer) {
            lockRef.current = true;
            try {
                // Use default threshold (2 seconds) and min group size (3)
                const newGroups = await invokeWithErrorHandling(
                    "recalculate_grouping_in_date",
                    {
                        dateStr: currentDate,
                        thresholdSeconds: 2,
                        minGroupSize: 3
                    },
                    'dateOperations'
                );
                lockRef.current = false;
                logger.info('dateOperations', 'groups_recalculated', 'Burst groups recalculated for date', {
                    date: currentDate,
                    newGroups
                });
                message(`Created ${newGroups} burst group(s)`, "Groups Recalculated");
            } catch (error) {
                lockRef.current = false;
                throw error;
            }
        }
    }, [currentDate]);

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
        applyDateChanges
    };
}
