/**
 * Date operations for DirectoryMenu
 * Handles date maintenance operations
 */
import { useCallback, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import { logger } from "../../../services/LoggerService.js";

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
                const r = await invoke("create_db_in_date", { dateStr: currentDate });
                lockRef.current = false;
                const data = JSON.parse(r);
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
                await invoke("move_photos_to_exif_date", { dateStr: currentDate });
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
                await invoke("create_thumbnails_in_date", { dateStr: currentDate });
                lockThumbnailRef.current = false;
            } catch (error) {
                lockThumbnailRef.current = false;
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
        applyDateChanges
    };
}
