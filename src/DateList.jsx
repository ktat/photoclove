function DateList(props) {
    return (
        <>
            <p>List of Date <a href="#" onClick={() => props.getDates()}>⟳</a></p>
            <div className="dateList">
                <ul>
                    {props.dateList.map((l, i) => {
                        let date = new Date(l.year + '/' + l.month + '/' + l.day).toLocaleString('default', { year: 'numeric', month: '2-digit', day: '2-digit' });
                        return (<li key={i} >
                            <a href="#" onClick={(e) => props.getPhotos(e, undefined)} data-date={date} data-page={props.datePage[date]}>
                                {date}
                            </a></li>)
                    })
                    }
                </ul>
            </div>
        </>
    );
}

export default DateList;