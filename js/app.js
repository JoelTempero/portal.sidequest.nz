/* ============================================
   SIDEQUEST DIGITAL - App UI Layer
   ============================================ */

import {
    auth, db, storage, AppState, ADMIN_UIDS,
    login, logout,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, createClient, updateClient,
    loadArchive, archiveItem, restoreFromArchive,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    uploadLogo,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getStatusLabel,
    showToast, showLoading
} from './firebase-portal.js';

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ============================================
// Filter State
// ============================================
let filters = { search: '', location: '', businessType: '', status: '' };

function applyFilters(items) {
    return items.filter(item => {
        if (filters.search) {
            const s = filters.search.toLowerCase();
            const searchable = `${item.companyName || ''} ${item.clientName || ''} ${item.clientEmail || ''}`.toLowerCase();
            if (!searchable.includes(s)) return false;
        }
        if (filters.location && item.location !== filters.location) return false;
        if (filters.businessType && item.businessType !== filters.businessType) return false;
        if (filters.status && item.status !== filters.status) return false;
        return true;
    });
}

function getUniqueValues(items, field) {
    return [...new Set(items.map(i => i[field]).filter(Boolean))].sort();
}

// ============================================
// Rendering - Stats
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
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${tickets}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="stat-content"><div class="stat-label">Leads</div><div class="stat-value">${leads}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-content"><div class="stat-label">Pending Revenue</div><div class="stat-value">${formatCurrency(pending)}</div></div></div>`;
    } else {
        const projects = AppState.projects;
        const tickets = AppState.tickets.filter(t => t.status !== 'resolved').length;
        const invoices = projects.flatMap(p => p.invoices || []).filter(i => i.status === 'pending').length;
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${projects.filter(p => p.status === 'active').length}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${tickets}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg></div><div class="stat-content"><div class="stat-label">Pending Invoices</div><div class="stat-value">${invoices}</div></div></div>`;
    }
}

// ============================================
// Rendering - Filter Bar
// ============================================

function renderFilterBar(containerId, items, type) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    const locations = getUniqueValues(items, 'location');
    const types = getUniqueValues(items, 'businessType');
    const statuses = type === 'lead' 
        ? ['noted', 'demo-complete', 'demo-sent']
        : ['active', 'paused', 'completed'];
    
    c.innerHTML = `
        <div class="filter-bar" style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center;">
            <div style="flex:1;min-width:200px;">
                <input type="text" class="form-input" id="filter-search" placeholder="Search by name or email..." value="${filters.search}">
            </div>
            <select class="form-input form-select" id="filter-location" style="width:150px;">
                <option value="">All Locations</option>
                ${locations.map(l => `<option value="${l}" ${filters.location === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <select class="form-input form-select" id="filter-type" style="width:180px;">
                <option value="">All Types</option>
                ${types.map(t => `<option value="${t}" ${filters.businessType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <select class="form-input form-select" id="filter-status" style="width:150px;">
                <option value="">All Statuses</option>
                ${statuses.map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${getStatusLabel(s)}</option>`).join('')}
            </select>
            <button class="btn btn-ghost" onclick="clearFilters()">Clear</button>
        </div>`;
    
    // Add event listeners
    document.getElementById('filter-search')?.addEventListener('input', e => { filters.search = e.target.value; renderCurrentPage(); });
    document.getElementById('filter-location')?.addEventListener('change', e => { filters.location = e.target.value; renderCurrentPage(); });
    document.getElementById('filter-type')?.addEventListener('change', e => { filters.businessType = e.target.value; renderCurrentPage(); });
    document.getElementById('filter-status')?.addEventListener('change', e => { filters.status = e.target.value; renderCurrentPage(); });
}

window.clearFilters = () => {
    filters = { search: '', location: '', businessType: '', status: '' };
    renderCurrentPage();
};

let currentPageType = '';
function renderCurrentPage() {
    if (currentPageType === 'leads') { renderFilterBar('filter-container', AppState.leads, 'lead'); renderLeads('leads-grid'); }
    if (currentPageType === 'projects') { renderFilterBar('filter-container', AppState.projects, 'project'); renderProjects('projects-grid'); }
}

// ============================================
// Rendering - Leads
// ============================================

function renderLeads(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    const items = applyFilters(AppState.leads);
    
    if (!items.length) {
        c.innerHTML = `<div class="empty-state"><h3>${AppState.leads.length ? 'No matches' : 'No leads yet'}</h3><p>${AppState.leads.length ? 'Try adjusting your filters.' : 'Add your first lead to get started.'}</p></div>`;
        return;
    }
    
    c.innerHTML = items.map(l => `
        <div class="item-card" onclick="window.location.href='lead-detail.html?id=${l.id}'">
            <div class="item-card-header">
                <div class="item-logo" ${l.logo ? `style="background-image:url('${l.logo}');background-size:cover;"` : ''}>${l.logo ? '' : getInitials(l.companyName)}</div>
                <div class="item-info"><div class="item-company">${l.companyName || 'Unnamed'}</div><div class="item-client">${l.clientName || ''}</div></div>
            </div>
            <span class="status-badge ${l.status || 'noted'}" style="position:absolute;top:16px;right:16px;">${getStatusLabel(l.status || 'noted')}</span>
            <div class="item-tags"><span class="tag">${l.location || 'No location'}</span><span class="tag">${l.businessType || 'No type'}</span></div>
            <div class="item-meta"><span>Added ${formatDate(l.createdAt)}</span><span>${(l.demoFiles || []).length} files</span></div>
        </div>`).join('');
}

// ============================================
// Rendering - Projects
// ============================================

function renderProjects(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    let list = items || applyFilters(AppState.projects);
    
    if (!list.length) {
        c.innerHTML = `<div class="empty-state"><h3>${AppState.projects.length && !items ? 'No matches' : 'No projects yet'}</h3><p>${AppState.projects.length && !items ? 'Try adjusting your filters.' : 'Create a project to get started.'}</p></div>`;
        return;
    }
    
    c.innerHTML = list.map(p => `
        <div class="item-card" onclick="window.location.href='project-detail.html?id=${p.id}'">
            <div class="item-card-header">
                <div class="item-logo" ${p.logo ? `style="background-image:url('${p.logo}');background-size:cover;"` : ''}>${p.logo ? '' : getInitials(p.companyName)}</div>
                <div class="item-info"><div class="item-company">${p.companyName || 'Unnamed'}</div><div class="item-client">${p.clientName || ''}</div></div>
            </div>
            <div class="item-status"><span class="status-badge ${p.status || 'active'}">${getStatusLabel(p.status || 'active')}</span></div>
            <div class="flex gap-sm mb-lg" style="margin-top:-8px;"><span class="tier-badge ${p.tier || 'host'}">${p.tier || 'host'}</span></div>
            <div class="item-progress"><div class="progress-header"><span class="progress-label">Progress</span><span class="progress-value">${p.progress || 0}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress || 0}%"></div></div></div>
            <div class="item-tags"><span class="tag">${p.location || '-'}</span><span class="tag">${p.businessType || '-'}</span></div>
            <div class="item-meta"><span>${(p.milestones || []).filter(m => m.status === 'completed').length}/${(p.milestones || []).length} milestones</span><span>${(p.invoices || []).filter(i => i.status === 'pending').length} pending</span></div>
        </div>`).join('');
}

// ============================================
// Rendering - Clients
// ============================================

function renderClients(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!AppState.clients.length) {
        c.innerHTML = '<div class="empty-state"><h3>No clients yet</h3><p>Add client accounts to assign them to projects.</p></div>';
        return;
    }
    
    c.innerHTML = `<div class="table-wrapper"><table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Projects</th><th>Actions</th></tr></thead>
        <tbody>${AppState.clients.map(cl => {
            const projectCount = AppState.projects.filter(p => (p.assignedClients || []).includes(cl.id)).length;
            return `<tr>
                <td><strong>${cl.displayName || 'Unknown'}</strong></td>
                <td>${cl.email || '-'}</td>
                <td>${cl.company || '-'}</td>
                <td>${projectCount}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="editClient('${cl.id}')">Edit</button></td>
            </tr>`;
        }).join('')}</tbody>
    </table></div>`;
}

// ============================================
// Rendering - Archive
// ============================================

function renderArchive(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    if (!AppState.archived.length) {
        c.innerHTML = '<div class="empty-state"><h3>Archive empty</h3><p>Archived items will appear here.</p></div>';
        return;
    }
    
    c.innerHTML = AppState.archived.map(a => `
        <div class="item-card">
            <div class="item-card-header"><div class="item-logo" style="opacity:0.5">${getInitials(a.companyName)}</div><div class="item-info"><div class="item-company">${a.companyName || 'Unnamed'}</div><div class="item-client">${a.clientName || ''}</div></div></div>
            <span class="badge badge-info" style="position:absolute;top:16px;right:16px;">${a.type}</span>
            <div class="item-meta" style="border:none;padding-top:8px;"><span>Archived ${formatDate(a.archivedAt)}</span><span>${a.reason || ''}</span></div>
            <button class="btn btn-secondary btn-sm mt-lg" onclick="handleRestore('${a.id}')">Restore</button>
        </div>`).join('');
}

// ============================================
// Rendering - Tickets
// ============================================

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

// ============================================
// Rendering - Other Components
// ============================================

function renderFiles(containerId, files) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!files?.length) { c.innerHTML = '<p class="text-muted">No files yet.</p>'; return; }
    c.innerHTML = `<div class="file-list">${files.map(f => `
        <div class="file-item"><div class="file-icon ${f.name?.endsWith('.pdf') ? 'pdf' : 'other'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
        <div class="file-info"><div class="file-name">${f.name || 'File'}</div><div class="file-meta">${f.size || ''}</div></div>
        <button class="btn btn-ghost btn-sm">Download</button></div>`).join('')}</div>`;
}

function renderMilestones(containerId, milestones) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!milestones?.length) { c.innerHTML = '<p class="text-muted">No milestones.</p>'; return; }
    c.innerHTML = `<div class="timeline">${milestones.map(m => `
        <div class="timeline-item ${m.status || 'pending'}"><div class="timeline-dot"></div><div class="timeline-content"><h4>${m.title || 'Milestone'}</h4><p>${m.status === 'completed' ? 'Completed' : m.status === 'current' ? 'In Progress' : 'Upcoming'}</p><div class="timeline-date">${formatDate(m.date)}</div></div></div>`).join('')}</div>`;
}

function renderInvoices(containerId, invoices) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!invoices?.length) { c.innerHTML = '<p class="text-muted">No invoices.</p>'; return; }
    c.innerHTML = invoices.map(i => `
        <div class="invoice-item"><div class="invoice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
        <div class="invoice-info"><div class="invoice-number">${i.number || 'Invoice'}</div><div class="invoice-desc">${i.description || ''} • Due ${formatDate(i.dueDate)}</div></div>
        <span class="badge badge-${i.status === 'paid' ? 'success' : 'warning'}">${i.status || 'pending'}</span>
        <div class="invoice-amount">${formatCurrency(i.amount)}</div>
        ${i.status !== 'paid' ? '<button class="btn btn-primary btn-sm">Pay Now</button>' : ''}</div>`).join('');
}

function renderMessages(containerId, messages) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!messages?.length) { c.innerHTML = '<p class="text-muted text-center">No messages yet.</p>'; return; }
    c.innerHTML = `<div class="message-list">${messages.map(m => `
        <div class="message-item ${m.senderId === AppState.currentUser?.uid ? 'sent' : ''}"><div class="message-avatar">${getInitials(m.senderName)}</div>
        <div class="message-bubble"><div class="message-sender">${m.senderName || 'User'}</div><div class="message-text">${m.text || ''}</div><div class="message-time">${timeAgo(m.timestamp)}</div></div></div>`).join('')}</div>`;
    c.scrollTop = c.scrollHeight;
}

function updateUserInfo() {
    const n = document.getElementById('user-name');
    const r = document.getElementById('user-role');
    const a = document.getElementById('user-avatar');
    if (n) n.textContent = AppState.userProfile?.displayName || 'User';
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
// Action Handlers
// ============================================

window.handleArchive = async (type, id) => {
    if (!confirm('Archive this item?')) return;
    await archiveItem(type, id);
};

window.handleRestore = async (id) => {
    if (!confirm('Restore this item?')) return;
    await restoreFromArchive(id);
    await loadArchive();
    renderArchive('archive-grid');
};

window.handleMoveToProject = async (leadId) => {
    if (!confirm('Convert this lead to a project?')) return;
    await moveLeadToProject(leadId);
};

window.handleReturnToLead = async (projectId) => {
    if (!confirm('Return this project to leads?')) return;
    await returnProjectToLead(projectId);
};

window.handleLogin = async (e) => {
    e.preventDefault();
    const result = await login(document.getElementById('email').value, document.getElementById('password').value);
    if (!result.success) {
        const err = document.getElementById('login-error');
        if (err) { err.textContent = result.error; err.style.display = 'block'; }
    }
};

window.handleCreateLead = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    data.demoFiles = [];
    const result = await createLead(data);
    if (result.success) { closeAllModals(); form.reset(); }
};

window.handleCreateProject = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    const result = await createProject(data);
    if (result.success) { closeAllModals(); form.reset(); }
};

window.handleCreateClient = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    new FormData(form).forEach((v, k) => data[k] = v);
    const result = await createClient(data);
    if (result.success) { closeAllModals(); form.reset(); await loadClients(); renderClients('clients-grid'); }
};

window.handleLogoUpload = async (e, itemId, type) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadLogo(file, itemId, type);
    location.reload();
};

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
        </div>
        <div class="mb-xl"><label class="form-label">Description</label><p>${t.description || 'No description'}</p></div>
        ${t.adminNotes ? `<div class="mb-xl"><label class="form-label">Notes</label><p>${t.adminNotes}</p></div>` : ''}
        ${AppState.isAdmin ? `
        <div class="form-group"><label class="form-label">Add Note</label><textarea class="form-input form-textarea" id="ticket-note-input"></textarea></div>
        <div class="form-group"><label class="form-label">Status</label>
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
    const updates = {};
    const note = document.getElementById('ticket-note-input')?.value;
    const status = document.getElementById('ticket-status-select')?.value;
    if (status) updates.status = status;
    if (note) updates.adminNotes = note;
    await updateTicket(t.id, updates);
    closeAllModals();
    await loadTickets();
    renderTickets('tickets-list');
};

window.handleSubmitTicket = async (projectId) => {
    const title = document.getElementById('new-ticket-title')?.value;
    const desc = document.getElementById('new-ticket-desc')?.value;
    if (!title || !desc) { showToast('Fill all fields', 'error'); return; }
    const proj = AppState.projects.find(p => p.id === projectId);
    await createTicket({ projectId, projectName: proj?.companyName || 'Unknown', tier: proj?.tier || 'host', title, description: desc, submittedBy: AppState.userProfile?.displayName || 'User' });
    closeAllModals();
};

window.handleSendMessage = async (projectId) => {
    const input = document.getElementById('message-input');
    if (!input?.value.trim()) return;
    await sendMessage(projectId, input.value.trim());
    input.value = '';
};

window.logout = logout;

// ============================================
// Page Initialization
// ============================================

onAuthStateChanged(auth, async (user) => {
    const page = location.pathname.split('/').pop() || 'index.html';
    
    if (user) {
        AppState.currentUser = user;
        AppState.isAdmin = ADMIN_UIDS.includes(user.uid);
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            AppState.userProfile = userSnap.data();
        } else {
            const profile = { email: user.email, displayName: user.displayName || user.email.split('@')[0], role: AppState.isAdmin ? 'admin' : 'client', createdAt: serverTimestamp() };
            await setDoc(userRef, profile);
            AppState.userProfile = profile;
        }
        
        if (page === 'login.html' || page === 'index.html') { window.location.href = 'dashboard.html'; return; }
        
        await loadPageData(page);
        renderPage(page);
        updateUserInfo();
        showLoading(false);
    } else {
        if (page !== 'login.html' && page !== 'index.html') window.location.href = 'login.html';
        showLoading(false);
    }
});

async function loadPageData(page) {
    switch (page) {
        case 'dashboard.html': await Promise.all([loadLeads(), loadProjects(), loadTickets()]); break;
        case 'leads.html': case 'lead-detail.html': await loadLeads(); break;
        case 'projects.html': case 'project-detail.html': await Promise.all([loadProjects(), loadTickets(), loadClients()]); break;
        case 'clients.html': await Promise.all([loadClients(), loadProjects()]); break;
        case 'archive.html': await loadArchive(); break;
        case 'tickets.html': await loadTickets(); break;
    }
}

function renderPage(page) {
    switch (page) {
        case 'dashboard.html':
            renderStats();
            renderProjects('projects-grid', AppState.projects.filter(p => p.status === 'active').slice(0, 4));
            break;
        case 'leads.html':
            currentPageType = 'leads';
            renderFilterBar('filter-container', AppState.leads, 'lead');
            renderLeads('leads-grid');
            subscribeToLeads(() => renderLeads('leads-grid'));
            break;
        case 'projects.html':
            currentPageType = 'projects';
            renderFilterBar('filter-container', AppState.projects, 'project');
            renderProjects('projects-grid');
            subscribeToProjects(() => renderProjects('projects-grid'));
            break;
        case 'clients.html':
            renderClients('clients-grid');
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
    if (!lead) { window.location.href = 'leads.html'; return; }
    AppState.currentItem = lead;
    
    const el = i => document.getElementById(i);
    if (el('detail-company')) el('detail-company').textContent = lead.companyName || 'Unnamed';
    if (el('detail-client')) el('detail-client').textContent = lead.clientName || '';
    if (el('detail-status')) { el('detail-status').className = `status-badge ${lead.status || 'noted'}`; el('detail-status').textContent = getStatusLabel(lead.status || 'noted'); }
    if (el('detail-logo')) { if (lead.logo) el('detail-logo').style.backgroundImage = `url('${lead.logo}')`; else el('detail-logo').textContent = getInitials(lead.companyName); }
    
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
    if (el('detail-notes')) el('detail-notes').textContent = lead.notes || 'No notes.';
    renderFiles('demo-files', lead.demoFiles);
}

function renderProjectDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const proj = AppState.projects.find(p => p.id === id);
    if (!proj) { window.location.href = 'projects.html'; return; }
    AppState.currentItem = proj;
    
    const el = i => document.getElementById(i);
    if (el('detail-company')) el('detail-company').textContent = proj.companyName || 'Unnamed';
    if (el('breadcrumb-title')) el('breadcrumb-title').textContent = proj.companyName || 'Project';
    if (el('detail-client')) el('detail-client').textContent = proj.clientName || '';
    if (el('detail-status')) { el('detail-status').className = `status-badge ${proj.status || 'active'}`; el('detail-status').textContent = getStatusLabel(proj.status || 'active'); }
    if (el('detail-tier')) { el('detail-tier').className = `tier-badge ${proj.tier || 'host'}`; el('detail-tier').textContent = proj.tier || 'host'; }
    if (el('detail-progress')) el('detail-progress').textContent = (proj.progress || 0) + '%';
    if (el('progress-fill')) el('progress-fill').style.width = (proj.progress || 0) + '%';
    if (el('detail-logo')) { if (proj.logo) { el('detail-logo').style.backgroundImage = `url('${proj.logo}')`; el('detail-logo').style.backgroundSize = 'cover'; el('detail-logo').textContent = ''; } else el('detail-logo').textContent = getInitials(proj.companyName); }
    
    if (el('detail-info')) {
        el('detail-info').innerHTML = `
            <div class="info-item"><label>Email</label><span><a href="mailto:${proj.clientEmail || ''}">${proj.clientEmail || '-'}</a></span></div>
            <div class="info-item"><label>Phone</label><span>${proj.clientPhone || '-'}</span></div>
            <div class="info-item"><label>Website</label><span>${proj.websiteUrl ? `<a href="https://${proj.websiteUrl}" target="_blank">${proj.websiteUrl}</a>` : '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${proj.location || '-'}</span></div>
            <div class="info-item"><label>Type</label><span>${proj.businessType || '-'}</span></div>
            ${proj.githubLink ? `<div class="info-item"><label>GitHub</label><span><a href="${proj.githubLink}" target="_blank">Code</a></span></div>` : ''}`;
    }
    
    renderMilestones('milestones', proj.milestones);
    renderFiles('client-files', proj.clientFiles);
    renderInvoices('invoices', proj.invoices);
    subscribeToMessages(proj.id, msgs => renderMessages('messages-container', msgs));
    renderTickets('project-tickets', AppState.tickets.filter(t => t.projectId === proj.id));
    
    document.getElementById('message-form')?.addEventListener('submit', e => { e.preventDefault(); handleSendMessage(proj.id); });
}

// Setup
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeAllModals));
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAllModals(); }));
    document.getElementById('create-lead-form')?.addEventListener('submit', handleCreateLead);
    document.getElementById('create-project-form')?.addEventListener('submit', handleCreateProject);
    document.getElementById('create-client-form')?.addEventListener('submit', handleCreateClient);
});
