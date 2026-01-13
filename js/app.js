/* ============================================
   SIDEQUEST DIGITAL - App UI Layer
   ============================================ */

import {
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
} from './firebase-portal.js';

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Filter State
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
// RENDERING
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
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${tickets}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="stat-content"><div class="stat-label">Leads</div><div class="stat-value">${leads}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-content"><div class="stat-label">Pending Revenue</div><div class="stat-value">${formatCurrency(pending)}</div></div></div>`;
    } else {
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${AppState.projects.filter(p => p.status === 'active').length}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${AppState.tickets.filter(t => t.status !== 'resolved').length}</div></div></div>`;
    }
}

function renderFilterBar(containerId, items, type) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const locations = getUniqueValues(items, 'location');
    const types = getUniqueValues(items, 'businessType');
    const statuses = type === 'lead' ? ['noted', 'demo-complete', 'demo-sent'] : ['active', 'paused', 'completed'];
    
    c.innerHTML = `
        <div class="filter-bar">
            <input type="text" class="form-input" id="filter-search" placeholder="Search..." value="${filters.search}" style="flex:1;min-width:200px;">
            <select class="form-input form-select" id="filter-location" style="width:150px;"><option value="">All Locations</option>${locations.map(l => `<option value="${l}" ${filters.location === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <select class="form-input form-select" id="filter-type" style="width:180px;"><option value="">All Types</option>${types.map(t => `<option value="${t}" ${filters.businessType === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <select class="form-input form-select" id="filter-status" style="width:150px;"><option value="">All Statuses</option>${statuses.map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${getStatusLabel(s)}</option>`).join('')}</select>
            <button class="btn btn-ghost" onclick="clearFilters()">Clear</button>
        </div>`;
    
    document.getElementById('filter-search')?.addEventListener('input', e => { filters.search = e.target.value; renderCurrentPage(); });
    document.getElementById('filter-location')?.addEventListener('change', e => { filters.location = e.target.value; renderCurrentPage(); });
    document.getElementById('filter-type')?.addEventListener('change', e => { filters.businessType = e.target.value; renderCurrentPage(); });
    document.getElementById('filter-status')?.addEventListener('change', e => { filters.status = e.target.value; renderCurrentPage(); });
}

window.clearFilters = () => { filters = { search: '', location: '', businessType: '', status: '' }; renderCurrentPage(); };

let currentPageType = '';
function renderCurrentPage() {
    if (currentPageType === 'leads') { renderFilterBar('filter-container', AppState.leads, 'lead'); renderLeads('leads-grid'); }
    if (currentPageType === 'projects') { renderFilterBar('filter-container', AppState.projects, 'project'); renderProjects('projects-grid'); }
}

function renderLeads(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const items = applyFilters(AppState.leads);
    if (!items.length) {
        c.innerHTML = `<div class="empty-state"><h3>${AppState.leads.length ? 'No matches' : 'No leads yet'}</h3><p>Add a lead to get started.</p></div>`;
        return;
    }
    c.innerHTML = items.map(l => `
        <div class="item-card" onclick="window.location.href='lead-detail.html?id=${l.id}'">
            <div class="item-card-header">
                <div class="item-logo ${l.logo ? 'has-logo' : ''}" ${l.logo ? `style="background-image:url('${l.logo}')"` : ''}>${l.logo ? '' : getInitials(l.companyName)}</div>
                <div class="item-info"><div class="item-company">${l.companyName || 'Unnamed'}</div><div class="item-client">${l.clientName || ''}</div></div>
            </div>
            <span class="status-badge ${l.status || 'noted'}">${getStatusLabel(l.status || 'noted')}</span>
            <div class="item-tags"><span class="tag">${l.location || '-'}</span><span class="tag">${l.businessType || '-'}</span></div>
            <div class="item-meta"><span>Added ${formatDate(l.createdAt)}</span></div>
        </div>`).join('');
}

function renderProjects(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    let list = items || applyFilters(AppState.projects);
    if (!list.length) {
        c.innerHTML = `<div class="empty-state"><h3>No projects yet</h3><p>Create a project to get started.</p></div>`;
        return;
    }
    c.innerHTML = list.map(p => `
        <div class="item-card" onclick="window.location.href='project-detail.html?id=${p.id}'">
            <div class="item-card-header">
                <div class="item-logo ${p.logo ? 'has-logo' : ''}" ${p.logo ? `style="background-image:url('${p.logo}')"` : ''}>${p.logo ? '' : getInitials(p.companyName)}</div>
                <div class="item-info"><div class="item-company">${p.companyName || 'Unnamed'}</div><div class="item-client">${p.clientName || ''}</div></div>
            </div>
            <div class="item-badges"><span class="status-badge ${p.status || 'active'}">${getStatusLabel(p.status || 'active')}</span><span class="tier-badge ${p.tier || 'host'}">${p.tier || 'host'}</span></div>
            <div class="item-progress"><div class="progress-header"><span>Progress</span><span>${p.progress || 0}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress || 0}%"></div></div></div>
            <div class="item-tags"><span class="tag">${p.location || '-'}</span><span class="tag">${p.businessType || '-'}</span></div>
        </div>`).join('');
}

function renderClients(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!AppState.clients.length) {
        c.innerHTML = '<div class="empty-state"><h3>No clients yet</h3><p>Add client accounts to assign to projects.</p></div>';
        return;
    }
    c.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Temp Password</th><th>Projects</th><th>Actions</th></tr></thead><tbody>
        ${AppState.clients.map(cl => {
            const projCount = AppState.projects.filter(p => (p.assignedClients || []).includes(cl.id)).length;
            return `<tr>
                <td><strong>${cl.displayName || '-'}</strong></td>
                <td>${cl.email || '-'}</td>
                <td>${cl.company || '-'}</td>
                <td><code style="background:#333;padding:2px 6px;border-radius:4px;font-size:12px;">${cl.tempPassword || '-'}</code></td>
                <td>${projCount}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="openEditClientModal('${cl.id}')">Edit</button></td>
            </tr>`;
        }).join('')}
    </tbody></table>`;
}

function renderArchive(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!AppState.archived.length) {
        c.innerHTML = '<div class="empty-state"><h3>Archive empty</h3><p>Archived items appear here.</p></div>';
        return;
    }
    c.innerHTML = AppState.archived.map(a => `
        <div class="item-card" onclick="openArchiveDetailModal('${a.id}')">
            <div class="item-card-header">
                <div class="item-logo" style="opacity:0.5">${getInitials(a.companyName)}</div>
                <div class="item-info"><div class="item-company">${a.companyName || 'Unnamed'}</div><div class="item-client">${a.clientName || ''}</div></div>
            </div>
            <span class="badge badge-secondary">${a.type}</span>
            <div class="item-meta"><span>Archived ${formatDate(a.archivedAt)}</span></div>
            <button class="btn btn-secondary btn-sm mt-md" onclick="event.stopPropagation(); handleRestore('${a.id}')">Restore</button>
        </div>`).join('');
}

function renderTickets(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    let list = [...(items || AppState.tickets)].sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
    if (!list.length) {
        c.innerHTML = '<div class="empty-state"><h3>No tickets</h3></div>';
        return;
    }
    c.innerHTML = list.map(t => `
        <div class="ticket-row" onclick="openTicketModal('${t.id}')">
            <div class="ticket-priority ${t.tier || 'host'}"></div>
            <div class="ticket-info"><div class="ticket-title">${t.title || 'Untitled'}</div><div class="ticket-meta">${t.projectName || '-'} • ${t.submittedBy || '-'} • ${timeAgo(t.submittedAt)}</div></div>
            <div class="ticket-badges"><span class="tier-badge ${t.tier || 'host'}">${t.tier || 'host'}</span><span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span></div>
        </div>`).join('');
}

function renderMilestones(containerId, milestones, editable = false) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!milestones?.length) { c.innerHTML = '<p class="text-muted">No milestones.</p>'; return; }
    c.innerHTML = `<div class="timeline">${milestones.map((m, i) => `
        <div class="timeline-item ${m.status || 'pending'}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <h4>${m.title || 'Milestone'}</h4>
                <p>${m.status === 'completed' ? 'Completed' : m.status === 'current' ? 'In Progress' : 'Upcoming'}</p>
                ${editable ? `<select class="form-input form-select mt-sm" style="width:auto;padding:4px 8px;font-size:12px;" onchange="updateMilestoneStatus(${i}, this.value)">
                    <option value="pending" ${m.status === 'pending' ? 'selected' : ''}>Upcoming</option>
                    <option value="current" ${m.status === 'current' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${m.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>` : ''}
            </div>
        </div>`).join('')}</div>`;
}

function renderInvoices(containerId, invoices) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!invoices?.length) { c.innerHTML = '<p class="text-muted">No invoices.</p>'; return; }
    c.innerHTML = invoices.map(i => `
        <div class="invoice-item">
            <div class="invoice-info"><strong>${i.number || 'Invoice'}</strong><br><span class="text-muted">${i.description || ''}</span></div>
            <span class="badge badge-${i.status === 'paid' ? 'success' : 'warning'}">${i.status || 'pending'}</span>
            <div class="invoice-amount">${formatCurrency(i.amount)}</div>
        </div>`).join('');
}

function renderMessages(containerId, messages) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!messages?.length) { c.innerHTML = '<p class="text-muted text-center">No messages yet.</p>'; return; }
    c.innerHTML = messages.map(m => `
        <div class="message ${m.senderId === AppState.currentUser?.uid ? 'sent' : 'received'}">
            <div class="message-avatar">${getInitials(m.senderName)}</div>
            <div class="message-bubble"><div class="message-sender">${m.senderName || 'User'}</div><div class="message-text">${m.text || ''}</div><div class="message-time">${timeAgo(m.timestamp)}</div></div>
        </div>`).join('');
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
// MODALS
// ============================================

window.openModal = id => document.getElementById(id)?.classList.add('active');
window.closeModal = id => document.getElementById(id)?.classList.remove('active');
window.closeAllModals = () => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

// Edit Lead Modal
window.openEditLeadModal = () => {
    const lead = AppState.currentItem;
    if (!lead) return;
    const modal = document.getElementById('edit-lead-modal');
    if (!modal) return;
    modal.querySelector('[name="companyName"]').value = lead.companyName || '';
    modal.querySelector('[name="clientName"]').value = lead.clientName || '';
    modal.querySelector('[name="clientEmail"]').value = lead.clientEmail || '';
    modal.querySelector('[name="clientPhone"]').value = lead.clientPhone || '';
    modal.querySelector('[name="websiteUrl"]').value = lead.websiteUrl || '';
    modal.querySelector('[name="location"]').value = lead.location || '';
    modal.querySelector('[name="businessType"]').value = lead.businessType || '';
    modal.querySelector('[name="status"]').value = lead.status || 'noted';
    modal.querySelector('[name="githubLink"]').value = lead.githubLink || '';
    modal.querySelector('[name="githubUrl"]').value = lead.githubUrl || '';
    modal.querySelector('[name="notes"]').value = lead.notes || '';
    openModal('edit-lead-modal');
};

// Edit Project Modal
window.openEditProjectModal = () => {
    const proj = AppState.currentItem;
    if (!proj) return;
    const modal = document.getElementById('edit-project-modal');
    if (!modal) return;
    modal.querySelector('[name="companyName"]').value = proj.companyName || '';
    modal.querySelector('[name="clientName"]').value = proj.clientName || '';
    modal.querySelector('[name="clientEmail"]').value = proj.clientEmail || '';
    modal.querySelector('[name="clientPhone"]').value = proj.clientPhone || '';
    modal.querySelector('[name="websiteUrl"]').value = proj.websiteUrl || '';
    modal.querySelector('[name="location"]').value = proj.location || '';
    modal.querySelector('[name="businessType"]').value = proj.businessType || '';
    modal.querySelector('[name="tier"]').value = proj.tier || 'growth';
    modal.querySelector('[name="status"]').value = proj.status || 'active';
    modal.querySelector('[name="progress"]').value = proj.progress || 0;
    modal.querySelector('#progress-value').textContent = (proj.progress || 0) + '%';
    modal.querySelector('[name="githubLink"]').value = proj.githubLink || '';
    modal.querySelector('[name="githubUrl"]').value = proj.githubUrl || '';
    modal.querySelector('[name="notes"]').value = proj.notes || '';
    
    // Assigned clients checkboxes
    const clientsDiv = modal.querySelector('#assign-clients');
    if (clientsDiv) {
        clientsDiv.innerHTML = AppState.clients.map(cl => `
            <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
                <input type="checkbox" name="assignedClients" value="${cl.id}" ${(proj.assignedClients || []).includes(cl.id) ? 'checked' : ''}>
                ${cl.displayName || cl.email} <span class="text-muted">(${cl.company || '-'})</span>
            </label>`).join('') || '<p class="text-muted">No clients yet</p>';
    }
    openModal('edit-project-modal');
};

// Edit Client Modal
window.openEditClientModal = (clientId) => {
    const client = AppState.clients.find(c => c.id === clientId);
    if (!client) return;
    AppState.currentItem = client;
    const modal = document.getElementById('edit-client-modal');
    if (!modal) return;
    modal.querySelector('[name="displayName"]').value = client.displayName || '';
    modal.querySelector('[name="email"]').value = client.email || '';
    modal.querySelector('[name="company"]').value = client.company || '';
    modal.querySelector('[name="phone"]').value = client.phone || '';
    
    // Projects assignment
    const projDiv = modal.querySelector('#client-projects');
    if (projDiv) {
        projDiv.innerHTML = AppState.projects.map(p => `
            <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
                <input type="checkbox" name="clientProjects" value="${p.id}" ${(p.assignedClients || []).includes(clientId) ? 'checked' : ''}>
                ${p.companyName} <span class="tier-badge ${p.tier || 'host'}" style="font-size:10px;">${p.tier || 'host'}</span>
            </label>`).join('') || '<p class="text-muted">No projects yet</p>';
    }
    openModal('edit-client-modal');
};

// Archive Detail Modal
window.openArchiveDetailModal = (archiveId) => {
    const item = AppState.archived.find(a => a.id === archiveId);
    if (!item) return;
    AppState.currentItem = item;
    const modal = document.getElementById('archive-detail-modal');
    if (!modal) return;
    
    const data = item.originalData || {};
    modal.querySelector('.modal-title').textContent = item.companyName || 'Archived Item';
    modal.querySelector('.modal-body').innerHTML = `
        <div class="mb-lg"><span class="badge badge-secondary">${item.type}</span></div>
        <div class="info-grid">
            <div class="info-item"><label>Company</label><span>${item.companyName || '-'}</span></div>
            <div class="info-item"><label>Client</label><span>${item.clientName || '-'}</span></div>
            <div class="info-item"><label>Email</label><span>${item.clientEmail || '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${data.location || '-'}</span></div>
            <div class="info-item"><label>Type</label><span>${data.businessType || '-'}</span></div>
            <div class="info-item"><label>Archived</label><span>${formatDate(item.archivedAt)}</span></div>
            ${item.type === 'project' ? `<div class="info-item"><label>Tier</label><span class="tier-badge ${data.tier || 'host'}">${data.tier || 'host'}</span></div>
            <div class="info-item"><label>Progress</label><span>${data.progress || 0}%</span></div>` : ''}
        </div>
        ${data.notes ? `<div class="mt-lg"><label class="form-label">Notes</label><p>${data.notes}</p></div>` : ''}`;
    openModal('archive-detail-modal');
};

// Ticket Modal
window.openTicketModal = (ticketId) => {
    const t = AppState.tickets.find(x => x.id === ticketId);
    if (!t) return;
    AppState.currentItem = t;
    const modal = document.getElementById('ticket-modal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = t.title || 'Ticket';
    modal.querySelector('.modal-body').innerHTML = `
        <div class="mb-lg"><span class="tier-badge ${t.tier || 'host'}">${t.tier || 'host'}</span> <span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span></div>
        <div class="info-grid mb-lg">
            <div class="info-item"><label>Project</label><span>${t.projectName || '-'}</span></div>
            <div class="info-item"><label>By</label><span>${t.submittedBy || '-'}</span></div>
            <div class="info-item"><label>Submitted</label><span>${formatDate(t.submittedAt)}</span></div>
        </div>
        <div class="mb-lg"><label class="form-label">Description</label><p>${t.description || '-'}</p></div>
        ${t.adminNotes ? `<div class="mb-lg"><label class="form-label">Notes</label><p>${t.adminNotes}</p></div>` : ''}
        ${AppState.isAdmin ? `
        <div class="form-group"><label class="form-label">Add Note</label><textarea class="form-input form-textarea" id="ticket-note"></textarea></div>
        <div class="form-group"><label class="form-label">Status</label>
            <select class="form-input form-select" id="ticket-status">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
        </div>` : ''}`;
    openModal('ticket-modal');
};

// ============================================
// ACTION HANDLERS
// ============================================

window.handleArchive = async (type, id) => {
    openConfirmModal('Archive this item?', async () => {
        const result = await archiveItem(type, id);
        if (result.success) window.location.href = type === 'lead' ? 'leads.html' : 'projects.html';
    });
};

window.handleRestore = async (id) => {
    openConfirmModal('Restore this item?', async () => {
        await restoreFromArchive(id);
        await loadArchive();
        renderArchive('archive-grid');
        closeAllModals();
    });
};

window.handleMoveToProject = async (leadId) => {
    openConfirmModal('Convert this lead to a project?', async () => {
        const result = await moveLeadToProject(leadId);
        if (result.success) window.location.href = 'projects.html';
    });
};

window.handleReturnToLead = async (projectId) => {
    openConfirmModal('Return this project to leads?', async () => {
        const result = await returnProjectToLead(projectId);
        if (result.success) window.location.href = 'leads.html';
    });
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
    const data = Object.fromEntries(new FormData(e.target));
    const result = await createLead(data);
    if (result.success) { closeAllModals(); e.target.reset(); }
};

window.handleCreateProject = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const result = await createProject(data);
    if (result.success) { closeAllModals(); e.target.reset(); }
};

window.handleCreateClient = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.querySelector('[name="email"]').value;
    const password = form.querySelector('[name="password"]').value;
    const displayName = form.querySelector('[name="displayName"]').value;
    const company = form.querySelector('[name="company"]').value;
    
    const result = await createClientWithAuth(email, password, displayName, company);
    if (result.success) {
        closeAllModals();
        form.reset();
        await loadClients();
        renderClients('clients-grid');
        showToast(`Client created! Email: ${email}, Password: ${password}`, 'success');
    }
};

window.handleUpdateLead = async (e) => {
    e.preventDefault();
    const lead = AppState.currentItem;
    if (!lead) return;
    const data = Object.fromEntries(new FormData(e.target));
    await updateLead(lead.id, data);
    closeAllModals();
    location.reload();
};

window.handleUpdateProject = async (e) => {
    e.preventDefault();
    const proj = AppState.currentItem;
    if (!proj) return;
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.progress = parseInt(data.progress) || 0;
    
    // Get assigned clients
    const checkboxes = form.querySelectorAll('[name="assignedClients"]:checked');
    data.assignedClients = Array.from(checkboxes).map(cb => cb.value);
    
    await updateProject(proj.id, data);
    closeAllModals();
    location.reload();
};

window.handleUpdateClient = async (e) => {
    e.preventDefault();
    const client = AppState.currentItem;
    if (!client) return;
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    
    // Update client
    await updateClient(client.id, data);
    
    // Update project assignments
    const checkboxes = form.querySelectorAll('[name="clientProjects"]:checked');
    const assignedProjects = Array.from(checkboxes).map(cb => cb.value);
    
    // Update each project's assignedClients
    for (const proj of AppState.projects) {
        const wasAssigned = (proj.assignedClients || []).includes(client.id);
        const nowAssigned = assignedProjects.includes(proj.id);
        
        if (wasAssigned !== nowAssigned) {
            let newAssigned = [...(proj.assignedClients || [])];
            if (nowAssigned) newAssigned.push(client.id);
            else newAssigned = newAssigned.filter(id => id !== client.id);
            await updateProject(proj.id, { assignedClients: newAssigned });
        }
    }
    
    closeAllModals();
    await loadClients();
    await loadProjects();
    renderClients('clients-grid');
};

window.handleSaveTicket = async () => {
    const t = AppState.currentItem;
    if (!t) return;
    const updates = {};
    const note = document.getElementById('ticket-note')?.value;
    const status = document.getElementById('ticket-status')?.value;
    if (note) updates.adminNotes = note;
    if (status) updates.status = status;
    await updateTicket(t.id, updates);
    closeAllModals();
    await loadTickets();
    renderTickets('tickets-list');
};

window.handleLogoUpload = async (e, itemId, type) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadLogo(file, itemId, type);
    location.reload();
};

window.handleSendMessage = async (projectId) => {
    const input = document.getElementById('message-input');
    if (!input?.value.trim()) return;
    await sendMessage(projectId, input.value.trim());
    input.value = '';
};

window.updateMilestoneStatus = async (index, status) => {
    const proj = AppState.currentItem;
    if (!proj) return;
    const milestones = [...(proj.milestones || [])];
    milestones[index] = { ...milestones[index], status };
    await updateProject(proj.id, { milestones });
    proj.milestones = milestones;
    renderMilestones('milestones', milestones, true);
};

// Confirm Modal
window.openConfirmModal = (message, onConfirm) => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
        // Fallback to native confirm if modal doesn't exist
        if (confirm(message)) onConfirm();
        return;
    }
    modal.querySelector('.confirm-message').textContent = message;
    modal._onConfirm = onConfirm;
    openModal('confirm-modal');
};

window.handleConfirm = () => {
    const modal = document.getElementById('confirm-modal');
    if (modal?._onConfirm) modal._onConfirm();
    closeModal('confirm-modal');
};

window.logout = logout;

// ============================================
// PAGE INITIALIZATION
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
    if (el('page-title')) el('page-title').textContent = lead.companyName || 'Lead';
    if (el('detail-company')) el('detail-company').textContent = lead.companyName || 'Unnamed';
    if (el('detail-client')) el('detail-client').textContent = lead.clientName || '';
    if (el('detail-status')) { el('detail-status').className = `status-badge ${lead.status || 'noted'}`; el('detail-status').textContent = getStatusLabel(lead.status || 'noted'); }
    if (el('detail-logo')) {
        if (lead.logo) { el('detail-logo').style.backgroundImage = `url('${lead.logo}')`; el('detail-logo').classList.add('has-logo'); el('detail-logo').textContent = ''; }
        else el('detail-logo').textContent = getInitials(lead.companyName);
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
    if (el('detail-notes')) el('detail-notes').textContent = lead.notes || 'No notes.';
}

function renderProjectDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const proj = AppState.projects.find(p => p.id === id);
    if (!proj) { window.location.href = 'projects.html'; return; }
    AppState.currentItem = proj;
    
    const el = i => document.getElementById(i);
    if (el('page-title')) el('page-title').textContent = proj.companyName || 'Project';
    if (el('breadcrumb-title')) el('breadcrumb-title').textContent = proj.companyName || 'Project';
    if (el('detail-company')) el('detail-company').textContent = proj.companyName || 'Unnamed';
    if (el('detail-client')) el('detail-client').textContent = proj.clientName || '';
    if (el('detail-status')) { el('detail-status').className = `status-badge ${proj.status || 'active'}`; el('detail-status').textContent = getStatusLabel(proj.status || 'active'); }
    if (el('detail-tier')) { el('detail-tier').className = `tier-badge ${proj.tier || 'host'}`; el('detail-tier').textContent = proj.tier || 'host'; }
    if (el('detail-progress')) el('detail-progress').textContent = (proj.progress || 0) + '%';
    if (el('progress-fill')) el('progress-fill').style.width = (proj.progress || 0) + '%';
    if (el('detail-logo')) {
        if (proj.logo) { el('detail-logo').style.backgroundImage = `url('${proj.logo}')`; el('detail-logo').classList.add('has-logo'); el('detail-logo').textContent = ''; }
        else el('detail-logo').textContent = getInitials(proj.companyName);
    }
    if (el('detail-info')) {
        el('detail-info').innerHTML = `
            <div class="info-item"><label>Email</label><span><a href="mailto:${proj.clientEmail || ''}">${proj.clientEmail || '-'}</a></span></div>
            <div class="info-item"><label>Phone</label><span>${proj.clientPhone || '-'}</span></div>
            <div class="info-item"><label>Website</label><span>${proj.websiteUrl ? `<a href="https://${proj.websiteUrl}" target="_blank">${proj.websiteUrl}</a>` : '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${proj.location || '-'}</span></div>
            <div class="info-item"><label>Type</label><span>${proj.businessType || '-'}</span></div>
            ${proj.githubLink ? `<div class="info-item"><label>GitHub</label><span><a href="${proj.githubLink}" target="_blank">Code</a></span></div>` : ''}`;
    }
    
    renderMilestones('milestones', proj.milestones, AppState.isAdmin);
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
    document.getElementById('edit-lead-form')?.addEventListener('submit', handleUpdateLead);
    document.getElementById('edit-project-form')?.addEventListener('submit', handleUpdateProject);
    document.getElementById('edit-client-form')?.addEventListener('submit', handleUpdateClient);
    
    // Progress slider
    document.querySelector('[name="progress"]')?.addEventListener('input', e => {
        document.getElementById('progress-value').textContent = e.target.value + '%';
    });
});
