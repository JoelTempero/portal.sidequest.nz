// Client-side caching utility with TTL support
const CACHE_PREFIX = 'sq_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {any|null} - Cached data or null if expired/missing
 */
export function getCached(key) {
    try {
        const item = localStorage.getItem(CACHE_PREFIX + key);
        if (!item) return null;

        const { data, expiry } = JSON.parse(item);
        if (Date.now() > expiry) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return data;
    } catch (e) {
        console.warn('[Cache] Error reading:', key, e);
        return null;
    }
}

/**
 * Set cached data with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in ms (default: 5 minutes)
 */
export function setCache(key, data, ttl = DEFAULT_TTL) {
    try {
        const item = {
            data,
            expiry: Date.now() + ttl
        };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
        console.warn('[Cache] Error writing:', key, e);
        // Clear old cache entries if storage is full
        if (e.name === 'QuotaExceededError') {
            clearExpiredCache();
        }
    }
}

/**
 * Remove specific cache entry
 * @param {string} key - Cache key
 */
export function removeCache(key) {
    localStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * Clear all expired cache entries
 */
export function clearExpiredCache() {
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
            try {
                const item = JSON.parse(localStorage.getItem(key));
                if (item.expiry < now) {
                    keysToRemove.push(key);
                }
            } catch (e) {
                keysToRemove.push(key);
            }
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[Cache] Cleared', keysToRemove.length, 'expired entries');
}

/**
 * Clear all cache entries
 */
export function clearAllCache() {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log('[Cache] Cleared all', keysToRemove.length, 'entries');
}

/**
 * Cached fetch with automatic caching
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Async function to fetch data
 * @param {number} ttl - Time to live in ms
 * @returns {Promise<any>} - Cached or fresh data
 */
export async function cachedFetch(key, fetchFn, ttl = DEFAULT_TTL) {
    const cached = getCached(key);
    if (cached !== null) {
        console.log('[Cache] Hit:', key);
        return cached;
    }

    console.log('[Cache] Miss:', key);
    const data = await fetchFn();
    setCache(key, data, ttl);
    return data;
}
