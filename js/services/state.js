/* ============================================
   SIDEQUEST DIGITAL - Application State
   ============================================ */

import { createLogger } from '../utils/logger.js';
import { USER_ROLES, ROLE_PERMISSIONS } from '../config/constants.js';

const logger = createLogger('State');

/**
 * Application state
 */
const state = {
    // Authentication
    currentUser: null,
    userProfile: null,
    isAdmin: false,
    userRole: null,

    // Data
    leads: [],
    projects: [],
    clients: [],
    tickets: [],
    posts: [],
    archived: [],
    messages: [],
    activity: [],

    // UI State
    currentItem: null,
    currentPage: null,
    isLoading: false,
    theme: 'dark',

    // Filters
    filters: {
        search: '',
        location: '',
        businessType: '',
        status: '',
        tier: ''
    },

    // Pagination
    pagination: {
        leads: { cursor: null, hasMore: true },
        projects: { cursor: null, hasMore: true },
        tickets: { cursor: null, hasMore: true },
        posts: { cursor: null, hasMore: true }
    },

    // Subscriptions
    unsubscribers: [],

    // Cache
    cache: new Map(),
    cacheTimestamps: new Map()
};

/**
 * State change listeners
 */
const listeners = new Map();

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(key, callback) {
    if (!listeners.has(key)) {
        listeners.set(key, new Set());
    }
    listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
        listeners.get(key)?.delete(callback);
    };
}

/**
 * Notify listeners of state change
 * @param {string} key - State key that changed
 * @param {*} value - New value
 */
function notifyListeners(key, value) {
    const keyListeners = listeners.get(key);
    if (keyListeners) {
        keyListeners.forEach(callback => {
            try {
                callback(value, state);
            } catch (error) {
                logger.error(`Listener error for ${key}`, error);
            }
        });
    }

    // Also notify wildcard listeners
    const wildcardListeners = listeners.get('*');
    if (wildcardListeners) {
        wildcardListeners.forEach(callback => {
            try {
                callback({ key, value }, state);
            } catch (error) {
                logger.error('Wildcard listener error', error);
            }
        });
    }
}

/**
 * Get state value
 * @param {string} key - State key
 * @returns {*} State value
 */
export function getState(key) {
    if (key) {
        return state[key];
    }
    return { ...state };
}

/**
 * Set state value
 * @param {string} key - State key
 * @param {*} value - New value
 */
export function setState(key, value) {
    const oldValue = state[key];
    state[key] = value;
    logger.debug(`State updated: ${key}`, { oldValue, newValue: value });
    notifyListeners(key, value);
}

/**
 * Update state with partial object
 * @param {Object} updates - Partial state updates
 */
export function updateState(updates) {
    for (const [key, value] of Object.entries(updates)) {
        state[key] = value;
        notifyListeners(key, value);
    }
}

/**
 * Reset state to initial values
 * @param {string[]} keys - Keys to reset (all if not provided)
 */
export function resetState(keys = null) {
    const initialState = {
        leads: [],
        projects: [],
        clients: [],
        tickets: [],
        posts: [],
        archived: [],
        messages: [],
        activity: [],
        currentItem: null,
        filters: {
            search: '',
            location: '',
            businessType: '',
            status: '',
            tier: ''
        }
    };

    if (keys) {
        keys.forEach(key => {
            if (key in initialState) {
                setState(key, initialState[key]);
            }
        });
    } else {
        Object.entries(initialState).forEach(([key, value]) => {
            setState(key, value);
        });
    }
}

// ============================================
// User State Helpers
// ============================================

/**
 * Set current user
 * @param {Object} user - Firebase user object
 */
export function setCurrentUser(user) {
    setState('currentUser', user);
}

/**
 * Set user profile
 * @param {Object} profile - User profile from Firestore
 */
export function setUserProfile(profile) {
    setState('userProfile', profile);

    // Determine role and admin status
    const role = profile?.role || USER_ROLES.CLIENT;
    setState('userRole', role);
    setState('isAdmin', role === USER_ROLES.ADMIN || role === USER_ROLES.MANAGER);
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated() {
    return state.currentUser !== null;
}

/**
 * Check if user has admin privileges
 * @returns {boolean} True if admin
 */
export function isAdmin() {
    return state.isAdmin;
}

/**
 * Check if user has permission
 * @param {string} permission - Permission to check
 * @returns {boolean} True if has permission
 */
export function hasPermission(permission) {
    const role = state.userRole || USER_ROLES.CLIENT;
    const permissions = ROLE_PERMISSIONS[role] || [];

    return permissions.includes('*') || permissions.includes(permission);
}

/**
 * Get current user ID
 * @returns {string|null} User ID
 */
export function getCurrentUserId() {
    return state.currentUser?.uid || null;
}

/**
 * Get current user display name
 * @returns {string} Display name
 */
export function getCurrentUserName() {
    return state.userProfile?.displayName || state.currentUser?.email?.split('@')[0] || 'User';
}

// ============================================
// Data State Helpers
// ============================================

/**
 * Set leads
 * @param {Array} leads - Leads array
 */
export function setLeads(leads) {
    setState('leads', leads);
}

/**
 * Add or update a lead
 * @param {Object} lead - Lead object
 */
export function upsertLead(lead) {
    const leads = [...state.leads];
    const index = leads.findIndex(l => l.id === lead.id);
    if (index >= 0) {
        leads[index] = lead;
    } else {
        leads.unshift(lead);
    }
    setState('leads', leads);
}

/**
 * Remove a lead
 * @param {string} leadId - Lead ID
 */
export function removeLead(leadId) {
    setState('leads', state.leads.filter(l => l.id !== leadId));
}

/**
 * Set projects
 * @param {Array} projects - Projects array
 */
export function setProjects(projects) {
    setState('projects', projects);
}

/**
 * Add or update a project
 * @param {Object} project - Project object
 */
export function upsertProject(project) {
    const projects = [...state.projects];
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
        projects[index] = project;
    } else {
        projects.unshift(project);
    }
    setState('projects', projects);
}

/**
 * Remove a project
 * @param {string} projectId - Project ID
 */
export function removeProject(projectId) {
    setState('projects', state.projects.filter(p => p.id !== projectId));
}

/**
 * Set clients
 * @param {Array} clients - Clients array
 */
export function setClients(clients) {
    setState('clients', clients);
}

/**
 * Set tickets
 * @param {Array} tickets - Tickets array
 */
export function setTickets(tickets) {
    setState('tickets', tickets);
}

/**
 * Set posts
 * @param {Array} posts - Posts array
 */
export function setPosts(posts) {
    setState('posts', posts);
}

/**
 * Set archived items
 * @param {Array} archived - Archived array
 */
export function setArchived(archived) {
    setState('archived', archived);
}

/**
 * Set messages
 * @param {Array} messages - Messages array
 */
export function setMessages(messages) {
    setState('messages', messages);
}

/**
 * Set activity
 * @param {Array} activity - Activity array
 */
export function setActivity(activity) {
    setState('activity', activity);
}

// ============================================
// Current Item Helpers
// ============================================

/**
 * Set current item (for detail views)
 * @param {Object} item - Current item
 */
export function setCurrentItem(item) {
    setState('currentItem', item);
}

/**
 * Get current item
 * @returns {Object|null} Current item
 */
export function getCurrentItem() {
    return state.currentItem;
}

/**
 * Clear current item
 */
export function clearCurrentItem() {
    setState('currentItem', null);
}

// ============================================
// Filter Helpers
// ============================================

/**
 * Set filter value
 * @param {string} key - Filter key
 * @param {string} value - Filter value
 */
export function setFilter(key, value) {
    const filters = { ...state.filters, [key]: value };
    setState('filters', filters);
}

/**
 * Clear all filters
 */
export function clearFilters() {
    setState('filters', {
        search: '',
        location: '',
        businessType: '',
        status: '',
        tier: ''
    });
}

/**
 * Get current filters
 * @returns {Object} Filters object
 */
export function getFilters() {
    return { ...state.filters };
}

// ============================================
// Subscription Management
// ============================================

/**
 * Add Firebase unsubscribe function
 * @param {Function} unsubscribe - Unsubscribe function
 */
export function addUnsubscriber(unsubscribe) {
    state.unsubscribers.push(unsubscribe);
}

/**
 * Clear all Firebase subscriptions
 */
export function clearSubscriptions() {
    state.unsubscribers.forEach(unsub => {
        try {
            unsub();
        } catch (error) {
            logger.error('Error unsubscribing', error);
        }
    });
    state.unsubscribers = [];
}

// ============================================
// Cache Helpers
// ============================================

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {*} Cached value or undefined
 */
export function getCache(key) {
    const timestamp = state.cacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp < CACHE_TTL) {
        return state.cache.get(key);
    }
    return undefined;
}

/**
 * Set cached value
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 */
export function setCache(key, value) {
    state.cache.set(key, value);
    state.cacheTimestamps.set(key, Date.now());
}

/**
 * Clear cache
 * @param {string} key - Specific key to clear (all if not provided)
 */
export function clearCache(key = null) {
    if (key) {
        state.cache.delete(key);
        state.cacheTimestamps.delete(key);
    } else {
        state.cache.clear();
        state.cacheTimestamps.clear();
    }
}

// ============================================
// Theme Helpers
// ============================================

/**
 * Get current theme
 * @returns {string} Theme name
 */
export function getTheme() {
    return state.theme;
}

/**
 * Set theme
 * @param {string} theme - Theme name ('dark' or 'light')
 */
export function setTheme(theme) {
    setState('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('portal_theme', theme);
}

/**
 * Toggle theme
 */
export function toggleTheme() {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

/**
 * Initialize theme from storage or system preference
 */
export function initializeTheme() {
    const stored = localStorage.getItem('portal_theme');
    if (stored) {
        setTheme(stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
    } else {
        setTheme('dark');
    }
}

// ============================================
// Loading State Helpers
// ============================================

/**
 * Set loading state
 * @param {boolean} loading - Loading state
 */
export function setLoading(loading) {
    setState('isLoading', loading);
}

/**
 * Get loading state
 * @returns {boolean} Loading state
 */
export function isLoading() {
    return state.isLoading;
}

// Export state for direct access (read-only pattern recommended)
export const AppState = state;
