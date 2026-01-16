/* ============================================
   SIDEQUEST DIGITAL - Activity Log Service
   ============================================ */

import {
    db,
    collection,
    doc,
    getDocs,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp
} from './firebase-init.js';

import { setActivity, addUnsubscriber, getCurrentUserId } from './state.js';
import { createLogger } from '../utils/logger.js';
import { COLLECTIONS, ACTIVITY_TYPES, FEATURES } from '../config/constants.js';

const logger = createLogger('Activity');

/**
 * Activity type display names
 */
const ACTIVITY_LABELS = {
    [ACTIVITY_TYPES.LEAD_CREATED]: 'Lead Created',
    [ACTIVITY_TYPES.LEAD_UPDATED]: 'Lead Updated',
    [ACTIVITY_TYPES.LEAD_ARCHIVED]: 'Lead Archived',
    [ACTIVITY_TYPES.PROJECT_CREATED]: 'Project Created',
    [ACTIVITY_TYPES.PROJECT_UPDATED]: 'Project Updated',
    [ACTIVITY_TYPES.PROJECT_ARCHIVED]: 'Project Archived',
    [ACTIVITY_TYPES.TICKET_CREATED]: 'Ticket Submitted',
    [ACTIVITY_TYPES.TICKET_UPDATED]: 'Ticket Updated',
    [ACTIVITY_TYPES.TICKET_RESOLVED]: 'Ticket Resolved',
    [ACTIVITY_TYPES.MESSAGE_SENT]: 'Message Sent',
    [ACTIVITY_TYPES.INVOICE_CREATED]: 'Invoice Created',
    [ACTIVITY_TYPES.INVOICE_PAID]: 'Invoice Paid',
    [ACTIVITY_TYPES.MILESTONE_COMPLETED]: 'Milestone Completed',
    [ACTIVITY_TYPES.CLIENT_CREATED]: 'Client Created',
    [ACTIVITY_TYPES.FILE_UPLOADED]: 'File Uploaded',
    [ACTIVITY_TYPES.POST_PUBLISHED]: 'Post Published'
};

/**
 * Activity type icons (SVG paths)
 */
const ACTIVITY_ICONS = {
    [ACTIVITY_TYPES.LEAD_CREATED]: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    [ACTIVITY_TYPES.PROJECT_CREATED]: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    [ACTIVITY_TYPES.TICKET_CREATED]: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    [ACTIVITY_TYPES.MESSAGE_SENT]: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    [ACTIVITY_TYPES.INVOICE_PAID]: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    default: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 8v4M12 16h.01'
};

/**
 * Log an activity
 * @param {string} type - Activity type from ACTIVITY_TYPES
 * @param {Object} data - Activity data
 * @returns {Promise<Object>} Result object
 */
export async function logActivity(type, data = {}) {
    // Check if activity logging is enabled
    if (!FEATURES.ACTIVITY_LOG) {
        return { success: true, skipped: true };
    }

    try {
        const userId = getCurrentUserId();

        const activityData = {
            type,
            data,
            userId,
            timestamp: serverTimestamp(),
            label: ACTIVITY_LABELS[type] || type
        };

        await addDoc(collection(db, COLLECTIONS.ACTIVITY), activityData);
        logger.debug('Activity logged', { type, data });

        return { success: true };
    } catch (error) {
        // Don't throw errors for activity logging - it's not critical
        logger.error('Failed to log activity', error);
        return { success: false, error: error.message };
    }
}

/**
 * Load recent activity
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Activity array
 */
export async function loadActivity(options = {}) {
    const {
        limitCount = 50,
        type = null,
        userId = null,
        projectId = null
    } = options;

    try {
        let q = query(
            collection(db, COLLECTIONS.ACTIVITY),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );

        // Apply filters
        if (type) {
            q = query(q, where('type', '==', type));
        }
        if (userId) {
            q = query(q, where('userId', '==', userId));
        }
        if (projectId) {
            q = query(q, where('data.projectId', '==', projectId));
        }

        const snapshot = await getDocs(q);
        const activity = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setActivity(activity);
        return activity;
    } catch (error) {
        logger.error('Failed to load activity', error);
        return [];
    }
}

/**
 * Subscribe to activity updates
 * @param {Function} callback - Callback when activity updates
 * @param {Object} options - Query options
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActivity(callback = null, options = {}) {
    const { limitCount = 20 } = options;

    const q = query(
        collection(db, COLLECTIONS.ACTIVITY),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const activity = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setActivity(activity);
        if (callback) callback(activity);
    }, (error) => {
        logger.error('Activity subscription error', error);
    });

    addUnsubscriber(unsubscribe);
    return unsubscribe;
}

/**
 * Get activity for a specific project
 * @param {string} projectId - Project ID
 * @param {number} limitCount - Number of items to return
 * @returns {Promise<Array>} Activity array
 */
export async function getProjectActivity(projectId, limitCount = 20) {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.ACTIVITY),
                where('data.projectId', '==', projectId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            )
        );

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        logger.error('Failed to get project activity', error);
        return [];
    }
}

/**
 * Get activity for a specific user
 * @param {string} userId - User ID
 * @param {number} limitCount - Number of items to return
 * @returns {Promise<Array>} Activity array
 */
export async function getUserActivity(userId, limitCount = 20) {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, COLLECTIONS.ACTIVITY),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            )
        );

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        logger.error('Failed to get user activity', error);
        return [];
    }
}

/**
 * Format activity item for display
 * @param {Object} item - Activity item
 * @returns {Object} Formatted activity
 */
export function formatActivityItem(item) {
    const { type, data, timestamp, userId } = item;

    let text = '';
    let icon = ACTIVITY_ICONS[type] || ACTIVITY_ICONS.default;
    let color = 'purple';

    switch (type) {
        case ACTIVITY_TYPES.LEAD_CREATED:
            text = `New lead: <strong>${data.companyName || 'Unknown'}</strong>`;
            color = 'blue';
            break;

        case ACTIVITY_TYPES.PROJECT_CREATED:
            text = `Project created: <strong>${data.companyName || 'Unknown'}</strong>`;
            color = 'purple';
            break;

        case ACTIVITY_TYPES.TICKET_CREATED:
            text = `Ticket submitted: <strong>${data.title || 'Unknown'}</strong>`;
            color = 'orange';
            break;

        case ACTIVITY_TYPES.TICKET_RESOLVED:
            text = `Ticket resolved: <strong>${data.title || 'Unknown'}</strong>`;
            color = 'green';
            break;

        case ACTIVITY_TYPES.MESSAGE_SENT:
            text = `Message sent on <strong>${data.projectName || 'project'}</strong>`;
            color = 'blue';
            break;

        case ACTIVITY_TYPES.INVOICE_PAID:
            text = `Invoice <strong>${data.invoiceNumber}</strong> paid`;
            color = 'green';
            break;

        case ACTIVITY_TYPES.MILESTONE_COMPLETED:
            text = `Milestone completed: <strong>${data.milestoneTitle}</strong>`;
            color = 'green';
            break;

        case ACTIVITY_TYPES.CLIENT_CREATED:
            text = `Client created: <strong>${data.displayName || data.email}</strong>`;
            color = 'blue';
            break;

        case ACTIVITY_TYPES.POST_PUBLISHED:
            text = `Post published: <strong>${data.title || 'Untitled'}</strong>`;
            color = 'purple';
            break;

        default:
            text = ACTIVITY_LABELS[type] || type;
    }

    return {
        ...item,
        text,
        icon,
        color,
        formattedTimestamp: timestamp
    };
}

/**
 * Get activity icon SVG
 * @param {string} type - Activity type
 * @returns {string} SVG HTML
 */
export function getActivityIcon(type) {
    const path = ACTIVITY_ICONS[type] || ACTIVITY_ICONS.default;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
}

/**
 * Get activity color class
 * @param {string} type - Activity type
 * @returns {string} Color class
 */
export function getActivityColor(type) {
    const colors = {
        [ACTIVITY_TYPES.LEAD_CREATED]: 'blue',
        [ACTIVITY_TYPES.PROJECT_CREATED]: 'purple',
        [ACTIVITY_TYPES.TICKET_CREATED]: 'orange',
        [ACTIVITY_TYPES.TICKET_RESOLVED]: 'green',
        [ACTIVITY_TYPES.MESSAGE_SENT]: 'blue',
        [ACTIVITY_TYPES.INVOICE_PAID]: 'green',
        [ACTIVITY_TYPES.MILESTONE_COMPLETED]: 'green',
        [ACTIVITY_TYPES.CLIENT_CREATED]: 'blue',
        [ACTIVITY_TYPES.POST_PUBLISHED]: 'purple'
    };

    return colors[type] || 'purple';
}
