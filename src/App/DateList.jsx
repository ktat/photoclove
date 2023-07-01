import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { message } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";

const unlisten = {};

function DateList(props) {
    const [selectedStyle, setSelectedStyle] = useState({});

    useEffect((e) => {
        props.getDates();
    }, [])

    return (
        <>
            <p>List of Date <a href="#" onClick={() => props.getDates()}>⟳</a></p>
            <div className="dateList">
                <ul>
                    {props.dateList.map((l, i) => {
                        let date = new Date(l.year + '/' + l.month + '/' + l.day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                        return (<li key={i} style={{ listStyle: selectedStyle["li-" + date] || "none" }}>
                            <a href="#" style={{ color: selectedStyle["a-" + date] || "#646cff" }} onClick={(e) => {
                                setSelectedStyle({ ["a-" + date]: "#ccc", ["li-" + date]: "square" }); //  outside url('...')
                                console.log(selectedStyle);
                                props.setCurrentDate(date);
                                props.setShowPhotoDisplay(false);
                                props.toggleImporter(false);
                            }
                            } data-date={date} data-page={props.datePage[date]}>
                                {date}
                                {props.dateNum[date.replace(/\//g, "-")] !== undefined ? " (" + props.dateNum[date.replace(/\//g, "-")] + ")" : ""}
                            </a></li>)
                    })
                    }
                </ul>
            </div>
        </>
    );
}

export default DateList;