/**
 * Format date according to locale
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale code (en, ja, fr, de)
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, locale = 'en', options = {}) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Map our locale codes to Intl locale codes
  const localeMap = {
    en: 'en-US',
    ja: 'ja-JP',
    fr: 'fr-FR',
    de: 'de-DE',
  };

  const intlLocale = localeMap[locale] || locale;

  // Default options for different formats
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  return dateObj.toLocaleDateString(intlLocale, { ...defaultOptions, ...options });
};

/**
 * Format date in ISO format (YYYY-MM-DD)
 * @param {Date|string|number} date - Date to format
 * @returns {string} ISO formatted date string
 */
export const formatDateISO = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toISOString().split('T')[0];
};

/**
 * Format date with time
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale code
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (date, locale = 'en') => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const localeMap = {
    en: 'en-US',
    ja: 'ja-JP',
    fr: 'fr-FR',
    de: 'de-DE',
  };

  const intlLocale = localeMap[locale] || locale;

  return dateObj.toLocaleString(intlLocale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format relative date (today, yesterday, etc.)
 * @param {Date|string|number} date - Date to format
 * @param {string} locale - Locale code
 * @param {function} t - Translation function
 * @returns {string} Relative or formatted date string
 */
export const formatRelativeDate = (date, locale = 'en', t) => {
  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(dateObj);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) {
    return t ? t('date.today') : 'Today';
  }

  if (dateOnly.getTime() === yesterday.getTime()) {
    return t ? t('date.yesterday') : 'Yesterday';
  }

  return formatDate(date, locale);
};

export default {
  formatDate,
  formatDateISO,
  formatDateTime,
  formatRelativeDate,
};
