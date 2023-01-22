function PhotoInfo(props) {
    return (
        <div className={props.class}>
            <p>Photo Info</p>
            <div>
                {props.path && (
                    <table>
                        <tbody>
                            <tr><th>File Name</th><td>{props.path.replace(/^.+\//, '')}</td></tr>
                            <tr><th>ISO</th><td>{props.photoInfo.ISO}</td></tr>
                            <tr><th>FNumber</th><td>{props.photoInfo.FNumber}</td></tr>
                            <tr><th>LensModel</th><td>{props.photoInfo.LensModel}</td></tr>
                            <tr><th>LensMake</th><td>{props.photoInfo.LensMake}</td></tr>
                            <tr><th>Make</th><td>{props.photoInfo.Make}</td></tr>
                            <tr><th>Model</th><td>{props.photoInfo.Model}</td></tr>
                            <tr><th>Date & Time</th><td>{props.photoInfo.DateTime}</td></tr>
                        </tbody>
                    </table>
                )}
            </div>
        </div >
    );
}

export default PhotoInfo;