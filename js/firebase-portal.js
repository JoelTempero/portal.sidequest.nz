/* ============================================
   SIDEQUEST DIGITAL - Client Portal JS
   Firebase Connected Version
   ============================================ */

// ============================================
// Firebase Configuration
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCHBw5_1925Bno5CHVEMUpdBgqQR_UHbAk",
    authDomain: "sidequest-digital.firebaseapp.com",
    projectId: "sidequest-digital",
    storageBucket: "sidequest-digital.firebasestorage.app",
    messagingSenderId: "576711179044",
    appId: "1:576711179044:web:bef810a231f00c0b9c11b1",
    measurementId: "G-XDZBXRBJSW"
};

// Admin UIDs
const ADMIN_UIDS = ['XQINsp8rRqh9xmgQBrBjI4M2Z7e2'];

// ============================================
// Firebase Initialization
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
    getStorage, ref, uploadBytes, getDownloadURL, deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ============================================
// App State
// ============================================

const AppState = {
    currentUser: null,
    userProfile: null,
    isAdmin: false,
    leads: [],
    projects: [],
    archived: [],
    tickets: [],
    clients: [],
    messages: [],
    currentItem: null,
    unsubscribers: [],
    filters: { search: '', location: '', businessType: '', status: '' }
};

// ============================================
// Utilities
// ============================================

const formatDate = d => {
    if (!d) return '-';
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = n => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n || 0);

const timeAgo = d => {
    if (!d) return '-';
    const date = d.toDate ? d.toDate() : new Date(d);
    const s = Math.floor((new Date() - date) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
};

const getInitials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase() : '??';
const getTierOrder = t => ({ premium: 0, growth: 1, bugcatcher: 2, host: 3 }[t] ?? 4);
const getStatusLabel = s => ({ 'noted': 'Noted', 'demo-complete': 'Demo Complete', 'demo-sent': 'Demo Sent', 'active': 'Active', 'paused': 'Paused', 'completed': 'Completed', 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' }[s] || s);

const showLoading = (show = true) => {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = show ? 'flex' : 'none';
};

const showToast = (message, type = 'info') => {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;border-radius:8px;color:white;z-index:9999;animation:fadeIn 0.3s;font-size:14px;`;
    toast.style.background = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// ============================================
// Authentication
// ============================================

async function login(email, password) {
    try {
        showLoading(true);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: cred.user };
    } catch (error) {
        console.error('Login error:', error);
        let msg = 'Login failed.';
        if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password.';
        return { success: false, error: msg };
    } finally {
        showLoading(false);
    }
}

async function logout() {
    AppState.unsubscribers.forEach(u => u());
    AppState.unsubscribers = [];
    await signOut(auth);
    window.location.href = 'login.html';
}

// ============================================
// LEADS
// ============================================

async function loadLeads() {
    try {
        const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        AppState.leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.leads;
    } catch (e) { console.error('Load leads:', e); return []; }
}

function subscribeToLeads(callback) {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        AppState.leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (callback) callback(AppState.leads);
    });
    AppState.unsubscribers.push(unsub);
    return unsub;
}

async function createLead(data) {
    try {
        const ref = await addDoc(collection(db, 'leads'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        showToast('Lead created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { console.error('Create lead:', e); showToast('Failed to create lead', 'error'); return { success: false }; }
}

async function updateLead(id, updates) {
    try {
        await updateDoc(doc(db, 'leads', id), { ...updates, updatedAt: serverTimestamp() });
        showToast('Lead updated!', 'success');
        return { success: true };
    } catch (e) { console.error('Update lead:', e); showToast('Failed to update', 'error'); return { success: false }; }
}

async function deleteLead(id) {
    try { await deleteDoc(doc(db, 'leads', id)); return { success: true }; }
    catch (e) { console.error('Delete lead:', e); return { success: false }; }
}

// ============================================
// PROJECTS
// ============================================

async function loadProjects() {
    try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        AppState.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.projects;
    } catch (e) { console.error('Load projects:', e); return []; }
}

function subscribeToProjects(callback) {
    let q;
    if (AppState.isAdmin) {
        q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'projects'), where('assignedClients', 'array-contains', AppState.currentUser.uid));
    }
    const unsub = onSnapshot(q, snap => {
        AppState.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (callback) callback(AppState.projects);
    });
    AppState.unsubscribers.push(unsub);
    return unsub;
}

async function createProject(data) {
    try {
        const ref = await addDoc(collection(db, 'projects'), {
            ...data, status: data.status || 'active', tier: data.tier || 'growth', progress: data.progress || 0,
            assignedClients: data.assignedClients || [], milestones: data.milestones || [], invoices: data.invoices || [],
            clientFiles: data.clientFiles || [], demoFiles: data.demoFiles || [],
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showToast('Project created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { console.error('Create project:', e); showToast('Failed to create project', 'error'); return { success: false }; }
}

async function updateProject(id, updates) {
    try {
        await updateDoc(doc(db, 'projects', id), { ...updates, updatedAt: serverTimestamp() });
        showToast('Project updated!', 'success');
        return { success: true };
    } catch (e) { console.error('Update project:', e); showToast('Failed to update', 'error'); return { success: false }; }
}

// ============================================
// CLIENTS (Users)
// ============================================

async function loadClients() {
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'client'));
        const snap = await getDocs(q);
        AppState.clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.clients;
    } catch (e) { console.error('Load clients:', e); return []; }
}

async function createClient(data) {
    try {
        // Create auth user first - this requires Firebase Admin SDK or a Cloud Function
        // For now, we'll just create a client record that can be linked when they sign up
        const ref = await addDoc(collection(db, 'users'), {
            ...data, role: 'client', createdAt: serverTimestamp()
        });
        showToast('Client created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { console.error('Create client:', e); showToast('Failed to create client', 'error'); return { success: false }; }
}

async function updateClient(id, updates) {
    try {
        await updateDoc(doc(db, 'users', id), updates);
        showToast('Client updated!', 'success');
        return { success: true };
    } catch (e) { console.error('Update client:', e); showToast('Failed to update', 'error'); return { success: false }; }
}

// ============================================
// ARCHIVE
// ============================================

async function loadArchive() {
    try {
        const q = query(collection(db, 'archived'), orderBy('archivedAt', 'desc'));
        const snap = await getDocs(q);
        AppState.archived = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.archived;
    } catch (e) { console.error('Load archive:', e); return []; }
}

async function archiveItem(type, itemId) {
    try {
        console.log('Archiving:', type, itemId);
        const colName = type === 'lead' ? 'leads' : 'projects';
        const itemRef = doc(db, colName, itemId);
        const itemSnap = await getDoc(itemRef);
        
        if (!itemSnap.exists()) {
            showToast('Item not found', 'error');
            return { success: false };
        }
        
        const itemData = itemSnap.data();
        
        await addDoc(collection(db, 'archived'), {
            type, originalId: itemId,
            companyName: itemData.companyName || '',
            clientName: itemData.clientName || '',
            clientEmail: itemData.clientEmail || '',
            reason: 'Manually archived',
            archivedAt: serverTimestamp(),
            originalData: itemData
        });
        
        await deleteDoc(itemRef);
        showToast('Archived!', 'success');
        window.location.href = type === 'lead' ? 'leads.html' : 'projects.html';
        return { success: true };
    } catch (e) { 
        console.error('Archive error:', e); 
        showToast('Failed to archive: ' + e.message, 'error'); 
        return { success: false }; 
    }
}

async function restoreFromArchive(archiveId) {
    try {
        const archRef = doc(db, 'archived', archiveId);
        const archSnap = await getDoc(archRef);
        if (!archSnap.exists()) { showToast('Not found', 'error'); return { success: false }; }
        
        const data = archSnap.data();
        const col = data.type === 'lead' ? 'leads' : 'projects';
        
        await addDoc(collection(db, col), { ...data.originalData, restoredAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await deleteDoc(archRef);
        
        showToast('Restored!', 'success');
        return { success: true };
    } catch (e) { console.error('Restore:', e); showToast('Failed to restore', 'error'); return { success: false }; }
}

// ============================================
// TICKETS
// ============================================

async function loadTickets() {
    try {
        const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
        const snap = await getDocs(q);
        AppState.tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.tickets;
    } catch (e) { console.error('Load tickets:', e); return []; }
}

function subscribeToTickets(callback) {
    const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        AppState.tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (callback) callback(AppState.tickets);
    });
    AppState.unsubscribers.push(unsub);
    return unsub;
}

async function createTicket(data) {
    try {
        const ref = await addDoc(collection(db, 'tickets'), { ...data, status: 'open', adminNotes: '', updates: [], submittedAt: serverTimestamp() });
        showToast('Ticket submitted!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { console.error('Create ticket:', e); showToast('Failed', 'error'); return { success: false }; }
}

async function updateTicket(id, updates) {
    try {
        await updateDoc(doc(db, 'tickets', id), updates);
        showToast('Ticket updated!', 'success');
        return { success: true };
    } catch (e) { console.error('Update ticket:', e); showToast('Failed', 'error'); return { success: false }; }
}

// ============================================
// MESSAGES
// ============================================

function subscribeToMessages(projectId, callback) {
    const q = query(collection(db, 'messages'), where('projectId', '==', projectId), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, snap => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (callback) callback(msgs);
    });
    AppState.unsubscribers.push(unsub);
    return unsub;
}

async function sendMessage(projectId, text) {
    try {
        await addDoc(collection(db, 'messages'), {
            projectId, senderId: AppState.currentUser.uid,
            senderName: AppState.userProfile?.displayName || 'User',
            text, timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (e) { console.error('Send message:', e); return { success: false }; }
}

// ============================================
// MOVE/CONVERT Functions
// ============================================

async function moveLeadToProject(leadId) {
    try {
        console.log('Moving lead to project:', leadId);
        const leadRef = doc(db, 'leads', leadId);
        const leadSnap = await getDoc(leadRef);
        
        if (!leadSnap.exists()) {
            showToast('Lead not found', 'error');
            return { success: false };
        }
        
        const leadData = leadSnap.data();
        
        await addDoc(collection(db, 'projects'), {
            companyName: leadData.companyName || '',
            clientName: leadData.clientName || '',
            clientEmail: leadData.clientEmail || '',
            clientPhone: leadData.clientPhone || '',
            websiteUrl: leadData.websiteUrl || '',
            logo: leadData.logo || null,
            location: leadData.location || '',
            businessType: leadData.businessType || '',
            githubLink: leadData.githubLink || '',
            githubUrl: leadData.githubUrl || '',
            notes: leadData.notes || '',
            demoFiles: leadData.demoFiles || [],
            status: 'active',
            tier: 'growth',
            progress: 0,
            assignedClients: [],
            milestones: [{ id: 'm1', title: 'Kickoff', status: 'current', date: new Date().toISOString().split('T')[0] }],
            invoices: [],
            clientFiles: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        await deleteDoc(leadRef);
        showToast('Moved to Projects!', 'success');
        window.location.href = 'projects.html';
        return { success: true };
    } catch (e) { 
        console.error('Move lead error:', e); 
        showToast('Failed: ' + e.message, 'error'); 
        return { success: false }; 
    }
}

async function returnProjectToLead(projectId) {
    try {
        const projRef = doc(db, 'projects', projectId);
        const projSnap = await getDoc(projRef);
        if (!projSnap.exists()) { showToast('Project not found', 'error'); return { success: false }; }
        
        const data = projSnap.data();
        
        await addDoc(collection(db, 'leads'), {
            companyName: data.companyName, clientName: data.clientName, clientEmail: data.clientEmail,
            clientPhone: data.clientPhone || '', websiteUrl: data.websiteUrl || '', logo: data.logo || null,
            location: data.location || '', businessType: data.businessType || '',
            githubLink: data.githubLink || '', githubUrl: data.githubUrl || '',
            status: 'noted', demoFiles: data.demoFiles || [],
            notes: 'Returned from project. ' + (data.notes || ''),
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        
        await deleteDoc(projRef);
        showToast('Returned to Leads!', 'success');
        window.location.href = 'leads.html';
        return { success: true };
    } catch (e) { console.error('Return project:', e); showToast('Failed', 'error'); return { success: false }; }
}

// ============================================
// FILE UPLOAD
// ============================================

async function uploadFile(file, path) {
    try {
        const storageRef = ref(storage, path);
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        return { success: true, url };
    } catch (e) { console.error('Upload:', e); return { success: false }; }
}

async function uploadLogo(file, itemId, type = 'project') {
    try {
        const path = `logos/${type}s/${itemId}/${file.name}`;
        const result = await uploadFile(file, path);
        if (result.success) {
            const col = type === 'lead' ? 'leads' : 'projects';
            await updateDoc(doc(db, col, itemId), { logo: result.url });
            showToast('Logo uploaded!', 'success');
        }
        return result;
    } catch (e) { console.error('Upload logo:', e); showToast('Failed', 'error'); return { success: false }; }
}

// ============================================
// Exports
// ============================================

export {
    auth, db, storage, AppState, ADMIN_UIDS,
    login, logout,
    loadLeads, subscribeToLeads, createLead, updateLead, deleteLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, createClient, updateClient,
    loadArchive, archiveItem, restoreFromArchive,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    uploadFile, uploadLogo,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getStatusLabel,
    showToast, showLoading
};
