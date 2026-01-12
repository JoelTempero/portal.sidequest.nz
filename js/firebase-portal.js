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

// Admin UIDs - add your UID here
const ADMIN_UIDS = [
    'XQINsp8rRqh9xmgQBrBjI4M2Z7e2'  // Joel
];

// ============================================
// Firebase Initialization (using CDN modules)
// ============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
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
    onSnapshot,
    serverTimestamp,
    Timestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Initialize Firebase
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
    messages: [],
    activity: [],
    currentItem: null,
    unsubscribers: []  // For cleaning up Firestore listeners
};

// ============================================
// Utilities
// ============================================

const formatDate = d => {
    if (!d) return '-';
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = n => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);

const timeAgo = d => {
    const date = d.toDate ? d.toDate() : new Date(d);
    const s = Math.floor((new Date() - date) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
};

const getInitials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase() : '??';
const getTierOrder = t => ({ premium: 0, growth: 1, bugcatcher: 2, host: 3 }[t] ?? 4);
const getStatusLabel = s => ({ 'noted': 'Noted', 'demo-complete': 'Demo Complete', 'demo-sent': 'Demo Sent', 'active': 'Active', 'paused': 'Paused', 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' }[s] || s);

// Generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Show loading state
const showLoading = (show = true) => {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = show ? 'flex' : 'none';
};

// Show toast notifications
const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 24px;border-radius:8px;color:white;z-index:9999;animation:fadeIn 0.3s;`;
    toast.style.background = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};

// ============================================
// Authentication Functions
// ============================================

async function login(email, password) {
    try {
        showLoading(true);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Login error:', error);
        let message = 'Login failed. Please try again.';
        if (error.code === 'auth/user-not-found') message = 'No account found with this email.';
        if (error.code === 'auth/wrong-password') message = 'Incorrect password.';
        if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
        if (error.code === 'auth/invalid-credential') message = 'Invalid email or password.';
        return { success: false, error: message };
    } finally {
        showLoading(false);
    }
}

async function logout() {
    try {
        // Clean up Firestore listeners
        AppState.unsubscribers.forEach(unsub => unsub());
        AppState.unsubscribers = [];
        
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

async function getUserProfile(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

async function createUserProfile(user, additionalData = {}) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userData = {
            email: user.email,
            displayName: user.displayName || additionalData.displayName || 'User',
            role: ADMIN_UIDS.includes(user.uid) ? 'admin' : 'client',
            company: additionalData.company || '',
            createdAt: serverTimestamp(),
            ...additionalData
        };
        await updateDoc(userRef, userData).catch(() => {
            // If update fails, document doesn't exist - would need setDoc
            // But we'll handle user creation separately
        });
        return userData;
    } catch (error) {
        console.error('Error creating user profile:', error);
        return null;
    }
}

// ============================================
// Firestore Data Functions - LEADS
// ============================================

async function loadLeads() {
    try {
        const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        AppState.leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return AppState.leads;
    } catch (error) {
        console.error('Error loading leads:', error);
        return [];
    }
}

function subscribeToLeads(callback) {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
        AppState.leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(AppState.leads);
    });
    AppState.unsubscribers.push(unsubscribe);
    return unsubscribe;
}

async function createLead(leadData) {
    try {
        const docRef = await addDoc(collection(db, 'leads'), {
            ...leadData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        showToast('Lead created!', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating lead:', error);
        showToast('Failed to create lead', 'error');
        return { success: false, error };
    }
}

async function updateLead(leadId, updates) {
    try {
        await updateDoc(doc(db, 'leads', leadId), {
            ...updates,
            updatedAt: serverTimestamp()
        });
        showToast('Lead updated!', 'success');
        return { success: true };
    } catch (error) {
        console.error('Error updating lead:', error);
        showToast('Failed to update lead', 'error');
        return { success: false, error };
    }
}

async function deleteLead(leadId) {
    try {
        await deleteDoc(doc(db, 'leads', leadId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting lead:', error);
        return { success: false, error };
    }
}

// ============================================
// Firestore Data Functions - PROJECTS
// ============================================

async function loadProjects() {
    try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        AppState.projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return AppState.projects;
    } catch (error) {
        console.error('Error loading projects:', error);
        return [];
    }
}

function subscribeToProjects(callback) {
    let q;
    if (AppState.isAdmin) {
        q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    } else {
        // Clients only see their assigned projects
        q = query(
            collection(db, 'projects'),
            where('assignedClients', 'array-contains', AppState.currentUser.uid)
        );
    }
    
    const unsubscribe = onSnapshot(q, snapshot => {
        AppState.projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(AppState.projects);
    });
    AppState.unsubscribers.push(unsubscribe);
    return unsubscribe;
}

async function createProject(projectData) {
    try {
        const docRef = await addDoc(collection(db, 'projects'), {
            ...projectData,
            status: 'active',
            progress: 0,
            assignedClients: [],
            milestones: [],
            invoices: [],
            clientFiles: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        showToast('Project created!', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating project:', error);
        showToast('Failed to create project', 'error');
        return { success: false, error };
    }
}

async function updateProject(projectId, updates) {
    try {
        await updateDoc(doc(db, 'projects', projectId), {
            ...updates,
            updatedAt: serverTimestamp()
        });
        showToast('Project updated!', 'success');
        return { success: true };
    } catch (error) {
        console.error('Error updating project:', error);
        showToast('Failed to update project', 'error');
        return { success: false, error };
    }
}

// ============================================
// Firestore Data Functions - ARCHIVE
// ============================================

async function loadArchive() {
    try {
        const q = query(collection(db, 'archived'), orderBy('archivedAt', 'desc'));
        const snapshot = await getDocs(q);
        AppState.archived = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return AppState.archived;
    } catch (error) {
        console.error('Error loading archive:', error);
        return [];
    }
}

async function archiveItem(type, itemId) {
    try {
        // Get the item
        const itemRef = doc(db, type === 'lead' ? 'leads' : 'projects', itemId);
        const itemSnap = await getDoc(itemRef);
        
        if (!itemSnap.exists()) {
            throw new Error('Item not found');
        }
        
        const itemData = itemSnap.data();
        
        // Add to archive
        await addDoc(collection(db, 'archived'), {
            type,
            originalId: itemId,
            companyName: itemData.companyName,
            clientName: itemData.clientName,
            clientEmail: itemData.clientEmail,
            reason: 'Manually archived',
            archivedAt: serverTimestamp(),
            originalData: itemData
        });
        
        // Delete original
        await deleteDoc(itemRef);
        
        showToast('Item archived!', 'success');
        return { success: true };
    } catch (error) {
        console.error('Error archiving item:', error);
        showToast('Failed to archive', 'error');
        return { success: false, error };
    }
}

async function restoreFromArchive(archiveId) {
    try {
        const archiveRef = doc(db, 'archived', archiveId);
        const archiveSnap = await getDoc(archiveRef);
        
        if (!archiveSnap.exists()) {
            throw new Error('Archived item not found');
        }
        
        const archiveData = archiveSnap.data();
        const targetCollection = archiveData.type === 'lead' ? 'leads' : 'projects';
        
        // Restore to original collection
        await addDoc(collection(db, targetCollection), {
            ...archiveData.originalData,
            restoredAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Delete from archive
        await deleteDoc(archiveRef);
        
        showToast('Item restored!', 'success');
        return { success: true };
    } catch (error) {
        console.error('Error restoring item:', error);
        showToast('Failed to restore', 'error');
        return { success: false, error };
    }
}

// ============================================
// Firestore Data Functions - TICKETS
// ============================================

async function loadTickets() {
    try {
        const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
        const snapshot = await getDocs(q);
        AppState.tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return AppState.tickets;
    } catch (error) {
        console.error('Error loading tickets:', error);
        return [];
    }
}

function subscribeToTickets(callback) {
    const q = query(collection(db, 'tickets'), orderBy('submittedAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
        AppState.tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(AppState.tickets);
    });
    AppState.unsubscribers.push(unsubscribe);
    return unsubscribe;
}

async function createTicket(ticketData) {
    try {
        const docRef = await addDoc(collection(db, 'tickets'), {
            ...ticketData,
            status: 'open',
            adminNotes: '',
            updates: [],
            submittedAt: serverTimestamp()
        });
        showToast('Ticket submitted!', 'success');
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating ticket:', error);
        showToast('Failed to submit ticket', 'error');
        return { success: false, error };
    }
}

async function updateTicket(ticketId, updates) {
    try {
        await updateDoc(doc(db, 'tickets', ticketId), updates);
        showToast('Ticket updated!', 'success');
        return { success: true };
    } catch (error) {
        console.error('Error updating ticket:', error);
        showToast('Failed to update ticket', 'error');
        return { success: false, error };
    }
}

// ============================================
// Firestore Data Functions - MESSAGES
// ============================================

function subscribeToMessages(projectId, callback) {
    const q = query(
        collection(db, 'messages'),
        where('projectId', '==', projectId),
        orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, snapshot => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (callback) callback(messages);
    });
    AppState.unsubscribers.push(unsubscribe);
    return unsubscribe;
}

async function sendMessage(projectId, text) {
    try {
        await addDoc(collection(db, 'messages'), {
            projectId,
            senderId: AppState.currentUser.uid,
            senderName: AppState.userProfile?.displayName || 'User',
            text,
            timestamp: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Error sending message:', error);
        return { success: false, error };
    }
}

// ============================================
// Move Lead to Project
// ============================================

async function moveLeadToProject(leadId) {
    try {
        const leadRef = doc(db, 'leads', leadId);
        const leadSnap = await getDoc(leadRef);
        
        if (!leadSnap.exists()) {
            throw new Error('Lead not found');
        }
        
        const leadData = leadSnap.data();
        
        // Create project from lead data
        await createProject({
            companyName: leadData.companyName,
            clientName: leadData.clientName,
            clientEmail: leadData.clientEmail,
            clientPhone: leadData.clientPhone || '',
            websiteUrl: leadData.websiteUrl || '',
            logo: leadData.logo || null,
            location: leadData.location || '',
            businessType: leadData.businessType || '',
            githubLink: leadData.githubLink || '',
            githubUrl: leadData.githubUrl || '',
            tier: 'growth',
            demoFiles: leadData.demoFiles || [],
            notes: leadData.notes || ''
        });
        
        // Delete the lead
        await deleteDoc(leadRef);
        
        showToast('Lead moved to Projects!', 'success');
        window.location.href = 'projects.html';
        return { success: true };
    } catch (error) {
        console.error('Error moving lead to project:', error);
        showToast('Failed to move lead', 'error');
        return { success: false, error };
    }
}

// ============================================
// Return Project to Lead
// ============================================

async function returnProjectToLead(projectId) {
    try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        
        if (!projectSnap.exists()) {
            throw new Error('Project not found');
        }
        
        const projectData = projectSnap.data();
        
        // Create lead from project data
        await createLead({
            companyName: projectData.companyName,
            clientName: projectData.clientName,
            clientEmail: projectData.clientEmail,
            clientPhone: projectData.clientPhone || '',
            websiteUrl: projectData.websiteUrl || '',
            logo: projectData.logo || null,
            location: projectData.location || '',
            businessType: projectData.businessType || '',
            githubLink: projectData.githubLink || '',
            githubUrl: projectData.githubUrl || '',
            status: 'noted',
            demoFiles: projectData.demoFiles || [],
            notes: 'Returned from project: ' + (projectData.notes || '')
        });
        
        // Delete the project
        await deleteDoc(projectRef);
        
        showToast('Project returned to Leads!', 'success');
        window.location.href = 'leads.html';
        return { success: true };
    } catch (error) {
        console.error('Error returning project to lead:', error);
        showToast('Failed to return project', 'error');
        return { success: false, error };
    }
}

// Make functions globally available
window.moveLeadToProject = moveLeadToProject;
window.returnProjectToLead = returnProjectToLead;
window.archiveItem = archiveItem;
window.restoreFromArchive = restoreFromArchive;

// Export for module use
export {
    auth, db, storage,
    AppState,
    login, logout,
    loadLeads, subscribeToLeads, createLead, updateLead, deleteLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadArchive, archiveItem, restoreFromArchive,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getStatusLabel,
    showToast, showLoading
};
