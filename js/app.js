/* ============================================
   SIDEQUEST DIGITAL - App UI Layer
   ============================================ */

// Force refresh service worker on load to clear old caches
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
            registration.update();
        });
    });
}

import {
    auth, db, storage, AppState, TIER_NAMES,
    login, logout, createClientWithAuth, uploadFile, uploadLogo,
    loadLeads, subscribeToLeads, createLead, updateLead,
    loadProjects, subscribeToProjects, createProject, updateProject,
    loadClients, updateClient, archiveClient,
    loadArchive, archiveItem, restoreFromArchive, deletePermanent,
    loadTickets, subscribeToTickets, createTicket, updateTicket,
    subscribeToMessages, sendMessage,
    moveLeadToProject, returnProjectToLead,
    // NEW: Posts imports
    loadPosts, subscribeToPosts, createPost, updatePost, deletePost, createPostFromProject, generateSlug,
    formatDate, formatCurrency, timeAgo, getInitials, getTierOrder, getTierName, getStatusLabel,
    showToast, showLoading,
    checkIsAdmin, hasRole
} from './firebase-portal.js';

import { NAVIGATION, UI_TIMING } from './config/constants.js';
import { escapeHtml } from './utils/sanitize.js';
import { PRODUCT_TASKS, TASK_CATEGORIES, PRODUCT_TYPES, getProductTasks, getCategoriesForProduct } from './config/product-tasks.js';

import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Filter State - arrays for multi-select
let filters = { search: '', locations: [], businessTypes: [], statuses: [], tiers: [] };

// Auth state tracking - prevent redundant initialization on token refresh
let pageInitialized = false;
let lastAuthUid = null;
let authCheckComplete = false;

function applyFilters(items) {
    return items.filter(item => {
        if (filters.search) {
            const s = filters.search.toLowerCase();
            if (!`${item.companyName || ''} ${item.clientName || ''} ${item.clientEmail || ''}`.toLowerCase().includes(s)) return false;
        }
        if (filters.locations.length && !filters.locations.includes(item.location)) return false;
        if (filters.businessTypes.length && !filters.businessTypes.includes(item.businessType)) return false;
        if (filters.statuses.length && !filters.statuses.includes(item.status)) return false;
        if (filters.tiers.length && !filters.tiers.includes(item.tier)) return false;
        return true;
    });
}

function getUniqueValues(items, field) {
    return [...new Set(items.map(i => i[field]).filter(Boolean))].sort();
}

// Multi-select dropdown component
function createMultiSelect(id, label, options, selectedValues, onChange) {
    const selectedCount = selectedValues.length;
    const displayText = selectedCount === 0 ? `All ${label}` :
                        selectedCount === 1 ? options.find(o => o.value === selectedValues[0])?.label || selectedValues[0] :
                        `${selectedCount} selected`;

    return `
        <div class="multi-select" id="${id}">
            <button type="button" class="multi-select-btn" onclick="toggleMultiSelect('${id}')">
                <span>${displayText}</span>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="multi-select-dropdown">
                ${options.map(opt => `
                    <label class="multi-select-option">
                        <input type="checkbox" value="${opt.value}" ${selectedValues.includes(opt.value) ? 'checked' : ''} onchange="handleMultiSelectChange('${id}', this)">
                        <span>${opt.label}</span>
                    </label>
                `).join('')}
            </div>
        </div>`;
}

window.toggleMultiSelect = (id) => {
    const el = document.getElementById(id);
    if (el) {
        // Close other open dropdowns
        document.querySelectorAll('.multi-select.open').forEach(ms => {
            if (ms.id !== id) ms.classList.remove('open');
        });
        el.classList.toggle('open');
    }
};

window.handleMultiSelectChange = (id, checkbox) => {
    const filterMap = {
        'filter-tier': 'tiers',
        'filter-location': 'locations',
        'filter-type': 'businessTypes',
        'filter-status': 'statuses'
    };
    const filterKey = filterMap[id];
    if (!filterKey) return;

    if (checkbox.checked) {
        if (!filters[filterKey].includes(checkbox.value)) {
            filters[filterKey].push(checkbox.value);
        }
    } else {
        filters[filterKey] = filters[filterKey].filter(v => v !== checkbox.value);
    }

    // Update button text
    const btn = document.querySelector(`#${id} .multi-select-btn span`);
    const count = filters[filterKey].length;
    const labelMap = { tiers: 'Tiers', locations: 'Locations', businessTypes: 'Types', statuses: 'Statuses' };
    if (btn) {
        btn.textContent = count === 0 ? `All ${labelMap[filterKey]}` : `${count} selected`;
    }

    renderGridOnly();
};

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.multi-select')) {
        document.querySelectorAll('.multi-select.open').forEach(ms => ms.classList.remove('open'));
    }
});

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

function renderAnalyticsCharts() {
    // Tickets by Status Chart
    const ticketsChart = document.getElementById('tickets-status-chart');
    if (ticketsChart) {
        const statusCounts = {
            open: AppState.tickets.filter(t => t.status === 'open').length,
            'in-progress': AppState.tickets.filter(t => t.status === 'in-progress').length,
            resolved: AppState.tickets.filter(t => t.status === 'resolved').length
        };
        const maxTickets = Math.max(...Object.values(statusCounts), 1);
        const statusColors = { open: '#7c3aed', 'in-progress': '#f59e0b', resolved: '#10b981' };
        const statusLabels = { open: 'Open', 'in-progress': 'In Progress', resolved: 'Resolved' };

        ticketsChart.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
            const height = Math.max((count / maxTickets) * 100, 5);
            return `<div class="chart-bar" style="height:${height}%;background:${statusColors[status]}">
                <span class="chart-bar-value">${count}</span>
                <span class="chart-bar-label">${statusLabels[status]}</span>
            </div>`;
        }).join('');
    }

    // Projects by Tier Chart
    const projectsChart = document.getElementById('projects-tier-chart');
    if (projectsChart) {
        const tierCounts = {};
        const tiers = ['guardian', 'watchfuleye', 'farmer', 'bugcatcher', 'host'];
        tiers.forEach(tier => {
            tierCounts[tier] = AppState.projects.filter(p => p.tier === tier).length;
        });
        const maxProjects = Math.max(...Object.values(tierCounts), 1);
        const tierColors = {
            guardian: '#7c3aed',
            watchfuleye: '#3b82f6',
            farmer: '#10b981',
            bugcatcher: '#f59e0b',
            host: '#ef4444'
        };

        projectsChart.innerHTML = tiers.map(tier => {
            const count = tierCounts[tier] || 0;
            const height = Math.max((count / maxProjects) * 100, 5);
            return `<div class="chart-bar" style="height:${height}%;background:${tierColors[tier]}">
                <span class="chart-bar-value">${count}</span>
                <span class="chart-bar-label">${getTierName(tier)}</span>
            </div>`;
        }).join('');
    }
}

function renderFilterBar(containerId, items, type) {
    const c = document.getElementById(containerId);
    if (!c) return;
    const locations = getUniqueValues(items, 'location').map(l => ({ value: l, label: l }));
    const types = getUniqueValues(items, 'businessType').map(t => ({ value: t, label: t }));
    const statuses = type === 'lead'
        ? [{ value: 'noted', label: 'Noted' }, { value: 'demo-complete', label: 'Demo Complete' }, { value: 'demo-sent', label: 'Demo Sent' }]
        : [{ value: 'active', label: 'Active' }, { value: 'testing', label: 'Testing' }, { value: 'paused', label: 'Paused' }, { value: 'completed', label: 'Completed' }];
    const tiers = [
        { value: 'guardian', label: 'Guardian' },
        { value: 'watchfuleye', label: 'Watchful Eye' },
        { value: 'farmer', label: 'Farmer' },
        { value: 'bugcatcher', label: 'Bug Catcher' },
        { value: 'host', label: 'Host' },
        { value: 'personal', label: 'Personal' }
    ];

    // Add tier filter only for projects
    const tierFilterHtml = type === 'project' ? createMultiSelect('filter-tier', 'Tiers', tiers, filters.tiers, () => {}) : '';

    c.innerHTML = `<div class="filter-bar">
        <input type="text" class="form-input" id="filter-search" placeholder="Search..." value="${filters.search}" style="flex:1;min-width:200px;">
        ${tierFilterHtml}
        ${createMultiSelect('filter-location', 'Locations', locations, filters.locations, () => {})}
        ${createMultiSelect('filter-type', 'Types', types, filters.businessTypes, () => {})}
        ${createMultiSelect('filter-status', 'Statuses', statuses, filters.statuses, () => {})}
        <button class="btn btn-ghost" onclick="clearFilters()">Clear</button>
    </div>`;
    document.getElementById('filter-search')?.addEventListener('input', e => { filters.search = e.target.value; renderGridOnly(); });
}

window.clearFilters = () => {
    filters = { search: '', locations: [], businessTypes: [], statuses: [], tiers: [] };
    renderCurrentPage();
};

let currentPageType = '';
function renderGridOnly() {
    if (currentPageType === 'leads') renderLeads('leads-grid');
    if (currentPageType === 'projects') renderProjects('projects-grid');
}
function renderCurrentPage() {
    if (currentPageType === 'leads') { renderFilterBar('filter-container', AppState.leads, 'lead'); renderLeads('leads-grid'); }
    if (currentPageType === 'projects') { renderFilterBar('filter-container', AppState.projects, 'project'); renderProjects('projects-grid'); }
}

// Skeleton loading cards
function showSkeletonCards(containerId, count = 6) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.classList.add('loading');
    const skeletons = Array(count).fill('').map(() => `
        <div class="skeleton-card">
            <div class="skeleton-logo"></div>
            <div class="skeleton-body">
                <div class="skeleton-line title"></div>
                <div class="skeleton-line subtitle"></div>
                <div class="skeleton-line badge"></div>
                <div class="skeleton-line badge"></div>
                <div class="skeleton-line progress"></div>
            </div>
        </div>
    `).join('');
    c.innerHTML = skeletons;
}

// Cards with big logo on top
function renderLeads(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.classList.remove('loading');
    const items = applyFilters(AppState.leads);
    if (!items.length) { c.innerHTML = `<div class="empty-state"><h3>${AppState.leads.length ? 'No matches' : 'No leads yet'}</h3></div>`; return; }

    // Collect logo URLs for preloading
    const logoUrls = items.filter(l => l.logo).map(l => l.logo);

    c.innerHTML = items.map((l, i) => `
        <div class="item-card waiting" data-index="${i}" onclick="window.location.href='${NAVIGATION.LEAD_DETAIL}?id=${escapeHtml(l.id)}'">
            ${l.logo ? `<div class="item-card-logo" style="background-image:url('${escapeHtml(l.logo)}')"></div>` : `<div class="item-card-logo item-card-logo-placeholder">${escapeHtml(getInitials(l.companyName))}</div>`}
            <div class="item-card-body">
                <div class="item-company">${escapeHtml(l.companyName || 'Unnamed')}</div>
                <div class="item-client">${escapeHtml(l.clientName || '')}</div>
                <span class="status-badge ${escapeHtml(l.status || 'noted')}">${escapeHtml(getStatusLabel(l.status || 'noted'))}</span>
                <div class="item-tags"><span class="tag">${escapeHtml(l.location || '-')}</span><span class="tag">${escapeHtml(l.businessType || '-')}</span></div>
                <div class="item-meta"><span>Added ${formatDate(l.createdAt)}</span></div>
            </div>
        </div>`).join('');

    // Preload logos then trigger fade-in
    const triggerFadeIn = () => {
        const cards = c.querySelectorAll('.item-card.waiting');
        cards.forEach(card => {
            const idx = parseInt(card.dataset.index) || 0;
            card.classList.remove('waiting');
            card.classList.add('fade-in');
            card.style.animationDelay = `${idx * 50}ms`;
        });
    };

    if (logoUrls.length > 0) {
        let loaded = 0;
        const timeout = setTimeout(triggerFadeIn, 2000);
        logoUrls.forEach(url => {
            const img = new Image();
            img.onload = img.onerror = () => {
                loaded++;
                if (loaded >= logoUrls.length) {
                    clearTimeout(timeout);
                    triggerFadeIn();
                }
            };
            img.src = url;
        });
    } else {
        triggerFadeIn();
    }
}

function renderProjects(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.classList.remove('loading');
    let list = items || applyFilters(AppState.projects);

    // Sort by tier first (highest tier first), then by progress (highest first)
    list.sort((a, b) => {
        const tierDiff = getTierOrder(a.tier) - getTierOrder(b.tier);
        if (tierDiff !== 0) return tierDiff;
        // If same tier, sort by progress (highest first)
        return (parseInt(b.progress) || 0) - (parseInt(a.progress) || 0);
    });

    if (!list.length) { c.innerHTML = `<div class="empty-state"><h3>No projects yet</h3></div>`; return; }

    // Collect logo URLs for preloading
    const logoUrls = list.filter(p => p.logo).map(p => p.logo);

    c.innerHTML = list.map((p, i) => `
        <div class="item-card waiting" data-index="${i}">
            <div onclick="window.location.href='${NAVIGATION.PROJECT_DETAIL}?id=${escapeHtml(p.id)}'" style="cursor:pointer;">
                ${p.logo ? `<div class="item-card-logo" style="background-image:url('${escapeHtml(p.logo)}')"></div>` : `<div class="item-card-logo item-card-logo-placeholder">${escapeHtml(getInitials(p.companyName))}</div>`}
                <div class="item-card-body">
                    <div class="item-company">${escapeHtml(p.companyName || 'Unnamed')}</div>
                    <div class="item-client">${escapeHtml(p.clientName || '')}</div>
                    <div class="item-badges"><span class="status-badge ${escapeHtml(p.status || 'active')}">${escapeHtml(getStatusLabel(p.status || 'active'))}</span><span class="tier-badge ${escapeHtml(p.tier || 'farmer')}">${escapeHtml(getTierName(p.tier || 'farmer'))}</span></div>
                    <div class="item-progress"><div class="progress-header"><span>Progress</span><span>${parseInt(p.progress) || 0}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${parseInt(p.progress) || 0}%"></div></div></div>
                </div>
            </div>
            ${AppState.isAdmin ? `<div class="card-task-section" onclick="event.stopPropagation();">
                <div class="card-task-view" id="task-view-${escapeHtml(p.id)}">
                    <span class="card-task-label">Task:</span>
                    <span class="card-task-text ${p.currentTask ? '' : 'empty'}">${escapeHtml(p.currentTask || 'None set')}</span>
                    <button class="card-task-edit-btn" onclick="toggleCardTaskEdit('${escapeHtml(p.id)}')" title="Edit task">✏️</button>
                </div>
                <div class="card-task-edit" id="task-edit-${escapeHtml(p.id)}" style="display:none;">
                    <input type="text" id="task-input-${escapeHtml(p.id)}" class="form-input" value="${escapeHtml(p.currentTask || '')}" placeholder="What's being worked on?" style="flex:1;font-size:13px;padding:6px 10px;">
                    <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="cancelCardTaskEdit('${escapeHtml(p.id)}')">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="handleQuickSaveTask('${escapeHtml(p.id)}')">Save</button>
                    </div>
                </div>
            </div>` : `<div style="padding:0 16px 16px;"><span style="font-size:12px;color:var(--color-text-muted);">Task:</span> <span style="font-size:14px;">${escapeHtml(p.currentTask || 'None set')}</span></div>`}
        </div>`).join('');

    // Preload logos then trigger fade-in animation
    const triggerFadeIn = () => {
        const cards = c.querySelectorAll('.item-card.waiting');
        cards.forEach(card => {
            const idx = parseInt(card.dataset.index) || 0;
            card.classList.remove('waiting');
            card.classList.add('fade-in');
            card.style.animationDelay = `${idx * 50}ms`;
        });
    };

    if (logoUrls.length > 0) {
        let loaded = 0;
        const total = logoUrls.length;
        const timeout = setTimeout(triggerFadeIn, 2000); // Max 2s wait

        logoUrls.forEach(url => {
            const img = new Image();
            img.onload = img.onerror = () => {
                loaded++;
                if (loaded >= total) {
                    clearTimeout(timeout);
                    triggerFadeIn();
                }
            };
            img.src = url;
        });
    } else {
        // No logos to preload, trigger immediately
        triggerFadeIn();
    }
}

// Dashboard-specific list view for projects - large task text, compact layout
function renderDashboardProjectsList(containerId, items = null) {
    const c = document.getElementById(containerId);
    if (!c) return;

    let list = items || AppState.projects;

    if (!list.length) {
        c.innerHTML = `<div class="empty-state" style="padding:32px;text-align:center;"><h3>No projects yet</h3></div>`;
        return;
    }

    // Collect logo URLs for preloading
    const logoUrls = list.filter(p => p.logo).map(p => p.logo);

    c.innerHTML = list.map((p, i) => `
        <div class="project-list-item waiting" data-index="${i}" data-id="${escapeHtml(p.id)}">
            <div onclick="window.location.href='${NAVIGATION.PROJECT_DETAIL}?id=${escapeHtml(p.id)}'" style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;">
                ${p.logo
                    ? `<div class="project-list-logo" style="background-image:url('${escapeHtml(p.logo)}')"></div>`
                    : `<div class="project-list-logo">${escapeHtml(getInitials(p.companyName))}</div>`}
                <div class="project-list-info">
                    <div class="project-list-header">
                        <span class="project-list-name">${escapeHtml(p.companyName || 'Unnamed')}</span>
                        <div class="project-list-badges">
                            <span class="status-badge ${escapeHtml(p.status || 'active')}" style="font-size:11px;padding:2px 8px;">${escapeHtml(getStatusLabel(p.status || 'active'))}</span>
                            <span class="tier-badge ${escapeHtml(p.tier || 'farmer')}" style="font-size:11px;padding:2px 8px;">${escapeHtml(getTierName(p.tier || 'farmer'))}</span>
                        </div>
                    </div>
                    ${AppState.isAdmin
                        ? `<div class="project-list-task-container" onclick="event.stopPropagation();">
                            <div class="project-list-task-view" id="dash-task-view-${escapeHtml(p.id)}">
                                <span class="project-list-task ${p.currentTask ? '' : 'empty'}">${escapeHtml(p.currentTask || 'No task set')}</span>
                                <button class="project-list-edit-btn" onclick="toggleDashTaskEdit('${escapeHtml(p.id)}')" title="Edit task">✏️</button>
                            </div>
                            <div class="project-list-task-edit" id="dash-task-edit-${escapeHtml(p.id)}" style="display:none;">
                                <input type="text" id="dash-task-input-${escapeHtml(p.id)}" class="form-input" value="${escapeHtml(p.currentTask || '')}" placeholder="Current task..." onkeydown="if(event.key==='Enter'){handleDashSaveTask('${escapeHtml(p.id)}');event.preventDefault();}">
                                <button class="btn btn-ghost btn-sm" onclick="cancelDashTaskEdit('${escapeHtml(p.id)}')">Cancel</button>
                                <button class="btn btn-primary btn-sm" onclick="handleDashSaveTask('${escapeHtml(p.id)}')">Save</button>
                            </div>
                        </div>`
                        : `<p class="project-list-task ${p.currentTask ? '' : 'empty'}">${escapeHtml(p.currentTask || 'No task set')}</p>`
                    }
                </div>
            </div>
            <div class="project-list-progress" onclick="window.location.href='${NAVIGATION.PROJECT_DETAIL}?id=${escapeHtml(p.id)}'">
                <div class="progress-bar"><div class="progress-fill" style="width:${parseInt(p.progress) || 0}%"></div></div>
                <span class="progress-value">${parseInt(p.progress) || 0}%</span>
            </div>
        </div>`).join('');

    // Preload logos then trigger fade-in
    const triggerFadeIn = () => {
        const items = c.querySelectorAll('.project-list-item.waiting');
        items.forEach(item => {
            const idx = parseInt(item.dataset.index) || 0;
            item.classList.remove('waiting');
            item.classList.add('fade-in');
            item.style.animationDelay = `${idx * 30}ms`;
        });
    };

    if (logoUrls.length > 0) {
        let loaded = 0;
        const total = logoUrls.length;
        const timeout = setTimeout(triggerFadeIn, 1500);

        logoUrls.forEach(url => {
            const img = new Image();
            img.onload = img.onerror = () => {
                loaded++;
                if (loaded >= total) {
                    clearTimeout(timeout);
                    triggerFadeIn();
                }
            };
            img.src = url;
        });
    } else {
        triggerFadeIn();
    }
}

// Dashboard task edit functions
window.toggleDashTaskEdit = (projectId) => {
    const viewEl = document.getElementById(`dash-task-view-${projectId}`);
    const editEl = document.getElementById(`dash-task-edit-${projectId}`);
    const inputEl = document.getElementById(`dash-task-input-${projectId}`);
    if (viewEl && editEl) {
        viewEl.style.display = 'none';
        editEl.style.display = 'flex';
        inputEl?.focus();
    }
};

window.cancelDashTaskEdit = (projectId) => {
    const viewEl = document.getElementById(`dash-task-view-${projectId}`);
    const editEl = document.getElementById(`dash-task-edit-${projectId}`);
    const proj = AppState.projects.find(p => p.id === projectId);
    const inputEl = document.getElementById(`dash-task-input-${projectId}`);
    if (viewEl && editEl) {
        viewEl.style.display = 'flex';
        editEl.style.display = 'none';
        if (inputEl && proj) inputEl.value = proj.currentTask || '';
    }
};

window.handleDashSaveTask = async (projectId) => {
    const inputEl = document.getElementById(`dash-task-input-${projectId}`);
    if (!inputEl) return;
    const newTask = inputEl.value.trim();

    try {
        await updateProject(projectId, { currentTask: newTask });
        // Update local state
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj) proj.currentTask = newTask;

        // Update the view
        const viewEl = document.getElementById(`dash-task-view-${projectId}`);
        const editEl = document.getElementById(`dash-task-edit-${projectId}`);
        if (viewEl) {
            const taskSpan = viewEl.querySelector('.project-list-task');
            if (taskSpan) {
                taskSpan.textContent = newTask || 'No task set';
                taskSpan.classList.toggle('empty', !newTask);
            }
            viewEl.style.display = 'flex';
        }
        if (editEl) editEl.style.display = 'none';

        showToast('Task updated', 'success');
    } catch (error) {
        console.error('Failed to update task:', error);
        showToast('Failed to update task', 'error');
    }
};

function renderClients(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!AppState.clients.length) { c.innerHTML = '<div class="empty-state"><h3>No clients yet</h3></div>'; return; }
    c.innerHTML = `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Password</th><th>Projects</th><th></th></tr></thead><tbody>
        ${AppState.clients.map(cl => `<tr>
            <td><strong>${escapeHtml(cl.displayName || '-')}</strong></td>
            <td>${escapeHtml(cl.email || '-')}</td>
            <td>${escapeHtml(cl.company || '-')}</td>
            <td><code style="background:#333;padding:2px 6px;border-radius:4px;font-size:11px;">${escapeHtml(cl.tempPassword || '-')}</code> <button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:11px;" onclick="openChangePasswordModal('${escapeHtml(cl.id)}')">Change</button></td>
            <td>${AppState.projects.filter(p => (p.assignedClients || []).includes(cl.id)).length}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="openEditClientModal('${escapeHtml(cl.id)}')">Edit</button></td>
        </tr>`).join('')}</tbody></table>`;
}

function renderArchive(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!AppState.archived.length) { c.innerHTML = '<div class="empty-state"><h3>Archive empty</h3></div>'; return; }
    c.innerHTML = AppState.archived.map(a => `
        <div class="item-card" onclick="openArchiveDetailModal('${escapeHtml(a.id)}')">
            <div class="item-card-logo item-card-logo-placeholder" style="opacity:0.5">${escapeHtml(getInitials(a.companyName || a.clientName))}</div>
            <div class="item-card-body">
                <div class="item-company">${escapeHtml(a.companyName || a.clientName || 'Unnamed')}</div>
                <div class="item-client">${escapeHtml(a.clientEmail || '')}</div>
                <span class="badge badge-secondary">${a.type === 'client' ? 'Client' : a.type === 'lead' ? 'Lead' : 'Project'}</span>
                <div class="item-meta"><span>Archived ${formatDate(a.archivedAt)}</span></div>
                <div class="flex gap-sm mt-sm">
                    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); handleRestore('${escapeHtml(a.id)}', '${escapeHtml(a.type)}')">Restore</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--color-error);" onclick="event.stopPropagation(); handleDeletePermanent('${escapeHtml(a.id)}')">Delete</button>
                </div>
            </div>
        </div>`).join('');
}

function renderTickets(containerId, items = null, showResolvedSection = true) {
    const c = document.getElementById(containerId);
    if (!c) return;
    let list = [...(items || AppState.tickets)];

    // Separate active and resolved tickets
    const activeTickets = list.filter(t => t.status !== 'resolved');
    const resolvedTickets = list.filter(t => t.status === 'resolved');

    // Sort active tickets by tier, urgency, then SLA
    const urgencyOrder = { 'asap': 0, 'day': 1, 'week': 2, 'month': 3 };
    activeTickets.sort((a, b) => {
        // First by tier
        const tierDiff = getTierOrder(a.tier) - getTierOrder(b.tier);
        if (tierDiff !== 0) return tierDiff;
        // Then by urgency
        const urgencyDiff = (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3);
        if (urgencyDiff !== 0) return urgencyDiff;
        // Then by date (oldest first for SLA)
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
        return dateA - dateB;
    });

    // Sort resolved tickets by resolution date (newest first)
    resolvedTickets.sort((a, b) => {
        const dateA = a.resolvedAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(0);
        const dateB = b.resolvedAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(0);
        return dateB - dateA;
    });

    if (!activeTickets.length && !resolvedTickets.length) {
        c.innerHTML = '<div class="empty-state"><h3>No tickets</h3></div>';
        return;
    }

    const renderTicketRow = (t) => `
        <div class="ticket-row" onclick="window.location.href='${NAVIGATION.TICKET_DETAIL}?id=${escapeHtml(t.id)}'" style="cursor:pointer;flex-wrap:wrap;">
            <div class="ticket-priority ${escapeHtml(t.tier || 'host')}"></div>
            <div class="ticket-info" style="flex:1;min-width:200px;"><div class="ticket-title">${escapeHtml(t.title || 'Untitled')}</div><div class="ticket-meta">${escapeHtml(t.projectName || '-')} • ${escapeHtml(t.submittedBy || '-')} • ${timeAgo(t.submittedAt)}</div></div>
            <div class="ticket-badges"><span class="tier-badge ${escapeHtml(t.tier || 'host')}">${escapeHtml(getTierName(t.tier || 'host'))}</span><span class="status-badge ${escapeHtml(t.status || 'open')}">${escapeHtml(getStatusLabel(t.status || 'open'))}</span></div>
            ${t.description ? `<div class="ticket-description-snippet" style="flex-basis:100%;margin-left:20px;margin-top:8px;">${escapeHtml(t.description)}</div>` : ''}
        </div>`;

    let html = '';

    // Active tickets section
    if (activeTickets.length) {
        html += activeTickets.map(t => renderTicketRow(t)).join('');
    } else {
        html += '<p class="text-muted" style="padding: 16px;">No active tickets</p>';
    }

    // Resolved tickets section (collapsible)
    if (showResolvedSection && resolvedTickets.length) {
        html += `
            <div class="resolved-tickets-section" style="margin-top: 24px; border-top: 1px solid var(--color-border-subtle); padding-top: 16px;">
                <div class="resolved-header" onclick="toggleResolvedTickets(this)" style="display: flex; align-items: center; cursor: pointer; margin-bottom: 12px;">
                    <svg class="chevron-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s; margin-right: 8px;"><polyline points="6 9 12 15 18 9"/></svg>
                    <h4 style="margin: 0; color: var(--color-text-muted);">Resolved Tickets (${resolvedTickets.length})</h4>
                </div>
                <div class="resolved-tickets-list" style="display: none;">
                    ${resolvedTickets.map(t => renderTicketRow(t)).join('')}
                </div>
            </div>`;
    }

    c.innerHTML = html;
}

// Toggle resolved tickets visibility
window.toggleResolvedTickets = function(header) {
    const list = header.nextElementSibling;
    const chevron = header.querySelector('.chevron-icon');
    if (list.style.display === 'none') {
        list.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        list.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

function renderMilestones(containerId, milestones, editable = false) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!milestones?.length) { c.innerHTML = '<p class="text-muted">No milestones yet.</p>'; return; }
    c.innerHTML = `<div class="milestone-list">${milestones.map((m, i) => `
        <div class="milestone-item ${escapeHtml(m.status || 'pending')}">
            <div class="milestone-dot"></div>
            <div class="milestone-content">
                <div class="milestone-title">${escapeHtml(m.title || 'Milestone')}</div>
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

// ============================================
// PRODUCT TASKS SYSTEM
// ============================================

let activeProductTab = null;

function renderProductTasks(proj) {
    const tabsContainer = document.getElementById('product-tabs');
    const tasksContainer = document.getElementById('tasks-container');
    const summaryEl = document.getElementById('tasks-summary');
    const customTasksSection = document.getElementById('custom-tasks-section');

    if (!tabsContainer || !tasksContainer) return;

    const products = proj.products || [];
    const taskStates = proj.taskStates || {};
    const customTasks = proj.customTasks || [];

    // No products selected
    if (products.length === 0) {
        tabsContainer.innerHTML = '';
        tasksContainer.innerHTML = '<p class="no-products-msg" style="color:var(--color-text-muted);padding:16px 0;">No products selected. Edit the project to add products and populate development tasks.</p>';
        if (summaryEl) summaryEl.innerHTML = '';
        if (customTasksSection) customTasksSection.style.display = 'none';
        updateProjectProgress(proj.id, 0);
        return;
    }

    // Calculate progress for each product and total
    let totalTasks = 0;
    let totalCompleted = 0;
    const productProgress = {};

    products.forEach(productId => {
        const tasks = getProductTasks(productId);
        let completed = 0;
        tasks.forEach(task => {
            if (taskStates[task.id]) completed++;
        });
        productProgress[productId] = { total: tasks.length, completed };
        totalTasks += tasks.length;
        totalCompleted += completed;
    });

    // Add custom tasks to total
    customTasks.forEach(task => {
        totalTasks++;
        if (task.completed) totalCompleted++;
    });

    // Render tabs
    if (!activeProductTab || !products.includes(activeProductTab)) {
        activeProductTab = products[0];
    }

    tabsContainer.innerHTML = products.map(productId => {
        const productInfo = PRODUCT_TYPES.find(p => p.id === productId) || { name: productId, icon: '📦' };
        const prog = productProgress[productId];
        const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
        return `<button class="product-tab ${activeProductTab === productId ? 'active' : ''}" onclick="switchProductTab('${productId}')">
            ${productInfo.icon} ${productInfo.name}
            <span class="tab-progress">${pct}%</span>
        </button>`;
    }).join('');

    // Render tasks for active product
    renderProductTasksList(activeProductTab, taskStates, proj.id);

    // Render custom tasks
    if (customTasksSection) {
        customTasksSection.style.display = AppState.isAdmin ? 'block' : 'none';
        renderCustomTasks(customTasks, proj.id);
    }

    // Update summary
    const totalPct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    if (summaryEl) {
        summaryEl.innerHTML = `<span class="completed-count">${totalCompleted}</span> / ${totalTasks} tasks completed`;
    }

    // Update progress bar
    updateProjectProgress(proj.id, totalPct);
}

function renderProductTasksList(productId, taskStates, projectId) {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    const categories = getCategoriesForProduct(productId);
    const allTasks = getProductTasks(productId);
    const isReadOnly = !AppState.isAdmin; // Clients can only view, not edit

    let html = '';
    categories.forEach(category => {
        const categoryTasks = allTasks.filter(t => t.category === category.id);
        if (categoryTasks.length === 0) return;

        html += `<div class="task-category">
            <div class="task-category-header">${escapeHtml(category.name)}</div>
            ${categoryTasks.map(task => {
                const isCompleted = !!taskStates[task.id];
                return `<div class="task-item ${isCompleted ? 'completed' : ''}">
                    <input type="checkbox" id="task-${escapeHtml(task.id)}" ${isCompleted ? 'checked' : ''} ${isReadOnly ? 'disabled' : `onchange="toggleProductTask('${projectId}', '${escapeHtml(task.id)}', this.checked)"`}>
                    <label for="task-${escapeHtml(task.id)}">${escapeHtml(task.text)}</label>
                </div>`;
            }).join('')}
        </div>`;
    });

    container.innerHTML = html || '<p style="color:var(--color-text-muted);">No tasks for this product.</p>';
}

function renderCustomTasks(customTasks, projectId) {
    const container = document.getElementById('custom-tasks-list');
    if (!container) return;

    if (!customTasks || customTasks.length === 0) {
        container.innerHTML = '<p style="color:var(--color-text-muted);font-size:13px;">No custom tasks added.</p>';
        return;
    }

    container.innerHTML = customTasks.map((task, index) => `
        <div class="task-item ${task.completed ? 'completed' : ''}">
            <input type="checkbox" id="custom-task-${index}" ${task.completed ? 'checked' : ''} onchange="toggleCustomTask('${projectId}', ${index}, this.checked)">
            <label for="custom-task-${index}">${escapeHtml(task.text)}${task.product ? ` <span style="font-size:11px;color:var(--color-text-muted);">(${task.product})</span>` : ''}</label>
            <button class="delete-task" onclick="deleteCustomTask('${projectId}', ${index})" title="Delete task">&times;</button>
        </div>
    `).join('');
}

window.switchProductTab = (productId) => {
    activeProductTab = productId;
    const proj = AppState.currentItem;
    if (proj) {
        // Update tab active states
        document.querySelectorAll('.product-tab').forEach(tab => {
            tab.classList.toggle('active', tab.textContent.includes(PRODUCT_TYPES.find(p => p.id === productId)?.name || ''));
        });
        renderProductTasksList(productId, proj.taskStates || {}, proj.id);
    }
};

window.toggleProductTask = async (projectId, taskId, completed) => {
    const proj = AppState.projects.find(p => p.id === projectId);
    if (!proj) return;

    const taskStates = { ...(proj.taskStates || {}) };
    if (completed) {
        taskStates[taskId] = true;
    } else {
        delete taskStates[taskId];
    }

    try {
        await updateProject(projectId, { taskStates });
        proj.taskStates = taskStates;
        // Recalculate and update progress
        renderProductTasks(proj);
    } catch (error) {
        console.error('Failed to toggle task:', error);
        showToast('Failed to update task', 'error');
    }
};

window.toggleCustomTask = async (projectId, index, completed) => {
    const proj = AppState.projects.find(p => p.id === projectId);
    if (!proj) return;

    const customTasks = [...(proj.customTasks || [])];
    if (customTasks[index]) {
        customTasks[index] = { ...customTasks[index], completed };
    }

    try {
        await updateProject(projectId, { customTasks });
        proj.customTasks = customTasks;
        renderProductTasks(proj);
    } catch (error) {
        console.error('Failed to toggle custom task:', error);
        showToast('Failed to update task', 'error');
    }
};

window.deleteCustomTask = async (projectId, index) => {
    if (!confirm('Delete this custom task?')) return;

    const proj = AppState.projects.find(p => p.id === projectId);
    if (!proj) return;

    const customTasks = [...(proj.customTasks || [])];
    customTasks.splice(index, 1);

    try {
        await updateProject(projectId, { customTasks });
        proj.customTasks = customTasks;
        renderProductTasks(proj);
        showToast('Task deleted', 'success');
    } catch (error) {
        console.error('Failed to delete task:', error);
        showToast('Failed to delete task', 'error');
    }
};

window.handleAddCustomTask = async () => {
    const textEl = document.getElementById('custom-task-text');
    const productEl = document.getElementById('custom-task-product');
    const text = textEl?.value?.trim();
    const product = productEl?.value || '';

    if (!text) {
        showToast('Please enter a task description', 'warning');
        return;
    }

    const proj = AppState.currentItem;
    if (!proj) return;

    const customTasks = [...(proj.customTasks || [])];
    customTasks.push({ text, product, completed: false });

    try {
        await updateProject(proj.id, { customTasks });
        proj.customTasks = customTasks;
        renderProductTasks(proj);
        closeAllModals();
        textEl.value = '';
        productEl.value = '';
        showToast('Task added', 'success');
    } catch (error) {
        console.error('Failed to add task:', error);
        showToast('Failed to add task', 'error');
    }
};

function updateProjectProgress(projectId, progress) {
    const proj = AppState.projects.find(p => p.id === projectId);

    // Update UI
    const progressFill = document.getElementById('progress-fill');
    const progressValue = document.getElementById('detail-progress');
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressValue) progressValue.textContent = `${progress}%`;

    // Save to database if different from stored value
    if (proj && proj.progress !== progress) {
        updateProject(projectId, { progress }).then(() => {
            proj.progress = progress;
        }).catch(console.error);
    }
}

function renderMessages(containerId, messages) {
    const c = document.getElementById(containerId);
    if (!c) return;
    if (!messages?.length) { c.innerHTML = '<p class="text-muted text-center">No messages yet.</p>'; return; }
    c.innerHTML = messages.map(m => {
        // Use timestamp if available, fall back to clientTimestamp
        const messageTime = m.timestamp || m.clientTimestamp;
        return `<div class="message ${m.senderId === AppState.currentUser?.uid ? 'sent' : 'received'}"><div class="message-avatar">${getInitials(m.senderName)}</div><div class="message-bubble"><div class="message-sender">${m.senderName || 'User'}</div><div class="message-text">${m.text || ''}</div><div class="message-time">${timeAgo(messageTime)}</div></div></div>`;
    }).join('');
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
    // Add role class to body for CSS-based visibility control
    document.body.classList.remove('is-admin', 'is-client');
    document.body.classList.add(AppState.isAdmin ? 'is-admin' : 'is-client');
    
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

window.openModal = id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    // Focus on first focusable element for accessibility
    const focusable = modal.querySelector('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 100);
};
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

    // Populate products checkboxes
    const products = p.products || [];
    m.querySelectorAll('[name="products"]').forEach(checkbox => {
        checkbox.checked = products.includes(checkbox.value);
    });

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
// ACTION HANDLERS - With proper error handling
// ============================================

window.handleArchive = (type, id) => openConfirmModal('Archive this item?', async () => {
    try {
        const r = await archiveItem(type, id);
        if (r.success) {
            window.location.href = type === 'lead' ? NAVIGATION.LEADS : NAVIGATION.PROJECTS;
        }
    } catch (error) {
        console.error('Archive failed:', error);
        showToast('Failed to archive item', 'error');
    }
});

window.handleRestore = (id, type) => openConfirmModal(`Restore this ${type || 'item'}?`, async () => {
    try {
        await restoreFromArchive(id);
        await loadArchive();
        renderArchive('archive-grid');
        closeAllModals();
    } catch (error) {
        console.error('Restore failed:', error);
        showToast('Failed to restore item', 'error');
    }
});

window.handleDeletePermanent = (id) => openConfirmModal('Permanently delete this item? This cannot be undone.', async () => {
    try {
        await deletePermanent(id);
        await loadArchive();
        renderArchive('archive-grid');
        closeAllModals();
    } catch (error) {
        console.error('Delete failed:', error);
        showToast('Failed to delete item', 'error');
    }
});

window.handleMoveToProject = (leadId) => openConfirmModal('Convert this lead to a project?', async () => {
    try {
        const r = await moveLeadToProject(leadId);
        if (r.success) window.location.href = NAVIGATION.PROJECTS;
    } catch (error) {
        console.error('Convert to project failed:', error);
        showToast('Failed to convert to project', 'error');
    }
});

window.handleReturnToLead = (projectId) => openConfirmModal('Return this project to leads?', async () => {
    try {
        const r = await returnProjectToLead(projectId);
        if (r.success) window.location.href = NAVIGATION.LEADS;
    } catch (error) {
        console.error('Return to lead failed:', error);
        showToast('Failed to return to lead', 'error');
    }
});

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
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent;

    // Show loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
    }
    showLoading(true);

    try {
        const r = await createClientWithAuth(
            form.querySelector('[name="email"]').value,
            form.querySelector('[name="password"]').value,
            form.querySelector('[name="displayName"]').value,
            form.querySelector('[name="company"]').value
        );
        if (r.success) {
            closeAllModals();
            form.reset();
            await loadClients();
            renderClients('clients-grid');
            showToast('Client created successfully!', 'success');
        }
    } finally {
        showLoading(false);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
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
    if (!proj) { console.error('No project selected'); return; }

    const form = e.target;
    console.log('Form element:', form);

    // Build data object manually to handle checkboxes properly
    const data = {
        companyName: form.querySelector('[name="companyName"]')?.value || '',
        clientName: form.querySelector('[name="clientName"]')?.value || '',
        clientEmail: form.querySelector('[name="clientEmail"]')?.value || '',
        clientPhone: form.querySelector('[name="clientPhone"]')?.value || '',
        websiteUrl: form.querySelector('[name="websiteUrl"]')?.value || '',
        location: form.querySelector('[name="location"]')?.value || '',
        businessType: form.querySelector('[name="businessType"]')?.value || '',
        tier: form.querySelector('[name="tier"]')?.value || 'farmer',
        status: form.querySelector('[name="status"]')?.value || 'active',
        githubLink: form.querySelector('[name="githubLink"]')?.value || '',
        notes: form.querySelector('[name="notes"]')?.value || ''
    };

    // Parse preview links from textarea (one per line)
    const previewLinksText = form.querySelector('[name="previewLinks"]')?.value || '';
    data.previewLinks = previewLinksText.split('\n').map(l => l.trim()).filter(l => l);

    // Get assigned clients
    const clientCheckboxes = form.querySelectorAll('[name="assignedClients"]:checked');
    data.assignedClients = Array.from(clientCheckboxes).map(cb => cb.value);

    // Get selected products - look in the modal for all product checkboxes
    const allProductCheckboxes = document.querySelectorAll('#edit-project-modal [name="products"]');
    console.log('All product checkboxes found:', allProductCheckboxes.length);
    allProductCheckboxes.forEach(cb => console.log('  -', cb.value, 'checked:', cb.checked));

    const productCheckboxes = document.querySelectorAll('#edit-project-modal [name="products"]:checked');
    data.products = Array.from(productCheckboxes).map(cb => cb.value);
    console.log('Selected products:', data.products);

    console.log('Full data to save:', JSON.stringify(data, null, 2));
    showLoading(true);

    try {
        const result = await updateProject(proj.id, data);
        console.log('Update result:', result);
        if (result.success) {
            showToast('Project updated', 'success');
            closeAllModals();
            // Small delay before reload to ensure Firestore has committed
            setTimeout(() => location.reload(), 500);
        } else {
            showToast('Failed to save: ' + (result.error || 'Unknown error'), 'error');
            showLoading(false);
        }
    } catch (error) {
        console.error('Error saving project:', error);
        showToast('Error saving project: ' + error.message, 'error');
        showLoading(false);
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
    console.log('handleSubmitTicket called with projectId:', projectId);
    const title = document.getElementById('new-ticket-title')?.value;
    const desc = document.getElementById('new-ticket-desc')?.value;
    const urgency = document.getElementById('new-ticket-urgency')?.value || 'week';

    console.log('Ticket form values:', { title, desc, urgency });

    if (!title) {
        console.log('Validation failed: no title');
        showToast('Please enter a title', 'error');
        return;
    }

    if (!projectId) {
        console.error('Validation failed: no projectId');
        showToast('Project ID is missing', 'error');
        return;
    }

    const proj = AppState.projects.find(p => p.id === projectId);
    console.log('Found project:', proj?.companyName || 'NOT FOUND');

    const ticketData = {
        projectId,
        projectName: proj?.companyName || 'Unknown',
        title,
        description: desc || '',
        urgency,
        tier: proj?.tier || 'farmer',
        submittedById: AppState.currentUser?.uid,
        submittedBy: AppState.userProfile?.displayName || 'Client'
    };
    console.log('Submitting ticket with data:', ticketData);

    const result = await createTicket(ticketData);
    console.log('createTicket result:', result);

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
    const task = input.value.trim();
    const result = await updateProject(projectId, { currentTask: task });
    if (result.success) {
        showToast('Task saved!', 'success');
        // Update local state
        const proj = AppState.projects.find(p => p.id === projectId);
        if (proj) proj.currentTask = task;
        // Update the display and hide edit area
        const taskText = document.querySelector(`#task-view-${projectId} .card-task-text`);
        if (taskText) {
            taskText.textContent = task || 'None set';
            taskText.classList.toggle('empty', !task);
        }
        cancelCardTaskEdit(projectId);
    }
};

// Card task editing toggle (for project cards in grid view)
window.toggleCardTaskEdit = (projectId) => {
    const viewArea = document.getElementById(`task-view-${projectId}`);
    const editArea = document.getElementById(`task-edit-${projectId}`);
    const input = document.getElementById(`task-input-${projectId}`);

    if (viewArea && editArea) {
        viewArea.style.display = 'none';
        editArea.style.display = 'block';
        if (input) input.focus();
    }
};

window.cancelCardTaskEdit = (projectId) => {
    const viewArea = document.getElementById(`task-view-${projectId}`);
    const editArea = document.getElementById(`task-edit-${projectId}`);

    if (viewArea && editArea) {
        viewArea.style.display = 'flex';
        editArea.style.display = 'none';
    }
};

// Inline task editing for project detail page
window.toggleTaskEdit = () => {
    const viewArea = document.getElementById('task-view');
    const editArea = document.getElementById('task-edit');
    const input = document.getElementById('inline-task-input');
    const currentTask = document.getElementById('current-task');

    if (editArea && viewArea) {
        viewArea.classList.add('hidden');
        editArea.classList.add('active');
        if (input && currentTask) {
            input.value = currentTask.classList.contains('empty') ? '' : currentTask.textContent;
            input.focus();
        }
    }
};

window.cancelTaskEdit = () => {
    const viewArea = document.getElementById('task-view');
    const editArea = document.getElementById('task-edit');

    if (editArea && viewArea) {
        viewArea.classList.remove('hidden');
        editArea.classList.remove('active');
    }
};

window.saveInlineTask = async () => {
    const proj = AppState.currentItem;
    if (!proj) return;

    const input = document.getElementById('inline-task-input');
    const task = input?.value?.trim() || '';
    const result = await updateProject(proj.id, { currentTask: task });

    if (result.success) {
        proj.currentTask = task;
        AppState.currentItem = proj;
        const taskEl = document.getElementById('current-task');
        if (taskEl) {
            taskEl.textContent = task || 'No current task set.';
            taskEl.classList.toggle('empty', !task);
        }
        cancelTaskEdit();
        showToast('Task updated!', 'success');
    }
};

// ============================================
// INVOICE MANAGEMENT
// ============================================

// Render invoices list
function renderInvoices(containerId, invoices, isClientView = false) {
    const c = document.getElementById(containerId);
    if (!c) return;

    // For clients, only show sent/paid invoices (not drafts)
    let visibleInvoices = invoices || [];
    if (isClientView) {
        visibleInvoices = visibleInvoices.filter(inv => inv.status === 'sent' || inv.status === 'paid');
    }

    if (!visibleInvoices?.length) {
        c.innerHTML = `<p class="text-muted" style="font-size:13px;">${isClientView ? 'No invoices to display.' : 'No invoices yet.'}</p>`;
        return;
    }

    // Sort by date (newest first)
    const sorted = [...visibleInvoices].sort((a, b) => {
        const dateA = new Date(b.createdAt || 0);
        const dateB = new Date(a.createdAt || 0);
        return dateA - dateB;
    });

    c.innerHTML = `<div class="invoice-list">${sorted.map(inv => {
        const statusClass = inv.status || 'draft';
        const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date';
        const amount = inv.amount ? `$${parseFloat(inv.amount).toFixed(2)}` : '$0.00';
        const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'paid' && inv.status !== 'cancelled';
        const canPay = inv.status === 'sent' && inv.stripeLink;

        // Admin view: clickable to edit
        // Client view: not clickable, shows pay button
        const mainClick = isClientView ? '' : `onclick="openEditInvoice('${escapeHtml(inv.id)}')" style="cursor:pointer;"`;

        return `
        <div class="invoice-item ${statusClass}${isOverdue ? ' overdue' : ''}">
            <div class="invoice-main" ${mainClick}>
                <div class="invoice-title">${escapeHtml(inv.title || 'Untitled Invoice')}</div>
                <div class="invoice-meta">
                    <span class="invoice-amount">${amount}</span>
                    <span class="invoice-due${isOverdue ? ' text-danger' : ''}">${isOverdue ? 'Overdue: ' : 'Due: '}${dueDate}</span>
                </div>
            </div>
            <div class="invoice-actions">
                <span class="status-badge ${statusClass}">${escapeHtml(getInvoiceStatusLabel(inv.status))}</span>
                ${inv.pdfUrl ? `<a href="${escapeHtml(inv.pdfUrl)}" target="_blank" class="btn btn-ghost btn-sm" title="View PDF">📄</a>` : ''}
                ${canPay ? `<a href="${escapeHtml(inv.stripeLink)}" target="_blank" class="btn btn-primary btn-sm">Pay Now</a>` : ''}
            </div>
        </div>`;
    }).join('')}</div>`;
}

function getInvoiceStatusLabel(status) {
    const labels = { draft: 'Draft', sent: 'Sent', paid: 'Paid', cancelled: 'Cancelled' };
    return labels[status] || 'Draft';
}

// Track selected PDF file for upload
let pendingInvoicePdf = null;

window.handleInvoicePdfSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
        pendingInvoicePdf = file;
        document.getElementById('invoice-pdf-name').textContent = file.name;
    }
};

window.clearInvoicePdf = () => {
    pendingInvoicePdf = null;
    document.getElementById('invoice-pdf').value = '';
    document.getElementById('invoice-pdf-name').textContent = 'No file selected';
    document.getElementById('invoice-pdf-existing').style.display = 'none';
    // Mark for removal on save
    document.getElementById('invoice-edit-id').dataset.removePdf = 'true';
};

window.openEditInvoice = (invoiceId) => {
    const proj = AppState.currentItem;
    if (!proj) return;

    const invoice = proj.invoices?.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    // Populate modal
    document.getElementById('invoice-modal-title').textContent = 'Edit Invoice';
    document.getElementById('invoice-edit-id').value = invoiceId;
    document.getElementById('invoice-edit-id').dataset.removePdf = '';
    document.getElementById('invoice-title').value = invoice.title || '';
    document.getElementById('invoice-amount').value = invoice.amount || '';
    document.getElementById('invoice-due-date').value = invoice.dueDate || '';
    document.getElementById('invoice-status').value = invoice.status || 'draft';
    document.getElementById('invoice-notes').value = invoice.notes || '';
    document.getElementById('invoice-stripe-link').value = invoice.stripeLink || '';

    // PDF handling
    pendingInvoicePdf = null;
    document.getElementById('invoice-pdf').value = '';
    document.getElementById('invoice-pdf-name').textContent = 'No file selected';

    if (invoice.pdfUrl) {
        document.getElementById('invoice-pdf-existing').style.display = 'block';
        document.getElementById('invoice-pdf-link').href = invoice.pdfUrl;
    } else {
        document.getElementById('invoice-pdf-existing').style.display = 'none';
    }

    openModal('create-invoice-modal');
};

window.openCreateInvoice = () => {
    // Reset modal for new invoice
    document.getElementById('invoice-modal-title').textContent = 'Create Invoice';
    document.getElementById('invoice-edit-id').value = '';
    document.getElementById('invoice-edit-id').dataset.removePdf = '';
    document.getElementById('invoice-title').value = '';
    document.getElementById('invoice-amount').value = '';
    document.getElementById('invoice-due-date').value = '';
    document.getElementById('invoice-status').value = 'draft';
    document.getElementById('invoice-notes').value = '';
    document.getElementById('invoice-stripe-link').value = '';

    pendingInvoicePdf = null;
    document.getElementById('invoice-pdf').value = '';
    document.getElementById('invoice-pdf-name').textContent = 'No file selected';
    document.getElementById('invoice-pdf-existing').style.display = 'none';

    openModal('create-invoice-modal');
};

window.handleSaveInvoice = async () => {
    const proj = AppState.currentItem;
    if (!proj) return;

    const editId = document.getElementById('invoice-edit-id')?.value;
    const title = document.getElementById('invoice-title')?.value;
    const amount = document.getElementById('invoice-amount')?.value;
    const dueDate = document.getElementById('invoice-due-date')?.value;
    const status = document.getElementById('invoice-status')?.value || 'draft';
    const notes = document.getElementById('invoice-notes')?.value || '';
    const stripeLink = document.getElementById('invoice-stripe-link')?.value || '';
    const removePdf = document.getElementById('invoice-edit-id')?.dataset.removePdf === 'true';

    if (!title) { showToast('Please enter an invoice title', 'error'); return; }
    if (!amount || parseFloat(amount) <= 0) { showToast('Please enter a valid amount', 'error'); return; }

    let pdfUrl = null;

    // Upload PDF if selected
    if (pendingInvoicePdf) {
        showToast('Uploading PDF...', 'info');
        const timestamp = Date.now();
        const fileName = `invoices/${proj.id}/${timestamp}_${pendingInvoicePdf.name}`;
        const storageRef = ref(storage, fileName);

        try {
            await uploadBytes(storageRef, pendingInvoicePdf);
            pdfUrl = await getDownloadURL(storageRef);
        } catch (err) {
            console.error('PDF upload error:', err);
            showToast('Failed to upload PDF', 'error');
            return;
        }
    }

    const invoices = [...(proj.invoices || [])];

    if (editId) {
        // Update existing invoice
        const idx = invoices.findIndex(inv => inv.id === editId);
        if (idx !== -1) {
            invoices[idx] = {
                ...invoices[idx],
                title,
                amount: parseFloat(amount),
                dueDate,
                status,
                notes,
                stripeLink,
                updatedAt: new Date().toISOString()
            };
            // Handle PDF
            if (pdfUrl) {
                invoices[idx].pdfUrl = pdfUrl;
            } else if (removePdf) {
                delete invoices[idx].pdfUrl;
            }
        }
    } else {
        // Create new invoice
        invoices.push({
            id: 'inv' + Date.now(),
            title,
            amount: parseFloat(amount),
            dueDate,
            status,
            notes,
            stripeLink,
            pdfUrl: pdfUrl || null,
            createdAt: new Date().toISOString()
        });
    }

    const result = await updateProject(proj.id, { invoices });
    if (result.success) {
        proj.invoices = invoices;
        AppState.currentItem = proj;
        pendingInvoicePdf = null;
        closeAllModals();
        renderInvoices('invoices', invoices);  // Admin view
        renderInvoices('client-invoices', invoices, true);  // Client view
        showToast(editId ? 'Invoice updated!' : 'Invoice created!', 'success');
    }
};

window.handleDashboardTicket = async () => {
    console.log('handleDashboardTicket called');
    const projectId = document.getElementById('dash-ticket-project')?.value;
    const title = document.getElementById('dash-ticket-title')?.value;
    const urgency = document.getElementById('dash-ticket-urgency')?.value || 'week';
    const desc = document.getElementById('dash-ticket-desc')?.value;

    console.log('Dashboard ticket form values:', { projectId, title, urgency, desc });

    if (!projectId) {
        console.log('Validation failed: no project selected');
        showToast('Please select a project', 'error');
        return;
    }
    if (!title) {
        console.log('Validation failed: no title');
        showToast('Please enter a title', 'error');
        return;
    }

    const proj = AppState.projects.find(p => p.id === projectId);
    console.log('Found project:', proj?.companyName || 'NOT FOUND');

    const ticketData = {
        projectId,
        projectName: proj?.companyName || 'Unknown',
        title,
        description: desc || '',
        urgency,
        tier: proj?.tier || 'farmer',
        submittedById: AppState.currentUser?.uid,
        submittedBy: AppState.userProfile?.displayName || 'Client'
    };
    console.log('Submitting dashboard ticket with data:', ticketData);

    const result = await createTicket(ticketData);
    console.log('createTicket result:', result);

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
// POSTS UI HANDLERS - NEW SECTION
// ============================================

let postEditorState = {
    quill: null,
    featuredImageFile: null,
    featuredImageUrl: null,
    logoFile: null,
    logoUrl: null,
    websiteUrl: '',
    galleryFiles: [],
    galleryUrls: [],
    published: false,
    featured: false,
    editingId: null
};

let postsFilter = 'all';

function renderPosts(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    let posts = AppState.posts || [];
    
    // Apply filter
    if (postsFilter === 'published') {
        posts = posts.filter(p => p.published);
    } else if (postsFilter === 'draft') {
        posts = posts.filter(p => !p.published);
    } else if (postsFilter === 'featured') {
        posts = posts.filter(p => p.featured);
    }
    
    if (!posts.length) {
        c.innerHTML = `<div class="empty-state"><h3>${postsFilter === 'all' ? 'No posts yet' : 'No ' + postsFilter + ' posts'}</h3><p>Create a post from a project or click "New Post"</p></div>`;
        return;
    }
    
    c.innerHTML = posts.map(post => `
        <div class="post-card" onclick="openEditPostModal('${post.id}')">
            ${post.featuredImage 
                ? `<div class="post-card-image" style="background-image:url('${post.featuredImage}')"></div>`
                : `<div class="post-card-image">No image</div>`
            }
            <div class="post-card-body">
                <div class="post-card-title">${post.title || 'Untitled'}</div>
                <div class="post-card-summary">${post.summary || 'No summary'}</div>
                <div class="post-card-meta">
                    <span class="post-status ${post.published ? 'published' : 'draft'}">${post.published ? 'Published' : 'Draft'}</span>
                    ${post.featured ? '<span class="post-status featured">Featured</span>' : ''}
                </div>
                ${post.tags && post.tags.length ? `
                    <div class="post-tags" style="margin-top:8px;">
                        ${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

window.filterPosts = (filter) => {
    postsFilter = filter;
    
    // Update button states
    document.querySelectorAll('.filter-tabs .btn').forEach(btn => {
        btn.classList.remove('active', 'btn-secondary');
        btn.classList.add('btn-ghost');
    });
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-ghost');
        activeBtn.classList.add('btn-secondary', 'active');
    }
    
    renderPosts('posts-grid');
};

function initQuillEditor() {
    if (postEditorState.quill) return;
    
    const editorEl = document.getElementById('post-description-editor');
    if (!editorEl) return;
    
    postEditorState.quill = new Quill('#post-description-editor', {
        theme: 'snow',
        placeholder: 'Write your case study content here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean']
            ]
        }
    });
}

function resetPostEditor() {
    postEditorState = {
        quill: postEditorState.quill,
        featuredImageFile: null,
        featuredImageUrl: null,
        logoFile: null,
        logoUrl: null,
        websiteUrl: '',
        galleryFiles: [],
        galleryUrls: [],
        published: false,
        featured: false,
        editingId: null
    };
    
    // Reset form fields
    const postId = document.getElementById('post-id');
    const postProjectId = document.getElementById('post-project-id');
    const postTitle = document.getElementById('post-title');
    const postSlug = document.getElementById('post-slug');
    const postSummary = document.getElementById('post-summary');
    const postTags = document.getElementById('post-tags');
    const postWebsiteUrl = document.getElementById('post-website-url');
    
    if (postId) postId.value = '';
    if (postProjectId) postProjectId.value = '';
    if (postTitle) postTitle.value = '';
    if (postSlug) postSlug.value = '';
    if (postSummary) postSummary.value = '';
    if (postTags) postTags.value = '';
    if (postWebsiteUrl) postWebsiteUrl.value = '';
    
    // Reset quill
    if (postEditorState.quill) {
        postEditorState.quill.root.innerHTML = '';
    }
    
    // Reset featured image
    const featuredArea = document.getElementById('featured-image-area');
    if (featuredArea) {
        featuredArea.innerHTML = `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Click to upload featured image</div>`;
        featuredArea.classList.remove('has-image');
    }
    
    // Reset logo image
    const logoArea = document.getElementById('logo-image-area');
    if (logoArea) {
        logoArea.innerHTML = `<div class="placeholder"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Upload logo (optional)</div>`;
        logoArea.classList.remove('has-image');
    }
    
    // Reset gallery
    const galleryPreview = document.getElementById('gallery-preview');
    if (galleryPreview) galleryPreview.innerHTML = '';
    
    // Reset toggles
    document.getElementById('toggle-published')?.classList.remove('active');
    document.getElementById('toggle-featured')?.classList.remove('active');
    
    // Reset slug preview
    const slugPreview = document.getElementById('slug-preview-text');
    if (slugPreview) slugPreview.textContent = '...';
    
    // Hide delete button for new posts
    const deleteBtn = document.getElementById('delete-post-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
}

window.openNewPostModal = () => {
    resetPostEditor();
    document.getElementById('post-modal-title').textContent = 'New Post';
    initQuillEditor();
    openModal('post-editor-modal');
};

window.openEditPostModal = (postId) => {
    const post = AppState.posts.find(p => p.id === postId);
    if (!post) return;
    
    resetPostEditor();
    postEditorState.editingId = postId;
    
    document.getElementById('post-modal-title').textContent = 'Edit Post';
    document.getElementById('post-id').value = postId;
    document.getElementById('post-project-id').value = post.projectId || '';
    document.getElementById('post-title').value = post.title || '';
    document.getElementById('post-slug').value = post.slug || '';
    document.getElementById('post-summary').value = post.summary || '';
    document.getElementById('post-tags').value = (post.tags || []).join(', ');
    
    // Set website URL
    const websiteUrlInput = document.getElementById('post-website-url');
    if (websiteUrlInput) {
        websiteUrlInput.value = post.websiteUrl || '';
        postEditorState.websiteUrl = post.websiteUrl || '';
    }
    
    // Set featured image
    if (post.featuredImage) {
        postEditorState.featuredImageUrl = post.featuredImage;
        const featuredArea = document.getElementById('featured-image-area');
        featuredArea.innerHTML = `<img src="${post.featuredImage}" alt="Featured">`;
        featuredArea.classList.add('has-image');
    }
    
    // Set logo image
    if (post.logo) {
        postEditorState.logoUrl = post.logo;
        const logoArea = document.getElementById('logo-image-area');
        if (logoArea) {
            logoArea.innerHTML = `<img src="${post.logo}" alt="Logo">`;
            logoArea.classList.add('has-image');
        }
    }
    
    // Set gallery images
    if (post.galleryImages && post.galleryImages.length) {
        postEditorState.galleryUrls = [...post.galleryImages];
        renderGalleryPreview();
    }
    
    // Set toggles
    postEditorState.published = post.published || false;
    postEditorState.featured = post.featured || false;
    if (post.published) document.getElementById('toggle-published')?.classList.add('active');
    if (post.featured) document.getElementById('toggle-featured')?.classList.add('active');
    
    // Set slug preview
    updateSlugPreview(post.slug);
    
    // Show delete button for existing posts
    const deleteBtn = document.getElementById('delete-post-btn');
    if (deleteBtn) deleteBtn.style.display = 'block';
    
    // Init quill and set content
    initQuillEditor();
    if (postEditorState.quill && post.description) {
        postEditorState.quill.root.innerHTML = post.description;
    }
    
    openModal('post-editor-modal');
};

window.toggleSwitch = (type) => {
    const toggle = document.getElementById(`toggle-${type}`);
    if (!toggle) return;
    
    if (type === 'published') {
        postEditorState.published = !postEditorState.published;
        toggle.classList.toggle('active', postEditorState.published);
    } else if (type === 'featured') {
        postEditorState.featured = !postEditorState.featured;
        toggle.classList.toggle('active', postEditorState.featured);
    }
};

window.handleFeaturedImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    postEditorState.featuredImageFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const featuredArea = document.getElementById('featured-image-area');
        featuredArea.innerHTML = `<img src="${e.target.result}" alt="Featured">`;
        featuredArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
};

window.handleLogoImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    postEditorState.logoFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const logoArea = document.getElementById('logo-image-area');
        logoArea.innerHTML = `<img src="${e.target.result}" alt="Logo">`;
        logoArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
};

window.handleGalleryImagesSelect = (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    
    files.forEach(file => {
        postEditorState.galleryFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            postEditorState.galleryUrls.push(e.target.result);
            renderGalleryPreview();
        };
        reader.readAsDataURL(file);
    });
};

function renderGalleryPreview() {
    const container = document.getElementById('gallery-preview');
    if (!container) return;
    
    container.innerHTML = postEditorState.galleryUrls.map((url, index) => `
        <div class="gallery-item">
            <img src="${url}" alt="Gallery ${index + 1}">
            <button class="remove-btn" onclick="removeGalleryImage(${index}, event)">×</button>
        </div>
    `).join('');
}

window.removeGalleryImage = (index, event) => {
    event.stopPropagation();
    postEditorState.galleryUrls.splice(index, 1);
    postEditorState.galleryFiles.splice(index, 1);
    renderGalleryPreview();
};

function updateSlugPreview(slug) {
    const preview = document.getElementById('slug-preview-text');
    if (preview) {
        preview.textContent = slug || '...';
    }
}

window.handleSavePost = async () => {
    const title = document.getElementById('post-title').value.trim();
    const slug = document.getElementById('post-slug').value.trim() || generateSlug(title);
    const summary = document.getElementById('post-summary').value.trim();
    const description = postEditorState.quill ? postEditorState.quill.root.innerHTML : '';
    const tagsRaw = document.getElementById('post-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const projectId = document.getElementById('post-project-id').value || null;
    const websiteUrl = document.getElementById('post-website-url')?.value.trim() || '';
    
    if (!title) {
        showToast('Title is required', 'error');
        return;
    }
    
    const postData = {
        title,
        slug,
        summary,
        description,
        tags,
        projectId,
        websiteUrl,
        published: postEditorState.published,
        featured: postEditorState.featured,
        featuredImage: postEditorState.featuredImageUrl,
        logo: postEditorState.logoUrl,
        galleryImages: postEditorState.galleryUrls.filter(url => !url.startsWith('data:'))
    };
    
    showLoading(true);
    
    let result;
    if (postEditorState.editingId) {
        // Update existing post
        result = await updatePost(
            postEditorState.editingId, 
            postData, 
            postEditorState.featuredImageFile,
            postEditorState.galleryFiles,
            postEditorState.logoFile
        );
    } else {
        // Create new post
        result = await createPost(
            postData,
            postEditorState.featuredImageFile,
            postEditorState.galleryFiles,
            postEditorState.logoFile
        );
    }
    
    showLoading(false);
    
    if (result.success) {
        closeAllModals();
    }
};

window.handleDeletePost = async () => {
    if (!postEditorState.editingId) return;
    
    if (confirm('Are you sure you want to delete this post? This cannot be undone.')) {
        showLoading(true);
        const result = await deletePost(postEditorState.editingId);
        showLoading(false);
        
        if (result.success) {
            closeAllModals();
        }
    }
};

// Create Post from Project (called from project-detail.html)
window.handleMakePost = async (projectId) => {
    showLoading(true);
    const result = await createPostFromProject(projectId);
    showLoading(false);
    
    if (result.success) {
        // Redirect to posts page with the new post open
        window.location.href = `posts.html?edit=${result.id}`;
    }
};

// ============================================
// PAGE INITIALIZATION
// ============================================

onAuthStateChanged(auth, async (user) => {
    const page = location.pathname.split('/').pop() || 'index.html';

    if (user) {
        authCheckComplete = true;

        // Skip redundant initialization if same user and page already set up
        if (pageInitialized && lastAuthUid === user.uid) {
            console.log('[Auth] Skipping redundant init for same user');
            return;
        }

        AppState.currentUser = user;

        try {
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                AppState.userProfile = userSnap.data();
                // Determine admin status from Firestore role field
                AppState.isAdmin = checkIsAdmin(AppState.userProfile);
            } else {
                // Create profile for new users - determine role based on context
                const profile = {
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    role: 'client', // Default to client, admin promotes via updateUserRole
                    createdAt: serverTimestamp()
                };
                await setDoc(userRef, profile);
                AppState.userProfile = profile;
                AppState.isAdmin = false;
            }

            if (page === 'index.html') {
                window.location.href = NAVIGATION.DASHBOARD;
                return;
            }

            showPageSkeletons(page);
            await loadPageData(page);
            renderPage(page);
            updateUserInfo();

            // Mark page as initialized after successful setup
            pageInitialized = true;
            lastAuthUid = user.uid;
        } catch (error) {
            console.error('Error loading user profile:', error);
            showToast('Failed to load user profile', 'error');
        } finally {
            showLoading(false);
        }
    } else {
        // Wait a moment before redirecting on initial load - auth might still be initializing
        if (!authCheckComplete && page !== 'index.html') {
            // First auth check returned null - wait and see if a user comes through
            setTimeout(() => {
                if (!authCheckComplete && !AppState.currentUser) {
                    console.log('[Auth] No user after timeout, redirecting to login');
                    window.location.href = NAVIGATION.LOGIN;
                }
            }, 1500);
            return;
        }

        // User explicitly logged out (was previously logged in)
        if (lastAuthUid !== null) {
            console.log('[Auth] User logged out, redirecting');
            pageInitialized = false;
            lastAuthUid = null;
            authCheckComplete = false;
            if (page !== 'index.html') window.location.href = NAVIGATION.LOGIN;
        } else if (authCheckComplete && page !== 'index.html') {
            // Auth check complete and no user
            window.location.href = NAVIGATION.LOGIN;
        }
        showLoading(false);
    }
});

// Show skeleton loading states before data loads
function showPageSkeletons(page) {
    switch (page) {
        case 'dashboard.html':
            showSkeletonCards('projects-grid', 6);
            break;
        case 'leads.html':
            showSkeletonCards('leads-grid', 6);
            break;
        case 'projects.html':
            showSkeletonCards('projects-grid', 6);
            break;
    }
}

async function loadPageData(page) {
    switch (page) {
        case 'dashboard.html': await Promise.all([loadLeads(), loadProjects(), loadTickets()]); break;
        case 'leads.html': case 'lead-detail.html': await loadLeads(); break;
        case 'projects.html': case 'project-detail.html': await Promise.all([loadProjects(), loadTickets(), loadClients()]); break;
        case 'clients.html': await Promise.all([loadClients(), loadProjects()]); break;
        case 'archive.html': await loadArchive(); break;
        case 'tickets.html': await loadTickets(); break;
        case 'posts.html': await loadPosts(); break;  // NEW: Load posts
    }
}

function renderPage(page) {
    switch (page) {
        case 'dashboard.html':
            renderStats();
            if (AppState.isAdmin) {
                // Show Active AND Testing projects, sorted by tier then progress
                const dashboardProjects = AppState.projects
                    .filter(p => p.status === 'active' || p.status === 'testing')
                    .sort((a, b) => {
                        const tierDiff = getTierOrder(a.tier) - getTierOrder(b.tier);
                        if (tierDiff !== 0) return tierDiff;
                        return (parseInt(b.progress) || 0) - (parseInt(a.progress) || 0);
                    });
                renderDashboardProjectsList('projects-grid', dashboardProjects);
                renderAdminDashboardTickets('admin-tickets-grid');
            } else {
                // Client dashboard - show their projects and tickets
                renderDashboardProjectsList('projects-grid', AppState.projects);
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
        // NEW: Posts page
        case 'posts.html':
            subscribeToPosts(() => renderPosts('posts-grid'));
            renderPosts('posts-grid');
            // Check if we should open a post for editing (coming from Make Post button)
            const editId = new URLSearchParams(location.search).get('edit');
            if (editId) {
                setTimeout(() => openEditPostModal(editId), 500);
            }
            break;
    }
}

function renderAdminDashboardTickets(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;

    // Get active tickets (not resolved)
    const activeTickets = AppState.tickets.filter(t => t.status !== 'resolved');

    if (!activeTickets.length) {
        c.innerHTML = '<p class="text-muted" style="padding: 16px;">No active tickets</p>';
        return;
    }

    // Sort by urgency then date
    const urgencyOrder = { 'asap': 0, 'day': 1, 'week': 2, 'month': 3 };
    activeTickets.sort((a, b) => {
        const urgencyDiff = (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3);
        if (urgencyDiff !== 0) return urgencyDiff;
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
        return dateA - dateB;
    });

    // Show up to 8 tickets
    const ticketsToShow = activeTickets.slice(0, 8);

    c.innerHTML = ticketsToShow.map(t => {
        const project = AppState.projects.find(p => p.id === t.projectId);
        return `
        <div class="ticket-row" onclick="window.location.href='ticket-detail.html?id=${escapeHtml(t.id)}'" style="cursor:pointer;flex-wrap:wrap;">
            <div class="ticket-priority ${escapeHtml(t.urgency || 'week')}"></div>
            <div class="ticket-info" style="flex: 1; min-width: 150px;">
                <div class="ticket-title">${escapeHtml(t.title || 'Untitled')}</div>
                <div class="ticket-meta">${timeAgo(t.submittedAt)} • ${escapeHtml(project?.companyName || '-')}</div>
            </div>
            <span class="status-badge ${escapeHtml(t.status || 'open')}" style="font-size: 11px;align-self:flex-start;">${escapeHtml(getStatusLabel(t.status || 'open'))}</span>
            ${t.description ? `<div class="ticket-description-snippet" style="flex-basis:100%;margin-left:20px;">${escapeHtml(t.description)}</div>` : ''}
        </div>`;
    }).join('');
}

function renderClientTickets(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    // Filter by both clientId and submittedById to catch all user's tickets
    const userId = AppState.currentUser?.uid;
    const myTickets = AppState.tickets.filter(t => t.submittedById === userId || t.clientId === userId);

    if (!myTickets.length) {
        c.innerHTML = '<p class="text-muted">No tickets submitted yet.</p>';
        return;
    }

    // Separate active and resolved tickets
    const activeTickets = myTickets.filter(t => t.status !== 'resolved');
    const resolvedTickets = myTickets.filter(t => t.status === 'resolved');

    // Sort active tickets by tier, urgency, then date
    const urgencyOrder = { 'asap': 0, 'day': 1, 'week': 2, 'month': 3 };
    activeTickets.sort((a, b) => {
        const tierDiff = getTierOrder(a.tier) - getTierOrder(b.tier);
        if (tierDiff !== 0) return tierDiff;
        const urgencyDiff = (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3);
        if (urgencyDiff !== 0) return urgencyDiff;
        const dateA = a.submittedAt?.toDate?.() || new Date(a.submittedAt || 0);
        const dateB = b.submittedAt?.toDate?.() || new Date(b.submittedAt || 0);
        return dateA - dateB;
    });

    // Sort resolved tickets by resolution date (newest first)
    resolvedTickets.sort((a, b) => {
        const dateA = a.resolvedAt?.toDate?.() || a.updatedAt?.toDate?.() || new Date(0);
        const dateB = b.resolvedAt?.toDate?.() || b.updatedAt?.toDate?.() || new Date(0);
        return dateB - dateA;
    });

    const renderTicketRow = (t) => `
        <div class="ticket-row" data-ticket-id="${escapeHtml(t.id)}" role="button" tabindex="0" style="cursor:pointer;flex-wrap:wrap;">
            <div class="ticket-priority ${escapeHtml(t.tier || 'host')}"></div>
            <div class="ticket-info" style="flex:1;min-width:150px;"><div class="ticket-title">${escapeHtml(t.title || 'Untitled')}</div><div class="ticket-meta">${escapeHtml(t.projectName || '-')} • ${timeAgo(t.submittedAt)}</div></div>
            <span class="status-badge ${escapeHtml(t.status || 'open')}">${escapeHtml(getStatusLabel(t.status || 'open'))}</span>
            ${t.description ? `<div class="ticket-description-snippet" style="flex-basis:100%;margin-left:20px;margin-top:4px;">${escapeHtml(t.description)}</div>` : ''}
        </div>`;

    let html = '';

    // Active tickets
    if (activeTickets.length) {
        html += activeTickets.map(t => renderTicketRow(t)).join('');
    } else {
        html += '<p class="text-muted" style="padding: 8px 0;">No active tickets</p>';
    }

    // Resolved tickets section (collapsible)
    if (resolvedTickets.length) {
        html += `
            <div class="resolved-tickets-section" style="margin-top: 16px; border-top: 1px solid var(--color-border-subtle); padding-top: 12px;">
                <button type="button" class="resolved-header" style="display: flex; align-items: center; cursor: pointer; margin-bottom: 8px; background: none; border: none; padding: 0; width: 100%; text-align: left;" aria-expanded="false" aria-controls="resolved-list-${containerId}">
                    <svg class="chevron-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s; margin-right: 6px;" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                    <span style="font-size: 13px; color: var(--color-text-muted); font-weight: 500;">Resolved (${resolvedTickets.length})</span>
                </button>
                <div id="resolved-list-${containerId}" class="resolved-tickets-list" style="display: none;">
                    ${resolvedTickets.map(t => renderTicketRow(t)).join('')}
                </div>
            </div>`;
    }

    c.innerHTML = html;

    // Use event delegation for ticket rows
    c.addEventListener('click', (e) => {
        const ticketRow = e.target.closest('.ticket-row[data-ticket-id]');
        if (ticketRow) {
            window.location.href = `${NAVIGATION.TICKET_DETAIL}?id=${ticketRow.dataset.ticketId}`;
            return;
        }

        const resolvedHeader = e.target.closest('.resolved-header');
        if (resolvedHeader) {
            const list = resolvedHeader.nextElementSibling;
            const chevron = resolvedHeader.querySelector('.chevron-icon');
            const isExpanded = list.style.display !== 'none';
            list.style.display = isExpanded ? 'none' : 'block';
            chevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
            resolvedHeader.setAttribute('aria-expanded', !isExpanded);
        }
    });

    // Keyboard accessibility for ticket rows
    c.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const ticketRow = e.target.closest('.ticket-row[data-ticket-id]');
            if (ticketRow) {
                e.preventDefault();
                window.location.href = `${NAVIGATION.TICKET_DETAIL}?id=${ticketRow.dataset.ticketId}`;
            }
        }
    });
}

function renderLeadDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const lead = AppState.leads.find(l => l.id === id);
    if (!lead) { window.location.href = NAVIGATION.LEADS; return; }
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
    if (!proj) {
        // Only redirect if projects have loaded and project truly doesn't exist
        if (AppState.projects.length > 0) {
            console.warn('[Project Detail] Project not found:', id);
            window.location.href = NAVIGATION.PROJECTS;
        } else {
            console.log('[Project Detail] Waiting for projects to load...');
        }
        return;
    }
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
            // Show actual URLs instead of "Preview 1, 2..."
            previewsHtml = `<div class="info-item"><label>Previews</label><span>${proj.previewLinks.map(link => `<a href="${escapeHtml(link)}" target="_blank" style="word-break: break-all;">${escapeHtml(link)}</a>`).join('<br>')}</span></div>`;
        }
        el('detail-info').innerHTML = `
            <div class="info-item"><label>Email</label><span><a href="mailto:${proj.clientEmail || ''}">${escapeHtml(proj.clientEmail || '-')}</a></span></div>
            <div class="info-item"><label>Phone</label><span>${escapeHtml(proj.clientPhone || '-')}</span></div>
            <div class="info-item"><label>Website</label><span>${proj.websiteUrl ? `<a href="https://${escapeHtml(proj.websiteUrl)}" target="_blank">${escapeHtml(proj.websiteUrl)}</a>` : '-'}</span></div>
            <div class="info-item"><label>Location</label><span>${escapeHtml(proj.location || '-')}</span></div>
            <div class="info-item"><label>Type</label><span>${escapeHtml(proj.businessType || '-')}</span></div>
            ${proj.githubLink ? `<div class="info-item"><label>GitHub Code</label><span><a href="${escapeHtml(proj.githubLink)}" target="_blank">View Repository</a></span></div>` : ''}
            ${previewsHtml}`;
    }

    // Render product tasks (new system)
    renderProductTasks(proj);

    renderInvoices('invoices', proj.invoices);  // Admin view
    renderInvoices('client-invoices', proj.invoices, true);  // Client view (only sent/paid, with Pay button)
    subscribeToMessages(proj.id, msgs => renderMessages('messages-container', msgs));
    renderTickets('project-tickets', AppState.tickets.filter(t => t.projectId === proj.id));

    // Display current task with proper empty state
    const taskEl = el('current-task');
    if (taskEl) {
        const hasTask = proj.currentTask && proj.currentTask.trim();
        taskEl.textContent = hasTask ? proj.currentTask : 'No current task set.';
        taskEl.classList.toggle('empty', !hasTask);
    }
    if (el('inline-task-input')) el('inline-task-input').value = proj.currentTask || '';
    if (el('edit-current-task')) el('edit-current-task').value = proj.currentTask || '';
}

// Setup
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired - app.js loaded successfully');

    // Register Service Worker for offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[SW] Registered:', reg.scope))
            .catch(err => console.error('[SW] Registration failed:', err));
    }

    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeAllModals));
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAllModals(); }));

    // Accessibility: Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeAllModals();
                // Return focus to the element that opened the modal
                const trigger = document.querySelector('[data-modal-trigger]');
                if (trigger) trigger.focus();
            }
        }
    });

    // Accessibility: Focus trapping in modals
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const modal = overlay.querySelector('.modal');
            if (!modal) return;

            const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
    });
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
    
    // NEW: Post title auto-slug
    document.getElementById('post-title')?.addEventListener('input', (e) => {
        const slugInput = document.getElementById('post-slug');
        if (slugInput && !slugInput.value) {
            const generatedSlug = generateSlug(e.target.value);
            slugInput.placeholder = generatedSlug;
            updateSlugPreview(generatedSlug);
        }
    });
    
    document.getElementById('post-slug')?.addEventListener('input', (e) => {
        updateSlugPreview(e.target.value || document.getElementById('post-slug').placeholder);
    });
});
