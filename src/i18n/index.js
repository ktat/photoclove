import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import English translations (default/fallback)
import enCommon from './locales/en/common.json';
import enModals from './locales/en/modals.json';
import enMessages from './locales/en/messages.json';
import enErrors from './locales/en/errors.json';
import enPreferences from './locales/en/preferences.json';
import enInsights from './locales/en/insights.json';
import enDirectoryMenu from './locales/en/directoryMenu.json';

// Import Japanese translations
import jaCommon from './locales/ja/common.json';
import jaModals from './locales/ja/modals.json';
import jaMessages from './locales/ja/messages.json';
import jaErrors from './locales/ja/errors.json';
import jaPreferences from './locales/ja/preferences.json';
import jaInsights from './locales/ja/insights.json';
import jaDirectoryMenu from './locales/ja/directoryMenu.json';

// Import French translations
import frCommon from './locales/fr/common.json';
import frModals from './locales/fr/modals.json';
import frMessages from './locales/fr/messages.json';
import frErrors from './locales/fr/errors.json';
import frPreferences from './locales/fr/preferences.json';
import frInsights from './locales/fr/insights.json';
import frDirectoryMenu from './locales/fr/directoryMenu.json';

// Import German translations
import deCommon from './locales/de/common.json';
import deModals from './locales/de/modals.json';
import deMessages from './locales/de/messages.json';
import deErrors from './locales/de/errors.json';
import dePreferences from './locales/de/preferences.json';
import deInsights from './locales/de/insights.json';
import deDirectoryMenu from './locales/de/directoryMenu.json';

// Import Chinese Simplified translations
import zhCNCommon from './locales/zh-CN/common.json';
import zhCNModals from './locales/zh-CN/modals.json';
import zhCNMessages from './locales/zh-CN/messages.json';
import zhCNErrors from './locales/zh-CN/errors.json';
import zhCNPreferences from './locales/zh-CN/preferences.json';
import zhCNInsights from './locales/zh-CN/insights.json';
import zhCNDirectoryMenu from './locales/zh-CN/directoryMenu.json';

// Import Chinese Traditional translations
import zhTWCommon from './locales/zh-TW/common.json';
import zhTWModals from './locales/zh-TW/modals.json';
import zhTWMessages from './locales/zh-TW/messages.json';
import zhTWErrors from './locales/zh-TW/errors.json';
import zhTWPreferences from './locales/zh-TW/preferences.json';
import zhTWInsights from './locales/zh-TW/insights.json';
import zhTWDirectoryMenu from './locales/zh-TW/directoryMenu.json';

// Import Spanish translations
import esCommon from './locales/es/common.json';
import esModals from './locales/es/modals.json';
import esMessages from './locales/es/messages.json';
import esErrors from './locales/es/errors.json';
import esPreferences from './locales/es/preferences.json';
import esInsights from './locales/es/insights.json';
import esDirectoryMenu from './locales/es/directoryMenu.json';

const resources = {
  en: {
    common: enCommon,
    modals: enModals,
    messages: enMessages,
    errors: enErrors,
    preferences: enPreferences,
    insights: enInsights,
    directoryMenu: enDirectoryMenu,
  },
  ja: {
    common: jaCommon,
    modals: jaModals,
    messages: jaMessages,
    errors: jaErrors,
    preferences: jaPreferences,
    insights: jaInsights,
    directoryMenu: jaDirectoryMenu,
  },
  fr: {
    common: frCommon,
    modals: frModals,
    messages: frMessages,
    errors: frErrors,
    preferences: frPreferences,
    insights: frInsights,
    directoryMenu: frDirectoryMenu,
  },
  de: {
    common: deCommon,
    modals: deModals,
    messages: deMessages,
    errors: deErrors,
    preferences: dePreferences,
    insights: deInsights,
    directoryMenu: deDirectoryMenu,
  },
  'zh-CN': {
    common: zhCNCommon,
    modals: zhCNModals,
    messages: zhCNMessages,
    errors: zhCNErrors,
    preferences: zhCNPreferences,
    insights: zhCNInsights,
    directoryMenu: zhCNDirectoryMenu,
  },
  'zh-TW': {
    common: zhTWCommon,
    modals: zhTWModals,
    messages: zhTWMessages,
    errors: zhTWErrors,
    preferences: zhTWPreferences,
    insights: zhTWInsights,
    directoryMenu: zhTWDirectoryMenu,
  },
  es: {
    common: esCommon,
    modals: esModals,
    messages: esMessages,
    errors: esErrors,
    preferences: esPreferences,
    insights: esInsights,
    directoryMenu: esDirectoryMenu,
  },
};

// Supported languages with display names
export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'modals', 'messages', 'errors', 'preferences', 'insights', 'directoryMenu'],

    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'photoclove_language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: false, // Avoid issues with SSR-like behavior
    },
  });

// Helper to change language and persist
export const changeLanguage = (langCode) => {
  i18n.changeLanguage(langCode);
  localStorage.setItem('photoclove_language', langCode);
};

// Helper to get current language
export const getCurrentLanguage = () => i18n.language || 'en';

export default i18n;
