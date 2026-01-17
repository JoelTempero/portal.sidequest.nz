/* ============================================
   SIDEQUEST DIGITAL - Tickets Service
   Comprehensive ticket management system
   ============================================ */

import {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    serverTimestamp,
    arrayUnion
} from './firebase-init.js';

import {
    setTickets,
    addUnsubscriber,
    getCurrentUserId,
    isAdmin,
    getState
} from './state.js';

import { createLogger } from '../utils/logger.js';
import { validateTicketForm } from '../utils/validation.js';
import { sanitizeObject, escapeHtml } from '../utils/sanitize.js';
import { showToast } from '../components/toast.js';
import { COLLECTIONS, TICKET_STATUSES, TICKET_URGENCIES } from '../config/constants.js';
import { uploadFile } from './storage.js';
import { logActivity } from './activity.js';
import { generateId, formatDate } from '../utils/helpers.js';

const logger = createLogger('Tickets');

// ============================================
// TICKET CONSTANTS
// ============================================

export const TICKET_CATEGORIES = {
    BUG: 'bug',
    FEATURE: 'feature',
    SUPPORT: 'support',
    BILLING: 'billing',
    OTHER: 'other'
};

export const TICKET_CATEGORY_LABELS = {
    [TICKET_CATEGORIES.BUG]: 'Bug Report',
    [TICKET_CATEGORIES.FEATURE]: 'Feature Request',
    [TICKET_CATEGORIES.SUPPORT]: 'Support',
    [TICKET_CATEGORIES.BILLING]: 'Billing',
    [TICKET_CATEGORIES.OTHER]: 'Other'
};

// Urgency labels (consolidated - no separate priority)
export const TICKET_URGENCY_LABELS = {
    'asap': 'ASAP',
    'day': 'Within a Day',
    'week': 'Within a Week',
    'month': 'Within a Month'
};

// Priority constants (internal use and backward compatibility)
export const TICKET_PRIORITIES = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

// Priority labels (backward compatibility)
export const TICKET_PRIORITY_LABELS = {
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low'
};

// SLA hours matrix: Tier + Urgency
// Higher tier = faster SLA, higher urgency = faster SLA
// Values from tier SLA table (ASAP, Day, Week, Month)
export const SLA_MATRIX = {
    // Guardian tier - highest priority, fastest response (12h, 24h, 72h/3d, 336h/14d)
    'guardian': { 'asap': 12, 'day': 24, 'week': 72, 'month': 336 },
    // Watchful Eye tier (16h, 30h, 120h/5d, 504h/21d)
    'premium': { 'asap': 16, 'day': 30, 'week': 120, 'month': 504 },
    'enterprise': { 'asap': 16, 'day': 30, 'week': 120, 'month': 504 },
    'watchfuleye': { 'asap': 16, 'day': 30, 'week': 120, 'month': 504 },
    // Farmer tier (18h, 34h, 168h/7d, 504h/21d)
    'professional': { 'asap': 18, 'day': 34, 'week': 168, 'month': 504 },
    'farmer': { 'asap': 18, 'day': 34, 'week': 168, 'month': 504 },
    // Bug Catcher tier (20h, 48h, 168h/7d, 720h/30d)
    'starter': { 'asap': 20, 'day': 48, 'week': 168, 'month': 720 },
    'bugcatcher': { 'asap': 20, 'day': 48, 'week': 168, 'month': 720 },
    // Host tier - standard response (24h, 52h, 168h/7d, 720h/30d)
    'host': { 'asap': 24, 'day': 52, 'week': 168, 'month': 720 },
    'basic': { 'asap': 24, 'day': 52, 'week': 168, 'month': 720 }
};

// Legacy fallback
export const SLA_HOURS = {
    'asap': 4,
    'day': 24,
    'week': 168,
    'month': 720
};

// ============================================
// LOAD & SUBSCRIBE
// ============================================

/**
 * Load all tickets (admin) or user's tickets (client)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Tickets array
 */
export async function loadTickets(options = {}) {
    const {
        status = null,
        projectId = null,
        assignedTo = null,
        category = null,
        submittedById = null,
        pageSize = 50,
        cursor = null
    } = options;

    try {
        logger.info('Loading tickets', options);

        let tickets = [];
        if (isAdmin()) {
            const q = query(
                collection(db, COLLECTIONS.TICKETS),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            // Clients: query multiple ways to find all their tickets
            const userId = getCurrentUserId();
            const ticketsMap = new Map();

            // Query by clientId (new tickets)
            try {
                const q1 = query(collection(db, COLLECTIONS.TICKETS), where('clientId', '==', userId));
                const s1 = await getDocs(q1);
                s1.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
            } catch (e) { logger.debug('clientId query failed', e); }

            // Query by submittedById (old tickets)
            try {
                const q2 = query(collection(db, COLLECTIONS.TICKETS), where('submittedById', '==', userId));
                const s2 = await getDocs(q2);
                s2.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
            } catch (e) { logger.debug('submittedById query failed', e); }

            tickets = Array.from(ticketsMap.values());
            // Sort by date
            tickets.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || a.submittedAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || b.submittedAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
        }

        // Apply additional filters client-side
        if (status) {
            tickets = tickets.filter(t => t.status === status);
        }
        if (projectId) {
            tickets = tickets.filter(t => t.projectId === projectId);
        }
        if (assignedTo) {
            tickets = tickets.filter(t => t.assignedTo === assignedTo);
        }
        if (category) {
            tickets = tickets.filter(t => t.category === category);
        }
        if (submittedById) {
            tickets = tickets.filter(t => t.submittedById === submittedById);
        }

        // Calculate SLA status for each ticket
        tickets = tickets.map(t => ({
            ...t,
            slaStatus: calculateSLAStatus(t)
        }));

        setTickets(tickets);
        logger.info(`Loaded ${tickets.length} tickets`);

        return tickets;
    } catch (error) {
        logger.error('Failed to load tickets', error);
        showToast('Failed to load tickets', 'error');
        return [];
    }
}

/**
 * Subscribe to tickets updates
 * @param {Function} callback - Callback when tickets update
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTickets(callback = null) {
    if (isAdmin()) {
        const q = query(
            collection(db, COLLECTIONS.TICKETS),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                slaStatus: calculateSLAStatus({ id: doc.id, ...doc.data() })
            }));
            setTickets(tickets);
            if (callback) callback(tickets);
        }, (error) => {
            logger.error('Tickets subscription error', error);
        });
        addUnsubscriber(unsubscribe);
        return unsubscribe;
    } else {
        // For clients, subscribe to tickets by clientId (no orderBy to avoid index)
        const userId = getCurrentUserId();
        const q = query(collection(db, COLLECTIONS.TICKETS), where('clientId', '==', userId));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            // Also load tickets by submittedById for old tickets
            const ticketsMap = new Map();
            snapshot.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));

            try {
                const q2 = query(collection(db, COLLECTIONS.TICKETS), where('submittedById', '==', userId));
                const s2 = await getDocs(q2);
                s2.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
            } catch (e) { /* ignore */ }

            let tickets = Array.from(ticketsMap.values());
            tickets = tickets.map(t => ({ ...t, slaStatus: calculateSLAStatus(t) }));
            tickets.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || a.submittedAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || b.submittedAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            setTickets(tickets);
            if (callback) callback(tickets);
        }, (error) => {
            logger.error('Tickets subscription error', error);
        });
        addUnsubscriber(unsubscribe);
        return unsubscribe;
    }
}

/**
 * Subscribe to a single ticket
 * @param {string} ticketId - Ticket ID
 * @param {Function} callback - Callback when ticket updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTicket(ticketId, callback) {
    const unsubscribe = onSnapshot(
        doc(db, COLLECTIONS.TICKETS, ticketId),
        (snapshot) => {
            if (snapshot.exists()) {
                const ticket = {
                    id: snapshot.id,
                    ...snapshot.data(),
                    slaStatus: calculateSLAStatus({ id: snapshot.id, ...snapshot.data() })
                };
                callback(ticket);
            } else {
                callback(null);
            }
        },
        (error) => {
            logger.error('Ticket subscription error', error);
        }
    );

    addUnsubscriber(unsubscribe);
    return unsubscribe;
}

/**
 * Get a single ticket by ID
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object|null>} Ticket object
 */
export async function getTicket(ticketId) {
    try {
        const docRef = doc(db, COLLECTIONS.TICKETS, ticketId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const ticket = { id: docSnap.id, ...docSnap.data() };
            ticket.slaStatus = calculateSLAStatus(ticket);
            return ticket;
        }

        return null;
    } catch (error) {
        logger.error('Failed to get ticket', error);
        return null;
    }
}

// ============================================
// CREATE & UPDATE
// ============================================

/**
 * Create a new ticket
 * @param {Object} data - Ticket data
 * @param {File[]} attachments - Optional attachments
 * @returns {Promise<Object>} Result object
 */
export async function createTicket(data, attachments = []) {
    try {
        // Validate
        const validation = validateTicketForm(data);
        if (!validation.valid) {
            showToast(validation.errors[0], 'error');
            return { success: false, errors: validation.errors };
        }

        // Sanitize
        const sanitized = sanitizeObject(data);

        // Get project info for tier
        let projectTier = 'host';
        let projectName = '';
        if (sanitized.projectId) {
            const projectDoc = await getDoc(doc(db, 'projects', sanitized.projectId));
            if (projectDoc.exists()) {
                projectTier = projectDoc.data().tier || 'host';
                projectName = projectDoc.data().companyName || '';
            }
        }

        // Get current user info
        const userProfile = getState('userProfile');
        const userId = getCurrentUserId();

        // Calculate priority from urgency
        const priority = mapUrgencyToPriority(sanitized.urgency);

        // Calculate SLA due date
        const slaDueDate = calculateSLADueDate(sanitized.urgency);

        logger.info('Creating ticket', { title: sanitized.title, projectId: sanitized.projectId });

        // Create ticket document
        const ticketData = {
            // Core fields
            title: sanitized.title,
            description: sanitized.description || '',
            projectId: sanitized.projectId,
            projectName: projectName,

            // Classification
            category: sanitized.category || TICKET_CATEGORIES.SUPPORT,
            priority: priority,
            urgency: sanitized.urgency || TICKET_URGENCIES.WEEK,
            tier: projectTier,

            // Status
            status: TICKET_STATUSES.OPEN,

            // Submitter info
            submittedBy: userProfile?.displayName || 'Unknown',
            submittedById: userId,
            submittedByEmail: userProfile?.email || '',

            // Assignment
            assignedTo: null,
            assignedToName: null,

            // SLA
            slaDueDate: slaDueDate,
            slaBreached: false,
            firstResponseAt: null,
            resolvedAt: null,

            // Notes
            adminNotes: '',
            internalNotes: '',

            // Arrays
            comments: [],
            attachments: [],
            updates: [{
                type: 'created',
                message: 'Ticket created',
                userId: userId,
                userName: userProfile?.displayName || 'Unknown',
                timestamp: new Date().toISOString()
            }],
            watchers: [userId],

            // Timestamps
            submittedAt: new Date().toISOString(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, COLLECTIONS.TICKETS), ticketData);
        logger.info('Ticket created', { id: docRef.id });

        // Upload attachments if provided
        if (attachments.length > 0) {
            const uploadedAttachments = await uploadTicketAttachments(docRef.id, attachments);
            if (uploadedAttachments.length > 0) {
                await updateDoc(doc(db, COLLECTIONS.TICKETS, docRef.id), {
                    attachments: uploadedAttachments
                });
            }
        }

        // Log activity
        await logActivity('ticket_created', {
            ticketId: docRef.id,
            title: sanitized.title,
            projectId: sanitized.projectId,
            projectName: projectName
        });

        showToast('Ticket submitted!', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        logger.error('Failed to create ticket', error);
        showToast('Failed to submit ticket', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update a ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>} Result object
 */
export async function updateTicket(ticketId, updates) {
    try {
        const sanitized = sanitizeObject(updates);

        // Get current ticket for comparison
        const currentTicket = await getTicket(ticketId);
        if (!currentTicket) {
            return { success: false, error: 'Ticket not found' };
        }

        // Track what changed
        const changes = [];
        const userProfile = getState('userProfile');
        const userId = getCurrentUserId();

        // Check for status change
        if (sanitized.status && sanitized.status !== currentTicket.status) {
            changes.push({
                type: 'status_changed',
                message: `Status changed from ${currentTicket.status} to ${sanitized.status}`,
                oldValue: currentTicket.status,
                newValue: sanitized.status,
                userId: userId,
                userName: userProfile?.displayName || 'Unknown',
                timestamp: new Date().toISOString()
            });

            // Set resolved timestamp
            if (sanitized.status === TICKET_STATUSES.RESOLVED) {
                sanitized.resolvedAt = serverTimestamp();
            }
        }

        // Check for assignment change
        if (sanitized.assignedTo !== undefined && sanitized.assignedTo !== currentTicket.assignedTo) {
            changes.push({
                type: 'assigned',
                message: sanitized.assignedTo
                    ? `Assigned to ${sanitized.assignedToName || 'team member'}`
                    : 'Unassigned',
                oldValue: currentTicket.assignedTo,
                newValue: sanitized.assignedTo,
                userId: userId,
                userName: userProfile?.displayName || 'Unknown',
                timestamp: new Date().toISOString()
            });
        }

        // Check for priority change
        if (sanitized.priority && sanitized.priority !== currentTicket.priority) {
            changes.push({
                type: 'priority_changed',
                message: `Priority changed from ${currentTicket.priority} to ${sanitized.priority}`,
                oldValue: currentTicket.priority,
                newValue: sanitized.priority,
                userId: userId,
                userName: userProfile?.displayName || 'Unknown',
                timestamp: new Date().toISOString()
            });
        }

        // Add changes to updates array
        if (changes.length > 0) {
            sanitized.updates = arrayUnion(...changes);
        }

        sanitized.updatedAt = serverTimestamp();

        await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), sanitized);

        logger.info('Ticket updated', { ticketId, changes: changes.length });
        showToast('Ticket updated!', 'success');

        // Log activity for status changes
        if (sanitized.status === TICKET_STATUSES.RESOLVED) {
            await logActivity('ticket_resolved', {
                ticketId,
                title: currentTicket.title,
                projectId: currentTicket.projectId
            });
        }

        return { success: true };
    } catch (error) {
        logger.error('Failed to update ticket', error);
        showToast('Failed to update ticket', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update ticket status
 * @param {string} ticketId - Ticket ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Result object
 */
export async function updateTicketStatus(ticketId, status) {
    return updateTicket(ticketId, { status });
}

/**
 * Assign ticket to user
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User ID to assign to
 * @param {string} userName - User name
 * @returns {Promise<Object>} Result object
 */
export async function assignTicket(ticketId, userId, userName) {
    const updates = {
        assignedTo: userId,
        assignedToName: userName
    };

    // If ticket is open, move to in-progress
    const ticket = await getTicket(ticketId);
    if (ticket && ticket.status === TICKET_STATUSES.OPEN) {
        updates.status = TICKET_STATUSES.IN_PROGRESS;
    }

    return updateTicket(ticketId, updates);
}

/**
 * Unassign ticket
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} Result object
 */
export async function unassignTicket(ticketId) {
    return updateTicket(ticketId, {
        assignedTo: null,
        assignedToName: null
    });
}

// ============================================
// COMMENTS
// ============================================

/**
 * Add a comment to a ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} comment - Comment data
 * @param {boolean} isInternal - Whether comment is internal (admin only)
 * @returns {Promise<Object>} Result object
 */
export async function addTicketComment(ticketId, comment, isInternal = false) {
    try {
        const userProfile = getState('userProfile');
        const userId = getCurrentUserId();

        const newComment = {
            id: generateId('cmt'),
            text: sanitizeObject({ text: comment.text }).text,
            userId: userId,
            userName: userProfile?.displayName || 'Unknown',
            userEmail: userProfile?.email || '',
            isInternal: isInternal,
            isAdmin: isAdmin(),
            createdAt: new Date().toISOString()
        };

        // Also add to updates timeline
        const updateEntry = {
            type: isInternal ? 'internal_note' : 'comment',
            message: isInternal ? 'Added internal note' : 'Added a comment',
            userId: userId,
            userName: userProfile?.displayName || 'Unknown',
            timestamp: new Date().toISOString()
        };

        await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), {
            comments: arrayUnion(newComment),
            updates: arrayUnion(updateEntry),
            updatedAt: serverTimestamp(),
            // Set first response time if this is admin's first response
            ...(isAdmin() && !(await getTicket(ticketId))?.firstResponseAt
                ? { firstResponseAt: serverTimestamp() }
                : {})
        });

        logger.info('Comment added', { ticketId, isInternal });
        showToast(isInternal ? 'Note added!' : 'Comment added!', 'success');

        return { success: true, commentId: newComment.id };
    } catch (error) {
        logger.error('Failed to add comment', error);
        showToast('Failed to add comment', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Add a public response (admin responding to client)
 * @param {string} ticketId - Ticket ID
 * @param {string} response - Response text
 * @returns {Promise<Object>} Result object
 */
export async function addTicketResponse(ticketId, response) {
    return addTicketComment(ticketId, { text: response }, false);
}

/**
 * Add an internal note (admin only, not visible to client)
 * @param {string} ticketId - Ticket ID
 * @param {string} note - Note text
 * @returns {Promise<Object>} Result object
 */
export async function addInternalNote(ticketId, note) {
    return addTicketComment(ticketId, { text: note }, true);
}

// ============================================
// ATTACHMENTS
// ============================================

/**
 * Upload attachments for a ticket
 * @param {string} ticketId - Ticket ID
 * @param {File[]} files - Files to upload
 * @returns {Promise<Array>} Uploaded attachments info
 */
async function uploadTicketAttachments(ticketId, files) {
    const attachments = [];

    for (const file of files) {
        const result = await uploadFile(file, `tickets/${ticketId}/attachments`);
        if (result.success) {
            attachments.push({
                id: generateId('att'),
                name: file.name,
                size: file.size,
                type: file.type,
                url: result.url,
                uploadedBy: getCurrentUserId(),
                uploadedAt: new Date().toISOString()
            });
        }
    }

    return attachments;
}

/**
 * Add attachment to existing ticket
 * @param {string} ticketId - Ticket ID
 * @param {File} file - File to upload
 * @returns {Promise<Object>} Result object
 */
export async function addTicketAttachment(ticketId, file) {
    try {
        const result = await uploadFile(file, `tickets/${ticketId}/attachments`);
        if (!result.success) {
            return result;
        }

        const userProfile = getState('userProfile');
        const attachment = {
            id: generateId('att'),
            name: file.name,
            size: file.size,
            type: file.type,
            url: result.url,
            uploadedBy: getCurrentUserId(),
            uploadedByName: userProfile?.displayName || 'Unknown',
            uploadedAt: new Date().toISOString()
        };

        const updateEntry = {
            type: 'attachment_added',
            message: `Added attachment: ${file.name}`,
            userId: getCurrentUserId(),
            userName: userProfile?.displayName || 'Unknown',
            timestamp: new Date().toISOString()
        };

        await updateDoc(doc(db, COLLECTIONS.TICKETS, ticketId), {
            attachments: arrayUnion(attachment),
            updates: arrayUnion(updateEntry),
            updatedAt: serverTimestamp()
        });

        showToast('Attachment uploaded!', 'success');
        return { success: true, attachment };
    } catch (error) {
        logger.error('Failed to add attachment', error);
        showToast('Failed to upload attachment', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================
// SLA & PRIORITY
// ============================================

/**
 * Map urgency to priority
 * @param {string} urgency - Urgency level
 * @returns {string} Priority level
 */
function mapUrgencyToPriority(urgency) {
    switch (urgency) {
        case TICKET_URGENCIES.ASAP:
            return TICKET_PRIORITIES.HIGH;
        case TICKET_URGENCIES.DAY:
            return TICKET_PRIORITIES.MEDIUM;
        case TICKET_URGENCIES.WEEK:
        default:
            return TICKET_PRIORITIES.LOW;
    }
}

/**
 * Calculate SLA due date based on urgency
 * @param {string} urgency - Urgency level
 * @returns {string} ISO date string
 */
function calculateSLADueDate(urgency) {
    const hours = SLA_HOURS[urgency] || SLA_HOURS[TICKET_URGENCIES.WEEK];
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + hours);
    return dueDate.toISOString();
}

/**
 * Get SLA hours based on tier and urgency
 * @param {string} tier - Project tier (premium, professional, starter, host, basic)
 * @param {string} urgency - Ticket urgency (asap, day, week)
 * @returns {number} SLA hours
 */
export function getSLAHours(tier, urgency) {
    const normalizedTier = (tier || 'host').toLowerCase();
    const normalizedUrgency = (urgency || 'week').toLowerCase();

    const tierMatrix = SLA_MATRIX[normalizedTier] || SLA_MATRIX['host'];
    return tierMatrix[normalizedUrgency] || tierMatrix['week'] || 168;
}

/**
 * Calculate SLA status for a ticket
 * Always recalculates based on tier + urgency to ensure consistency
 * @param {Object} ticket - Ticket object
 * @returns {Object} SLA status info with text for display
 */
export function calculateSLAStatus(ticket) {
    if (!ticket || ticket.status === TICKET_STATUSES.RESOLVED || ticket.status === 'closed') {
        return { status: 'resolved', breached: false, text: 'Resolved' };
    }

    const now = new Date();
    let dueDate = null;

    // Always calculate SLA based on tier + urgency for consistency
    if (ticket.submittedAt || ticket.createdAt) {
        const timestamp = ticket.submittedAt || ticket.createdAt;
        const createdAt = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);

        // Get SLA hours from tier + urgency matrix
        const tier = ticket.tier || 'host';
        const urgency = ticket.urgency || 'week';
        const slaHours = getSLAHours(tier, urgency);

        dueDate = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);
    }

    if (!dueDate) {
        return { status: 'on-track', breached: false, text: 'No SLA' };
    }

    const hoursRemaining = (dueDate - now) / (1000 * 60 * 60);

    if (hoursRemaining < 0) {
        const hoursOverdue = Math.abs(Math.round(hoursRemaining));
        return {
            status: 'breached',
            breached: true,
            hoursOverdue,
            text: `${hoursOverdue}h overdue`
        };
    } else if (hoursRemaining < 2) {
        return {
            status: 'at-risk',
            breached: false,
            hoursRemaining: Math.round(hoursRemaining),
            text: `${Math.round(hoursRemaining)}h left`
        };
    } else if (hoursRemaining < 8) {
        return {
            status: 'at-risk',
            breached: false,
            hoursRemaining: Math.round(hoursRemaining),
            text: `${Math.round(hoursRemaining)}h left`
        };
    } else {
        const hours = Math.round(hoursRemaining);
        const days = Math.floor(hours / 24);
        return {
            status: 'on-track',
            breached: false,
            hoursRemaining: hours,
            text: days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h left`
        };
    }
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Bulk update ticket status
 * @param {string[]} ticketIds - Array of ticket IDs
 * @param {string} status - New status
 * @returns {Promise<Object>} Result object
 */
export async function bulkUpdateStatus(ticketIds, status) {
    try {
        const userProfile = getState('userProfile');
        const userId = getCurrentUserId();

        const updateEntry = {
            type: 'status_changed',
            message: `Status changed to ${status} (bulk update)`,
            userId: userId,
            userName: userProfile?.displayName || 'Unknown',
            timestamp: new Date().toISOString()
        };

        const promises = ticketIds.map(id =>
            updateDoc(doc(db, COLLECTIONS.TICKETS, id), {
                status,
                updates: arrayUnion(updateEntry),
                updatedAt: serverTimestamp(),
                ...(status === TICKET_STATUSES.RESOLVED ? { resolvedAt: serverTimestamp() } : {})
            })
        );

        await Promise.all(promises);

        showToast(`Updated ${ticketIds.length} tickets`, 'success');
        return { success: true, count: ticketIds.length };
    } catch (error) {
        logger.error('Bulk update failed', error);
        showToast('Failed to update tickets', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Bulk assign tickets
 * @param {string[]} ticketIds - Array of ticket IDs
 * @param {string} assigneeId - User ID to assign to
 * @param {string} assigneeName - User name
 * @returns {Promise<Object>} Result object
 */
export async function bulkAssign(ticketIds, assigneeId, assigneeName) {
    try {
        const userProfile = getState('userProfile');
        const userId = getCurrentUserId();

        const updateEntry = {
            type: 'assigned',
            message: `Assigned to ${assigneeName} (bulk update)`,
            userId: userId,
            userName: userProfile?.displayName || 'Unknown',
            timestamp: new Date().toISOString()
        };

        const promises = ticketIds.map(id =>
            updateDoc(doc(db, COLLECTIONS.TICKETS, id), {
                assignedTo: assigneeId,
                assignedToName: assigneeName,
                updates: arrayUnion(updateEntry),
                updatedAt: serverTimestamp()
            })
        );

        await Promise.all(promises);

        showToast(`Assigned ${ticketIds.length} tickets`, 'success');
        return { success: true, count: ticketIds.length };
    } catch (error) {
        logger.error('Bulk assign failed', error);
        showToast('Failed to assign tickets', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================
// SEARCH & FILTER
// ============================================

/**
 * Search tickets
 * @param {string} searchTerm - Search term
 * @param {Object} filters - Additional filters
 * @returns {Promise<Array>} Matching tickets
 */
export async function searchTickets(searchTerm, filters = {}) {
    try {
        const tickets = await loadTickets(filters);
        const term = searchTerm.toLowerCase().trim();

        if (!term) return tickets;

        return tickets.filter(ticket =>
            ticket.title?.toLowerCase().includes(term) ||
            ticket.description?.toLowerCase().includes(term) ||
            ticket.projectName?.toLowerCase().includes(term) ||
            ticket.submittedBy?.toLowerCase().includes(term) ||
            ticket.id?.toLowerCase().includes(term)
        );
    } catch (error) {
        logger.error('Search failed', error);
        return [];
    }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get ticket statistics
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Statistics object
 */
export async function getTicketStats(options = {}) {
    try {
        const tickets = await loadTickets(options);

        const open = tickets.filter(t => t.status === TICKET_STATUSES.OPEN);
        const inProgress = tickets.filter(t => t.status === TICKET_STATUSES.IN_PROGRESS);
        const resolved = tickets.filter(t => t.status === TICKET_STATUSES.RESOLVED);
        const breached = tickets.filter(t => t.slaStatus?.breached);

        // Calculate average resolution time
        const resolvedWithTime = resolved.filter(t => t.createdAt && t.resolvedAt);
        let avgResolutionHours = 0;
        if (resolvedWithTime.length > 0) {
            const totalHours = resolvedWithTime.reduce((sum, t) => {
                const created = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
                const resolvedAt = t.resolvedAt?.toDate ? t.resolvedAt.toDate() : new Date(t.resolvedAt);
                return sum + (resolvedAt - created) / (1000 * 60 * 60);
            }, 0);
            avgResolutionHours = Math.round(totalHours / resolvedWithTime.length);
        }

        return {
            total: tickets.length,
            open: open.length,
            inProgress: inProgress.length,
            resolved: resolved.length,
            breached: breached.length,
            avgResolutionHours,
            byCategory: groupByField(tickets, 'category'),
            byPriority: groupByField(tickets, 'priority'),
            byProject: groupByField(tickets, 'projectName')
        };
    } catch (error) {
        logger.error('Failed to get ticket stats', error);
        return {
            total: 0, open: 0, inProgress: 0, resolved: 0, breached: 0,
            avgResolutionHours: 0, byCategory: {}, byPriority: {}, byProject: {}
        };
    }
}

/**
 * Group tickets by a field
 * @param {Array} tickets - Tickets array
 * @param {string} field - Field to group by
 * @returns {Object} Grouped counts
 */
function groupByField(tickets, field) {
    return tickets.reduce((acc, ticket) => {
        const value = ticket[field] || 'unknown';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

// ============================================
// CANNED RESPONSES
// ============================================

export const CANNED_RESPONSES = {
    ACKNOWLEDGE: {
        id: 'acknowledge',
        name: 'Acknowledge Receipt',
        text: 'Thank you for contacting us. We have received your ticket and will review it shortly. We aim to respond within our SLA timeframe.'
    },
    NEED_INFO: {
        id: 'need_info',
        name: 'Need More Information',
        text: 'Thank you for your ticket. To help us resolve this issue faster, could you please provide the following additional information:\n\n1. \n2. \n3. \n\nOnce we have this information, we\'ll be able to proceed with a resolution.'
    },
    IN_PROGRESS: {
        id: 'in_progress',
        name: 'Working On It',
        text: 'We\'re currently working on your request. We\'ll update you as soon as we have more information or when the issue is resolved.'
    },
    RESOLVED: {
        id: 'resolved',
        name: 'Issue Resolved',
        text: 'We\'re pleased to inform you that your issue has been resolved. Please let us know if you have any further questions or if the problem persists.'
    },
    FOLLOW_UP: {
        id: 'follow_up',
        name: 'Follow Up',
        text: 'We wanted to follow up on your ticket. Have you had a chance to verify that the solution we provided resolved your issue? Please let us know if you need any further assistance.'
    }
};

/**
 * Get canned responses list
 * @returns {Array} Canned responses
 */
export function getCannedResponses() {
    return Object.values(CANNED_RESPONSES);
}

// ============================================
// ALIAS EXPORTS & ADMIN FUNCTIONS
// ============================================

/**
 * Subscribe to all tickets (admin only)
 * Alias for subscribeToTickets when admin
 * @param {Function} callback - Callback when tickets update
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAllTickets(callback = null) {
    // Always get all tickets for admin view
    // Use submittedAt for backwards compatibility with existing tickets
    const q = query(
        collection(db, COLLECTIONS.TICKETS),
        orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            slaStatus: calculateSLAStatus({ id: doc.id, ...doc.data() })
        }));

        setTickets(tickets);
        if (callback) callback(tickets);
    }, (error) => {
        logger.error('Tickets subscription error', error);
    });

    addUnsubscriber(unsubscribe);
    return unsubscribe;
}

/**
 * Bulk assign tickets - alias for bulkAssign
 */
export const bulkAssignTickets = bulkAssign;
