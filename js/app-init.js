/* ============================================
   SIDEQUEST DIGITAL - App Initialization
   Main entry point that bootstraps the application
   ============================================ */

// Configuration
import { FEATURES } from './config/constants.js';

// State Management
import {
    initializeTheme,
    clearSubscriptions,
    subscribe
} from './services/state.js';

// Authentication
import {
    initAuthListener,
    requiresAuth,
    handleAuthRedirect,
    updateLastLogin
} from './services/auth.js';

// Services
import { subscribeToLeads, loadLeads } from './services/leads.js';
import { subscribeToProjects, loadProjects } from './services/projects.js';
import { subscribeToActivity } from './services/activity.js';

// Components
import { showLoading } from './components/loaders.js';
import { initModalHandlers } from './components/modal.js';

// Utils
import { createLogger, configureLogger, LOG_LEVELS } from './utils/logger.js';

const logger = createLogger('App');

/**
 * Initialize the application
 */
async function initApp() {
    logger.info('Initializing Sidequest Portal');

    // Configure logging based on environment
    const isDev = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';

    configureLogger({
        level: isDev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN
    });

    // Initialize theme
    initializeTheme();

    // Initialize modals
    initModalHandlers();

    // Set up auth state listener
    initAuthListener(async (user) => {
        showLoading(true);

        if (user) {
            logger.info('User signed in', { uid: user.uid });

            // Update last login
            await updateLastLogin(user.uid);

            // Redirect if on login page
            handleAuthRedirect(user);

            // Initialize data subscriptions
            initDataSubscriptions();
        } else {
            logger.info('User signed out');

            // Clear subscriptions
            clearSubscriptions();

            // Redirect to login if needed
            handleAuthRedirect(null);
        }

        showLoading(false);
    });

    // Register service worker
    if (FEATURES.OFFLINE_MODE && 'serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            logger.info('Service Worker registered', { scope: registration.scope });
        } catch (error) {
            logger.warn('Service Worker registration failed', error);
        }
    }

    // Set up global error handler
    window.addEventListener('error', (event) => {
        logger.error('Uncaught error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno
        });
    });

    // Set up unhandled rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection', event.reason);
    });

    logger.info('App initialization complete');
}

/**
 * Initialize data subscriptions based on current page
 */
function initDataSubscriptions() {
    const page = getCurrentPage();
    logger.debug('Initializing subscriptions for page', { page });

    // Subscribe to activity for dashboard
    if (page === 'dashboard.html') {
        subscribeToActivity();
        subscribeToProjects();
    }

    // Subscribe to leads for leads pages
    if (page === 'leads.html' || page === 'lead-detail.html') {
        subscribeToLeads();
    }

    // Subscribe to projects for project pages
    if (page === 'projects.html' || page === 'project-detail.html') {
        subscribeToProjects();
    }
}

/**
 * Get current page name
 * @returns {string} Page name
 */
function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

/**
 * Navigate to a page
 * @param {string} page - Page URL
 */
export function navigateTo(page) {
    window.location.href = page;
}

/**
 * Reload current page data
 */
export async function reloadData() {
    const page = getCurrentPage();

    showLoading(true);

    try {
        if (page.includes('lead')) {
            await loadLeads();
        } else if (page.includes('project')) {
            await loadProjects();
        }
    } finally {
        showLoading(false);
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for use in other modules
export { initApp, getCurrentPage };
