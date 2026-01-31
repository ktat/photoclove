/**
 * Format number according to locale
 * @param {number} num - Number to format
 * @param {string} locale - Locale code (en, ja, fr, de)
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, locale = 'en', options = {}) => {
  if (typeof num !== 'number' || isNaN(num)) {
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

  return num.toLocaleString(intlLocale, options);
};

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @param {string} locale - Locale code
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes, locale = 'en') => {
  if (typeof bytes !== 'number' || isNaN(bytes)) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${formatNumber(size, locale, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
};

/**
 * Format percentage
 * @param {number} value - Value (0-1 or 0-100)
 * @param {string} locale - Locale code
 * @param {boolean} isDecimal - Whether value is decimal (0-1) or percentage (0-100)
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, locale = 'en', isDecimal = true) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '';
  }

  const localeMap = {
    en: 'en-US',
    ja: 'ja-JP',
    fr: 'fr-FR',
    de: 'de-DE',
  };

  const intlLocale = localeMap[locale] || locale;
  const percentValue = isDecimal ? value : value / 100;

  return percentValue.toLocaleString(intlLocale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
};

export default {
  formatNumber,
  formatFileSize,
  formatPercent,
};
