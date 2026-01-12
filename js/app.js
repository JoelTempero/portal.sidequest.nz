/* ============================================
   SIDEQUEST DIGITAL - App UI Layer
   Handles rendering and page interactions
   ============================================ */

import {
    auth, db, storage,
    AppState,
    login, logout,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadArchive, archiveItem, restoreFromArchive,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getStatusLabel,
    showToast, showLoading
} from './firebase-portal.js';

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Admin UIDs
const ADMIN_UIDS = ['XQINsp8rRqh9xmgQBrBjI4M2Z7e2'];

// ============================================
// Rendering Functions
// ============================================

function renderStats() {
    const c = document.getElementById('stats-grid');
    if (!c) return;
    
    if (AppState.isAdmin) {
        const active = AppState.projects.filter(p => p.status === 'active').length;
        const tickets = AppState.tickets.filter(t => t.status !== 'resolved').length;
        const leads = AppState.leads.length;
        const pending = AppState.projects.flatMap(p => p.invoices || []).filter(i => i.status === 'pending').reduce((s, i) => s + (i.amount || 0), 0);
        
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${active}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${tickets}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="stat-content"><div class="stat-label">Leads</div><div class="stat-value">${leads}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-content"><div class="stat-label">Pending Revenue</div><div class="stat-value">${formatCurrency(pending)}</div></div></div>`;
    } else {
        const projects = AppState.projects;
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${projects.filter(p => p.status === 'active').length}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${AppState.tickets.filter(t => t.status !== 'resolved').length}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div><div class="stat-content"><div class="stat-label">Pending Invoices</div><div class="stat-value">${projects.flatMap(p => p.invoices || []).filter(i => i.status === 'pending').length}</div></div></div>`;
    }
}

function renderLeads(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!AppState.leads.length) {
        c.innerHTML = '<div class="empty-state"><h3>No leads yet</h3><p>Add your first lead to get started.</p><button class="btn btn-primary" onclick="openModal(\'new-lead-modal\')">Add Lead</button></div>';
        return;
    }
    
    c.innerHTML = AppState.leads.map(l => `
        <div class="item-card" onclick="window.location.href='lead-detail.html?id=${l.id}'">
            <div class="item-card-header"><div class="item-logo">${getInitials(l.companyName)}</div><div class="item-info"><div class="item-company">${l.companyName || 'Unnamed'}</div><div class="item-client">${l.clientName || ''}</div></div></div>
            <span class="status-badge ${l.status || 'noted'}" style="position:absolute;top:16px;right:16px;">${getStatusLabel(l.status || 'noted')}</span>
            <div class="item-tags"><span class="tag">${l.location || 'No location'}</span><span class="tag">${l.businessType || 'No type'}</span></div>
            <div class="item-meta"><span>Added ${formatDate(l.createdAt)}</span><span>${(l.demoFiles || []).length} files</span></div>
        </div>`).join('');
}

function renderProjects(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    const list = items || AppState.projects;
    
    if (!list.length) {
        c.innerHTML = '<div class="empty-state"><h3>No projects yet</h3><p>Projects will appear here.</p></div>';
        return;
    }
    
    c.innerHTML = list.map(p => `
        <div class="item-card" onclick="window.location.href='project-detail.html?id=${p.id}'">
            <div class="item-card-header"><div class="item-logo">${getInitials(p.companyName)}</div><div class="item-info"><div class="item-company">${p.companyName || 'Unnamed'}</div><div class="item-client">${p.clientName || ''}</div></div></div>
            <div class="item-status"><span class="status-badge ${p.status || 'active'}">${getStatusLabel(p.status || 'active')}</span></div>
            <div class="flex gap-sm mb-lg" style="margin-top:-8px;"><span class="tier-badge ${p.tier || 'host'}">${p.tier || 'host'}</span></div>
            <div class="item-progress"><div class="progress-header"><span class="progress-label">Progress</span><span class="progress-value">${p.progress || 0}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress || 0}%"></div></div></div>
            <div class="item-tags"><span class="tag">${p.location || '-'}</span><span class="tag">${p.businessType || '-'}</span></div>
            <div class="item-meta"><span>${(p.milestones || []).filter(m => m.status === 'completed').length}/${(p.milestones || []).length} milestones</span><span>${(p.invoices || []).filter(i => i.status === 'pending').length} pending</span></div>
        </div>`).join('');
}

function renderArchive(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!AppState.archived.length) {
        c.innerHTML = '<div class="empty-state"><h3>Archive empty</h3><p>Archived items will appear here.</p></div>';
        return;
    }
    
    c.innerHTML = AppState.archived.map(a => `
        <div class="item-card" onclick="viewArchived('${a.id}')">
            <div class="item-card-header"><div class="item-logo" style="opacity:0.5">${getInitials(a.companyName)}</div><div class="item-info"><div class="item-company">${a.companyName || 'Unnamed'}</div><div class="item-client">${a.clientName || ''}</div></div></div>
            <span class="badge badge-info" style="position:absolute;top:16px;right:16px;">${a.type}</span>
            <div class="item-meta" style="border:none;padding-top:8px;"><span>Archived ${formatDate(a.archivedAt)}</span><span>${a.reason || ''}</span></div>
            <button class="btn btn-secondary btn-sm mt-lg" onclick="event.stopPropagation(); restoreFromArchive('${a.id}')">Restore</button>
        </div>`).join('');
}

function renderTickets(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    let list = items || AppState.tickets;
    list = [...list].sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
    
    if (!list.length) {
        c.innerHTML = '<div class="empty-state"><h3>No tickets</h3><p>Support tickets will appear here.</p></div>';
        return;
    }
    
    c.innerHTML = list.map(t => `
        <div class="ticket-row" onclick="viewTicket('${t.id}')">
            <div class="ticket-priority ${t.tier || 'host'}"></div>
            <div class="ticket-info"><div class="ticket-title">${t.title || 'Untitled'}</div><div class="ticket-meta">${t.projectName || 'Unknown'} • ${t.submittedBy || 'Unknown'} • ${timeAgo(t.submittedAt)}</div></div>
            <div class="ticket-status"><span class="tier-badge ${t.tier || 'host'}">${t.tier || 'host'}</span><span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span></div>
        </div>`).join('');
}

function renderFiles(containerId, files) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!files?.length) {
        c.innerHTML = '<p class="text-muted">No files yet.</p>';
        return;
    }
    
    c.innerHTML = `<div class="file-list">${files.map(f => `
        <div class="file-item"><div class="file-icon ${f.name?.endsWith('.pdf') ? 'pdf' : 'other'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="file-info"><div class="file-name">${f.name || 'File'}</div><div class="file-meta">${f.size || ''} ${f.uploadedBy ? '• ' + f.uploadedBy : ''}</div></div>
        <button class="btn btn-ghost btn-sm">Download</button></div>`).join('')}</div>`;
}

function renderMilestones(containerId, milestones) {
    const c = document.getElementById(containerId);
    if (!c || !milestones?.length) {
        if (c) c.innerHTML = '<p class="text-muted">No milestones defined.</p>';
        return;
    }
    
    c.innerHTML = `<div class="timeline">${milestones.map(m => `
        <div class="timeline-item ${m.status || 'pending'}"><div class="timeline-dot"></div><div class="timeline-content"><h4>${m.title || 'Milestone'}</h4><p>${m.status === 'completed' ? 'Completed' : m.status === 'current' ? 'In Progress' : 'Upcoming'}</p><div class="timeline-date">${formatDate(m.date)}</div></div></div>`).join('')}</div>`;
}

function renderInvoices(containerId, invoices) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!invoices?.length) {
        c.innerHTML = '<p class="text-muted">No invoices.</p>';
        return;
    }
    
    c.innerHTML = invoices.map(i => `
        <div class="invoice-item"><div class="invoice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
        <div class="invoice-info"><div class="invoice-number">${i.number || 'Invoice'}</div><div class="invoice-desc">${i.description || ''} • Due ${formatDate(i.dueDate)}</div></div>
        <span class="badge badge-${i.status === 'paid' ? 'success' : 'warning'}">${i.status || 'pending'}</span>
        <div class="invoice-amount">${formatCurrency(i.amount || 0)}</div>
        ${i.status !== 'paid' ? '<button class="btn btn-primary btn-sm">Pay Now</button>' : ''}</div>`).join('');
}

function renderMessages(containerId, messages) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!messages?.length) {
        c.innerHTML = '<p class="text-muted text-center">No messages yet. Start the conversation!</p>';
        return;
    }
    
    c.innerHTML = `<div class="message-list">${messages.map(m => `
        <div class="message-item ${m.senderId === AppState.currentUser?.uid ? 'sent' : ''}"><div class="message-avatar">${getInitials(m.senderName)}</div>
        <div class="message-bubble"><div class="message-sender">${m.senderName || 'User'}</div><div class="message-text">${m.text || ''}</div><div class="message-time">${timeAgo(m.timestamp)}</div></div></div>`).join('')}</div>`;
    c.scrollTop = c.scrollHeight;
}

function updateUserInfo() {
    const n = document.getElementById('user-name');
    const r = document.getElementById('user-role');
    const a = document.getElementById('user-avatar');
    
    if (n) n.textContent = AppState.userProfile?.displayName || AppState.currentUser?.email || 'User';
    if (r) r.textContent = AppState.isAdmin ? 'Administrator' : 'Client';
    if (a) a.textContent = getInitials(AppState.userProfile?.displayName || 'U');
    
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = AppState.isAdmin ? '' : 'none');
    document.querySelectorAll('.client-only').forEach(el => el.style.display = AppState.isAdmin ? 'none' : '');
}

// ============================================
// Modal Functions
// ============================================

window.openModal = id => document.getElementById(id)?.classList.add('active');
window.closeModal = id => document.getElementById(id)?.classList.remove('active');
window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

// ============================================
// Ticket Modal
// ============================================

window.viewTicket = async (ticketId) => {
    const t = AppState.tickets.find(x => x.id === ticketId);
    if (!t) return;
    
    AppState.currentItem = t;
    const modal = document.getElementById('ticket-modal');
    if (!modal) return;
    
    modal.querySelector('.modal-title').textContent = t.title || 'Ticket';
    modal.querySelector('.modal-body').innerHTML = `
        <div class="mb-xl"><span class="tier-badge ${t.tier || 'host'}">${t.tier || 'host'}</span> <span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span></div>
        <div class="info-grid mb-xl">
            <div class="info-item"><label>Project</label><span>${t.projectName || 'Unknown'}</span></div>
            <div class="info-item"><label>Submitted By</label><span>${t.submittedBy || 'Unknown'}</span></div>
            <div class="info-item"><label>Submitted</label><span>${formatDate(t.submittedAt)}</span></div>
            <div class="info-item"><label>Status</label><span>${getStatusLabel(t.status || 'open')}</span></div>
        </div>
        <div class="mb-xl"><label class="form-label">Description</label><p>${t.description || 'No description'}</p></div>
        ${t.adminNotes ? `<div class="mb-xl"><label class="form-label">Admin Notes</label><p>${t.adminNotes}</p></div>` : ''}
        ${AppState.isAdmin ? `
        <div class="form-group"><label class="form-label">Add Note</label><textarea class="form-input form-textarea" id="ticket-note-input" placeholder="Add a note..."></textarea></div>
        <div class="form-group"><label class="form-label">Update Status</label>
            <select class="form-input form-select" id="ticket-status-select">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
        </div>` : ''}`;
    
    openModal('ticket-modal');
};

window.saveTicketChanges = async () => {
    const t = AppState.currentItem;
    if (!t) return;
    
    const note = document.getElementById('ticket-note-input')?.value;
    const status = document.getElementById('ticket-status-select')?.value;
    
    const updates = {};
    if (status) updates.status = status;
    if (note) {
        updates.adminNotes = note;
        updates.updates = [...(t.updates || []), { note, timestamp: new Date().toISOString(), by: AppState.userProfile?.displayName || 'Admin' }];
    }
    
    await updateTicket(t.id, updates);
    closeAllModals();
    
    // Refresh tickets list if on tickets page
    if (document.getElementById('tickets-list')) {
        await loadTickets();
        renderTickets('tickets-list');
    }
};

// ============================================
// Form Handlers
// ============================================

window.handleLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const result = await login(email, password);
    
    if (!result.success) {
        const err = document.getElementById('login-error');
        if (err) {
            err.textContent = result.error;
            err.style.display = 'block';
        }
    }
    // Auth state listener will handle redirect
};

window.handleCreateLead = async (e) => {
    e.preventDefault();
    const form = e.target;
    
    const leadData = {
        companyName: form.querySelector('[name="companyName"]')?.value || '',
        clientName: form.querySelector('[name="clientName"]')?.value || '',
        clientEmail: form.querySelector('[name="clientEmail"]')?.value || '',
        clientPhone: form.querySelector('[name="clientPhone"]')?.value || '',
        websiteUrl: form.querySelector('[name="websiteUrl"]')?.value || '',
        location: form.querySelector('[name="location"]')?.value || '',
        businessType: form.querySelector('[name="businessType"]')?.value || '',
        githubLink: form.querySelector('[name="githubLink"]')?.value || '',
        githubUrl: form.querySelector('[name="githubUrl"]')?.value || '',
        status: form.querySelector('[name="status"]')?.value || 'noted',
        notes: form.querySelector('[name="notes"]')?.value || '',
        demoFiles: []
    };
    
    const result = await createLead(leadData);
    if (result.success) {
        closeAllModals();
        form.reset();
    }
};

window.handleSubmitTicket = async (projectId) => {
    const title = document.getElementById('new-ticket-title')?.value;
    const desc = document.getElementById('new-ticket-desc')?.value;
    
    if (!title || !desc) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    const proj = AppState.projects.find(p => p.id === projectId);
    
    await createTicket({
        projectId,
        projectName: proj?.companyName || 'Unknown',
        tier: proj?.tier || 'host',
        title,
        description: desc,
        submittedBy: AppState.userProfile?.displayName || 'User'
    });
    
    closeAllModals();
    document.getElementById('new-ticket-title').value = '';
    document.getElementById('new-ticket-desc').value = '';
};

window.handleSendMessage = async (projectId) => {
    const input = document.getElementById('message-input');
    if (!input?.value.trim()) return;
    
    await sendMessage(projectId, input.value.trim());
    input.value = '';
};

// ============================================
// Page Initialization
// ============================================

async function initializePage() {
    const page = location.pathname.split('/').pop() || 'index.html';
    
    // Login page - no auth needed
    if (page === 'login.html' || page === 'index.html') {
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        showLoading(false);
        return;
    }
    
    // Wait for auth state
    showLoading(true);
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    const page = location.pathname.split('/').pop() || 'index.html';
    
    if (user) {
        // User is signed in
        AppState.currentUser = user;
        AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
        
        // Get or create user profile
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            AppState.userProfile = userSnap.data();
        } else {
            // Create profile for new user
            const profile = {
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                role: AppState.isAdmin ? 'admin' : 'client',
                createdAt: serverTimestamp()
            };
            await setDoc(userRef, profile);
            AppState.userProfile = profile;
        }
        
        // Redirect from login page
        if (page === 'login.html' || page === 'index.html') {
            window.location.href = 'dashboard.html';
            return;
        }
        
        // Load data and render page
        await loadPageData(page);
        renderPage(page);
        updateUserInfo();
        showLoading(false);
        
    } else {
        // User is signed out
        if (page !== 'login.html' && page !== 'index.html') {
            window.location.href = 'login.html';
        }
        showLoading(false);
    }
});

async function loadPageData(page) {
    switch (page) {
        case 'dashboard.html':
            await Promise.all([loadLeads(), loadProjects(), loadTickets()]);
            break;
        case 'leads.html':
        case 'lead-detail.html':
            await loadLeads();
            break;
        case 'projects.html':
        case 'project-detail.html':
            await loadProjects();
            await loadTickets();
            break;
        case 'archive.html':
            await loadArchive();
            break;
        case 'tickets.html':
            await loadTickets();
            break;
    }
}

function renderPage(page) {
    switch (page) {
        case 'dashboard.html':
            renderStats();
            renderProjects('projects-grid', AppState.projects.filter(p => p.status === 'active').slice(0, 4));
            break;
        case 'leads.html':
            renderLeads('leads-grid');
            // Subscribe for real-time updates
            subscribeToLeads(() => renderLeads('leads-grid'));
            break;
        case 'projects.html':
            renderProjects('projects-grid');
            subscribeToProjects(() => renderProjects('projects-grid'));
            break;
        case 'archive.html':
            renderArchive('archive-grid');
            break;
        case 'tickets.html':
            renderTickets('tickets-list');
            subscribeToTickets(() => renderTickets('tickets-list'));
            break;
        case 'lead-detail.html':
            renderLeadDetail();
            break;
        case 'project-detail.html':
            renderProjectDetail();
            break;
    }
}

function renderLeadDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const lead = AppState.leads.find(l => l.id === id);
    
    if (!lead) {
        window.location.href = 'leads.html';
        return;
    }
    
    AppState.currentItem = lead;
    
    const el = (id) => document.getElementById(id);
    if (el('detail-company')) el('detail-company').textContent = lead.companyName || 'Unnamed';
    if (el('detail-client')) el('detail-client').textContent = lead.clientName || '';
    if (el('detail-status')) {
        el('detail-status').className = `status-badge ${lead.status || 'noted'}`;
        el('detail-status').textContent = getStatusLabel(lead.status || 'noted');
    }
    
    if (el('detail-info')) {
        el('detail-info').innerHTML = `
            <div class="info-item"><label>Email</label><span><a href="mailto:${lead.clientEmail || ''}">${lead.clientEmail || '-'}</a></span></div>
            <div class="info-item"><label>Phone</label><span>${lead.clientPhone || '-'}</span></div>
            <div class="info-item"><label>Website</label><span>${lead.websiteUrl ? `<a href="https://${lead.websiteUrl}" target="_blank">${lead.websiteUrl}</a>` : '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${lead.location || '-'}</span></div>
            <div class="info-item"><label>Business Type</label><span>${lead.businessType || '-'}</span></div>
            <div class="info-item"><label>Added</label><span>${formatDate(lead.createdAt)}</span></div>
            ${lead.githubLink ? `<div class="info-item"><label>GitHub</label><span><a href="${lead.githubLink}" target="_blank">View Code</a></span></div>` : ''}
            ${lead.githubUrl ? `<div class="info-item"><label>Preview</label><span><a href="${lead.githubUrl}" target="_blank">View Demo</a></span></div>` : ''}`;
    }
    
    if (el('detail-notes')) el('detail-notes').textContent = lead.notes || 'No notes yet.';
    renderFiles('demo-files', lead.demoFiles);
}

function renderProjectDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const proj = AppState.projects.find(p => p.id === id);
    
    if (!proj) {
        window.location.href = 'projects.html';
        return;
    }
    
    AppState.currentItem = proj;
    
    const el = (id) => document.getElementById(id);
    if (el('detail-company')) el('detail-company').textContent = proj.companyName || 'Unnamed';
    if (el('breadcrumb-title')) el('breadcrumb-title').textContent = proj.companyName || 'Project';
    if (el('detail-client')) el('detail-client').textContent = proj.clientName || '';
    if (el('detail-status')) {
        el('detail-status').className = `status-badge ${proj.status || 'active'}`;
        el('detail-status').textContent = getStatusLabel(proj.status || 'active');
    }
    if (el('detail-tier')) {
        el('detail-tier').className = `tier-badge ${proj.tier || 'host'}`;
        el('detail-tier').textContent = proj.tier || 'host';
    }
    if (el('detail-progress')) el('detail-progress').textContent = (proj.progress || 0) + '%';
    if (el('progress-fill')) el('progress-fill').style.width = (proj.progress || 0) + '%';
    
    if (el('detail-info')) {
        el('detail-info').innerHTML = `
            <div class="info-item"><label>Email</label><span><a href="mailto:${proj.clientEmail || ''}">${proj.clientEmail || '-'}</a></span></div>
            <div class="info-item"><label>Phone</label><span>${proj.clientPhone || '-'}</span></div>
            <div class="info-item"><label>Website</label><span>${proj.websiteUrl ? `<a href="https://${proj.websiteUrl}" target="_blank">${proj.websiteUrl}</a>` : '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${proj.location || '-'}</span></div>
            <div class="info-item"><label>Business Type</label><span>${proj.businessType || '-'}</span></div>
            ${proj.githubLink ? `<div class="info-item"><label>GitHub</label><span><a href="${proj.githubLink}" target="_blank">View Code</a></span></div>` : ''}`;
    }
    
    renderMilestones('milestones', proj.milestones);
    renderFiles('client-files', proj.clientFiles);
    renderInvoices('invoices', proj.invoices);
    
    // Subscribe to messages for real-time updates
    subscribeToMessages(proj.id, (messages) => renderMessages('messages-container', messages));
    
    // Render project tickets
    const projectTickets = AppState.tickets.filter(t => t.projectId === proj.id);
    renderTickets('project-tickets', projectTickets);
    
    // Message form handler
    document.getElementById('message-form')?.addEventListener('submit', e => {
        e.preventDefault();
        handleSendMessage(proj.id);
    });
}

// Global functions
window.logout = logout;
window.restoreFromArchive = restoreFromArchive;

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    
    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => 
        btn.addEventListener('click', closeAllModals)
    );
    
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(m => 
        m.addEventListener('click', e => { if (e.target === m) closeAllModals(); })
    );
    
    // Lead form
    document.getElementById('create-lead-form')?.addEventListener('submit', handleCreateLead);
});
