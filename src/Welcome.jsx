import { invoke } from "@tauri-apps/api/core";
import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import WelcomeImage from "./WelcomeImage.jsx";
import { supportedLanguages, changeLanguage, getCurrentLanguage } from './i18n';
import './Welcome.css';

function Welcome(props) {
    const { t } = useTranslation(['messages', 'common']);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const [showLanguageSelect, setShowLanguageSelect] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState(getCurrentLanguage());

    useEffect((e) => {
        props.setWelcomeImage(WelcomeImage(props.config));
    }, [props.config]);

    useEffect((e) => {
        setTimeout(() => {
            setShowSplash(false);
            // Show language selection on first run (useCount === 0)
            if (props.useCount === 0) {
                setShowLanguageSelect(true);
            } else {
                setShowWelcome(true);
            }
        }, props.useCount > 0 ? 0 : 1000);
    }, []);

    function getAndSaveConfig(useCount) {
        props.setUseCount(useCount);
        invoke("get_config", {}).then((r) => {
            const json = JSON.parse(r);
            json.use_count = useCount;
            invoke("save_config", { config: json });
        })
    }

    function handleLanguageSelect(langCode) {
        setSelectedLanguage(langCode);
        changeLanguage(langCode);
    }

    function handleLanguageConfirm() {
        setShowLanguageSelect(false);
        setShowWelcome(true);
        // Set use_count to 1 after language selection
        getAndSaveConfig(1);
    }

    return (
        <div id="welcome-container">
            {showWelcome && <h1>{t('messages:welcome.title')}</h1>}
            {showSplash &&
                <div className="welcome-splash">
                    <div className="splash-container">
                        <img className="splash" src={props.welcomeImage} />
                    </div>
                </div>
            }
            {showLanguageSelect &&
                <div id="welcome">
                    <div className="welcome language-select">
                        <h1 className="language-title">{t('common:language.select')}</h1>
                        <div className="language-icon">&#x1F310;</div>
                        <div className="language-buttons">
                            {supportedLanguages.map((lang) => (
                                <button
                                    key={lang.code}
                                    className={`language-btn ${selectedLanguage === lang.code ? 'selected' : ''}`}
                                    onClick={() => handleLanguageSelect(lang.code)}
                                >
                                    <span className="lang-flag">{lang.flag}</span>
                                    <span className="lang-name">{lang.name}</span>
                                </button>
                            ))}
                        </div>
                        <button
                            className="language-confirm-btn"
                            onClick={handleLanguageConfirm}
                        >
                            {t('common:button.next')} →
                        </button>
                    </div>
                </div>
            }
            {showWelcome &&
                <div id="welcome">
                    <div className="welcome">
                        <div className="photo-clove">
                            &#x1f980;
                        </div>
                        <div className="introduce">
                            {t('messages:welcome.description')}
                        </div>
                        <ol className="tutorial">
                            <li><span className={"useCount-" + props.useCount}>{t('messages:welcome.step1')} <a href="#"
                                onClick={() => {
                                    getAndSaveConfig(3);
                                    props.togglePreferences(true);
                                }
                                }>{t('messages:welcome.step1Link')}</a>.</span></li>
                            <li>
                                <span className={"useCount-" + (props.useCount == 2 ? 2 : 0)}>{t('messages:welcome.step2a')} <a href="#"
                                    onClick={() => {
                                        getAndSaveConfig(3);
                                        props.toggleImporter(true);
                                    }
                                    }>{t('messages:welcome.step2aLink')}</a>.
                                </span>
                                <br />
                                <span className={"useCount-" + (props.useCount == 3 ? 3 : 0)}>{t('messages:welcome.step2b')} <a href="#"
                                    onClick={() => {
                                        getAndSaveConfig(3);
                                        props.togglePreferences(false);
                                    }
                                    }>{t('messages:welcome.step2bLink')}</a>.
                                </span>
                            </li>
                        </ol>
                    </div>
                </div>
            }
        </div>
    )
}

export default Welcome;
