import { useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { usePhoto } from '../context/PhotoContext.jsx';
import { useUI } from '../context/UIContext.jsx';
import { useError } from '../context/ErrorContext.jsx';

export const useDateNavigation = () => {
  const { 
    dateList, 
    updateDateList, 
    updateDateNum, 
    updateHideLoading 
  } = usePhoto();
  const { addFooterMessage } = useUI();
  const { handleTauriError } = useError();

  const getDates = useCallback(() => {
    updateHideLoading(false);
    
    invoke("get_dates").then((r) => {
      let l = JSON.parse(r);
      updateDateList(l);
      let datesStr = "";
      const newDateNum = {};
      let n = 0;
      const promises = [];
      
      l.map((v, i) => {
        n += 1;
        datesStr += v.year;
        if (v.month < 10) {
          datesStr += "-0" + v.month;
        } else {
          datesStr += "-" + v.month;
        }
        if (v.day < 10) {
          datesStr += "-0" + v.day;
        } else {
          datesStr += "-" + v.day;
        }
        if (i !== l.length - 1 && n < 20) {
          datesStr += ",";
        }
        if (n === 20 || i === l.length - 1) {
          const reqDatesStr = datesStr;
          n = 0;
          datesStr = "";
          
          const promise = new Promise((resolve, reject) => {
            invoke("get_dates_num", { datesStr: reqDatesStr }).then((r) => {
              console.log(r);
              let l = JSON.parse(r);
              return resolve(l);
            }).catch((e) => { 
              console.log(e);
              handleTauriError(e, "Getting date numbers");
              reject(e);
            });
          });
          promises.push(promise);
        }
      });
      
      Promise.all(promises).then((results) => {
        results.map((result) => {
          Object.keys(result).map((k) => {
            newDateNum[k] = result[k];
          });
          updateDateNum(newDateNum);
          updateHideLoading(true);
        });
      }).catch((error) => {
        handleTauriError(error, "Processing date numbers");
        updateHideLoading(true);
      });
    }).catch((error) => {
      handleTauriError(error, "Getting dates");
      updateHideLoading(true);
    });
  }, [updateDateList, updateDateNum, updateHideLoading, handleTauriError]);

  return {
    dateList,
    getDates
  };
};