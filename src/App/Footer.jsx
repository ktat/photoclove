import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import RandomMessages from "./Footer/RandomMessages.jsx"
import { useUI } from "../context/UIContext.jsx";
import { logger } from "../services/LoggerService.js";
import './Footer.css';

function Footer({ onRecoveryQueueClick }) {
    const { footerMessages } = useUI();
    const [recoveryCount, setRecoveryCount] = useState(0);

    // Fetch recovery queue count
    const fetchRecoveryCount = useCallback(async () => {
        try {
            const count = await invoke("get_recovery_pending_count");
            setRecoveryCount(count);
        } catch (err) {
            logger.error('Footer', 'recovery_count_error', 'Failed to fetch recovery count', { error: err });
        }
    }, []);

    useEffect(() => {
        fetchRecoveryCount();
        // Poll every 30 seconds
        const interval = setInterval(fetchRecoveryCount, 30000);
        return () => clearInterval(interval);
    }, [fetchRecoveryCount]);

    // Re-fetch when operations complete (listen for events)
    useEffect(() => {
        const handleRefresh = () => fetchRecoveryCount();
        window.addEventListener('recovery-queue-changed', handleRefresh);
        return () => window.removeEventListener('recovery-queue-changed', handleRefresh);
    }, [fetchRecoveryCount]);

    const handleRecoveryClick = () => {
        if (onRecoveryQueueClick && recoveryCount > 0) {
            onRecoveryQueueClick();
        }
    };

    const hasRecoveryItems = recoveryCount > 0;
    // Filter out empty/undefined values
    const validMessages = Object.entries(footerMessages).filter(([, v]) => v != null && v !== '');
    const hasFooterMessages = validMessages.length > 0;

    return (
        <footer>
            <div id="footer-message">
                {hasRecoveryItems ? (
                    <span
                        className="recovery-warning"
                        onClick={handleRecoveryClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleRecoveryClick()}
                    >
                        <span className="crab">&#x1f980;</span>
                        <span className="warning-icon">&#x1f4ef;</span>
                        <span>&lt; </span>
                        <span className="message">
                            {recoveryCount} failed operation{recoveryCount !== 1 ? 's' : ''}
                        </span>
                    </span>
                ) : (
                    <>
                        <span>&#x1f980;.｡o( </span>
                        {!hasFooterMessages
                            ? <RandomMessages />
                            : validMessages.map(([k, v], i) => (
                                <React.Fragment key={k}>
                                    {i > 0 && " | "}
                                    <span className={k}>{v}</span>
                                </React.Fragment>
                            ))}
                        <span> )</span>
                    </>
                )}
            </div>
            <div id="copyright">
                PhotoClove &copy; ktat
            </div>
        </footer>
    );
}

export default Footer;
