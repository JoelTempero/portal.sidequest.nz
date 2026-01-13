/* ============================================
   SIDEQUEST DIGITAL - Client Portal JS
   Firebase Connected Version
   ============================================ */

const firebaseConfig = {
    apiKey: "AIzaSyCHBw5_1925Bno5CHVEMUpdBgqQR_UHbAk",
    authDomain: "sidequest-digital.firebaseapp.com",
    projectId: "sidequest-digital",
    storageBucket: "sidequest-digital.firebasestorage.app",
    messagingSenderId: "576711179044",
    appId: "1:576711179044:web:bef810a231f00c0b9c11b1"
};

const ADMIN_UIDS = ['XQINsp8rRqh9xmgQBrBjI4M2Z7e2'];

// Tier names: Host, Bug Catcher, Farmer, Watchful Eye
const TIER_NAMES = { host: 'Host', bugcatcher: 'Bug Catcher', farmer: 'Farmer', watchfuleye: 'Watchful Eye' };
const TIER_ORDER = { watchfuleye: 0, farmer: 1, bugcatcher: 2, host: 3 };

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const AppState = {
    currentUser: null, userProfile: null, isAdmin: false,
    leads: [], projects: [], archived: [], tickets: [], clients: [], messages: [],
    currentItem: null, unsubscribers: [], pendingLogoFile: null
};

// Utilities
const formatDate = d => { if (!d) return '-'; const date = d.toDate ? d.toDate() : new Date(d); return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', year: 'numeric' }); };
const formatCurrency = n => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n || 0);
const timeAgo = d => { if (!d) return '-'; const date = d.toDate ? d.toDate() : new Date(d); const s = Math.floor((new Date() - date) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const getInitials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase() : '??';
const getTierOrder = t => TIER_ORDER[t] ?? 4;
const getTierName = t => TIER_NAMES[t] || t;
const getStatusLabel = s => ({ 'noted': 'Noted', 'demo-complete': 'Demo Complete', 'demo-sent': 'Demo Sent', 'active': 'Active', 'paused': 'Paused', 'completed': 'Completed', 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' }[s] || s);
const showLoading = (show = true) => { const l = document.getElementById('loading-overlay'); if (l) l.style.display = show ? 'flex' : 'none'; };
const showToast = (msg, type = 'info') => { document.querySelector('.toast')?.remove(); const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg; t.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;border-radius:8px;color:white;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);background:${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};`; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };

// Auth
async function login(email, password) {
    try { showLoading(true); const c = await signInWithEmailAndPassword(auth, email, password); return { success: true, user: c.user }; }
    catch (e) { return { success: false, error: e.code === 'auth/invalid-credential' ? 'Invalid email or password.' : 'Login failed.' }; }
    finally { showLoading(false); }
}
async function logout() { AppState.unsubscribers.forEach(u => u()); AppState.unsubscribers = []; await signOut(auth); window.location.href = 'login.html'; }

async function createClientWithAuth(email, password, displayName, company) {
    try {
        const ref = await addDoc(collection(db, 'users'), { email, displayName, company: company || '', role: 'client', tempPassword: password, status: 'pending', createdAt: serverTimestamp() });
        showToast('Client created!', 'success');
        return { success: true, id: ref.id, email, password };
    } catch (e) { showToast('Failed to create client', 'error'); return { success: false }; }
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
        const path = `logos/${type}s/${itemId}/${Date.now()}_${file.name}`;
        const url = await uploadFile(file, path);
        if (url) {
            const col = type === 'lead' ? 'leads' : 'projects';
            await updateDoc(doc(db, col, itemId), { logo: url });
            showToast('Logo uploaded!', 'success');
            return { success: true, url };
        }
        return { success: false };
    } catch (e) { showToast('Upload failed', 'error'); return { success: false }; }
}

// LEADS
async function loadLeads() { try { const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc')); const s = await getDocs(q); AppState.leads = s.docs.map(d => ({ id: d.id, ...d.data() })); return AppState.leads; } catch (e) { return []; } }
function subscribeToLeads(cb) { const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc')); const u = onSnapshot(q, s => { AppState.leads = s.docs.map(d => ({ id: d.id, ...d.data() })); if (cb) cb(AppState.leads); }); AppState.unsubscribers.push(u); return u; }
async function createLead(data, logoFile = null) {
    try {
        const ref = await addDoc(collection(db, 'leads'), { ...data, demoFiles: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        if (logoFile) {
            const url = await uploadFile(logoFile, `logos/leads/${ref.id}/${Date.now()}_${logoFile.name}`);
            if (url) await updateDoc(doc(db, 'leads', ref.id), { logo: url });
        }
        showToast('Lead created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { showToast('Failed to create lead', 'error'); return { success: false }; }
}
async function updateLead(id, updates) { try { await updateDoc(doc(db, 'leads', id), { ...updates, updatedAt: serverTimestamp() }); showToast('Lead updated!', 'success'); return { success: true }; } catch (e) { showToast('Failed to update', 'error'); return { success: false }; } }

// PROJECTS
async function loadProjects() { try { const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc')); const s = await getDocs(q); AppState.projects = s.docs.map(d => ({ id: d.id, ...d.data() })); return AppState.projects; } catch (e) { return []; } }
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
        showToast('Project updated!', 'success');
        return { success: true };
    } catch (e) { console.error('Update project error:', e); showToast('Failed to update', 'error'); return { success: false }; }
}

// CLIENTS
async function loadClients() { try { const q = query(collection(db, 'users'), where('role', '==', 'client')); const s = await getDocs(q); AppState.clients = s.docs.map(d => ({ id: d.id, ...d.data() })); return AppState.clients; } catch (e) { return []; } }
async function updateClient(id, updates) { try { await updateDoc(doc(db, 'users', id), updates); showToast('Client updated!', 'success'); return { success: true }; } catch (e) { showToast('Failed to update', 'error'); return { success: false }; } }

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
        await addDoc(collection(db, data.type === 'lead' ? 'leads' : 'projects'), { ...data.originalData, restoredAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await deleteDoc(doc(db, 'archived', archiveId));
        showToast('Restored!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed to restore', 'error'); return { success: false }; }
}

// TICKETS
async function loadTickets() { try { const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc')); const s = await getDocs(q); AppState.tickets = s.docs.map(d => ({ id: d.id, ...d.data() })); return AppState.tickets; } catch (e) { return []; } }
function subscribeToTickets(cb) { const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc')); const u = onSnapshot(q, s => { AppState.tickets = s.docs.map(d => ({ id: d.id, ...d.data() })); if (cb) cb(AppState.tickets); }); AppState.unsubscribers.push(u); return u; }
async function createTicket(data) { try { await addDoc(collection(db, 'tickets'), { ...data, status: 'open', adminNotes: '', updates: [], submittedAt: serverTimestamp() }); showToast('Ticket submitted!', 'success'); return { success: true }; } catch (e) { showToast('Failed', 'error'); return { success: false }; } }
async function updateTicket(id, updates) { try { await updateDoc(doc(db, 'tickets', id), updates); showToast('Ticket updated!', 'success'); return { success: true }; } catch (e) { showToast('Failed', 'error'); return { success: false }; } }

// MESSAGES
function subscribeToMessages(projectId, cb) { const q = query(collection(db, 'messages'), where('projectId', '==', projectId), orderBy('timestamp', 'asc')); const u = onSnapshot(q, s => { if (cb) cb(s.docs.map(d => ({ id: d.id, ...d.data() }))); }); AppState.unsubscribers.push(u); return u; }
async function sendMessage(projectId, text) { try { await addDoc(collection(db, 'messages'), { projectId, senderId: AppState.currentUser.uid, senderName: AppState.userProfile?.displayName || 'User', text, timestamp: serverTimestamp() }); return { success: true }; } catch (e) { return { success: false }; } }

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

export {
    auth, db, storage, AppState, ADMIN_UIDS, TIER_NAMES, TIER_ORDER,
    login, logout, createClientWithAuth, uploadFile, uploadLogo,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, updateClient,
    loadArchive, archiveItem, restoreFromArchive,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getTierName, getStatusLabel,
    showToast, showLoading
};
