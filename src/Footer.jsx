import React, { useState, useEffect } from "react";
import RandomMessages from "./RandomMessages.jsx"

function Footer(props) {
    return <footer>
        <div id="footer-message">
            <span>&#x1f980;.｡o( </span>
            {Object.keys(props.footerMessages).length == 0
                ? <RandomMessages />
                : Object.keys(props.footerMessages).map((k, i) => {
                    return (<React.Fragment key={i}>
                        {i > 0 && " | "}
                        <span className={k}>
                            {props.footerMessages[k]}</span>
                    </React.Fragment>)
                })}
            <span> )</span>
        </div>
        <div id="copyright">
            PhotoClove &copy; ktat
        </div>
    </footer>
}

export default Footer;