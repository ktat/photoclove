import { useCallback, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { usePhoto } from '../context/PhotoContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { useError } from '../context/ErrorContext.jsx';
import { logger } from '../services/LoggerService.js';

export const useDateNavigation = () => {
  const {
    dateList,
    updateDateList,
    updateDateNum,
    updateHideLoading
  } = usePhoto();
  const { addFooterMessage } = useUI();
  const { handleTauriError } = useError();
  const isLoadingRef = useRef(false);

  const getDates = useCallback(() => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      logger.debug('useDateNavigation', 'get_dates_skipped', 'Skipping duplicate getDates call');
      return;
    }
    
    isLoadingRef.current = true;
    updateHideLoading(false);
   
    invoke("get_dates").then((r) => {
      let l = JSON.parse(r);
      updateDateList(l);
      
      // Build comma-separated string of all dates for single request
      const datesArray = l.map((v) => {
        const month = v.month < 10 ? `0${v.month}` : v.month;
        const day = v.day < 10 ? `0${v.day}` : v.day;
        return `${v.year}-${month}-${day}`;
      });
      const datesStr = datesArray.join(",");
      
      // Make single request for all dates (backend is now optimized)
      logger.debug('useDateNavigation', 'get_dates_num_request', 'Requesting date numbers', {
        dateCount: l.length,
        sampleDates: datesArray.slice(0, 5)
      });
      
      invoke("get_dates_num", { datesStr }).then((r) => {
        logger.debug('useDateNavigation', 'get_dates_num_success', 'Retrieved all date numbers', {
          dateCount: l.length
        });
        const dateNumData = JSON.parse(r);
        updateDateNum(dateNumData);
        updateHideLoading(true);
        isLoadingRef.current = false;
      }).catch((error) => {
        logger.error('useDateNavigation', 'get_dates_num_failed', 'Failed to get date numbers', {
          error: error.toString(),
          dateCount: l.length
        });
        handleTauriError(error, "Getting date numbers");
        updateHideLoading(true);
        isLoadingRef.current = false;
      });
    }).catch((error) => {
      handleTauriError(error, "Getting dates");
      updateHideLoading(true);
      isLoadingRef.current = false;
    });
  }, [updateDateList, updateDateNum, updateHideLoading, handleTauriError]);

  return {
    dateList,
    getDates
  };
};
