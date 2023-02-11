import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

function DateList(props) {
    const [dateList, setDateList] = useState([]);
    const [dateNum, setDateNum] = useState({});

    useEffect((e) => {
        getDates();
        props.setReloadDates(false);
    }, [props.reloadDates])

    const getDates = () => {
        invoke("get_dates").then((r) => {
            let l = JSON.parse(r);
            setDateList(l);
            let datesStr = "";
            l.map((v, i) => {
                datesStr += v.year + "-" + v.month + "-" + v.day;
                if (i !== l.length - 1) {
                    datesStr += ",";
                }
            });
            invoke("get_dates_num", { datesStr: datesStr }).then((r) => {
                let l = JSON.parse(r);
                setDateNum(l);
            });
        });
    };
    return (
        <>
            <p>List of Date <a href="#" onClick={() => getDates()}>⟳</a></p>
            <div className="dateList">
                <ul>
                    {dateList.map((l, i) => {
                        let date = new Date(l.year + '/' + l.month + '/' + l.day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                        return (<li key={i} >
                            <a href="#" onClick={(e) => {
                                props.setCurrentDate(date);
                                props.toggleImporter(false);
                            }
                            } data-date={date} data-page={props.datePage[date]}>
                                {date}
                                {dateNum[date.replace(/\//g, "-")] !== undefined ? " (" + dateNum[date.replace(/\//g, "-")] + ")" : ""}
                            </a></li>)
                    })
                    }
                </ul>
            </div>
        </>
    );
}

export default DateList;