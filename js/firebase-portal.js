/* ============================================
   SIDEQUEST DIGITAL - Client Portal JS
   Firebase Connected Version
   ============================================ */

import { FIREBASE_CONFIG, NAVIGATION, UI_TIMING } from './config/constants.js';

// Use centralized Firebase config from constants.js
const firebaseConfig = FIREBASE_CONFIG;

// Tier names: Personal, Host, Bug Catcher, Farmer, Watchful Eye, Guardian
const TIER_NAMES = { personal: 'Personal', host: 'Host', bugcatcher: 'Bug Catcher', farmer: 'Farmer', watchfuleye: 'Watchful Eye', guardian: 'Guardian' };
const TIER_ORDER = { guardian: 0, watchfuleye: 1, farmer: 2, bugcatcher: 3, host: 4, personal: 5 };

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, browserLocalPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Set Firebase auth persistence to local (survives browser restart)
// This is more secure than manual localStorage and handles token refresh automatically
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to set auth persistence:', error);
});

const AppState = {
    currentUser: null, userProfile: null, isAdmin: false,
    leads: [], projects: [], archived: [], tickets: [], clients: [], messages: [],
    posts: [],  // NEW: Posts collection
    currentItem: null, unsubscribers: [], pendingLogoFile: null
};

/**
 * Check if user has admin/manager role based on Firestore profile
 * This replaces the hardcoded ADMIN_UIDS approach for better security
 * Admin status is determined by the 'role' field in the user's Firestore document
 * @param {Object} userProfile - User profile from Firestore
 * @returns {boolean} True if user has admin or manager role
 */
function checkIsAdmin(userProfile) {
    if (!userProfile || !userProfile.role) return false;
    return ['admin', 'manager'].includes(userProfile.role);
}

/**
 * Check if user has specific role
 * @param {string} role - Role to check for
 * @returns {boolean} True if user has the role
 */
function hasRole(role) {
    if (!AppState.userProfile) return false;
    const userRole = AppState.userProfile.role;

    // Role hierarchy: admin > manager > support > client
    const roleHierarchy = {
        admin: ['admin', 'manager', 'support', 'client'],
        manager: ['manager', 'support', 'client'],
        support: ['support', 'client'],
        client: ['client']
    };

    const allowedRoles = roleHierarchy[userRole] || [];
    return allowedRoles.includes(role);
}

// Utilities
const formatDate = d => { if (!d) return '-'; const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', year: 'numeric' }); };
const formatCurrency = n => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n || 0);
const timeAgo = d => { if (!d) return '-'; const date = d.toDate ? d.toDate() : new Date(d); const s = Math.floor((new Date() - date) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const getInitials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase() : '??';
const LEGACY_TIER_MAP = { premium: 'watchfuleye', enterprise: 'watchfuleye', professional: 'farmer', starter: 'bugcatcher', basic: 'host' };
const getTierOrder = t => {
    // Map legacy tiers to current ones before getting order
    const mapped = LEGACY_TIER_MAP[t] || t;
    return TIER_ORDER[mapped] ?? 6; // Unknown tiers go last
};
const getTierName = t => {
    const mapped = LEGACY_TIER_MAP[t] || t;
    return TIER_NAMES[mapped] || t;
};
const getStatusLabel = s => ({ 'noted': 'Noted', 'demo-complete': 'Demo Complete', 'demo-sent': 'Demo Sent', 'active': 'Active', 'testing': 'Testing', 'paused': 'Paused', 'completed': 'Completed', 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' }[s] || s);
const showLoading = (show = true) => { const l = document.getElementById('loading-overlay'); if (l) l.style.display = show ? 'flex' : 'none'; };
const showToast = (msg, type = 'info') => { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg; t.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;border-radius:8px;color:white;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};`; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };

// Auth
async function login(email, password) {
    try { showLoading(true); const c = await signInWithEmailAndPassword(auth, email, password); return { success: true, user: c.user }; }
    catch (e) { return { success: false, error: e.code === 'auth/invalid-credential' ? 'Invalid email or password.' : 'Login failed.' }; }
    finally { showLoading(false); }
}
async function logout() { AppState.unsubscribers.forEach(u => u()); AppState.unsubscribers = []; await signOut(auth); window.location.href = 'index.html'; }

async function createClientWithAuth(email, password, displayName, company) {
    try {
        console.log('Creating client via Cloud Function:', { email, displayName, company });
        
        // Call the Cloud Function to create the Auth user
        const createClientFn = httpsCallable(functions, 'createClient');
        const result = await createClientFn({ email, password, displayName });
        
        console.log('Cloud Function result:', result.data);
        
        // Now create the Firestore document with the same UID
        await setDoc(doc(db, 'users', result.data.uid), {
            email,
            displayName,
            company: company || '',
            role: 'client',
            tempPassword: password,
            status: 'active',
            createdAt: serverTimestamp()
        });
        
        showToast('Client created!', 'success');
        return { success: true, id: result.data.uid, email, password };
    } catch (e) {
        console.error('Create client error:', e);
        const message = e.message || 'Failed to create client';
        showToast(message, 'error');
        return { success: false, error: message };
    }
}

// Image Compression - compress images before upload for faster loading
async function compressImage(file, maxWidth = 400, quality = 0.8) {
    // Only compress images
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                // Create canvas and compress
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob && blob.size < file.size) {
                        // Create a new file from the compressed blob
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        console.log(`[Image] Compressed from ${Math.round(file.size/1024)}KB to ${Math.round(blob.size/1024)}KB`);
                        resolve(compressedFile);
                    } else {
                        // Original is smaller or same, use original
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file); // On error, use original
            img.src = e.target.result;
        };
        reader.onerror = () => resolve(file); // On error, use original
        reader.readAsDataURL(file);
    });
}

// File Upload
async function uploadFile(file, path) {
    try {
        const storageRef = ref(storage, path);
        const snap = await uploadBytes(storageRef, file);
        return await getDownloadURL(snap.ref);
    } catch (e) { console.error('Upload error:', e); return null; }
}

async function uploadLogo(file, itemId, type = 'project') {
    try {
        showLoading(true);
        // Compress the image before upload (max 400px wide for logos)
        const compressedFile = await compressImage(file, 400, 0.85);
        const path = `logos/${type}s/${itemId}/${Date.now()}_logo.jpg`;
        const url = await uploadFile(compressedFile, path);
        if (url) {
            const col = type === 'lead' ? 'leads' : 'projects';
            await updateDoc(doc(db, col, itemId), { logo: url });
            showToast('Logo uploaded!', 'success');
            showLoading(false);
            return { success: true, url };
        }
        showLoading(false);
        return { success: false };
    } catch (e) { showLoading(false); showToast('Upload failed', 'error'); return { success: false }; }
}

// LEADS
async function loadLeads() { try { const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc')); const s = await getDocs(q); AppState.leads = s.docs.map(d => ({ id: d.id, ...d.data() })); return AppState.leads; } catch (e) { return []; } }
function subscribeToLeads(cb) { const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc')); const u = onSnapshot(q, s => { AppState.leads = s.docs.map(d => ({ id: d.id, ...d.data() })); if (cb) cb(AppState.leads); }); AppState.unsubscribers.push(u); return u; }
async function createLead(data, logoFile = null) {
    try {
        console.log('Creating lead:', data);
        const ref = await addDoc(collection(db, 'leads'), { ...data, demoFiles: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        console.log('Lead created with ID:', ref.id);
        if (logoFile) {
            const url = await uploadFile(logoFile, `logos/leads/${ref.id}/${Date.now()}_${logoFile.name}`);
            if (url) await updateDoc(doc(db, 'leads', ref.id), { logo: url });
        }
        showToast('Lead created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { console.error('Create lead error:', e); showToast('Failed to create lead', 'error'); return { success: false }; }
}
async function updateLead(id, updates) { try { await updateDoc(doc(db, 'leads', id), { ...updates, updatedAt: serverTimestamp() }); showToast('Lead updated!', 'success'); return { success: true }; } catch (e) { showToast('Failed to update', 'error'); return { success: false }; } }

// PROJECTS
async function loadProjects() {
    try {
        let q;
        if (AppState.isAdmin) {
            q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        } else {
            // For clients, only load projects they're assigned to
            q = query(collection(db, 'projects'), where('assignedClients', 'array-contains', AppState.currentUser?.uid || ''));
        }
        const s = await getDocs(q);
        AppState.projects = s.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.projects;
    } catch (e) { console.error('Load projects error:', e); return []; }
}
function subscribeToProjects(cb) {
    const q = AppState.isAdmin ? query(collection(db, 'projects'), orderBy('createdAt', 'desc')) : query(collection(db, 'projects'), where('assignedClients', 'array-contains', AppState.currentUser?.uid || ''));
    const u = onSnapshot(q, s => { AppState.projects = s.docs.map(d => ({ id: d.id, ...d.data() })); if (cb) cb(AppState.projects); });
    AppState.unsubscribers.push(u); return u;
}
async function createProject(data, logoFile = null) {
    try {
        const ref = await addDoc(collection(db, 'projects'), {
            ...data, status: data.status || 'active', tier: data.tier || 'farmer', progress: parseInt(data.progress) || 0,
            assignedClients: data.assignedClients || [], milestones: data.milestones || [{ id: 'm1', title: 'Kickoff', status: 'current', date: new Date().toISOString().split('T')[0] }],
            invoices: [], clientFiles: [], demoFiles: [],
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        if (logoFile) {
            const url = await uploadFile(logoFile, `logos/projects/${ref.id}/${Date.now()}_${logoFile.name}`);
            if (url) await updateDoc(doc(db, 'projects', ref.id), { logo: url });
        }
        showToast('Project created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { showToast('Failed to create project', 'error'); return { success: false }; }
}
async function updateProject(id, updates) {
    try {
        console.log('Updating project:', id, updates);
        await updateDoc(doc(db, 'projects', id), { ...updates, updatedAt: serverTimestamp() });

        // If tier was updated, also update all tickets for this project
        if (updates.tier) {
            console.log('Tier changed, updating related tickets...');
            try {
                const ticketsQuery = query(collection(db, 'tickets'), where('projectId', '==', id));
                const ticketsSnapshot = await getDocs(ticketsQuery);
                const updatePromises = ticketsSnapshot.docs.map(ticketDoc =>
                    updateDoc(doc(db, 'tickets', ticketDoc.id), { tier: updates.tier })
                );
                await Promise.all(updatePromises);
                console.log(`Updated tier for ${ticketsSnapshot.docs.length} tickets`);
            } catch (ticketErr) {
                console.warn('Could not update ticket tiers:', ticketErr);
            }
        }

        showToast('Project updated!', 'success');
        return { success: true };
    } catch (e) { console.error('Update project error:', e); showToast('Failed to update', 'error'); return { success: false }; }
}

// CLIENTS
async function loadClients() {
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'client'));
        const s = await getDocs(q);
        // Filter out archived clients
        AppState.clients = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.status !== 'archived');
        return AppState.clients;
    } catch (e) { return []; }
}
async function updateClient(id, updates) { try { await updateDoc(doc(db, 'users', id), updates); showToast('Client updated!', 'success'); return { success: true }; } catch (e) { showToast('Failed to update', 'error'); return { success: false }; } }
async function archiveClient(clientId) {
    try {
        const snap = await getDoc(doc(db, 'users', clientId));
        if (!snap.exists()) { showToast('Client not found', 'error'); return { success: false }; }
        const data = snap.data();
        // Add to archived collection
        await addDoc(collection(db, 'archived'), {
            type: 'client',
            originalId: clientId,
            companyName: data.company || '',
            clientName: data.displayName || '',
            clientEmail: data.email || '',
            reason: 'Archived',
            archivedAt: serverTimestamp(),
            originalData: data
        });
        // Delete from users
        await deleteDoc(doc(db, 'users', clientId));
        showToast('Client archived!', 'success');
        return { success: true };
    } catch (e) { console.error('Archive client error:', e); showToast('Failed to archive', 'error'); return { success: false }; }
}

// ARCHIVE
async function loadArchive() { try { const q = query(collection(db, 'archived'), orderBy('archivedAt', 'desc')); const s = await getDocs(q); AppState.archived = s.docs.map(d => ({ id: d.id, ...d.data() })); return AppState.archived; } catch (e) { return []; } }
async function archiveItem(type, itemId) {
    try {
        const col = type === 'lead' ? 'leads' : 'projects';
        const snap = await getDoc(doc(db, col, itemId));
        if (!snap.exists()) { showToast('Not found', 'error'); return { success: false }; }
        const data = snap.data();
        await addDoc(collection(db, 'archived'), { type, originalId: itemId, companyName: data.companyName || '', clientName: data.clientName || '', clientEmail: data.clientEmail || '', reason: 'Archived', archivedAt: serverTimestamp(), originalData: data });
        await deleteDoc(doc(db, col, itemId));
        showToast('Archived!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed to archive', 'error'); return { success: false }; }
}
async function restoreFromArchive(archiveId) {
    try {
        const snap = await getDoc(doc(db, 'archived', archiveId));
        if (!snap.exists()) { showToast('Not found', 'error'); return { success: false }; }
        const data = snap.data();
        
        // Determine which collection to restore to
        let targetCollection;
        if (data.type === 'lead') targetCollection = 'leads';
        else if (data.type === 'client') targetCollection = 'users';
        else targetCollection = 'projects';
        
        await addDoc(collection(db, targetCollection), { ...data.originalData, restoredAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await deleteDoc(doc(db, 'archived', archiveId));
        showToast('Restored!', 'success');
        return { success: true };
    } catch (e) { console.error('Restore error:', e); showToast('Failed to restore', 'error'); return { success: false }; }
}

async function deletePermanent(archiveId) {
    try {
        await deleteDoc(doc(db, 'archived', archiveId));
        showToast('Permanently deleted', 'success');
        return { success: true };
    } catch (e) { console.error('Delete error:', e); showToast('Failed to delete', 'error'); return { success: false }; }
}

// TICKETS
async function loadTickets() {
    console.log('loadTickets called, isAdmin:', AppState.isAdmin, 'userId:', AppState.currentUser?.uid);
    try {
        if (AppState.isAdmin) {
            // Admins can see all tickets
            const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
            const s = await getDocs(q);
            AppState.tickets = s.docs.map(d => ({ id: d.id, ...d.data() }));
        } else {
            // Clients can see tickets where:
            // 1. clientId matches their uid (new tickets)
            // 2. submittedById matches their uid (old tickets)
            // 3. projectId is in their assigned projects
            const userId = AppState.currentUser?.uid || '';
            console.log('Client loading tickets for userId:', userId);

            // Get user's project IDs
            const projectIds = AppState.projects.map(p => p.id);
            console.log('User project IDs:', projectIds);

            // Query tickets by clientId
            const ticketsMap = new Map();

            try {
                const q1 = query(collection(db, 'tickets'), where('clientId', '==', userId));
                const s1 = await getDocs(q1);
                console.log('Query by clientId returned', s1.docs.length, 'results');
                s1.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
            } catch (e) {
                console.log('clientId query failed:', e.message);
            }

            // Also query by submittedById for old tickets
            try {
                const q2 = query(collection(db, 'tickets'), where('submittedById', '==', userId));
                const s2 = await getDocs(q2);
                console.log('Query by submittedById returned', s2.docs.length, 'results');
                s2.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
            } catch (e) {
                console.log('submittedById query failed:', e.message);
            }

            // Query by projectId for each of the user's projects (in batches of 10)
            for (let i = 0; i < projectIds.length; i += 10) {
                const batch = projectIds.slice(i, i + 10);
                if (batch.length > 0) {
                    try {
                        const q3 = query(collection(db, 'tickets'), where('projectId', 'in', batch));
                        const s3 = await getDocs(q3);
                        console.log('Query by projectId batch returned', s3.docs.length, 'results');
                        s3.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
                    } catch (e) {
                        console.log('projectId query failed:', e.message);
                    }
                }
            }

            AppState.tickets = Array.from(ticketsMap.values());
            // Sort by date
            AppState.tickets.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || a.submittedAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || b.submittedAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
        }
        console.log('loadTickets result:', AppState.tickets.length, 'tickets');
        return AppState.tickets;
    } catch (e) {
        console.error('Load tickets error:', e);
        console.error('Error code:', e.code, 'Error message:', e.message);
        return [];
    }
}
function subscribeToTickets(cb) {
    console.log('subscribeToTickets called, isAdmin:', AppState.isAdmin, 'userId:', AppState.currentUser?.uid);
    if (AppState.isAdmin) {
        const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
        const u = onSnapshot(q, s => {
            AppState.tickets = s.docs.map(d => ({ id: d.id, ...d.data() }));
            if (cb) cb(AppState.tickets);
        }, (error) => {
            console.error('Tickets subscription error:', error);
        });
        AppState.unsubscribers.push(u);
        return u;
    } else {
        // For clients, subscribe to tickets by clientId
        const userId = AppState.currentUser?.uid || '';
        const q = query(collection(db, 'tickets'), where('clientId', '==', userId));
        const u = onSnapshot(q, s => {
            console.log('Tickets subscription by clientId got', s.docs.length, 'results');
            // Merge with existing tickets from other queries
            const ticketsMap = new Map(AppState.tickets.map(t => [t.id, t]));
            s.docs.forEach(d => ticketsMap.set(d.id, { id: d.id, ...d.data() }));
            AppState.tickets = Array.from(ticketsMap.values());
            AppState.tickets.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || a.submittedAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || b.submittedAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            if (cb) cb(AppState.tickets);
        }, (error) => {
            console.error('Tickets subscription error:', error);
        });
        AppState.unsubscribers.push(u);
        return u;
    }
}
async function createTicket(data) {
    console.log('createTicket called with data:', data);
    try {
        // Validate required fields
        if (!data.title || !data.title.trim()) {
            console.error('Ticket validation failed: Title is required');
            showToast('Title is required', 'error');
            return { success: false, error: 'Title is required' };
        }
        if (!data.projectId) {
            console.error('Ticket validation failed: Project ID is required');
            showToast('Project is required', 'error');
            return { success: false, error: 'Project is required' };
        }

        const ticketData = {
            ...data,
            // Required by Firestore rules: clientId must match auth.uid
            clientId: data.submittedById || data.clientId,
            // Required by Firestore rules: createdAt timestamp
            createdAt: serverTimestamp(),
            submittedAt: serverTimestamp(),
            status: 'open',
            adminNotes: '',
            updates: []
        };
        console.log('Saving ticket to Firestore:', ticketData);

        const docRef = await addDoc(collection(db, 'tickets'), ticketData);
        console.log('Ticket created successfully with ID:', docRef.id);
        showToast('Ticket submitted!', 'success');
        return { success: true, id: docRef.id };
    } catch (e) {
        console.error('Create ticket error:', e);
        console.error('Error code:', e.code);
        console.error('Error message:', e.message);
        showToast('Failed to submit ticket: ' + (e.message || 'Unknown error'), 'error');
        return { success: false, error: e.message };
    }
}
async function updateTicket(id, updates) { try { await updateDoc(doc(db, 'tickets', id), updates); showToast('Ticket updated!', 'success'); return { success: true }; } catch (e) { console.error('Update ticket error:', e); showToast('Failed to update ticket', 'error'); return { success: false }; } }

// MESSAGES
function subscribeToMessages(projectId, cb) {
    console.log('subscribeToMessages called for project:', projectId);
    const q = query(collection(db, 'messages'), where('projectId', '==', projectId), orderBy('timestamp', 'asc'));
    const u = onSnapshot(q, s => {
        const messages = s.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('Messages snapshot received:', messages.length, 'messages');
        if (cb) cb(messages);
    }, (error) => {
        console.error('Messages subscription error:', error);
        // Try without orderBy if index doesn't exist
        if (error.code === 'failed-precondition') {
            console.log('Index missing, retrying without orderBy...');
            const fallbackQ = query(collection(db, 'messages'), where('projectId', '==', projectId));
            onSnapshot(fallbackQ, s => {
                const messages = s.docs.map(d => ({ id: d.id, ...d.data() }));
                // Sort client-side
                messages.sort((a, b) => {
                    const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
                    const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
                    return timeA - timeB;
                });
                if (cb) cb(messages);
            });
        }
    });
    AppState.unsubscribers.push(u);
    return u;
}
async function sendMessage(projectId, text) {
    try {
        // Validate user is authenticated
        if (!AppState.currentUser?.uid) {
            console.error('Cannot send message: User not authenticated');
            showToast('Please log in to send messages', 'error');
            return { success: false, error: 'Not authenticated' };
        }

        if (!text || !text.trim()) {
            console.error('Cannot send message: Empty text');
            return { success: false, error: 'Message is empty' };
        }

        if (!projectId) {
            console.error('Cannot send message: No project ID');
            showToast('Project ID missing', 'error');
            return { success: false, error: 'No project ID' };
        }

        console.log('Sending message:', { projectId, text, sender: AppState.currentUser.uid, senderName: AppState.userProfile?.displayName });

        // Include both serverTimestamp and a client-side fallback timestamp
        const messageData = {
            projectId,
            senderId: AppState.currentUser.uid,
            senderName: AppState.userProfile?.displayName || 'User',
            text: text.trim(),
            timestamp: serverTimestamp(),
            clientTimestamp: new Date().toISOString() // Fallback for display
        };

        const docRef = await addDoc(collection(db, 'messages'), messageData);
        console.log('Message sent successfully, ID:', docRef.id);
        return { success: true, id: docRef.id };
    } catch (e) {
        console.error('Send message error:', e);
        console.error('Error code:', e.code);
        console.error('Error message:', e.message);

        let errorMsg = 'Failed to send message';
        if (e.code === 'permission-denied') {
            errorMsg = 'You do not have permission to send messages on this project';
        }
        showToast(errorMsg, 'error');
        return { success: false, error: e.message };
    }
}

// MOVE/CONVERT
async function moveLeadToProject(leadId) {
    try {
        const snap = await getDoc(doc(db, 'leads', leadId));
        if (!snap.exists()) { showToast('Lead not found', 'error'); return { success: false }; }
        const d = snap.data();
        await addDoc(collection(db, 'projects'), {
            companyName: d.companyName || '', clientName: d.clientName || '', clientEmail: d.clientEmail || '',
            clientPhone: d.clientPhone || '', websiteUrl: d.websiteUrl || '', logo: d.logo || null,
            location: d.location || '', businessType: d.businessType || '', githubLink: d.githubLink || '', githubUrl: d.githubUrl || '',
            notes: d.notes || '', demoFiles: d.demoFiles || [], status: 'active', tier: 'farmer', progress: 0,
            assignedClients: [], milestones: [{ id: 'm1', title: 'Kickoff', status: 'current', date: new Date().toISOString().split('T')[0] }],
            invoices: [], clientFiles: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'leads', leadId));
        showToast('Moved to Projects!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed', 'error'); return { success: false }; }
}

async function returnProjectToLead(projectId) {
    try {
        const snap = await getDoc(doc(db, 'projects', projectId));
        if (!snap.exists()) { showToast('Project not found', 'error'); return { success: false }; }
        const d = snap.data();
        await addDoc(collection(db, 'leads'), {
            companyName: d.companyName, clientName: d.clientName, clientEmail: d.clientEmail,
            clientPhone: d.clientPhone || '', websiteUrl: d.websiteUrl || '', logo: d.logo || null,
            location: d.location || '', businessType: d.businessType || '', githubLink: d.githubLink || '', githubUrl: d.githubUrl || '',
            status: 'noted', demoFiles: d.demoFiles || [], notes: 'Returned from project. ' + (d.notes || ''),
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await deleteDoc(doc(db, 'projects', projectId));
        showToast('Returned to Leads!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed', 'error'); return { success: false }; }
}

// ============================================
// POSTS - NEW SECTION
// ============================================

async function loadPosts() {
    try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const s = await getDocs(q);
        AppState.posts = s.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.posts;
    } catch (e) {
        console.error('Load posts error:', e);
        return [];
    }
}

function subscribeToPosts(cb) {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const u = onSnapshot(q, s => {
        AppState.posts = s.docs.map(d => ({ id: d.id, ...d.data() }));
        if (cb) cb(AppState.posts);
    });
    AppState.unsubscribers.push(u);
    return u;
}

async function createPost(data, featuredImageFile = null, galleryFiles = [], logoFile = null) {
    try {
        console.log('createPost called with:', data);
        // Create the post first
        const postData = {
            title: data.title || '',
            slug: data.slug || generateSlug(data.title),
            summary: data.summary || '',
            description: data.description || '',
            featuredImage: data.featuredImage || null,
            logo: data.logo || null,
            websiteUrl: data.websiteUrl || '',
            galleryImages: data.galleryImages || [],
            tags: data.tags || [],
            projectId: data.projectId || null,
            published: data.published || false,
            featured: data.featured || false,
            publishedAt: data.published ? serverTimestamp() : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        console.log('postData to save:', postData);
        const ref = await addDoc(collection(db, 'posts'), postData);
        console.log('Post created with ID:', ref.id);
        
        // Upload featured image if provided
        if (featuredImageFile) {
            console.log('Uploading featured image...');
            const url = await uploadFile(featuredImageFile, `posts/${ref.id}/featured_${Date.now()}_${featuredImageFile.name}`);
            if (url) {
                await updateDoc(doc(db, 'posts', ref.id), { featuredImage: url });
                console.log('Featured image uploaded:', url);
            }
        }
        
        // Upload logo if provided
        if (logoFile) {
            console.log('Uploading logo...');
            const url = await uploadFile(logoFile, `posts/${ref.id}/logo_${Date.now()}_${logoFile.name}`);
            if (url) {
                await updateDoc(doc(db, 'posts', ref.id), { logo: url });
                console.log('Logo uploaded:', url);
            }
        }
        
        // Upload gallery images if provided
        if (galleryFiles.length > 0) {
            console.log('Uploading gallery images...');
            const galleryUrls = [];
            for (const file of galleryFiles) {
                const url = await uploadFile(file, `posts/${ref.id}/gallery_${Date.now()}_${file.name}`);
                if (url) galleryUrls.push(url);
            }
            if (galleryUrls.length > 0) {
                await updateDoc(doc(db, 'posts', ref.id), { galleryImages: galleryUrls });
                console.log('Gallery images uploaded:', galleryUrls);
            }
        }
        
        showToast('Post created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) {
        console.error('Create post error:', e);
        console.error('Error code:', e.code);
        console.error('Error message:', e.message);
        showToast('Failed to create post', 'error');
        return { success: false };
    }
}

async function updatePost(id, updates, featuredImageFile = null, newGalleryFiles = [], logoFile = null) {
    try {
        const updateData = {
            ...updates,
            updatedAt: serverTimestamp()
        };
        
        // If publishing for first time, set publishedAt
        if (updates.published && !updates.publishedAt) {
            updateData.publishedAt = serverTimestamp();
        }
        
        // Upload new featured image if provided
        if (featuredImageFile) {
            const url = await uploadFile(featuredImageFile, `posts/${id}/featured_${Date.now()}_${featuredImageFile.name}`);
            if (url) updateData.featuredImage = url;
        }
        
        // Upload new logo if provided
        if (logoFile) {
            const url = await uploadFile(logoFile, `posts/${id}/logo_${Date.now()}_${logoFile.name}`);
            if (url) updateData.logo = url;
        }
        
        // Upload new gallery images if provided
        if (newGalleryFiles.length > 0) {
            const existingGallery = updates.galleryImages || [];
            const newUrls = [];
            for (const file of newGalleryFiles) {
                const url = await uploadFile(file, `posts/${id}/gallery_${Date.now()}_${file.name}`);
                if (url) newUrls.push(url);
            }
            updateData.galleryImages = [...existingGallery, ...newUrls];
        }
        
        await updateDoc(doc(db, 'posts', id), updateData);
        showToast('Post updated!', 'success');
        return { success: true };
    } catch (e) {
        console.error('Update post error:', e);
        showToast('Failed to update post', 'error');
        return { success: false };
    }
}

async function deletePost(id) {
    try {
        await deleteDoc(doc(db, 'posts', id));
        showToast('Post deleted!', 'success');
        return { success: true };
    } catch (e) {
        console.error('Delete post error:', e);
        showToast('Failed to delete post', 'error');
        return { success: false };
    }
}

async function createPostFromProject(projectId) {
    try {
        console.log('createPostFromProject called with projectId:', projectId);
        const snap = await getDoc(doc(db, 'projects', projectId));
        if (!snap.exists()) {
            console.error('Project not found:', projectId);
            showToast('Project not found', 'error');
            return { success: false };
        }
        
        const project = snap.data();
        console.log('Project data:', project);
        
        // Create draft post pre-populated with project data
        const postData = {
            title: project.companyName || 'Untitled Project',
            slug: generateSlug(project.companyName),
            summary: '',
            description: '',
            featuredImage: project.logo || null,
            galleryImages: [],
            tags: [project.businessType, project.location].filter(Boolean),
            projectId: projectId,
            published: false,
            featured: false,
            publishedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        console.log('Creating post with data:', postData);
        const ref = await addDoc(collection(db, 'posts'), postData);
        console.log('Post created with ID:', ref.id);
        showToast('Draft post created! Opening editor...', 'success');
        return { success: true, id: ref.id };
    } catch (e) {
        console.error('Create post from project error:', e);
        console.error('Error code:', e.code);
        console.error('Error message:', e.message);
        showToast('Failed to create post', 'error');
        return { success: false };
    }
}

function generateSlug(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ============================================
// EXPORTS
// ============================================

export {
    auth, db, storage, AppState, TIER_NAMES, TIER_ORDER,
    login, logout, createClientWithAuth, uploadFile, uploadLogo,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, updateClient, archiveClient,
    loadArchive, archiveItem, restoreFromArchive, deletePermanent,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    // NEW: Posts exports
    loadPosts, subscribeToPosts, createPost, updatePost, deletePost, createPostFromProject, generateSlug,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getTierName, getStatusLabel,
    showToast, showLoading,
    // Role checking utilities
    checkIsAdmin, hasRole
};
