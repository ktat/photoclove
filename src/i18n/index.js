import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import English translations (default/fallback)
import enCommon from './locales/en/common.json';
import enModals from './locales/en/modals.json';
import enMessages from './locales/en/messages.json';
import enErrors from './locales/en/errors.json';
import enPreferences from './locales/en/preferences.json';

// Import Japanese translations
import jaCommon from './locales/ja/common.json';
import jaModals from './locales/ja/modals.json';
import jaMessages from './locales/ja/messages.json';
import jaErrors from './locales/ja/errors.json';
import jaPreferences from './locales/ja/preferences.json';

// Import French translations
import frCommon from './locales/fr/common.json';
import frModals from './locales/fr/modals.json';
import frMessages from './locales/fr/messages.json';
import frErrors from './locales/fr/errors.json';
import frPreferences from './locales/fr/preferences.json';

// Import German translations
import deCommon from './locales/de/common.json';
import deModals from './locales/de/modals.json';
import deMessages from './locales/de/messages.json';
import deErrors from './locales/de/errors.json';
import dePreferences from './locales/de/preferences.json';

const resources = {
  en: {
    common: enCommon,
    modals: enModals,
    messages: enMessages,
    errors: enErrors,
    preferences: enPreferences,
  },
  ja: {
    common: jaCommon,
    modals: jaModals,
    messages: jaMessages,
    errors: jaErrors,
    preferences: jaPreferences,
  },
  fr: {
    common: frCommon,
    modals: frModals,
    messages: frMessages,
    errors: frErrors,
    preferences: frPreferences,
  },
  de: {
    common: deCommon,
    modals: deModals,
    messages: deMessages,
    errors: deErrors,
    preferences: dePreferences,
  },
};

// Supported languages with display names
export const supportedLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'modals', 'messages', 'errors', 'preferences'],

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
