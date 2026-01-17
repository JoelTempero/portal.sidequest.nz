/* ============================================
   SIDEQUEST DIGITAL - Ticket Detail Page
   ============================================ */

import { initAuthListener, logout } from './services/auth.js';
import {
    getState,
    isAdmin as checkIsAdmin,
    getCurrentUserId,
    setTheme,
    getTheme,
    initializeTheme
} from './services/state.js';
import {
    getTicket,
    subscribeToTicket,
    updateTicket,
    updateTicketStatus,
    addTicketComment,
    addTicketResponse,
    addInternalNote,
    addTicketAttachment,
    getCannedResponses,
    TICKET_CATEGORIES,
    TICKET_CATEGORY_LABELS,
    TICKET_PRIORITIES,
    TICKET_PRIORITY_LABELS
} from './services/tickets.js';
import { showToast } from './components/toast.js';
import { showLoading, showSkeleton } from './components/loaders.js';
import { openModal, closeModal } from './components/modal.js';
import { escapeHtml } from './utils/sanitize.js';
import { formatDate, formatDateTime, timeAgo, parseQueryParams } from './utils/helpers.js';
import { TICKET_STATUSES, TICKET_STATUS_LABELS, TICKET_URGENCIES, TICKET_URGENCY_LABELS } from './config/constants.js';
import {
    db,
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from './services/firebase-init.js';

// Current ticket state
let currentTicket = null;
let currentProject = null;
let currentReplyTab = 'public';
let unsubscribeTicket = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initAuthListener(onAuthStateChanged);
});

function onAuthStateChanged(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Update UI for role
    updateUIForRole();

    // Get ticket ID from URL
    const params = parseQueryParams();
    const ticketId = params.id;

    if (!ticketId) {
        showToast('Ticket not found', 'error');
        window.location.href = checkIsAdmin() ? 'tickets.html' : 'my-tickets.html';
        return;
    }

    // Load ticket
    loadTicketDetail(ticketId);

    // Load admin helpers
    if (checkIsAdmin()) {
        populateCannedResponses();
    }

    // Update user info in sidebar
    updateUserInfo();
}

function updateUIForRole() {
    const isAdmin = checkIsAdmin();
    document.querySelectorAll('.admin-only').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    document.querySelectorAll('.client-only').forEach(el => {
        el.style.display = isAdmin ? 'none' : '';
    });
}

function updateUserInfo() {
    const profile = getState('userProfile');
    if (profile) {
        document.getElementById('user-name').textContent = profile.displayName || 'User';
        document.getElementById('user-role').textContent = checkIsAdmin() ? 'Admin' : 'Client';
        document.getElementById('user-avatar').textContent = (profile.displayName || 'U')[0].toUpperCase();
    }
}

// ============================================
// LOAD TICKET
// ============================================

async function loadTicketDetail(ticketId) {
    showLoading(true);

    // Show skeletons
    showSkeleton('ticket-header', 'detail');
    showSkeleton('ticket-description', 'text');
    showSkeleton('ticket-comments', 'messages');
    showSkeleton('ticket-timeline', 'list');

    // Subscribe to real-time updates
    if (unsubscribeTicket) {
        unsubscribeTicket();
    }

    unsubscribeTicket = subscribeToTicket(ticketId, async (ticket) => {
        if (!ticket) {
            showToast('Ticket not found', 'error');
            window.location.href = checkIsAdmin() ? 'tickets.html' : 'my-tickets.html';
            return;
        }

        // Check access (allow if clientId matches OR submittedById matches)
        const userId = getCurrentUserId();
        if (!checkIsAdmin() && ticket.submittedById !== userId && ticket.clientId !== userId) {
            showToast('Access denied', 'error');
            window.location.href = 'my-tickets.html';
            return;
        }

        currentTicket = ticket;

        // Fetch project data for logo
        if (ticket.projectId && !currentProject) {
            try {
                const projectDoc = await getDoc(doc(db, 'projects', ticket.projectId));
                if (projectDoc.exists()) {
                    currentProject = { id: projectDoc.id, ...projectDoc.data() };
                }
            } catch (e) {
                console.log('Could not load project:', e);
            }
        }

        renderTicketDetail(ticket);
        showLoading(false);
    });
}

// ============================================
// RENDER TICKET
// ============================================

function renderTicketDetail(ticket) {
    // Update breadcrumb
    document.getElementById('ticket-breadcrumb').textContent = `#${ticket.id.slice(-6).toUpperCase()}`;
    document.title = `${ticket.title} - Sidequest Portal`;

    // Render header
    renderTicketHeader(ticket);

    // Render description
    renderDescription(ticket);

    // Render attachments
    renderAttachments(ticket);

    // Render comments
    renderComments(ticket);

    // Render sidebar
    renderSidebar(ticket);

    // Render timeline
    renderTimeline(ticket);
}

function renderTicketHeader(ticket) {
    const statusClass = ticket.status.replace('-', '');
    const priorityClass = ticket.priority || 'medium';
    const categoryLabel = TICKET_CATEGORY_LABELS[ticket.category] || ticket.category || 'Support';

    document.getElementById('ticket-header').innerHTML = `
        <div class="ticket-header-top">
            <div class="ticket-header-badges">
                <span class="status-badge ${statusClass}">${TICKET_STATUS_LABELS[ticket.status] || ticket.status}</span>
                <span class="priority-badge ${priorityClass}">${TICKET_PRIORITY_LABELS[ticket.priority] || 'Medium'}</span>
                <span class="category-badge">${categoryLabel}</span>
                ${ticket.slaStatus?.breached ? '<span class="sla-badge breached">SLA Breached</span>' : ''}
            </div>
            <div class="ticket-header-actions admin-only">
                <button class="btn btn-secondary btn-sm" onclick="window.location.href='project-detail.html?id=${ticket.projectId}'">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    View Project
                </button>
            </div>
        </div>
        <h1 class="ticket-title-large">${escapeHtml(ticket.title)}</h1>
        <div class="ticket-header-meta">
            <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${escapeHtml(ticket.submittedBy)}
            </span>
            <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${formatDateTime(ticket.createdAt)}
            </span>
            <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                ${escapeHtml(ticket.projectName || 'No Project')}
            </span>
        </div>
    `;
}

function renderDescription(ticket) {
    document.getElementById('ticket-description').innerHTML = `
        <div class="description-content">${escapeHtml(ticket.description || 'No description provided.').replace(/\n/g, '<br>')}</div>
    `;
}

function renderAttachments(ticket) {
    const attachments = ticket.attachments || [];
    const container = document.getElementById('ticket-attachments');

    if (attachments.length === 0) {
        container.innerHTML = '<div class="empty-state small">No attachments</div>';
        return;
    }

    container.innerHTML = attachments.map(att => `
        <div class="attachment-item">
            <div class="attachment-icon">
                ${getAttachmentIcon(att.type)}
            </div>
            <div class="attachment-info">
                <a href="${att.url}" target="_blank" class="attachment-name">${escapeHtml(att.name)}</a>
                <span class="attachment-meta">${formatFileSize(att.size)} • ${timeAgo(att.uploadedAt)}</span>
            </div>
            <a href="${att.url}" target="_blank" download class="attachment-download">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
        </div>
    `).join('');
}

function renderComments(ticket) {
    const comments = ticket.comments || [];
    const container = document.getElementById('ticket-comments');
    const isAdmin = checkIsAdmin();

    if (comments.length === 0) {
        container.innerHTML = '<div class="empty-state small">No comments yet. Start the conversation below.</div>';
        return;
    }

    // Filter comments based on role (clients don't see internal notes)
    const visibleComments = isAdmin ? comments : comments.filter(c => !c.isInternal);

    container.innerHTML = visibleComments.map(comment => {
        const isOwn = comment.userId === getCurrentUserId();
        const isAdminComment = comment.isAdmin;

        return `
            <div class="comment ${isOwn ? 'own' : ''} ${comment.isInternal ? 'internal' : ''} ${isAdminComment ? 'admin-comment' : 'client-comment'}">
                <div class="comment-avatar ${isAdminComment ? 'admin' : 'client'}">
                    ${(comment.userName || 'U')[0].toUpperCase()}
                </div>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHtml(comment.userName || 'Unknown')}</span>
                        ${comment.isInternal ? '<span class="comment-badge internal">Internal</span>' : ''}
                        ${isAdminComment ? '<span class="comment-badge admin">Staff</span>' : ''}
                        <span class="comment-time">${timeAgo(comment.createdAt)}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(comment.text).replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function renderSidebar(ticket) {
    // Status
    const statusClass = ticket.status.replace('-', '');
    document.getElementById('ticket-status-badge').innerHTML = `
        <span class="status-badge large ${statusClass}">${TICKET_STATUS_LABELS[ticket.status] || ticket.status}</span>
    `;
    document.getElementById('status-select').value = ticket.status;

    // SLA
    renderSLA(ticket);

    // Details
    document.getElementById('detail-ticket-id').textContent = `#${ticket.id.slice(-6).toUpperCase()}`;

    // Project with logo
    const projectEl = document.getElementById('detail-project');
    const projectLogo = currentProject?.logo;
    const projectName = ticket.projectName || 'No Project';
    const projectInitial = (projectName || 'P')[0].toUpperCase();
    const logoHtml = projectLogo
        ? `<img src="${escapeHtml(projectLogo)}" alt="" style="width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:32px;height:32px;border-radius:6px;background:var(--color-bg-tertiary);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--color-text-muted);flex-shrink:0;">${projectInitial}</div>`;
    projectEl.innerHTML = `<span style="display:flex;align-items:center;gap:10px;">${logoHtml}<span>${escapeHtml(projectName)}</span></span>`;
    projectEl.href = `project-detail.html?id=${ticket.projectId}`;
    document.getElementById('detail-category').textContent = TICKET_CATEGORY_LABELS[ticket.category] || ticket.category || 'Support';
    document.getElementById('detail-priority').innerHTML = `<span class="priority-badge small ${ticket.priority || 'medium'}">${TICKET_PRIORITY_LABELS[ticket.priority] || 'Medium'}</span>`;
    document.getElementById('detail-urgency').textContent = TICKET_URGENCY_LABELS[ticket.urgency] || ticket.urgency || 'Normal';
    document.getElementById('detail-submitter').textContent = ticket.submittedBy || 'Unknown';
    document.getElementById('detail-submitted').textContent = formatDateTime(ticket.createdAt);

    // Internal notes
    const internalNotesEl = document.getElementById('internal-notes');
    if (internalNotesEl) {
        internalNotesEl.value = ticket.internalNotes || '';
    }
}

function renderSLA(ticket) {
    const sla = ticket.slaStatus || {};
    const container = document.getElementById('ticket-sla');

    if (ticket.status === TICKET_STATUSES.RESOLVED) {
        container.innerHTML = `
            <div class="sla-resolved">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Resolved</span>
            </div>
        `;
        return;
    }

    let statusClass = 'ok';
    let statusText = 'On Track';
    let timeText = '';

    if (sla.breached) {
        statusClass = 'breached';
        statusText = 'SLA Breached';
        timeText = `${sla.hoursOverdue}h overdue`;
    } else if (sla.status === 'critical') {
        statusClass = 'critical';
        statusText = 'Critical';
        timeText = `${sla.hoursRemaining}h remaining`;
    } else if (sla.status === 'warning') {
        statusClass = 'warning';
        statusText = 'Warning';
        timeText = `${sla.hoursRemaining}h remaining`;
    } else if (sla.hoursRemaining) {
        timeText = `${sla.hoursRemaining}h remaining`;
    }

    container.innerHTML = `
        <div class="sla-status ${statusClass}">
            <div class="sla-indicator"></div>
            <div class="sla-info">
                <span class="sla-label">${statusText}</span>
                <span class="sla-time">${timeText}</span>
            </div>
        </div>
        ${ticket.slaDueDate ? `<div class="sla-due">Due: ${formatDateTime(ticket.slaDueDate)}</div>` : ''}
    `;
}

function renderTimeline(ticket) {
    const updates = ticket.updates || [];
    const container = document.getElementById('ticket-timeline');

    if (updates.length === 0) {
        container.innerHTML = '<div class="empty-state small">No activity yet</div>';
        return;
    }

    // Sort by timestamp descending (newest first)
    const sorted = [...updates].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    container.innerHTML = sorted.slice(0, 10).map(update => `
        <div class="timeline-item">
            <div class="timeline-icon ${update.type}">
                ${getTimelineIcon(update.type)}
            </div>
            <div class="timeline-content">
                <div class="timeline-message">${escapeHtml(update.message)}</div>
                <div class="timeline-meta">${escapeHtml(update.userName || 'System')} • ${timeAgo(update.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

// ============================================
// ACTIONS
// ============================================

window.changeTicketStatus = async function(status) {
    if (!currentTicket) return;

    const result = await updateTicketStatus(currentTicket.id, status);
    if (!result.success) {
        // Revert select
        document.getElementById('status-select').value = currentTicket.status;
    }
};

window.switchReplyTab = function(tab) {
    currentReplyTab = tab;
    document.querySelectorAll('.reply-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    const textarea = document.getElementById('reply-text');
    textarea.placeholder = tab === 'internal'
        ? 'Add internal note (not visible to client)...'
        : 'Type your reply...';
};

window.insertCannedResponse = function(responseId) {
    if (!responseId) return;

    const responses = getCannedResponses();
    const response = responses.find(r => r.id === responseId);

    if (response) {
        document.getElementById('reply-text').value = response.text;
    }

    // Reset select
    document.getElementById('canned-response-select').value = '';
};

window.toggleResolveOnReply = function() {
    // Visual feedback only - actual resolve happens on submit
};

window.submitReply = async function() {
    const text = document.getElementById('reply-text').value.trim();
    if (!text) {
        showToast('Please enter a message', 'warning');
        return;
    }

    const isInternal = currentReplyTab === 'internal';
    const shouldResolve = document.getElementById('reply-resolve')?.checked;

    let result;
    if (isInternal) {
        result = await addInternalNote(currentTicket.id, text);
    } else {
        result = await addTicketResponse(currentTicket.id, text);
    }

    if (result.success) {
        document.getElementById('reply-text').value = '';

        // Resolve if checked
        if (shouldResolve && !isInternal) {
            await updateTicketStatus(currentTicket.id, TICKET_STATUSES.RESOLVED);
            document.getElementById('reply-resolve').checked = false;
        }
    }
};

window.saveInternalNotes = async function() {
    if (!currentTicket) return;

    const notes = document.getElementById('internal-notes').value;
    if (notes !== currentTicket.internalNotes) {
        await updateTicket(currentTicket.id, { internalNotes: notes });
    }
};

window.openAttachmentUpload = function() {
    document.getElementById('attachment-file').value = '';
    document.getElementById('attachment-preview').innerHTML = '';
    openModal('attachment-modal');
};

window.uploadAttachment = async function() {
    const fileInput = document.getElementById('attachment-file');
    const file = fileInput.files[0];

    if (!file) {
        showToast('Please select a file', 'warning');
        return;
    }

    const result = await addTicketAttachment(currentTicket.id, file);
    if (result.success) {
        closeModal('attachment-modal');
    }
};

// ============================================
// HELPERS
// ============================================

function populateCannedResponses() {
    const select = document.getElementById('canned-response-select');
    if (!select) return;

    const responses = getCannedResponses();
    responses.forEach(response => {
        const option = document.createElement('option');
        option.value = response.id;
        option.textContent = response.name;
        select.appendChild(option);
    });
}

function getAttachmentIcon(type) {
    if (type?.startsWith('image/')) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
    }
    if (type === 'application/pdf') {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>';
}

function getTimelineIcon(type) {
    const icons = {
        created: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        status_changed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
        assigned: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>',
        comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        internal_note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        attachment_added: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
        priority_changed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
    };
    return icons[type] || icons.comment;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

window.openModal = openModal;
window.closeModal = closeModal;
window.handleLogout = logout;

window.toggleTheme = function() {
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
};

window.toggleMobileMenu = function() {
    document.querySelector('.sidebar').classList.toggle('mobile-open');
    document.querySelector('.mobile-overlay').classList.toggle('active');
};

window.saveSettings = async function() {
    // Implement settings save
    closeModal('settings-modal');
};
