/* ============================================
   SIDEQUEST DIGITAL - Utility Helpers
   ============================================ */

import { DATE_CONFIG, CURRENCY_CONFIG } from '../config/constants.js';

/**
 * Format a date to a readable string
 * @param {Date|Object|string|number} date - Date to format (can be Firestore timestamp)
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = DATE_CONFIG.SHORT_OPTIONS) {
    if (!date) return '-';

    // Handle Firestore Timestamp
    const d = date.toDate ? date.toDate() : new Date(date);

    if (isNaN(d.getTime())) return '-';

    return d.toLocaleDateString(DATE_CONFIG.LOCALE, options);
}

/**
 * Format a date to long format
 * @param {Date|Object|string|number} date - Date to format
 * @returns {string} Long formatted date string
 */
export function formatDateLong(date) {
    return formatDate(date, DATE_CONFIG.LONG_OPTIONS);
}

/**
 * Format a date with time
 * @param {Date|Object|string|number} date - Date to format
 * @returns {string} Date and time string
 */
export function formatDateTime(date) {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '-';

    return d.toLocaleDateString(DATE_CONFIG.LOCALE, {
        ...DATE_CONFIG.SHORT_OPTIONS,
        ...DATE_CONFIG.TIME_OPTIONS
    });
}

/**
 * Get relative time string (e.g., "2 hours ago")
 * @param {Date|Object|string|number} date - Date to compare
 * @returns {string} Relative time string
 */
export function timeAgo(date) {
    if (!date) return '-';

    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '-';

    const seconds = Math.floor((new Date() - d) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

    return formatDate(d);
}

/**
 * Format a number as currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat(CURRENCY_CONFIG.LOCALE, CURRENCY_CONFIG.OPTIONS)
        .format(amount || 0);
}

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @param {number} maxLength - Maximum number of initials
 * @returns {string} Initials in uppercase
 */
export function getInitials(name, maxLength = 2) {
    if (!name || typeof name !== 'string') return '??';

    return name
        .split(' ')
        .map(word => word[0])
        .filter(Boolean)
        .slice(0, maxLength)
        .join('')
        .toUpperCase() || '??';
}

/**
 * Generate a URL-safe slug from text
 * @param {string} text - Text to convert
 * @returns {string} URL-safe slug
 */
export function generateSlug(text) {
    if (!text) return '';

    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')  // Remove non-word chars
        .replace(/[\s_-]+/g, '-')  // Replace spaces/underscores with hyphens
        .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 300) {
    let inThrottle;

    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));

    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * Check if an object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export function isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    if (typeof obj === 'string') return obj.trim() === '';
    return false;
}

/**
 * Get nested property from object using dot notation
 * @param {Object} obj - Object to search
 * @param {string} path - Property path (e.g., 'user.profile.name')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Property value or default
 */
export function getNestedValue(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined) return defaultValue;
        result = result[key];
    }

    return result === undefined ? defaultValue : result;
}

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to title case
 * @param {string} str - String to convert
 * @returns {string} Title case string
 */
export function toTitleCase(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Unique ID
 */
export function generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`;
}

/**
 * Parse URL query parameters
 * @param {string} url - URL string (optional, uses current URL)
 * @returns {Object} Object with query parameters
 */
export function parseQueryParams(url = window.location.href) {
    const params = {};
    const searchParams = new URL(url).searchParams;

    for (const [key, value] of searchParams) {
        params[key] = value;
    }

    return params;
}

/**
 * Build URL with query parameters
 * @param {string} baseUrl - Base URL
 * @param {Object} params - Query parameters
 * @returns {string} URL with query string
 */
export function buildUrl(baseUrl, params = {}) {
    const url = new URL(baseUrl, window.location.origin);

    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
            url.searchParams.set(key, value);
        }
    }

    return url.toString();
}

/**
 * Format file size to human readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if running on mobile device
 * @returns {boolean} True if mobile
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
}

/**
 * Check if running in standalone PWA mode
 * @returns {boolean} True if in PWA mode
 */
export function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise} Promise that resolves after duration
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Result of function
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await sleep(baseDelay * Math.pow(2, i));
            }
        }
    }

    throw lastError;
}

/**
 * Group array items by a key
 * @param {Array} array - Array to group
 * @param {string|Function} key - Key to group by
 * @returns {Object} Grouped object
 */
export function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(item);
        return groups;
    }, {});
}

/**
 * Sort array by multiple keys
 * @param {Array} array - Array to sort
 * @param {Array} keys - Array of sort keys (prefix with '-' for descending)
 * @returns {Array} Sorted array
 */
export function sortByKeys(array, keys) {
    return [...array].sort((a, b) => {
        for (const key of keys) {
            const desc = key.startsWith('-');
            const actualKey = desc ? key.slice(1) : key;
            const valA = getNestedValue(a, actualKey);
            const valB = getNestedValue(b, actualKey);

            if (valA < valB) return desc ? 1 : -1;
            if (valA > valB) return desc ? -1 : 1;
        }
        return 0;
    });
}

/**
 * Remove duplicate items from array
 * @param {Array} array - Array to dedupe
 * @param {string} key - Key to compare (for object arrays)
 * @returns {Array} Deduped array
 */
export function uniqueBy(array, key) {
    if (!key) {
        return [...new Set(array)];
    }

    const seen = new Set();
    return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}
