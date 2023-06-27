import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { message } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";

const unlisten = {};

function DateList(props) {
    const [selectedStyle, setSelectedStyle] = useState({});

    useEffect((e) => {
        getDates();
        props.setReloadDates(false);
    }, [props.reloadDates])

    const getDates = () => {
        invoke("get_dates").then((r) => {
            let l = JSON.parse(r);
            props.setDateList(l);
            let datesStr = "";
            const newDateNum = {};
            let n = 0;
            const promises = [];
            l.map((v, i) => {
                n += 1;
                datesStr += v.year + "-" + v.month + "-" + v.day;
                if (i !== l.length - 1 && n < 20) {
                    datesStr += ",";
                }
                if (n == 20 || i == l.length - 1) {
                    const reqDatesStr = datesStr;
                    n = 0;
                    datesStr = "";
                    const promise = new Promise((resolve, reject) => {
                        invoke("get_dates_num", { datesStr: reqDatesStr }).then((r) => {
                            let l = JSON.parse(r);
                            return resolve(l);
                        }).catch((e) => { console.log(e) });
                    });
                    promises.push(promise);
                }
            });
            Promise.all(promises).then((results) => {
                results.map((result) => {
                    Object.keys(result).map((k) => {
                        newDateNum[k] = result[k];
                    })
                    props.setDateNum(newDateNum);
                });
            })
        });
    };
    return (
        <>
            <p>List of Date <a href="#" onClick={() => getDates()}>⟳</a></p>
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