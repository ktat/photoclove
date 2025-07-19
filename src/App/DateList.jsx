import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { message } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import Scrollable from "../Scrollable.jsx";
import '../scrollable.css';
import { usePhoto } from "../context/PhotoContext.jsx";
import { logger } from "../services/LoggerService.js";

const unlisten = {};

function DateList(props) {
    const {
        dateList,
        datePage,
        dateNum,
        hideLoading,
        updateCurrentDate,
        updateShowPhotoDisplay,
        recentPhotosMode,
        updateRecentPhotosMode
    } = usePhoto();
    
    const [selectedStyle, setSelectedStyle] = useState({});

    useEffect((e) => {
        props.getDates();
    }, [])


    return (
        <>
            <p className="dateListTitle">List of Date <a href="#" onClick={() => props.getDates()}>⟳</a></p>
            <div style={{ display: hideLoading ? "none" : "inline-block" }}>
                <div className="dateListLoading-crub" style={{ display: hideLoading ? "none" : "inline-block" }}>
                    &#129408;
                </div>
                <div className="dateListLoading-container">
                    {["l", "o", "a", "d", "i", "n", "g"].map((l, i) => {
                        return (<div className="dateListLoading" key={i}>{l}</div>);
                    })}
                </div>
                <div className="dateListLoading-crub" style={{ display: hideLoading ? "none" : "inline-block" }}>
                    &#129408;
                </div>
            </div>
            <div className="dateList">
                <Scrollable>
                    <ul>
                        <li style={{ listStyle: recentPhotosMode ? "square" : "none" }}>
                            <a href="#" 
                               style={{ 
                                   color: recentPhotosMode ? "#ccc" : "#646cff",
                                   fontWeight: "bold"
                               }} 
                               onClick={(e) => {
                                   e.preventDefault();
                                   setSelectedStyle({});
                                   updateRecentPhotosMode(true);
                                   updateShowPhotoDisplay({});
                                   props.toggleImporter(false);
                               }}>
                                Recent Photos
                            </a>
                        </li>
                        {dateList.map((l, i) => {
                            let date = new Date(l.year + '/' + l.month + '/' + l.day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                            return (dateNum[date.replace(/\//g, "-")]) > 0 && (<li key={i} style={{ listStyle: selectedStyle["li-" + date] || "none" }}>
                                <a href="#" style={{ color: selectedStyle["a-" + date] || "#646cff" }} onClick={(e) => {
                                    e.preventDefault();
                                    setSelectedStyle({ ["a-" + date]: "#ccc", ["li-" + date]: "square" }); //  outside url('...')
                                    logger.debug('DateList', 'date_click', 'Date clicked', { date });
                                    updateRecentPhotosMode(false);
                                    updateCurrentDate(date);
                                    updateShowPhotoDisplay({});
                                    props.toggleImporter(false);
                                }
                                } data-date={date} data-page={datePage[date]}>
                                    {date}
                                    {dateNum[date.replace(/\//g, "-")] !== undefined ? " (" + dateNum[date.replace(/\//g, "-")] + ")" : ""}
                                </a></li>);
                        })
                        }
                    </ul>
                </Scrollable>
            </div>
        </>
    );
}

export default DateList;
