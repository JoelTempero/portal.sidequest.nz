/* ============================================
   SIDEQUEST DIGITAL - Logging Service
   ============================================ */

/**
 * Log levels
 */
export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * Current log level (set based on environment)
 */
let currentLogLevel = LOG_LEVELS.INFO;

/**
 * Whether to send logs to remote service
 */
let remoteLoggingEnabled = false;

/**
 * Remote logging endpoint
 */
let remoteEndpoint = null;

/**
 * Buffer for batching remote logs
 */
let logBuffer = [];

/**
 * Max buffer size before flush
 */
const MAX_BUFFER_SIZE = 10;

/**
 * Flush interval in ms
 */
const FLUSH_INTERVAL = 30000;

/**
 * Flush timer
 */
let flushTimer = null;

/**
 * Check if running in development
 */
const isDevelopment = () => {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.local');
};

/**
 * Format timestamp
 */
const formatTimestamp = () => {
    return new Date().toISOString();
};

/**
 * Format log message
 */
const formatMessage = (level, context, message, data) => {
    return {
        timestamp: formatTimestamp(),
        level,
        context,
        message,
        data,
        url: window.location.href,
        userAgent: navigator.userAgent
    };
};

/**
 * Get level name
 */
const getLevelName = (level) => {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'UNKNOWN';
};

/**
 * Get console method for level
 */
const getConsoleMethod = (level) => {
    switch (level) {
        case LOG_LEVELS.DEBUG: return console.debug;
        case LOG_LEVELS.INFO: return console.info;
        case LOG_LEVELS.WARN: return console.warn;
        case LOG_LEVELS.ERROR: return console.error;
        default: return console.log;
    }
};

/**
 * Get console style for level
 */
const getConsoleStyle = (level) => {
    switch (level) {
        case LOG_LEVELS.DEBUG:
            return 'color: #888; font-style: italic;';
        case LOG_LEVELS.INFO:
            return 'color: #3b82f6;';
        case LOG_LEVELS.WARN:
            return 'color: #f59e0b; font-weight: bold;';
        case LOG_LEVELS.ERROR:
            return 'color: #ef4444; font-weight: bold;';
        default:
            return '';
    }
};

/**
 * Output to console
 */
const outputToConsole = (level, context, message, data) => {
    if (level < currentLogLevel) return;

    const consoleMethod = getConsoleMethod(level);
    const style = getConsoleStyle(level);
    const levelName = getLevelName(level);
    const timestamp = new Date().toLocaleTimeString();

    if (isDevelopment()) {
        // Detailed output in development
        const prefix = `%c[${timestamp}] [${levelName}] [${context}]`;
        if (data !== undefined) {
            consoleMethod(prefix, style, message, data);
        } else {
            consoleMethod(prefix, style, message);
        }
    } else {
        // Minimal output in production
        if (level >= LOG_LEVELS.WARN) {
            if (data !== undefined) {
                consoleMethod(`[${levelName}]`, message, data);
            } else {
                consoleMethod(`[${levelName}]`, message);
            }
        }
    }
};

/**
 * Send logs to remote endpoint
 */
const sendToRemote = async (logs) => {
    if (!remoteLoggingEnabled || !remoteEndpoint || logs.length === 0) {
        return;
    }

    try {
        await fetch(remoteEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ logs }),
            keepalive: true
        });
    } catch (error) {
        // Silently fail for remote logging
        console.error('Failed to send logs to remote:', error);
    }
};

/**
 * Add to buffer and flush if needed
 */
const addToBuffer = (logEntry) => {
    if (!remoteLoggingEnabled) return;

    logBuffer.push(logEntry);

    if (logBuffer.length >= MAX_BUFFER_SIZE) {
        flushBuffer();
    }
};

/**
 * Flush log buffer
 */
const flushBuffer = () => {
    if (logBuffer.length === 0) return;

    const logsToSend = [...logBuffer];
    logBuffer = [];
    sendToRemote(logsToSend);
};

/**
 * Start flush timer
 */
const startFlushTimer = () => {
    if (flushTimer) return;

    flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL);
};

/**
 * Stop flush timer
 */
const stopFlushTimer = () => {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
    }
};

/**
 * Log function
 */
const log = (level, context, message, data) => {
    // Output to console
    outputToConsole(level, context, message, data);

    // Add to remote buffer if error or higher
    if (level >= LOG_LEVELS.ERROR) {
        const logEntry = formatMessage(getLevelName(level), context, message, data);
        addToBuffer(logEntry);
    }
};

/**
 * Create a logger instance for a specific context
 * @param {string} context - Logger context (e.g., 'Auth', 'Leads', 'Projects')
 * @returns {Object} Logger instance
 */
export function createLogger(context) {
    return {
        debug: (message, data) => log(LOG_LEVELS.DEBUG, context, message, data),
        info: (message, data) => log(LOG_LEVELS.INFO, context, message, data),
        warn: (message, data) => log(LOG_LEVELS.WARN, context, message, data),
        error: (message, data) => log(LOG_LEVELS.ERROR, context, message, data),

        /**
         * Log a timed operation
         */
        time: (label) => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                console.time(`[${context}] ${label}`);
            }
            return {
                end: () => {
                    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                        console.timeEnd(`[${context}] ${label}`);
                    }
                }
            };
        },

        /**
         * Log a group of related messages
         */
        group: (label, collapsed = true) => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                if (collapsed) {
                    console.groupCollapsed(`[${context}] ${label}`);
                } else {
                    console.group(`[${context}] ${label}`);
                }
            }
            return {
                end: () => {
                    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                        console.groupEnd();
                    }
                }
            };
        },

        /**
         * Log a table
         */
        table: (data, columns) => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                console.table(data, columns);
            }
        }
    };
}

/**
 * Configure the logger
 * @param {Object} options - Configuration options
 */
export function configureLogger(options = {}) {
    const {
        level = isDevelopment() ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN,
        remoteLogging = false,
        endpoint = null
    } = options;

    currentLogLevel = level;
    remoteLoggingEnabled = remoteLogging;
    remoteEndpoint = endpoint;

    if (remoteLogging && endpoint) {
        startFlushTimer();
    } else {
        stopFlushTimer();
    }
}

/**
 * Set log level
 * @param {number} level - Log level from LOG_LEVELS
 */
export function setLogLevel(level) {
    currentLogLevel = level;
}

/**
 * Get current log level
 * @returns {number} Current log level
 */
export function getLogLevel() {
    return currentLogLevel;
}

/**
 * Flush any pending logs
 */
export function flush() {
    flushBuffer();
}

/**
 * Log an error with stack trace
 * @param {string} context - Error context
 * @param {Error} error - Error object
 * @param {Object} additionalData - Additional data to log
 */
export function logError(context, error, additionalData = {}) {
    const logger = createLogger(context);
    logger.error(error.message, {
        name: error.name,
        stack: error.stack,
        ...additionalData
    });
}

/**
 * Create an error boundary logger
 * @param {string} context - Component/section context
 * @returns {Function} Error handler
 */
export function createErrorBoundary(context) {
    return (error) => {
        logError(context, error);

        // Return false to let error propagate, true to suppress
        return false;
    };
}

/**
 * Performance logger for measuring operations
 * @param {string} context - Operation context
 * @returns {Object} Performance logger
 */
export function createPerformanceLogger(context) {
    const marks = new Map();

    return {
        /**
         * Start timing an operation
         */
        start: (label) => {
            marks.set(label, performance.now());
        },

        /**
         * End timing and log result
         */
        end: (label) => {
            const startTime = marks.get(label);
            if (startTime !== undefined) {
                const duration = performance.now() - startTime;
                marks.delete(label);

                const logger = createLogger(context);
                logger.debug(`${label} completed in ${duration.toFixed(2)}ms`);

                return duration;
            }
            return 0;
        },

        /**
         * Measure an async operation
         */
        measure: async (label, fn) => {
            const start = performance.now();
            try {
                return await fn();
            } finally {
                const duration = performance.now() - start;
                const logger = createLogger(context);
                logger.debug(`${label} completed in ${duration.toFixed(2)}ms`);
            }
        }
    };
}

// Initialize based on environment
configureLogger({
    level: isDevelopment() ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN
});

// Flush on page unload
window.addEventListener('beforeunload', flush);

// Global error handler
window.addEventListener('error', (event) => {
    logError('Global', event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    logError('Promise', event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
});

// Default export for convenience
export default {
    LOG_LEVELS,
    createLogger,
    configureLogger,
    setLogLevel,
    getLogLevel,
    logError,
    flush
};
