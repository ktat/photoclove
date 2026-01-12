import React from "react";
import RandomMessages from "./Footer/RandomMessages.jsx"
import { useUI } from "../context/UIContext.jsx";

function Footer(props) {
    const { footerMessages } = useUI();
    
    return <footer>
        <div id="footer-message">
            <span>&#x1f980;.｡o( </span>
            {Object.keys(footerMessages).length == 0
                ? <RandomMessages />
                : Object.keys(footerMessages).map((k, i) => {
                    return (<React.Fragment key={i}>
                        {i > 0 && " | "}
                        <span className={k}>
                            {footerMessages[k]}</span>
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