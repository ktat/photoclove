function PhotosListMini() {
    return <></>;
    // todo
    return (
        <div id="photos-list-mini">
            <div className="row1">◁</div>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v, i) => {
                return <div className="row2" key={i}>
                    <img src="/bird.jpg" alt={"photo-" + i} />
                </div>
            })}
            <div className="row1">▷</div>
        </div>
    )
}

export default PhotosListMini;