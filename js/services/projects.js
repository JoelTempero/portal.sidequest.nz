/* ============================================
   SIDEQUEST DIGITAL - Projects Service
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
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from './firebase-init.js';

import {
    setProjects,
    upsertProject,
    removeProject,
    addUnsubscriber,
    getCurrentUserId,
    isAdmin,
    getState
} from './state.js';

import { createLogger } from '../utils/logger.js';
import { validateProjectForm } from '../utils/validation.js';
import { sanitizeObject } from '../utils/sanitize.js';
import { showToast } from '../components/toast.js';
import { COLLECTIONS, TIERS, PROJECT_STATUSES } from '../config/constants.js';
import { uploadLogo, uploadFile } from './storage.js';
import { logActivity } from './activity.js';
import { generateId } from '../utils/helpers.js';

const logger = createLogger('Projects');

/**
 * Load projects (filtered by role)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Projects array
 */
export async function loadProjects(options = {}) {
    const { status = null, tier = null } = options;

    try {
        logger.info('Loading projects');

        let q;
        if (isAdmin()) {
            q = query(
                collection(db, COLLECTIONS.PROJECTS),
                orderBy('createdAt', 'desc')
            );
        } else {
            // Clients only see assigned projects
            const userId = getCurrentUserId();
            q = query(
                collection(db, COLLECTIONS.PROJECTS),
                where('assignedClients', 'array-contains', userId || '')
            );
        }

        const snapshot = await getDocs(q);
        let projects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Apply additional filters client-side
        if (status) {
            projects = projects.filter(p => p.status === status);
        }
        if (tier) {
            projects = projects.filter(p => p.tier === tier);
        }

        setProjects(projects);
        logger.info(`Loaded ${projects.length} projects`);

        return projects;
    } catch (error) {
        logger.error('Failed to load projects', error);
        showToast('Failed to load projects', 'error');
        return [];
    }
}

/**
 * Subscribe to projects updates
 * @param {Function} callback - Callback when projects update
 * @returns {Function} Unsubscribe function
 */
export function subscribeToProjects(callback = null) {
    let q;
    if (isAdmin()) {
        q = query(
            collection(db, COLLECTIONS.PROJECTS),
            orderBy('createdAt', 'desc')
        );
    } else {
        const userId = getCurrentUserId();
        q = query(
            collection(db, COLLECTIONS.PROJECTS),
            where('assignedClients', 'array-contains', userId || '')
        );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const projects = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        setProjects(projects);
        if (callback) callback(projects);
    }, (error) => {
        logger.error('Projects subscription error', error);
    });

    addUnsubscriber(unsubscribe);
    return unsubscribe;
}

/**
 * Get a single project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>} Project object
 */
export async function getProject(projectId) {
    try {
        const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }

        return null;
    } catch (error) {
        logger.error('Failed to get project', error);
        return null;
    }
}

/**
 * Create a new project
 * @param {Object} data - Project data
 * @param {File} logoFile - Optional logo file
 * @returns {Promise<Object>} Result object
 */
export async function createProject(data, logoFile = null) {
    try {
        // Validate
        const validation = validateProjectForm(data);
        if (!validation.valid) {
            showToast(validation.errors[0], 'error');
            return { success: false, errors: validation.errors };
        }

        // Sanitize
        const sanitized = sanitizeObject(data);

        logger.info('Creating project', { companyName: sanitized.companyName });

        // Create document
        const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), {
            ...sanitized,
            status: sanitized.status || PROJECT_STATUSES.ACTIVE,
            tier: sanitized.tier || TIERS.FARMER,
            progress: parseInt(sanitized.progress) || 0,
            assignedClients: sanitized.assignedClients || [],
            milestones: sanitized.milestones || [{
                id: 'm1',
                title: 'Kickoff',
                status: 'current',
                date: new Date().toISOString().split('T')[0]
            }],
            invoices: [],
            clientFiles: [],
            demoFiles: sanitized.demoFiles || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: getCurrentUserId()
        });

        logger.info('Project created', { id: docRef.id });

        // Upload logo if provided
        if (logoFile) {
            const uploadResult = await uploadLogo(logoFile, docRef.id, 'project');
            if (uploadResult.success) {
                await updateDoc(doc(db, COLLECTIONS.PROJECTS, docRef.id), {
                    logo: uploadResult.url
                });
            }
        }

        // Log activity
        await logActivity('project_created', {
            projectId: docRef.id,
            companyName: sanitized.companyName
        });

        showToast('Project created!', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        logger.error('Failed to create project', error);
        showToast('Failed to create project', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update a project
 * @param {string} projectId - Project ID
 * @param {Object} updates - Update data
 * @param {File} logoFile - Optional new logo file
 * @returns {Promise<Object>} Result object
 */
export async function updateProject(projectId, updates, logoFile = null) {
    try {
        // Sanitize
        const sanitized = sanitizeObject(updates);

        logger.info('Updating project', { projectId });

        // Upload logo if provided
        if (logoFile) {
            const uploadResult = await uploadLogo(logoFile, projectId, 'project');
            if (uploadResult.success) {
                sanitized.logo = uploadResult.url;
            }
        }

        await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
            ...sanitized,
            updatedAt: serverTimestamp()
        });

        logger.info('Project updated', { projectId });
        showToast('Project updated!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to update project', error);
        showToast('Failed to update project', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update project progress
 * @param {string} projectId - Project ID
 * @param {number} progress - Progress percentage (0-100)
 * @returns {Promise<Object>} Result object
 */
export async function updateProjectProgress(projectId, progress) {
    const validProgress = Math.min(100, Math.max(0, parseInt(progress) || 0));

    try {
        await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
            progress: validProgress,
            updatedAt: serverTimestamp()
        });

        showToast('Progress updated!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to update progress', error);
        showToast('Failed to update progress', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Assign client to project
 * @param {string} projectId - Project ID
 * @param {string} clientId - Client user ID
 * @returns {Promise<Object>} Result object
 */
export async function assignClientToProject(projectId, clientId) {
    try {
        await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
            assignedClients: arrayUnion(clientId),
            updatedAt: serverTimestamp()
        });

        showToast('Client assigned!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to assign client', error);
        showToast('Failed to assign client', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Remove client from project
 * @param {string} projectId - Project ID
 * @param {string} clientId - Client user ID
 * @returns {Promise<Object>} Result object
 */
export async function removeClientFromProject(projectId, clientId) {
    try {
        await updateDoc(doc(db, COLLECTIONS.PROJECTS, projectId), {
            assignedClients: arrayRemove(clientId),
            updatedAt: serverTimestamp()
        });

        showToast('Client removed!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to remove client', error);
        showToast('Failed to remove client', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================
// MILESTONES
// ============================================

/**
 * Add milestone to project
 * @param {string} projectId - Project ID
 * @param {Object} milestone - Milestone data
 * @returns {Promise<Object>} Result object
 */
export async function addMilestone(projectId, milestone) {
    try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const milestones = project.milestones || [];

        const newMilestone = {
            id: generateId('m'),
            title: milestone.title,
            status: milestone.status || 'pending',
            date: milestone.date || new Date().toISOString().split('T')[0]
        };

        await updateDoc(projectRef, {
            milestones: [...milestones, newMilestone],
            updatedAt: serverTimestamp()
        });

        showToast('Milestone added!', 'success');
        return { success: true, milestoneId: newMilestone.id };
    } catch (error) {
        logger.error('Failed to add milestone', error);
        showToast('Failed to add milestone', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update milestone
 * @param {string} projectId - Project ID
 * @param {string} milestoneId - Milestone ID
 * @param {Object} updates - Milestone updates
 * @returns {Promise<Object>} Result object
 */
export async function updateMilestone(projectId, milestoneId, updates) {
    try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const milestones = project.milestones || [];
        const index = milestones.findIndex(m => m.id === milestoneId);

        if (index === -1) {
            return { success: false, error: 'Milestone not found' };
        }

        milestones[index] = { ...milestones[index], ...updates };

        // If marking as completed, log activity
        if (updates.status === 'completed') {
            await logActivity('milestone_completed', {
                projectId,
                milestoneId,
                milestoneTitle: milestones[index].title,
                companyName: project.companyName
            });
        }

        await updateDoc(projectRef, {
            milestones,
            updatedAt: serverTimestamp()
        });

        showToast('Milestone updated!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to update milestone', error);
        showToast('Failed to update milestone', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Delete milestone
 * @param {string} projectId - Project ID
 * @param {string} milestoneId - Milestone ID
 * @returns {Promise<Object>} Result object
 */
export async function deleteMilestone(projectId, milestoneId) {
    try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const milestones = (project.milestones || []).filter(m => m.id !== milestoneId);

        await updateDoc(projectRef, {
            milestones,
            updatedAt: serverTimestamp()
        });

        showToast('Milestone deleted!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to delete milestone', error);
        showToast('Failed to delete milestone', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================
// INVOICES
// ============================================

/**
 * Add invoice to project
 * @param {string} projectId - Project ID
 * @param {Object} invoice - Invoice data
 * @returns {Promise<Object>} Result object
 */
export async function addInvoice(projectId, invoice) {
    try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const invoices = project.invoices || [];

        const newInvoice = {
            id: generateId('inv'),
            number: invoice.number,
            amount: parseFloat(invoice.amount) || 0,
            status: invoice.status || 'pending',
            dueDate: invoice.dueDate,
            description: invoice.description || '',
            createdAt: new Date().toISOString()
        };

        await updateDoc(projectRef, {
            invoices: [...invoices, newInvoice],
            updatedAt: serverTimestamp()
        });

        // Log activity
        await logActivity('invoice_created', {
            projectId,
            invoiceNumber: newInvoice.number,
            amount: newInvoice.amount,
            companyName: project.companyName
        });

        showToast('Invoice added!', 'success');
        return { success: true, invoiceId: newInvoice.id };
    } catch (error) {
        logger.error('Failed to add invoice', error);
        showToast('Failed to add invoice', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Update invoice
 * @param {string} projectId - Project ID
 * @param {string} invoiceId - Invoice ID
 * @param {Object} updates - Invoice updates
 * @returns {Promise<Object>} Result object
 */
export async function updateInvoice(projectId, invoiceId, updates) {
    try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const invoices = project.invoices || [];
        const index = invoices.findIndex(i => i.id === invoiceId);

        if (index === -1) {
            return { success: false, error: 'Invoice not found' };
        }

        const wasUnpaid = invoices[index].status !== 'paid';
        invoices[index] = { ...invoices[index], ...updates };

        // If marking as paid, log activity
        if (updates.status === 'paid' && wasUnpaid) {
            await logActivity('invoice_paid', {
                projectId,
                invoiceNumber: invoices[index].number,
                amount: invoices[index].amount,
                companyName: project.companyName
            });
        }

        await updateDoc(projectRef, {
            invoices,
            updatedAt: serverTimestamp()
        });

        showToast('Invoice updated!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to update invoice', error);
        showToast('Failed to update invoice', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================
// CLIENT FILES
// ============================================

/**
 * Add client file to project
 * @param {string} projectId - Project ID
 * @param {File} file - File to upload
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Result object
 */
export async function addClientFile(projectId, file, onProgress = null) {
    try {
        // Upload file
        const uploadResult = await uploadFile(
            file,
            `files/projects/${projectId}`,
            { onProgress }
        );

        if (!uploadResult.success) {
            return uploadResult;
        }

        // Add to project
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const clientFiles = project.clientFiles || [];

        const newFile = {
            id: generateId('cf'),
            name: file.name,
            size: uploadResult.size,
            url: uploadResult.url,
            uploadedBy: getState('userProfile')?.displayName || 'User',
            uploadedAt: new Date().toISOString()
        };

        await updateDoc(projectRef, {
            clientFiles: [...clientFiles, newFile],
            updatedAt: serverTimestamp()
        });

        // Log activity
        await logActivity('file_uploaded', {
            projectId,
            fileName: file.name,
            companyName: project.companyName
        });

        showToast('File uploaded!', 'success');
        return { success: true, fileId: newFile.id };
    } catch (error) {
        logger.error('Failed to add client file', error);
        showToast('Failed to upload file', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Remove client file from project
 * @param {string} projectId - Project ID
 * @param {string} fileId - File ID
 * @returns {Promise<Object>} Result object
 */
export async function removeClientFile(projectId, fileId) {
    try {
        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();
        const clientFiles = (project.clientFiles || []).filter(f => f.id !== fileId);

        await updateDoc(projectRef, {
            clientFiles,
            updatedAt: serverTimestamp()
        });

        showToast('File removed!', 'success');
        return { success: true };
    } catch (error) {
        logger.error('Failed to remove client file', error);
        showToast('Failed to remove file', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================
// ARCHIVE & CONVERT
// ============================================

/**
 * Archive a project
 * @param {string} projectId - Project ID
 * @param {string} reason - Archive reason
 * @returns {Promise<Object>} Result object
 */
export async function archiveProject(projectId, reason = 'Archived') {
    try {
        const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));

        if (!projectSnap.exists()) {
            showToast('Project not found', 'error');
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();

        // Add to archive
        await addDoc(collection(db, COLLECTIONS.ARCHIVED), {
            type: 'project',
            originalId: projectId,
            companyName: project.companyName || '',
            clientName: project.clientName || '',
            clientEmail: project.clientEmail || '',
            reason,
            archivedAt: serverTimestamp(),
            archivedBy: getCurrentUserId(),
            originalData: project
        });

        // Delete original
        await deleteDoc(doc(db, COLLECTIONS.PROJECTS, projectId));

        // Log activity
        await logActivity('project_archived', {
            projectId,
            companyName: project.companyName,
            reason
        });

        removeProject(projectId);
        logger.info('Project archived', { projectId });
        showToast('Project archived!', 'success');

        return { success: true };
    } catch (error) {
        logger.error('Failed to archive project', error);
        showToast('Failed to archive project', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Return project to leads
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Result object with lead ID
 */
export async function returnProjectToLead(projectId) {
    try {
        const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));

        if (!projectSnap.exists()) {
            showToast('Project not found', 'error');
            return { success: false, error: 'Project not found' };
        }

        const project = projectSnap.data();

        // Create lead from project
        const leadRef = await addDoc(collection(db, COLLECTIONS.LEADS), {
            companyName: project.companyName,
            clientName: project.clientName,
            clientEmail: project.clientEmail,
            clientPhone: project.clientPhone || '',
            websiteUrl: project.websiteUrl || '',
            logo: project.logo || null,
            location: project.location || '',
            businessType: project.businessType || '',
            githubLink: project.githubLink || '',
            githubUrl: project.githubUrl || '',
            status: 'noted',
            demoFiles: project.demoFiles || [],
            notes: `Returned from project. ${project.notes || ''}`.trim(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            returnedFromProject: projectId,
            createdBy: getCurrentUserId()
        });

        // Delete project
        await deleteDoc(doc(db, COLLECTIONS.PROJECTS, projectId));

        logger.info('Project returned to lead', { projectId, leadId: leadRef.id });
        showToast('Returned to Leads!', 'success');

        return { success: true, leadId: leadRef.id };
    } catch (error) {
        logger.error('Failed to return project to lead', error);
        showToast('Failed to return to leads', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Get project statistics
 * @returns {Promise<Object>} Statistics object
 */
export async function getProjectStats() {
    try {
        let q;
        if (isAdmin()) {
            q = collection(db, COLLECTIONS.PROJECTS);
        } else {
            const userId = getCurrentUserId();
            q = query(
                collection(db, COLLECTIONS.PROJECTS),
                where('assignedClients', 'array-contains', userId || '')
            );
        }

        const snapshot = await getDocs(q);
        const projects = snapshot.docs.map(doc => doc.data());

        const pendingInvoices = projects.flatMap(p => p.invoices || [])
            .filter(i => i.status === 'pending');

        const pendingRevenue = pendingInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

        return {
            total: projects.length,
            active: projects.filter(p => p.status === 'active').length,
            paused: projects.filter(p => p.status === 'paused').length,
            completed: projects.filter(p => p.status === 'completed').length,
            pendingInvoices: pendingInvoices.length,
            pendingRevenue
        };
    } catch (error) {
        logger.error('Failed to get project stats', error);
        return {
            total: 0, active: 0, paused: 0, completed: 0,
            pendingInvoices: 0, pendingRevenue: 0
        };
    }
}
