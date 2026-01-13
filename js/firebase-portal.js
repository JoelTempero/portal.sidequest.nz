/* ============================================
   SIDEQUEST DIGITAL - Client Portal JS
   Firebase Connected Version
   ============================================ */

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCHBw5_1925Bno5CHVEMUpdBgqQR_UHbAk",
    authDomain: "sidequest-digital.firebaseapp.com",
    projectId: "sidequest-digital",
    storageBucket: "sidequest-digital.firebasestorage.app",
    messagingSenderId: "576711179044",
    appId: "1:576711179044:web:bef810a231f00c0b9c11b1",
    measurementId: "G-XDZBXRBJSW"
};

const ADMIN_UIDS = ['XQINsp8rRqh9xmgQBrBjI4M2Z7e2'];

// Firebase Imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
    getStorage, ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// App State
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
    unsubscribers: []
};

// Utilities
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
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;border-radius:8px;color:white;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
    toast.style.background = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// Authentication
async function login(email, password) {
    try {
        showLoading(true);
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: cred.user };
    } catch (error) {
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

// Create client user with password
async function createClientWithAuth(email, password, displayName, company) {
    try {
        // Note: Creating users from client-side requires the user to be signed out
        // So we'll create a pending user record that gets linked when they sign in
        const clientData = {
            email,
            displayName,
            company: company || '',
            role: 'client',
            tempPassword: password, // Store temporarily - they should change on first login
            status: 'pending',
            createdAt: serverTimestamp()
        };
        
        const ref = await addDoc(collection(db, 'users'), clientData);
        showToast('Client created! Share login details with them.', 'success');
        return { success: true, id: ref.id, email, password };
    } catch (e) {
        console.error('Create client:', e);
        showToast('Failed to create client', 'error');
        return { success: false };
    }
}

// LEADS
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
        const ref = await addDoc(collection(db, 'leads'), { ...data, demoFiles: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        showToast('Lead created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { showToast('Failed to create lead', 'error'); return { success: false }; }
}

async function updateLead(id, updates) {
    try {
        await updateDoc(doc(db, 'leads', id), { ...updates, updatedAt: serverTimestamp() });
        showToast('Lead updated!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed to update', 'error'); return { success: false }; }
}

// PROJECTS
async function loadProjects() {
    try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        AppState.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.projects;
    } catch (e) { console.error('Load projects:', e); return []; }
}

function subscribeToProjects(callback) {
    let q = AppState.isAdmin 
        ? query(collection(db, 'projects'), orderBy('createdAt', 'desc'))
        : query(collection(db, 'projects'), where('assignedClients', 'array-contains', AppState.currentUser?.uid || ''));
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
            clientFiles: [], demoFiles: data.demoFiles || [],
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        showToast('Project created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) { showToast('Failed to create project', 'error'); return { success: false }; }
}

async function updateProject(id, updates) {
    try {
        await updateDoc(doc(db, 'projects', id), { ...updates, updatedAt: serverTimestamp() });
        showToast('Project updated!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed to update', 'error'); return { success: false }; }
}

// CLIENTS
async function loadClients() {
    try {
        const q = query(collection(db, 'users'), where('role', '==', 'client'));
        const snap = await getDocs(q);
        AppState.clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.clients;
    } catch (e) { console.error('Load clients:', e); return []; }
}

async function updateClient(id, updates) {
    try {
        await updateDoc(doc(db, 'users', id), updates);
        showToast('Client updated!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed to update', 'error'); return { success: false }; }
}

// ARCHIVE
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
        const colName = type === 'lead' ? 'leads' : 'projects';
        const itemRef = doc(db, colName, itemId);
        const itemSnap = await getDoc(itemRef);
        if (!itemSnap.exists()) { showToast('Item not found', 'error'); return { success: false }; }
        
        const itemData = itemSnap.data();
        await addDoc(collection(db, 'archived'), {
            type, originalId: itemId,
            companyName: itemData.companyName || '',
            clientName: itemData.clientName || '',
            clientEmail: itemData.clientEmail || '',
            reason: 'Archived',
            archivedAt: serverTimestamp(),
            originalData: itemData
        });
        await deleteDoc(itemRef);
        showToast('Archived!', 'success');
        return { success: true };
    } catch (e) { 
        console.error('Archive error:', e); 
        showToast('Failed to archive', 'error'); 
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
    } catch (e) { showToast('Failed to restore', 'error'); return { success: false }; }
}

// TICKETS
async function loadTickets() {
    try {
        const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
        const snap = await getDocs(q);
        AppState.tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.tickets;
    } catch (e) { return []; }
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
        await addDoc(collection(db, 'tickets'), { ...data, status: 'open', adminNotes: '', updates: [], submittedAt: serverTimestamp() });
        showToast('Ticket submitted!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed', 'error'); return { success: false }; }
}

async function updateTicket(id, updates) {
    try {
        await updateDoc(doc(db, 'tickets', id), updates);
        showToast('Ticket updated!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed', 'error'); return { success: false }; }
}

// MESSAGES
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
    } catch (e) { return { success: false }; }
}

// MOVE/CONVERT
async function moveLeadToProject(leadId) {
    try {
        const leadRef = doc(db, 'leads', leadId);
        const leadSnap = await getDoc(leadRef);
        if (!leadSnap.exists()) { showToast('Lead not found', 'error'); return { success: false }; }
        
        const data = leadSnap.data();
        await addDoc(collection(db, 'projects'), {
            companyName: data.companyName || '', clientName: data.clientName || '', clientEmail: data.clientEmail || '',
            clientPhone: data.clientPhone || '', websiteUrl: data.websiteUrl || '', logo: data.logo || null,
            location: data.location || '', businessType: data.businessType || '',
            githubLink: data.githubLink || '', githubUrl: data.githubUrl || '', notes: data.notes || '',
            demoFiles: data.demoFiles || [], status: 'active', tier: 'growth', progress: 0,
            assignedClients: [], milestones: [{ id: 'm1', title: 'Kickoff', status: 'current', date: new Date().toISOString().split('T')[0] }],
            invoices: [], clientFiles: [],
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await deleteDoc(leadRef);
        showToast('Moved to Projects!', 'success');
        return { success: true };
    } catch (e) { showToast('Failed', 'error'); return { success: false }; }
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
        return { success: true };
    } catch (e) { showToast('Failed', 'error'); return { success: false }; }
}

// FILE UPLOAD
async function uploadLogo(file, itemId, type = 'project') {
    try {
        const path = `logos/${type}s/${itemId}/${file.name}`;
        const storageRef = ref(storage, path);
        const snap = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snap.ref);
        const col = type === 'lead' ? 'leads' : 'projects';
        await updateDoc(doc(db, col, itemId), { logo: url });
        showToast('Logo uploaded!', 'success');
        return { success: true, url };
    } catch (e) { showToast('Upload failed', 'error'); return { success: false }; }
}

// Exports
export {
    auth, db, storage, AppState, ADMIN_UIDS,
    login, logout, createClientWithAuth,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, updateClient,
    loadArchive, archiveItem, restoreFromArchive,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead, uploadLogo,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getStatusLabel,
    showToast, showLoading
};
