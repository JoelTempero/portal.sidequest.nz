/* ============================================
   SIDEQUEST DIGITAL - App UI Layer
   ============================================ */

import {
    auth, db, storage, AppState, ADMIN_UIDS, TIER_NAMES,
    login, logout, createClientWithAuth, uploadFile, uploadLogo,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, updateClient, archiveClient,
    loadArchive, archiveItem, restoreFromArchive, deletePermanent,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getTierName, getStatusLabel,
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
            if (!`${item.companyName || ''} ${item.clientName || ''} ${item.clientEmail || ''}`.toLowerCase().includes(s)) return false;
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
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${active}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${tickets}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><div class="stat-content"><div class="stat-label">Leads</div><div class="stat-value">${AppState.leads.length}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-content"><div class="stat-label">Pending Revenue</div><div class="stat-value">${formatCurrency(AppState.projects.flatMap(p => p.invoices || []).filter(i => i.status === 'pending').reduce((s, i) => s + (i.amount || 0), 0))}</div></div></div>`;
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
    c.innerHTML = `<div class="filter-bar">
        <input type="text" class="form-input" id="filter-search" placeholder="Search..." value="${filters.search}" style="flex:1;min-width:200px;">
        <select class="form-input form-select" id="filter-location" style="width:150px;"><option value="">All Locations</option>${locations.map(l => `<option value="${l}" ${filters.location === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="form-input form-select" id="filter-type" style="width:180px;"><option value="">All Types</option>${types.map(t => `<option value="${t}" ${filters.businessType === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select class="form-input form-select" id="filter-status" style="width:150px;"><option value="">All Statuses</option>${statuses.map(s => `<option value="${s}" ${filters.status === s ? 'selected' : ''}>${getStatusLabel(s)}</option>`).join('')}</select>
        <button class="btn btn-ghost" onclick="clearFilters()">Clear</button>
    </div>`;
    document.getElementById('filter-search')?.addEventListener('input', e => { filters.search = e.target.value; renderGridOnly(); });
    document.getElementById('filter-location')?.addEventListener('change', e => { filters.location = e.target.value; renderGridOnly(); });
    document.getElementById('filter-type')?.addEventListener('change', e => { filters.businessType = e.target.value; renderGridOnly(); });
    document.getElementById('filter-status')?.addEventListener('change', e => { filters.status = e.target.value; renderGridOnly(); });
}

window.clearFilters = () => { filters = { search: '', location: '', businessType: '', status: '' }; renderCurrentPage(); };

let currentPageType = '';
function renderGridOnly() {
    if (currentPageType === 'leads') renderLeads('leads-grid');
    if (currentPageType === 'projects') renderProjects('projects-grid');
}
function renderCurrentPage() {
    if (currentPageType === 'leads') { renderFilterBar('filter-container', AppState.leads, 'lead'); renderLeads('leads-grid'); }
    if (currentPageType === 'projects') { renderFilterBar('filter-container', AppState.projects, 'project'); renderProjects('projects-grid'); }
}

// Cards with big logo on top
function renderLeads(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const items = applyFilters(AppState.leads);
    if (!items.length) { c.innerHTML = `<div class="empty-state"><h3>${AppState.leads.length ? 'No matches' : 'No leads yet'}</h3></div>`; return; }
    c.innerHTML = items.map(l => `
        <div class="item-card" onclick="window.location.href='lead-detail.html?id=${l.id}'">
            ${l.logo ? `<div class="item-card-logo" style="background-image:url('${l.logo}')"></div>` : `<div class="item-card-logo item-card-logo-placeholder">${getInitials(l.companyName)}</div>`}
            <div class="item-card-body">
                <div class="item-company">${l.companyName || 'Unnamed'}</div>
                <div class="item-client">${l.clientName || ''}</div>
                <span class="status-badge ${l.status || 'noted'}">${getStatusLabel(l.status || 'noted')}</span>
                <div class="item-tags"><span class="tag">${l.location || '-'}</span><span class="tag">${l.businessType || '-'}</span></div>
                <div class="item-meta"><span>Added ${formatDate(l.createdAt)}</span></div>
            </div>
        </div>`).join('');
}

function renderProjects(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    let list = items || applyFilters(AppState.projects);
    if (!list.length) { c.innerHTML = `<div class="empty-state"><h3>No projects yet</h3></div>`; return; }
    c.innerHTML = list.map(p => `
        <div class="item-card">
            <div onclick="window.location.href='project-detail.html?id=${p.id}'" style="cursor:pointer;">
                ${p.logo ? `<div class="item-card-logo" style="background-image:url('${p.logo}')"></div>` : `<div class="item-card-logo item-card-logo-placeholder">${getInitials(p.companyName)}</div>`}
                <div class="item-card-body">
                    <div class="item-company">${p.companyName || 'Unnamed'}</div>
                    <div class="item-client">${p.clientName || ''}</div>
                    <div class="item-badges"><span class="status-badge ${p.status || 'active'}">${getStatusLabel(p.status || 'active')}</span><span class="tier-badge ${p.tier || 'farmer'}">${getTierName(p.tier || 'farmer')}</span></div>
                    <div class="item-progress"><div class="progress-header"><span>Progress</span><span>${p.progress || 0}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress || 0}%"></div></div></div>
                </div>
            </div>
            ${AppState.isAdmin ? `<div style="padding:0 16px 16px;border-top:1px solid var(--color-border-subtle);margin-top:8px;padding-top:12px;" onclick="event.stopPropagation();">
                <label style="font-size:11px;color:var(--color-text-muted);display:block;margin-bottom:4px;">Current Task</label>
                <div style="display:flex;gap:8px;"><input type="text" id="task-input-${p.id}" class="form-input" value="${(p.currentTask || '').replace(/"/g, '&quot;')}" placeholder="What's being worked on?" style="flex:1;font-size:13px;padding:6px 10px;"><button class="btn btn-primary btn-sm" onclick="handleQuickSaveTask('${p.id}')">Save</button></div>
            </div>` : `<div style="padding:0 16px 16px;"><span style="font-size:12px;color:var(--color-text-muted);">Task:</span> <span style="font-size:13px;">${p.currentTask || 'None set'}</span></div>`}
        </div>`).join('');
}

function renderClients(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!AppState.clients.length) { c.innerHTML = '<div class="empty-state"><h3>No clients yet</h3></div>'; return; }
    c.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Password</th><th>Projects</th><th></th></tr></thead><tbody>
        ${AppState.clients.map(cl => `<tr>
            <td><strong>${cl.displayName || '-'}</strong></td>
            <td>${cl.email || '-'}</td>
            <td>${cl.company || '-'}</td>
            <td><code style="background:#333;padding:2px 6px;border-radius:4px;font-size:11px;">${cl.tempPassword || '-'}</code> <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;" onclick="openChangePasswordModal('${cl.id}')">Change</button></td>
            <td>${AppState.projects.filter(p => (p.assignedClients || []).includes(cl.id)).length}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="openEditClientModal('${cl.id}')">Edit</button></td>
        </tr>`).join('')}</tbody></table>`;
}

function renderArchive(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!AppState.archived.length) { c.innerHTML = '<div class="empty-state"><h3>Archive empty</h3></div>'; return; }
    c.innerHTML = AppState.archived.map(a => `
        <div class="item-card" onclick="openArchiveDetailModal('${a.id}')">
            <div class="item-card-logo item-card-logo-placeholder" style="opacity:0.5">${getInitials(a.companyName || a.clientName)}</div>
            <div class="item-card-body">
                <div class="item-company">${a.companyName || a.clientName || 'Unnamed'}</div>
                <div class="item-client">${a.clientEmail || ''}</div>
                <span class="badge badge-secondary">${a.type === 'client' ? 'Client' : a.type === 'lead' ? 'Lead' : 'Project'}</span>
                <div class="item-meta"><span>Archived ${formatDate(a.archivedAt)}</span></div>
                <div class="flex gap-sm mt-sm">
                    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); handleRestore('${a.id}', '${a.type}')">Restore</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--color-error);" onclick="event.stopPropagation(); handleDeletePermanent('${a.id}')">Delete</button>
                </div>
            </div>
        </div>`).join('');
}

function renderTickets(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    let list = [...(items || AppState.tickets)].sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier));
    if (!list.length) { c.innerHTML = '<div class="empty-state"><h3>No tickets</h3></div>'; return; }
    c.innerHTML = list.map(t => `
        <div class="ticket-row" onclick="openTicketModal('${t.id}')">
            <div class="ticket-priority ${t.tier || 'host'}"></div>
            <div class="ticket-info"><div class="ticket-title">${t.title || 'Untitled'}</div><div class="ticket-meta">${t.projectName || '-'} • ${t.submittedBy || '-'} • ${timeAgo(t.submittedAt)}</div></div>
            <div class="ticket-badges"><span class="tier-badge ${t.tier || 'host'}">${getTierName(t.tier || 'host')}</span><span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span></div>
        </div>`).join('');
}

function renderMilestones(containerId, milestones, editable = false) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!milestones?.length) { c.innerHTML = '<p class="text-muted">No milestones yet.</p>'; return; }
    c.innerHTML = `<div class="milestone-list">${milestones.map((m, i) => `
        <div class="milestone-item ${m.status || 'pending'}">
            <div class="milestone-dot"></div>
            <div class="milestone-content">
                <div class="milestone-title">${m.title || 'Milestone'}</div>
                ${editable ? `<select class="form-input form-select milestone-status-select" data-index="${i}">
                    <option value="pending" ${m.status === 'pending' ? 'selected' : ''}>Upcoming</option>
                    <option value="current" ${m.status === 'current' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${m.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>` : `<span class="milestone-status">${m.status === 'completed' ? 'Completed' : m.status === 'current' ? 'In Progress' : 'Upcoming'}</span>`}
            </div>
        </div>`).join('')}</div>`;
    
    // Add event listeners for milestone status changes
    if (editable) {
        c.querySelectorAll('.milestone-status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const index = parseInt(e.target.dataset.index);
                const newStatus = e.target.value;
                await updateMilestoneStatus(index, newStatus);
            });
        });
    }
}

function renderInvoices(containerId, invoices) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!invoices?.length) { c.innerHTML = '<p class="text-muted">No invoices yet.</p>'; return; }
    c.innerHTML = invoices.map(i => `<div class="invoice-item"><div class="invoice-info"><strong>${i.number || 'Invoice'}</strong><br><span class="text-muted">${i.description || ''}</span></div><span class="badge badge-${i.status === 'paid' ? 'success' : 'warning'}">${i.status || 'pending'}</span><div class="invoice-amount">${formatCurrency(i.amount)}</div></div>`).join('');
}

function renderMessages(containerId, messages) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!messages?.length) { c.innerHTML = '<p class="text-muted text-center">No messages yet.</p>'; return; }
    c.innerHTML = messages.map(m => `<div class="message ${m.senderId === AppState.currentUser?.uid ? 'sent' : 'received'}"><div class="message-avatar">${getInitials(m.senderName)}</div><div class="message-bubble"><div class="message-sender">${m.senderName || 'User'}</div><div class="message-text">${m.text || ''}</div><div class="message-time">${timeAgo(m.timestamp)}</div></div></div>`).join('');
    c.scrollTop = c.scrollHeight;
}

function updateUserInfo() {
    const n = document.getElementById('user-name');
    const r = document.getElementById('user-role');
    const a = document.getElementById('user-avatar');
    if (n) n.textContent = AppState.userProfile?.displayName || 'User';
    if (r) r.textContent = AppState.isAdmin ? 'Administrator' : 'Client';
    if (a) {
        if (AppState.userProfile?.avatar) {
            a.innerHTML = `<img src="${AppState.userProfile.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            a.textContent = getInitials(AppState.userProfile?.displayName || 'U');
        }
    }
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = AppState.isAdmin ? '' : 'none');
    document.querySelectorAll('.client-only').forEach(el => el.style.display = AppState.isAdmin ? 'none' : '');
    
    // Populate admin profile modal if exists
    const adminName = document.getElementById('admin-display-name');
    const adminAvatar = document.getElementById('admin-avatar-preview');
    if (adminName) adminName.value = AppState.userProfile?.displayName || '';
    if (adminAvatar) {
        if (AppState.userProfile?.avatar) {
            adminAvatar.innerHTML = `<img src="${AppState.userProfile.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
        } else {
            adminAvatar.textContent = getInitials(AppState.userProfile?.displayName || 'U');
        }
    }
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
    const m = document.getElementById('edit-lead-modal');
    if (!m) return;
    m.querySelector('[name="companyName"]').value = lead.companyName || '';
    m.querySelector('[name="clientName"]').value = lead.clientName || '';
    m.querySelector('[name="clientEmail"]').value = lead.clientEmail || '';
    m.querySelector('[name="clientPhone"]').value = lead.clientPhone || '';
    m.querySelector('[name="websiteUrl"]').value = lead.websiteUrl || '';
    m.querySelector('[name="location"]').value = lead.location || '';
    m.querySelector('[name="businessType"]').value = lead.businessType || '';
    m.querySelector('[name="status"]').value = lead.status || 'noted';
    m.querySelector('[name="githubLink"]').value = lead.githubLink || '';
    m.querySelector('[name="githubUrl"]').value = lead.githubUrl || '';
    m.querySelector('[name="notes"]').value = lead.notes || '';
    openModal('edit-lead-modal');
};

// Edit Project Modal
window.openEditProjectModal = () => {
    const p = AppState.currentItem;
    if (!p) { console.error('No current item'); return; }
    const m = document.getElementById('edit-project-modal');
    if (!m) { console.error('No modal found'); return; }
    
    m.querySelector('[name="companyName"]').value = p.companyName || '';
    m.querySelector('[name="clientName"]').value = p.clientName || '';
    m.querySelector('[name="clientEmail"]').value = p.clientEmail || '';
    m.querySelector('[name="clientPhone"]').value = p.clientPhone || '';
    m.querySelector('[name="websiteUrl"]').value = p.websiteUrl || '';
    m.querySelector('[name="location"]').value = p.location || '';
    m.querySelector('[name="businessType"]').value = p.businessType || '';
    m.querySelector('[name="tier"]').value = p.tier || 'farmer';
    m.querySelector('[name="status"]').value = p.status || 'active';
    
    const progressInput = m.querySelector('[name="progress"]');
    const progressValue = m.querySelector('#progress-value');
    if (progressInput) progressInput.value = p.progress || 0;
    if (progressValue) progressValue.textContent = (p.progress || 0) + '%';
    
    m.querySelector('[name="githubLink"]').value = p.githubLink || '';
    m.querySelector('[name="previewLinks"]').value = (p.previewLinks || []).join('\n');
    m.querySelector('[name="notes"]').value = p.notes || '';
    
    // Assigned clients with search (hidden until searched)
    const clientsDiv = m.querySelector('#assign-clients');
    if (clientsDiv) {
        const assignedIds = p.assignedClients || [];
        const assignedClients = AppState.clients.filter(cl => assignedIds.includes(cl.id));
        clientsDiv.innerHTML = `
            <input type="text" class="form-input mb-sm" id="client-search" placeholder="Search clients to assign..." oninput="filterClientCheckboxes(this.value)">
            ${assignedClients.length ? `<div class="mb-sm" style="font-size:12px;color:var(--color-text-muted);">Currently assigned: ${assignedClients.map(c => c.displayName || c.email).join(', ')}</div>` : '<div class="mb-sm" style="font-size:12px;color:var(--color-text-muted);">No clients assigned</div>'}
            <div id="client-checkboxes" style="max-height:200px;overflow-y:auto;">
                ${AppState.clients.map(cl => `<label class="checkbox-item" data-name="${(cl.displayName || '').toLowerCase()} ${(cl.company || '').toLowerCase()}" style="display:none;">
                    <input type="checkbox" name="assignedClients" value="${cl.id}" ${assignedIds.includes(cl.id) ? 'checked' : ''}>
                    <span>${cl.displayName || cl.email}</span> <span class="text-muted">(${cl.company || '-'})</span>
                </label>`).join('') || '<p class="text-muted">No clients yet</p>'}
            </div>`;
    }
    openModal('edit-project-modal');
};

window.filterClientCheckboxes = (search) => {
    const s = search.toLowerCase().trim();
    document.querySelectorAll('#client-checkboxes .checkbox-item').forEach(el => {
        // Show if search matches OR if already checked
        const matches = s && el.dataset.name.includes(s);
        const isChecked = el.querySelector('input[type="checkbox"]').checked;
        el.style.display = (matches || isChecked) ? '' : 'none';
    });
};

// Edit Client Modal
window.openEditClientModal = (clientId) => {
    const client = AppState.clients.find(c => c.id === clientId);
    if (!client) return;
    AppState.currentItem = client;
    const m = document.getElementById('edit-client-modal');
    if (!m) return;
    m.querySelector('[name="displayName"]').value = client.displayName || '';
    m.querySelector('[name="email"]').value = client.email || '';
    m.querySelector('[name="company"]').value = client.company || '';
    m.querySelector('[name="phone"]').value = client.phone || '';
    
    // Projects with search
    const projDiv = m.querySelector('#client-projects');
    if (projDiv) {
        projDiv.innerHTML = `
            <input type="text" class="form-input mb-sm" id="project-search" placeholder="Search projects..." oninput="filterProjectCheckboxes(this.value)">
            <div id="project-checkboxes" style="max-height:200px;overflow-y:auto;">
                ${AppState.projects.map(p => `<label class="checkbox-item" data-name="${(p.companyName || '').toLowerCase()}">
                    <input type="checkbox" name="clientProjects" value="${p.id}" ${(p.assignedClients || []).includes(clientId) ? 'checked' : ''}>
                    <span>${p.companyName}</span> <span class="tier-badge ${p.tier || 'farmer'}" style="font-size:10px;">${getTierName(p.tier || 'farmer')}</span>
                </label>`).join('') || '<p class="text-muted">No projects yet</p>'}
            </div>`;
    }
    openModal('edit-client-modal');
};

window.filterProjectCheckboxes = (search) => {
    const s = search.toLowerCase();
    document.querySelectorAll('#project-checkboxes .checkbox-item').forEach(el => {
        el.style.display = el.dataset.name.includes(s) ? '' : 'none';
    });
};

// Archive Detail Modal
window.openArchiveDetailModal = (archiveId) => {
    const item = AppState.archived.find(a => a.id === archiveId);
    if (!item) return;
    AppState.currentItem = item;
    const m = document.getElementById('archive-detail-modal');
    if (!m) return;
    const d = item.originalData || {};
    m.querySelector('.modal-title').textContent = item.companyName || 'Archived Item';
    m.querySelector('.modal-body').innerHTML = `
        <div class="mb-lg"><span class="badge badge-secondary">${item.type}</span></div>
        <div class="info-grid">
            <div class="info-item"><label>Company</label><span>${item.companyName || '-'}</span></div>
            <div class="info-item"><label>Client</label><span>${item.clientName || '-'}</span></div>
            <div class="info-item"><label>Email</label><span>${item.clientEmail || '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${d.location || '-'}</span></div>
            <div class="info-item"><label>Type</label><span>${d.businessType || '-'}</span></div>
            <div class="info-item"><label>Archived</label><span>${formatDate(item.archivedAt)}</span></div>
            ${item.type === 'project' ? `<div class="info-item"><label>Tier</label><span class="tier-badge ${d.tier || 'farmer'}">${getTierName(d.tier || 'farmer')}</span></div><div class="info-item"><label>Progress</label><span>${d.progress || 0}%</span></div>` : ''}
        </div>
        ${d.notes ? `<div class="mt-lg"><label class="form-label">Notes</label><p>${d.notes}</p></div>` : ''}`;
    openModal('archive-detail-modal');
};

// Ticket Modal
window.openTicketModal = (ticketId) => {
    const t = AppState.tickets.find(x => x.id === ticketId);
    if (!t) return;
    AppState.currentItem = t;
    const m = document.getElementById('ticket-modal');
    if (!m) return;
    m.querySelector('.modal-title').textContent = t.title || 'Ticket';
    m.querySelector('.modal-body').innerHTML = `
        <div class="mb-lg"><span class="tier-badge ${t.tier || 'host'}">${getTierName(t.tier || 'host')}</span> <span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span></div>
        <div class="info-grid mb-lg">
            <div class="info-item"><label>Project</label><span>${t.projectName || '-'}</span></div>
            <div class="info-item"><label>By</label><span>${t.submittedBy || '-'}</span></div>
            <div class="info-item"><label>Submitted</label><span>${formatDate(t.submittedAt)}</span></div>
        </div>
        <div class="mb-lg"><label class="form-label">Description</label><p>${t.description || '-'}</p></div>
        ${AppState.isAdmin ? `<div class="form-group"><label class="form-label">Admin Note</label><textarea class="form-input form-textarea" id="ticket-note">${t.adminNotes || ''}</textarea></div>
        <div class="form-group"><label class="form-label">Status</label><select class="form-input form-select" id="ticket-status"><option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option><option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option><option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option></select></div>` : ''}`;
    openModal('ticket-modal');
};

// Confirm Modal
window.openConfirmModal = (message, onConfirm) => {
    const m = document.getElementById('confirm-modal');
    if (!m) { if (confirm(message)) onConfirm(); return; }
    m.querySelector('.confirm-message').textContent = message;
    m._onConfirm = onConfirm;
    openModal('confirm-modal');
};
window.handleConfirm = () => { const m = document.getElementById('confirm-modal'); if (m?._onConfirm) m._onConfirm(); closeModal('confirm-modal'); };

// ============================================
// ACTION HANDLERS
// ============================================

window.handleArchive = (type, id) => openConfirmModal('Archive this item?', async () => { const r = await archiveItem(type, id); if (r.success) window.location.href = type === 'lead' ? 'leads.html' : 'projects.html'; });
window.handleRestore = (id, type) => openConfirmModal(`Restore this ${type || 'item'}?`, async () => { await restoreFromArchive(id); await loadArchive(); renderArchive('archive-grid'); closeAllModals(); });
window.handleDeletePermanent = (id) => openConfirmModal('Permanently delete this item? This cannot be undone.', async () => { await deletePermanent(id); await loadArchive(); renderArchive('archive-grid'); closeAllModals(); });
window.handleMoveToProject = (leadId) => openConfirmModal('Convert this lead to a project?', async () => { const r = await moveLeadToProject(leadId); if (r.success) window.location.href = 'projects.html'; });
window.handleReturnToLead = (projectId) => openConfirmModal('Return this project to leads?', async () => { const r = await returnProjectToLead(projectId); if (r.success) window.location.href = 'leads.html'; });

window.handleLogin = async (e) => {
    e.preventDefault();
    const r = await login(document.getElementById('email').value, document.getElementById('password').value);
    if (!r.success) { const err = document.getElementById('login-error'); if (err) { err.textContent = r.error; err.style.display = 'block'; } }
};

window.handleCreateLead = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    // Remove empty logo field from form data (it's a file, handled separately)
    delete data.logo;
    const logoFile = form.querySelector('[name="logo"]')?.files[0];
    console.log('Creating lead with data:', data, 'Logo file:', logoFile);
    const r = await createLead(data, logoFile);
    if (r.success) { closeAllModals(); form.reset(); }
};

window.handleCreateProject = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    // Remove empty logo field from form data (it's a file, handled separately)
    delete data.logo;
    const logoFile = form.querySelector('[name="logo"]')?.files[0];
    console.log('Creating project with data:', data, 'Logo file:', logoFile);
    const r = await createProject(data, logoFile);
    if (r.success) { closeAllModals(); form.reset(); }
};

window.handleCreateClient = async (e) => {
    e.preventDefault();
    const form = e.target;
    const r = await createClientWithAuth(
        form.querySelector('[name="email"]').value,
        form.querySelector('[name="password"]').value,
        form.querySelector('[name="displayName"]').value,
        form.querySelector('[name="company"]').value
    );
    if (r.success) { closeAllModals(); form.reset(); await loadClients(); renderClients('clients-grid'); }
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
    if (!proj) { console.error('No project selected'); return; }
    
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.progress = parseInt(data.progress) || 0;
    
    // Parse preview links from textarea (one per line)
    if (data.previewLinks) {
        data.previewLinks = data.previewLinks.split('\n').map(l => l.trim()).filter(l => l);
    } else {
        data.previewLinks = [];
    }
    
    // Get assigned clients
    const checkboxes = form.querySelectorAll('[name="assignedClients"]:checked');
    data.assignedClients = Array.from(checkboxes).map(cb => cb.value);
    
    // Remove 'logo' from data if empty (don't overwrite existing)
    delete data.logo;
    
    console.log('Saving project:', proj.id, data);
    const result = await updateProject(proj.id, data);
    if (result.success) {
        closeAllModals();
        location.reload();
    }
};

window.handleUpdateClient = async (e) => {
    e.preventDefault();
    const client = AppState.currentItem;
    if (!client) return;
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    await updateClient(client.id, { displayName: data.displayName, company: data.company, phone: data.phone });
    
    // Update project assignments
    const checkboxes = form.querySelectorAll('[name="clientProjects"]:checked');
    const assignedProjects = Array.from(checkboxes).map(cb => cb.value);
    
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

window.openChangePasswordModal = (clientId) => {
    const client = AppState.clients.find(c => c.id === clientId);
    if (!client) return;
    AppState.currentItem = client;
    document.getElementById('new-client-password').value = '';
    openModal('change-password-modal');
};

window.handleChangeClientPassword = async () => {
    const client = AppState.currentItem;
    if (!client) return;
    const newPassword = document.getElementById('new-client-password').value;
    if (!newPassword) { showToast('Please enter a password', 'error'); return; }
    await updateClient(client.id, { tempPassword: newPassword });
    closeAllModals();
    await loadClients();
    renderClients('clients-grid');
};

window.handleArchiveClient = () => {
    const client = AppState.currentItem;
    if (!client) return;
    openConfirmModal('Archive this client? They will no longer be able to log in.', async () => {
        const result = await archiveClient(client.id);
        if (result.success) {
            closeAllModals();
            await loadClients();
            renderClients('clients-grid');
        }
    });
};

window.handleSaveTicket = async () => {
    const t = AppState.currentItem;
    if (!t) return;
    const updates = {};
    const note = document.getElementById('ticket-note')?.value;
    const status = document.getElementById('ticket-status')?.value;
    if (note !== undefined) updates.adminNotes = note;
    if (status) updates.status = status;
    await updateTicket(t.id, updates);
    closeAllModals();
    await loadTickets();
    renderTickets('tickets-list');
};

window.handleSubmitTicket = async (projectId) => {
    const title = document.getElementById('new-ticket-title')?.value;
    const desc = document.getElementById('new-ticket-desc')?.value;
    const urgency = document.getElementById('new-ticket-urgency')?.value || 'week';
    
    if (!title) { showToast('Please enter a title', 'error'); return; }
    
    const proj = AppState.projects.find(p => p.id === projectId);
    const result = await createTicket({
        projectId,
        projectName: proj?.companyName || 'Unknown',
        title,
        description: desc || '',
        urgency,
        tier: proj?.tier || 'farmer',
        submittedById: AppState.currentUser?.uid,
        submittedBy: AppState.userProfile?.displayName || 'Client'
    });
    
    if (result.success) {
        closeAllModals();
        document.getElementById('new-ticket-title').value = '';
        document.getElementById('new-ticket-desc').value = '';
        await loadTickets();
        renderTickets('project-tickets', AppState.tickets.filter(t => t.projectId === projectId));
    }
};

window.handleAddMilestone = async () => {
    const proj = AppState.currentItem;
    if (!proj) return;
    
    const title = document.getElementById('new-milestone-title')?.value;
    const date = document.getElementById('new-milestone-date')?.value;
    
    if (!title) { showToast('Please enter a title', 'error'); return; }
    
    const milestones = [...(proj.milestones || [])];
    milestones.push({
        id: 'm' + Date.now(),
        title,
        date: date || new Date().toISOString().split('T')[0],
        status: 'pending'
    });
    
    const result = await updateProject(proj.id, { milestones });
    if (result.success) {
        proj.milestones = milestones;
        AppState.currentItem = proj;
        closeAllModals();
        renderMilestones('milestones', milestones, AppState.isAdmin);
    }
};

window.handleSaveCurrentTask = async () => {
    const proj = AppState.currentItem;
    if (!proj) return;
    
    const task = document.getElementById('edit-current-task')?.value || '';
    const result = await updateProject(proj.id, { currentTask: task });
    if (result.success) {
        proj.currentTask = task;
        AppState.currentItem = proj;
        document.getElementById('current-task').textContent = task || 'No current task set.';
        closeAllModals();
    }
};

window.openEditTaskModal = (projectId) => {
    const proj = projectId ? AppState.projects.find(p => p.id === projectId) : AppState.currentItem;
    if (!proj) return;
    AppState.currentItem = proj;
    document.getElementById('edit-current-task').value = proj.currentTask || '';
    openModal('edit-task-modal');
};

window.handleQuickSaveTask = async (projectId) => {
    const input = document.getElementById(`task-input-${projectId}`);
    if (!input) return;
    const result = await updateProject(projectId, { currentTask: input.value });
    if (result.success) {
        showToast('Task saved!', 'success');
        // Update local state
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj) proj.currentTask = input.value;
    }
};

window.handleDashboardTicket = async () => {
    const projectId = document.getElementById('dash-ticket-project')?.value;
    const title = document.getElementById('dash-ticket-title')?.value;
    const urgency = document.getElementById('dash-ticket-urgency')?.value || 'week';
    const desc = document.getElementById('dash-ticket-desc')?.value;
    
    if (!projectId) { showToast('Please select a project', 'error'); return; }
    if (!title) { showToast('Please enter a title', 'error'); return; }
    
    const proj = AppState.projects.find(p => p.id === projectId);
    const result = await createTicket({
        projectId,
        projectName: proj?.companyName || 'Unknown',
        title,
        description: desc || '',
        urgency,
        tier: proj?.tier || 'farmer',
        submittedById: AppState.currentUser?.uid,
        submittedBy: AppState.userProfile?.displayName || 'Client'
    });
    
    if (result.success) {
        closeAllModals();
        document.getElementById('dash-ticket-title').value = '';
        document.getElementById('dash-ticket-desc').value = '';
        await loadTickets();
        renderClientTickets('tickets-grid');
    }
};

function populateDashboardTicketProjects() {
    const select = document.getElementById('dash-ticket-project');
    if (!select || AppState.isAdmin) return;
    select.innerHTML = AppState.projects.map(p => `<option value="${p.id}">${p.companyName || 'Unnamed'}</option>`).join('');
}

window.handleLogoUpload = async (e, itemId, type) => {
    const file = e.target.files[0];
    if (!file) return;
    await uploadLogo(file, itemId, type);
    location.reload();
};

window.handleSendMessage = async (projectId) => {
    console.log('handleSendMessage called with projectId:', projectId);
    const input = document.getElementById('message-input');
    console.log('Message input value:', input?.value);
    if (!input?.value.trim()) { console.log('Empty message, returning'); return; }
    const result = await sendMessage(projectId, input.value.trim());
    console.log('Send result:', result);
    if (result.success) input.value = '';
};

window.updateMilestoneStatus = async (index, newStatus) => {
    const proj = AppState.currentItem;
    if (!proj) { console.error('No project'); return; }
    const milestones = [...(proj.milestones || [])];
    milestones[index] = { ...milestones[index], status: newStatus };
    const result = await updateProject(proj.id, { milestones });
    if (result.success) {
        proj.milestones = milestones;
        AppState.currentItem = proj;
    }
};

window.updateProgress = async (value) => {
    const proj = AppState.currentItem;
    if (!proj) return;
    document.getElementById('detail-progress').textContent = value + '%';
    document.getElementById('progress-fill').style.width = value + '%';
    await updateProject(proj.id, { progress: parseInt(value) });
};

// Admin Profile
window.handleAdminAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const path = `avatars/${AppState.currentUser.uid}/${Date.now()}_${file.name}`;
        const url = await uploadFile(file, path);
        if (url) {
            await setDoc(doc(db, 'users', AppState.currentUser.uid), { avatar: url }, { merge: true });
            AppState.userProfile.avatar = url;
            updateUserInfo();
            const preview = document.getElementById('admin-avatar-preview');
            if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
            showToast('Avatar uploaded!', 'success');
        }
    } catch (e) { showToast('Upload failed', 'error'); }
};

window.handleSaveAdminProfile = async () => {
    const name = document.getElementById('admin-display-name')?.value;
    if (name) {
        await setDoc(doc(db, 'users', AppState.currentUser.uid), { displayName: name }, { merge: true });
        AppState.userProfile.displayName = name;
        updateUserInfo();
        showToast('Profile updated!', 'success');
    }
    closeAllModals();
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
            if (AppState.isAdmin) {
                renderProjects('projects-grid', AppState.projects.filter(p => p.status === 'active').slice(0, 4));
            } else {
                // Client dashboard - show their projects and tickets
                renderProjects('projects-grid', AppState.projects);
                renderClientTickets('tickets-grid');
                populateDashboardTicketProjects();
            }
            break;
        case 'leads.html': currentPageType = 'leads'; renderFilterBar('filter-container', AppState.leads, 'lead'); renderLeads('leads-grid'); subscribeToLeads(() => renderLeads('leads-grid')); break;
        case 'projects.html':
            currentPageType = 'projects';
            if (AppState.isAdmin) {
                renderFilterBar('filter-container', AppState.projects, 'project');
            }
            renderProjects('projects-grid');
            subscribeToProjects(() => renderProjects('projects-grid'));
            break;
        case 'clients.html': renderClients('clients-grid'); break;
        case 'archive.html': renderArchive('archive-grid'); break;
        case 'tickets.html': renderTickets('tickets-list'); subscribeToTickets(() => renderTickets('tickets-list')); break;
        case 'lead-detail.html': renderLeadDetail(); break;
        case 'project-detail.html': renderProjectDetail(); break;
    }
}

function renderClientTickets(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const myTickets = AppState.tickets.filter(t => t.submittedById === AppState.currentUser?.uid);
    if (!myTickets.length) { c.innerHTML = '<p class="text-muted">No tickets submitted yet.</p>'; return; }
    c.innerHTML = myTickets.map(t => `
        <div class="ticket-row">
            <div class="ticket-priority ${t.tier || 'host'}"></div>
            <div class="ticket-info"><div class="ticket-title">${t.title || 'Untitled'}</div><div class="ticket-meta">${t.projectName || '-'} • ${timeAgo(t.submittedAt)}</div></div>
            <span class="status-badge ${t.status || 'open'}">${getStatusLabel(t.status || 'open')}</span>
        </div>`).join('');
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
    
    // Big logo
    const logoEl = el('detail-logo');
    if (logoEl) {
        if (lead.logo) {
            logoEl.innerHTML = `<img src="${lead.logo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;">`;
            logoEl.classList.add('has-logo');
        } else {
            logoEl.textContent = getInitials(lead.companyName);
        }
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
    if (el('detail-tier')) { el('detail-tier').className = `tier-badge ${proj.tier || 'farmer'}`; el('detail-tier').textContent = getTierName(proj.tier || 'farmer'); }
    if (el('detail-progress')) el('detail-progress').textContent = (proj.progress || 0) + '%';
    if (el('progress-fill')) el('progress-fill').style.width = (proj.progress || 0) + '%';
    
    // Big logo
    const logoEl = el('detail-logo');
    if (logoEl) {
        if (proj.logo) {
            logoEl.innerHTML = `<img src="${proj.logo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;">`;
            logoEl.classList.add('has-logo');
        } else {
            logoEl.textContent = getInitials(proj.companyName);
        }
    }
    
    if (el('detail-info')) {
        let previewsHtml = '';
        if (proj.previewLinks && proj.previewLinks.length) {
            previewsHtml = `<div class="info-item"><label>Previews</label><span>${proj.previewLinks.map((link, i) => `<a href="${link}" target="_blank">Preview ${i + 1}</a>`).join(' • ')}</span></div>`;
        }
        el('detail-info').innerHTML = `
            <div class="info-item"><label>Email</label><span><a href="mailto:${proj.clientEmail || ''}">${proj.clientEmail || '-'}</a></span></div>
            <div class="info-item"><label>Phone</label><span>${proj.clientPhone || '-'}</span></div>
            <div class="info-item"><label>Website</label><span>${proj.websiteUrl ? `<a href="https://${proj.websiteUrl}" target="_blank">${proj.websiteUrl}</a>` : '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${proj.location || '-'}</span></div>
            <div class="info-item"><label>Type</label><span>${proj.businessType || '-'}</span></div>
            ${proj.githubLink ? `<div class="info-item"><label>GitHub Code</label><span><a href="${proj.githubLink}" target="_blank">View Repository</a></span></div>` : ''}
            ${previewsHtml}`;
    }
    
    renderMilestones('milestones', proj.milestones, AppState.isAdmin);
    renderInvoices('invoices', proj.invoices);
    subscribeToMessages(proj.id, msgs => renderMessages('messages-container', msgs));
    renderTickets('project-tickets', AppState.tickets.filter(t => t.projectId === proj.id));
    
    // Display current task
    if (el('current-task')) el('current-task').textContent = proj.currentTask || 'No current task set.';
    if (el('edit-current-task')) el('edit-current-task').value = proj.currentTask || '';
    
    // Progress slider event
    const progressSlider = document.getElementById('progress-slider');
    if (progressSlider) {
        progressSlider.value = proj.progress || 0;
        progressSlider.addEventListener('change', e => updateProgress(e.target.value));
        progressSlider.addEventListener('input', e => {
            document.getElementById('detail-progress').textContent = e.target.value + '%';
            document.getElementById('progress-fill').style.width = e.target.value + '%';
        });
    }
}

// Setup
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired - app.js loaded successfully');
    
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
    
    // Message send button
    document.getElementById('send-message-btn')?.addEventListener('click', () => {
        console.log('Send button clicked!');
        const projectId = new URLSearchParams(location.search).get('id');
        handleSendMessage(projectId);
    });
    
    // Progress slider in edit modal
    document.querySelector('[name="progress"]')?.addEventListener('input', e => {
        const v = document.getElementById('progress-value');
        if (v) v.textContent = e.target.value + '%';
    });
});
