/* ============================================
   SIDEQUEST DIGITAL - Leads Service
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
    serverTimestamp
} from './firebase-init.js';

import {
    setLeads,
    upsertLead,
    removeLead,
    addUnsubscriber,
    getCurrentUserId
} from './state.js';

import { createLogger } from '../utils/logger.js';
import { validateLeadForm } from '../utils/validation.js';
import { sanitizeObject } from '../utils/sanitize.js';
import { showToast } from '../components/toast.js';
import { COLLECTIONS, PAGINATION } from '../config/constants.js';
import { uploadLogo } from './storage.js';
import { logActivity } from './activity.js';

const logger = createLogger('Leads');

/**
 * Load all leads
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Leads array
 */
export async function loadLeads(options = {}) {
    const {
        status = null,
        location = null,
        businessType = null,
        pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
        cursor = null
    } = options;

    try {
        logger.info('Loading leads', options);

        let q = query(
            collection(db, COLLECTIONS.LEADS),
            orderBy('createdAt', 'desc')
        );

        // Apply filters
        if (status) {
            q = query(q, where('status', '==', status));
        }
        if (location) {
            q = query(q, where('location', '==', location));
        }
        if (businessType) {
            q = query(q, where('businessType', '==', businessType));
        }

        // Pagination
        q = query(q, limit(pageSize));
        if (cursor) {
            q = query(q, startAfter(cursor));
        }

        const snapshot = await getDocs(q);
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setLeads(leads);
        logger.info(`Loaded ${leads.length} leads`);

        return leads;
    } catch (error) {
        logger.error('Failed to load leads', error);
        showToast('Failed to load leads', 'error');
        return [];
    }
}

/**
 * Subscribe to leads updates
 * @param {Function} callback - Callback when leads update
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLeads(callback = null) {
    const q = query(
        collection(db, COLLECTIONS.LEADS),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setLeads(leads);
        if (callback) callback(leads);
    }, (error) => {
        logger.error('Leads subscription error', error);
    });

    addUnsubscriber(unsubscribe);
    return unsubscribe;
}

/**
 * Get a single lead by ID
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object|null>} Lead object
 */
export async function getLead(leadId) {
    try {
        const docRef = doc(db, COLLECTIONS.LEADS, leadId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }

        return null;
    } catch (error) {
        logger.error('Failed to get lead', error);
        return null;
    }
}

/**
 * Create a new lead
 * @param {Object} data - Lead data
 * @param {File} logoFile - Optional logo file
 * @returns {Promise<Object>} Result object
 */
export async function createLead(data, logoFile = null) {
    try {
        // Validate
        const validation = validateLeadForm(data);
        if (!validation.valid) {
            showToast(validation.errors[0], 'error');
            return { success: false, errors: validation.errors };
        }

        // Sanitize
        const sanitized = sanitizeObject(data);

        logger.info('Creating lead', { companyName: sanitized.companyName });

        // Create document
        const docRef = await addDoc(collection(db, COLLECTIONS.LEADS), {
            ...sanitized,
            demoFiles: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUserId()
        });

        logger.info('Lead created', { id: docRef.id });

        // Upload logo if provided
        if (logoFile) {
            const uploadResult = await uploadLogo(logoFile, docRef.id, 'lead');
            if (uploadResult.success) {
                await updateDoc(doc(db, COLLECTIONS.LEADS, docRef.id), {
                    logo: uploadResult.url
                });
            }
        }

        // Log activity
        await logActivity('lead_created', {
            leadId: docRef.id,
            companyName: sanitized.companyName
        });

        showToast('Lead created!', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        logger.error('Failed to create lead', error);
        showToast('Failed to create lead', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update a lead
 * @param {string} leadId - Lead ID
 * @param {Object} updates - Update data
 * @param {File} logoFile - Optional new logo file
 * @returns {Promise<Object>} Result object
 */
export async function updateLead(leadId, updates, logoFile = null) {
    try {
        // Sanitize
        const sanitized = sanitizeObject(updates);

        logger.info('Updating lead', { leadId });

        // Upload logo if provided
        if (logoFile) {
            const uploadResult = await uploadLogo(logoFile, leadId, 'lead');
            if (uploadResult.success) {
                sanitized.logo = uploadResult.url;
            }
        }

        await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
            ...sanitized,
            updatedAt: serverTimestamp()
        });

        logger.info('Lead updated', { leadId });
        showToast('Lead updated!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to update lead', error);
        showToast('Failed to update lead', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update lead status
 * @param {string} leadId - Lead ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Result object
 */
export async function updateLeadStatus(leadId, status) {
    try {
        await updateDoc(doc(db, COLLECTIONS.LEADS, leadId), {
            status,
            updatedAt: serverTimestamp()
        });

        logger.info('Lead status updated', { leadId, status });
        showToast('Status updated!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to update lead status', error);
        showToast('Failed to update status', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Add a demo file to lead
 * @param {string} leadId - Lead ID
 * @param {Object} fileData - File data
 * @returns {Promise<Object>} Result object
 */
export async function addLeadDemoFile(leadId, fileData) {
    try {
        const leadRef = doc(db, COLLECTIONS.LEADS, leadId);
        const leadSnap = await getDoc(leadRef);

        if (!leadSnap.exists()) {
            return { success: false, error: 'Lead not found' };
        }

        const lead = leadSnap.data();
        const demoFiles = lead.demoFiles || [];

        await updateDoc(leadRef, {
            demoFiles: [...demoFiles, {
                ...fileData,
                uploadedAt: new Date().toISOString()
            }],
            updatedAt: serverTimestamp()
        });

        showToast('File added!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to add demo file', error);
        showToast('Failed to add file', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Remove a demo file from lead
 * @param {string} leadId - Lead ID
 * @param {number} fileIndex - File index to remove
 * @returns {Promise<Object>} Result object
 */
export async function removeLeadDemoFile(leadId, fileIndex) {
    try {
        const leadRef = doc(db, COLLECTIONS.LEADS, leadId);
        const leadSnap = await getDoc(leadRef);

        if (!leadSnap.exists()) {
            return { success: false, error: 'Lead not found' };
        }

        const lead = leadSnap.data();
        const demoFiles = [...(lead.demoFiles || [])];
        demoFiles.splice(fileIndex, 1);

        await updateDoc(leadRef, {
            demoFiles,
            updatedAt: serverTimestamp()
        });

        showToast('File removed!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to remove demo file', error);
        showToast('Failed to remove file', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Move lead to projects
 * @param {string} leadId - Lead ID
 * @returns {Promise<Object>} Result object with project ID
 */
export async function moveLeadToProject(leadId) {
    try {
        const leadSnap = await getDoc(doc(db, COLLECTIONS.LEADS, leadId));

        if (!leadSnap.exists()) {
            showToast('Lead not found', 'error');
            return { success: false, error: 'Lead not found' };
        }

        const lead = leadSnap.data();
        logger.info('Moving lead to project', { leadId, companyName: lead.companyName });

        // Create project from lead
        const projectRef = await addDoc(collection(db, 'projects'), {
            companyName: lead.companyName || '',
            clientName: lead.clientName || '',
            clientEmail: lead.clientEmail || '',
            clientPhone: lead.clientPhone || '',
            websiteUrl: lead.websiteUrl || '',
            logo: lead.logo || null,
            location: lead.location || '',
            businessType: lead.businessType || '',
            githubLink: lead.githubLink || '',
            githubUrl: lead.githubUrl || '',
            notes: lead.notes || '',
            demoFiles: lead.demoFiles || [],
            status: 'active',
            tier: 'farmer',
            progress: 0,
            assignedClients: [],
            milestones: [{
                id: 'm1',
                title: 'Kickoff',
                status: 'current',
                date: new Date().toISOString().split('T')[0]
            }],
            invoices: [],
            clientFiles: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            convertedFromLead: leadId,
            createdBy: getCurrentUserId()
        });

        // Delete lead
        await deleteDoc(doc(db, COLLECTIONS.LEADS, leadId));

        // Log activity
        await logActivity('lead_converted', {
            leadId,
            projectId: projectRef.id,
            companyName: lead.companyName
        });

        logger.info('Lead moved to project', { leadId, projectId: projectRef.id });
        showToast('Moved to Projects!', 'success');

        return { success: true, projectId: projectRef.id };
    } catch (error) {
        logger.error('Failed to move lead to project', error);
        showToast('Failed to move to projects', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Archive a lead
 * @param {string} leadId - Lead ID
 * @param {string} reason - Archive reason
 * @returns {Promise<Object>} Result object
 */
export async function archiveLead(leadId, reason = 'Archived') {
    try {
        const leadSnap = await getDoc(doc(db, COLLECTIONS.LEADS, leadId));

        if (!leadSnap.exists()) {
            showToast('Lead not found', 'error');
            return { success: false, error: 'Lead not found' };
        }

        const lead = leadSnap.data();

        // Add to archive
        await addDoc(collection(db, COLLECTIONS.ARCHIVED), {
            type: 'lead',
            originalId: leadId,
            companyName: lead.companyName || '',
            clientName: lead.clientName || '',
            clientEmail: lead.clientEmail || '',
            reason,
            archivedAt: serverTimestamp(),
            archivedBy: getCurrentUserId(),
            originalData: lead
        });

        // Delete original
        await deleteDoc(doc(db, COLLECTIONS.LEADS, leadId));

        // Log activity
        await logActivity('lead_archived', {
            leadId,
            companyName: lead.companyName,
            reason
        });

        removeLead(leadId);
        logger.info('Lead archived', { leadId });
        showToast('Lead archived!', 'success');

        return { success: true };
    } catch (error) {
        logger.error('Failed to archive lead', error);
        showToast('Failed to archive lead', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Search leads
 * @param {string} searchTerm - Search term
 * @returns {Promise<Array>} Matching leads
 */
export async function searchLeads(searchTerm) {
    try {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return [];

        // Note: Firestore doesn't support full-text search
        // For production, consider using Algolia or Elasticsearch
        // This is a simple client-side filter

        const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.LEADS), orderBy('createdAt', 'desc'))
        );

        const leads = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(lead =>
                lead.companyName?.toLowerCase().includes(term) ||
                lead.clientName?.toLowerCase().includes(term) ||
                lead.clientEmail?.toLowerCase().includes(term) ||
                lead.location?.toLowerCase().includes(term) ||
                lead.businessType?.toLowerCase().includes(term)
            );

        return leads;
    } catch (error) {
        logger.error('Failed to search leads', error);
        return [];
    }
}

/**
 * Get lead statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getLeadStats() {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.LEADS));
        const leads = snapshot.docs.map(doc => doc.data());

        return {
            total: leads.length,
            noted: leads.filter(l => l.status === 'noted').length,
            demoSent: leads.filter(l => l.status === 'demo-sent').length,
            demoComplete: leads.filter(l => l.status === 'demo-complete').length
        };
    } catch (error) {
        logger.error('Failed to get lead stats', error);
        return { total: 0, noted: 0, demoSent: 0, demoComplete: 0 };
    }
}
