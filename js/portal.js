/* ============================================
   SIDEQUEST DIGITAL - Client Portal JS
   Complete Admin + Client System
   ============================================ */

const DEMO_MODE = true;

// ============================================
// Demo Data
// ============================================

const DEMO_DATA = {
    users: {
        'client-demo': { uid: 'client-demo', email: 'demo@client.com', displayName: 'Sarah Mitchell', role: 'client', company: 'Greenfield Primary' },
        'client-002': { uid: 'client-002', email: 'david@hendersonlegal.co.nz', displayName: 'David Chen', role: 'client', company: 'Henderson Legal' },
        'admin-demo': { uid: 'admin-demo', email: 'admin@sidequest.nz', displayName: 'Joel', role: 'admin', company: 'Sidequest Digital' }
    },
    
    leads: [
        { id: 'lead-001', companyName: 'Meadowbrook Dental', clientName: 'Dr. Emma Richards', clientEmail: 'emma@meadowbrook.co.nz', clientPhone: '+64 21 555 1234', websiteUrl: 'www.meadowbrookdental.co.nz', logo: null, location: 'Auckland', businessType: 'Healthcare', githubLink: 'https://github.com/sidequest/meadowbrook-demo', githubUrl: 'https://sidequest.github.io/meadowbrook-demo', status: 'demo-sent', demoFiles: [{ name: 'Homepage_Demo.pdf', size: '2.1 MB', uploadedAt: '2025-01-08' }], notes: 'Interested in online booking.', createdAt: '2025-01-05' },
        { id: 'lead-002', companyName: 'Coastal Cafe', clientName: 'James Wilson', clientEmail: 'james@coastalcafe.co.nz', clientPhone: '+64 22 333 4567', websiteUrl: '', logo: null, location: 'Tauranga', businessType: 'Hospitality', githubLink: '', githubUrl: '', status: 'noted', demoFiles: [], notes: 'New cafe opening March.', createdAt: '2025-01-12' },
        { id: 'lead-003', companyName: 'Summit Accounting', clientName: 'Lisa Park', clientEmail: 'lisa@summit.co.nz', clientPhone: '+64 21 888 9999', websiteUrl: 'www.summitaccounting.co.nz', logo: null, location: 'Wellington', businessType: 'Professional Services', githubLink: 'https://github.com/sidequest/summit-demo', githubUrl: 'https://sidequest.github.io/summit-demo', status: 'demo-complete', demoFiles: [{ name: 'Full_Demo.pdf', size: '4.2 MB', uploadedAt: '2025-01-09' }], notes: 'Budget ~$5k for portal.', createdAt: '2025-01-03' }
    ],
    
    projects: [
        { id: 'proj-001', companyName: 'Greenfield Primary', clientName: 'Sarah Mitchell', clientEmail: 'sarah@greenfield.school.nz', clientPhone: '+64 21 123 4567', websiteUrl: 'www.greenfieldprimary.school.nz', logo: null, location: 'Auckland', businessType: 'Education', githubLink: 'https://github.com/sidequest/greenfield', githubUrl: 'https://sidequest.github.io/greenfield', status: 'active', tier: 'premium', progress: 65, assignedClients: ['client-demo'], demoFiles: [{ name: 'Initial_Wireframes.pdf', size: '1.8 MB', uploadedAt: '2024-10-20' }], clientFiles: [{ id: 'cf-001', name: 'Homepage_v3.pdf', size: '2.4 MB', uploadedBy: 'Joel', uploadedAt: '2024-12-10' }, { id: 'cf-002', name: 'Brand_Guidelines.pdf', size: '5.1 MB', uploadedBy: 'Sarah', uploadedAt: '2024-11-05' }], milestones: [{ id: 'm1', title: 'Discovery & Planning', status: 'completed', date: '2024-11-08' }, { id: 'm2', title: 'Design Mockups', status: 'completed', date: '2024-11-22' }, { id: 'm3', title: 'Homepage Dev', status: 'completed', date: '2024-12-15' }, { id: 'm4', title: 'Inner Pages', status: 'current', date: '2025-01-10' }, { id: 'm5', title: 'CMS Integration', status: 'pending', date: '2025-01-25' }, { id: 'm6', title: 'Launch', status: 'pending', date: '2025-02-15' }], invoices: [{ id: 'inv-001', number: 'INV-2024-001', amount: 1500, status: 'paid', dueDate: '2024-11-15', description: '50% Deposit' }, { id: 'inv-002', number: 'INV-2024-002', amount: 750, status: 'pending', dueDate: '2025-01-15', description: 'Milestone Payment' }], createdAt: '2024-10-15' },
        { id: 'proj-002', companyName: 'Henderson Legal', clientName: 'David Chen', clientEmail: 'david@hendersonlegal.co.nz', clientPhone: '+64 21 987 6543', websiteUrl: 'www.hendersonlegal.co.nz', logo: null, location: 'Auckland', businessType: 'Legal', githubLink: 'https://github.com/sidequest/henderson', githubUrl: '', status: 'active', tier: 'growth', progress: 30, assignedClients: ['client-002'], demoFiles: [], clientFiles: [{ id: 'cf-003', name: 'Portal_Wireframes.pdf', size: '3.2 MB', uploadedBy: 'Joel', uploadedAt: '2025-01-05' }], milestones: [{ id: 'm1', title: 'Requirements', status: 'completed', date: '2024-12-20' }, { id: 'm2', title: 'Portal Design', status: 'current', date: '2025-01-15' }, { id: 'm3', title: 'Development', status: 'pending', date: '2025-02-15' }], invoices: [{ id: 'inv-003', number: 'INV-2024-003', amount: 2000, status: 'paid', dueDate: '2024-12-20', description: 'Initial Deposit' }], createdAt: '2024-12-01' },
        { id: 'proj-003', companyName: 'Northshore Sports', clientName: 'Mike Thompson', clientEmail: 'mike@northshore.co.nz', clientPhone: '+64 22 555 1234', websiteUrl: 'www.northshoresports.co.nz', logo: null, location: 'Auckland', businessType: 'Sports', githubLink: '', githubUrl: '', status: 'active', tier: 'bugcatcher', progress: 90, assignedClients: [], demoFiles: [], clientFiles: [], milestones: [{ id: 'm1', title: 'Bug Fixes', status: 'current', date: '2025-01-15' }], invoices: [{ id: 'inv-004', number: 'INV-2025-001', amount: 200, status: 'pending', dueDate: '2025-01-20', description: 'Monthly Retainer' }], createdAt: '2024-10-01' },
        { id: 'proj-004', companyName: 'Kiwi Plumbing', clientName: 'Tom Bradley', clientEmail: 'tom@kiwiplumbing.co.nz', clientPhone: '+64 27 111 2222', websiteUrl: 'www.kiwiplumbing.co.nz', logo: null, location: 'Hamilton', businessType: 'Trades', githubLink: '', githubUrl: '', status: 'active', tier: 'host', progress: 100, assignedClients: [], demoFiles: [], clientFiles: [], milestones: [], invoices: [{ id: 'inv-005', number: 'INV-2025-002', amount: 50, status: 'pending', dueDate: '2025-01-01', description: 'Annual Hosting' }], createdAt: '2024-05-01' }
    ],
    
    archived: [
        { id: 'arch-001', type: 'lead', companyName: 'Old Coffee Shop', clientName: 'Jane Doe', clientEmail: 'jane@old.co.nz', reason: 'No response', archivedAt: '2024-12-01', originalData: { location: 'Christchurch', businessType: 'Hospitality' } },
        { id: 'arch-002', type: 'project', companyName: 'Sunset Yoga', clientName: 'Amy Chen', clientEmail: 'amy@sunset.co.nz', reason: 'Completed', archivedAt: '2024-11-15', originalData: { tier: 'growth', progress: 100, location: 'Auckland' } }
    ],
    
    tickets: [
        { id: 'tick-001', projectId: 'proj-001', projectName: 'Greenfield Primary', tier: 'premium', title: 'Calendar not syncing', description: 'Events not pulling from Google Calendar.', status: 'open', submittedBy: 'Sarah Mitchell', submittedAt: '2025-01-10T09:30:00Z', adminNotes: '', updates: [] },
        { id: 'tick-002', projectId: 'proj-001', projectName: 'Greenfield Primary', tier: 'premium', title: 'Update staff photos', description: '3 new staff need adding.', status: 'in-progress', submittedBy: 'Sarah Mitchell', submittedAt: '2025-01-08T14:00:00Z', adminNotes: 'Photos received', updates: [{ note: 'Photos received', timestamp: '2025-01-09T10:00:00Z', by: 'Joel' }] },
        { id: 'tick-003', projectId: 'proj-002', projectName: 'Henderson Legal', tier: 'growth', title: 'Mobile login issue', description: 'Cannot log in on phones.', status: 'open', submittedBy: 'David Chen', submittedAt: '2025-01-11T11:15:00Z', adminNotes: '', updates: [] },
        { id: 'tick-004', projectId: 'proj-003', projectName: 'Northshore Sports', tier: 'bugcatcher', title: 'Form error', description: 'Error on membership form.', status: 'resolved', submittedBy: 'Mike Thompson', submittedAt: '2025-01-05T16:30:00Z', adminNotes: 'Fixed', updates: [] }
    ],
    
    messages: [
        { id: 'msg-001', projectId: 'proj-001', senderId: 'admin-demo', senderName: 'Joel', text: "Hey Sarah! Latest mockup uploaded!", timestamp: '2024-12-10T14:35:00Z' },
        { id: 'msg-002', projectId: 'proj-001', senderId: 'client-demo', senderName: 'Sarah', text: 'Looks amazing! Can Events be more prominent?', timestamp: '2024-12-10T15:20:00Z' },
        { id: 'msg-003', projectId: 'proj-001', senderId: 'admin-demo', senderName: 'Joel', text: "Absolutely! Tomorrow.", timestamp: '2024-12-10T15:25:00Z' }
    ],
    
    activity: [
        { type: 'ticket', text: '<strong>Sarah</strong> submitted ticket on <strong>Greenfield</strong>', timestamp: '2025-01-10T09:30:00Z' },
        { type: 'lead', text: 'New lead: <strong>Coastal Cafe</strong>', timestamp: '2025-01-12T10:00:00Z' },
        { type: 'invoice', text: 'Invoice <strong>INV-2024-003</strong> paid', timestamp: '2024-12-20T11:00:00Z' }
    ],
    
    locations: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Tauranga', 'Dunedin'],
    businessTypes: ['Education', 'Healthcare', 'Legal', 'Hospitality', 'Retail', 'Professional Services', 'Trades', 'Sports', 'Technology']
};

// ============================================
// App State
// ============================================

const AppState = { currentUser: null, isAdmin: false, leads: [], projects: [], archived: [], tickets: [], messages: [], activity: [], currentItem: null };

// ============================================
// Utilities
// ============================================

const formatDate = d => d ? new Date(d).toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const formatCurrency = n => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
const timeAgo = d => { const s = Math.floor((new Date() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const getInitials = n => n ? n.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase() : '??';
const getTierOrder = t => ({ premium: 0, growth: 1, bugcatcher: 2, host: 3 }[t] ?? 4);
const getStatusLabel = s => ({ 'noted': 'Noted', 'demo-complete': 'Demo Complete', 'demo-sent': 'Demo Sent', 'active': 'Active', 'paused': 'Paused', 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' }[s] || s);

// ============================================
// Authentication
// ============================================

function login(email, password) {
    if (email === 'demo@client.com' && password === 'demo123') { AppState.currentUser = DEMO_DATA.users['client-demo']; AppState.isAdmin = false; return { success: true }; }
    if (email === 'admin@sidequest.nz' && password === 'admin123') { AppState.currentUser = DEMO_DATA.users['admin-demo']; AppState.isAdmin = true; return { success: true }; }
    return { success: false, error: 'Invalid credentials. Try demo@client.com / demo123 or admin@sidequest.nz / admin123' };
}

function checkAuth() {
    const s = localStorage.getItem('portal_session');
    if (s) { const { uid } = JSON.parse(s); AppState.currentUser = DEMO_DATA.users[uid]; AppState.isAdmin = AppState.currentUser?.role === 'admin'; return !!AppState.currentUser; }
    return false;
}

function logout() { localStorage.removeItem('portal_session'); window.location.href = 'login.html'; }

// ============================================
// Data Loading
// ============================================

function loadData() {
    AppState.leads = [...DEMO_DATA.leads];
    AppState.projects = [...DEMO_DATA.projects];
    AppState.archived = [...DEMO_DATA.archived];
    AppState.tickets = [...DEMO_DATA.tickets];
    AppState.messages = [...DEMO_DATA.messages];
    AppState.activity = [...DEMO_DATA.activity];
}

function getClientProjects() { return AppState.projects.filter(p => p.assignedClients?.includes(AppState.currentUser?.uid)); }
function getClientTickets() { const pids = getClientProjects().map(p => p.id); return AppState.tickets.filter(t => pids.includes(t.projectId)); }

// ============================================
// Rendering Functions
// ============================================

function renderStats() {
    const c = document.getElementById('stats-grid'); if (!c) return;
    if (AppState.isAdmin) {
        const active = AppState.projects.filter(p => p.status === 'active').length;
        const tickets = AppState.tickets.filter(t => t.status !== 'resolved').length;
        const leads = AppState.leads.length;
        const pending = AppState.projects.flatMap(p => p.invoices || []).filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${active}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${tickets}</div></div></div>
            <div class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div><div class="stat-content"><div class="stat-label">Leads</div><div class="stat-value">${leads}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="stat-content"><div class="stat-label">Pending Revenue</div><div class="stat-value">${formatCurrency(pending)}</div></div></div>`;
    } else {
        const projects = getClientProjects();
        c.innerHTML = `
            <div class="stat-card"><div class="stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></div><div class="stat-content"><div class="stat-label">Active Projects</div><div class="stat-value">${projects.filter(p => p.status === 'active').length}</div></div></div>
            <div class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="stat-content"><div class="stat-label">Open Tickets</div><div class="stat-value">${getClientTickets().filter(t => t.status !== 'resolved').length}</div></div></div>
            <div class="stat-card"><div class="stat-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div><div class="stat-content"><div class="stat-label">Pending Invoices</div><div class="stat-value">${projects.flatMap(p => p.invoices || []).filter(i => i.status === 'pending').length}</div></div></div>`;
    }
}

function renderLeads(id) {
    const c = document.getElementById(id); if (!c) return;
    if (!AppState.leads.length) { c.innerHTML = '<div class="empty-state"><h3>No leads yet</h3><p>Add your first lead to get started.</p></div>'; return; }
    c.innerHTML = AppState.leads.map(l => `
        <div class="item-card" onclick="viewLead('${l.id}')">
            <div class="item-card-header"><div class="item-logo">${getInitials(l.companyName)}</div><div class="item-info"><div class="item-company">${l.companyName}</div><div class="item-client">${l.clientName}</div></div></div>
            <span class="status-badge ${l.status}" style="position:absolute;top:16px;right:16px;">${getStatusLabel(l.status)}</span>
            <div class="item-tags"><span class="tag">${l.location || 'No location'}</span><span class="tag">${l.businessType || 'No type'}</span></div>
            <div class="item-meta"><span>Added ${formatDate(l.createdAt)}</span><span>${l.demoFiles?.length || 0} files</span></div>
        </div>`).join('');
}

function renderProjects(id, items = null) {
    const c = document.getElementById(id); if (!c) return;
    const list = items || (AppState.isAdmin ? AppState.projects : getClientProjects());
    if (!list.length) { c.innerHTML = '<div class="empty-state"><h3>No projects</h3></div>'; return; }
    c.innerHTML = list.map(p => `
        <div class="item-card" onclick="viewProject('${p.id}')">
            <div class="item-card-header"><div class="item-logo">${getInitials(p.companyName)}</div><div class="item-info"><div class="item-company">${p.companyName}</div><div class="item-client">${p.clientName}</div></div></div>
            <div class="item-status"><span class="status-badge ${p.status}">${getStatusLabel(p.status)}</span></div>
            <div class="flex gap-sm mb-lg" style="margin-top:-8px;"><span class="tier-badge ${p.tier}">${p.tier}</span></div>
            <div class="item-progress"><div class="progress-header"><span class="progress-label">Progress</span><span class="progress-value">${p.progress}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div></div>
            <div class="item-tags"><span class="tag">${p.location || '-'}</span><span class="tag">${p.businessType || '-'}</span></div>
            <div class="item-meta"><span>${p.milestones?.filter(m => m.status === 'completed').length || 0}/${p.milestones?.length || 0} milestones</span><span>${p.invoices?.filter(i => i.status === 'pending').length || 0} pending inv.</span></div>
        </div>`).join('');
}

function renderArchive(id) {
    const c = document.getElementById(id); if (!c) return;
    if (!AppState.archived.length) { c.innerHTML = '<div class="empty-state"><h3>Archive empty</h3></div>'; return; }
    c.innerHTML = AppState.archived.map(a => `
        <div class="item-card" onclick="viewArchived('${a.id}')">
            <div class="item-card-header"><div class="item-logo" style="opacity:0.5">${getInitials(a.companyName)}</div><div class="item-info"><div class="item-company">${a.companyName}</div><div class="item-client">${a.clientName}</div></div></div>
            <span class="badge badge-info" style="position:absolute;top:16px;right:16px;">${a.type}</span>
            <div class="item-meta" style="border:none;padding-top:8px;"><span>Archived ${formatDate(a.archivedAt)}</span><span>${a.reason}</span></div>
        </div>`).join('');
}

function renderTickets(id, items = null) {
    const c = document.getElementById(id); if (!c) return;
    let list = items || (AppState.isAdmin ? AppState.tickets : getClientTickets());
    list = list.sort((a, b) => getTierOrder(a.tier) - getTierOrder(b.tier) || new Date(b.submittedAt) - new Date(a.submittedAt));
    if (!list.length) { c.innerHTML = '<div class="empty-state"><h3>No tickets</h3></div>'; return; }
    c.innerHTML = list.map(t => `
        <div class="ticket-row" onclick="viewTicket('${t.id}')">
            <div class="ticket-priority ${t.tier}"></div>
            <div class="ticket-info"><div class="ticket-title">${t.title}</div><div class="ticket-meta">${t.projectName} • ${t.submittedBy} • ${timeAgo(t.submittedAt)}</div></div>
            <div class="ticket-status"><span class="tier-badge ${t.tier}">${t.tier}</span><span class="status-badge ${t.status}">${getStatusLabel(t.status)}</span></div>
        </div>`).join('');
}

function renderActivity(id) {
    const c = document.getElementById(id); if (!c) return;
    c.innerHTML = `<div class="activity-list">${AppState.activity.slice(0, 8).map(a => `
        <div class="activity-item"><div class="activity-icon stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg></div>
        <div class="activity-content"><div class="activity-text">${a.text}</div><div class="activity-time">${timeAgo(a.timestamp)}</div></div></div>`).join('')}</div>`;
}

function renderFiles(id, files) {
    const c = document.getElementById(id); if (!c) return;
    if (!files?.length) { c.innerHTML = '<p class="text-muted">No files yet.</p>'; return; }
    c.innerHTML = `<div class="file-list">${files.map(f => `
        <div class="file-item"><div class="file-icon ${f.name?.endsWith('.pdf') ? 'pdf' : 'other'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="file-info"><div class="file-name">${f.name}</div><div class="file-meta">${f.size || ''} ${f.uploadedBy ? '• ' + f.uploadedBy : ''}</div></div>
        <button class="btn btn-ghost btn-sm">Download</button></div>`).join('')}</div>`;
}

function renderMilestones(id, milestones) {
    const c = document.getElementById(id); if (!c || !milestones?.length) return;
    c.innerHTML = `<div class="timeline">${milestones.map(m => `
        <div class="timeline-item ${m.status}"><div class="timeline-dot"></div><div class="timeline-content"><h4>${m.title}</h4><p>${m.status === 'completed' ? 'Completed' : m.status === 'current' ? 'In Progress' : 'Upcoming'}</p><div class="timeline-date">${formatDate(m.date)}</div></div></div>`).join('')}</div>`;
}

function renderInvoices(id, invoices) {
    const c = document.getElementById(id); if (!c) return;
    if (!invoices?.length) { c.innerHTML = '<p class="text-muted">No invoices.</p>'; return; }
    c.innerHTML = invoices.map(i => `
        <div class="invoice-item"><div class="invoice-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg></div>
        <div class="invoice-info"><div class="invoice-number">${i.number}</div><div class="invoice-desc">${i.description} • Due ${formatDate(i.dueDate)}</div></div>
        <span class="badge badge-${i.status === 'paid' ? 'success' : 'warning'}">${i.status}</span>
        <div class="invoice-amount">${formatCurrency(i.amount)}</div>
        ${i.status === 'pending' ? '<button class="btn btn-primary btn-sm">Pay Now</button>' : ''}</div>`).join('');
}

function renderMessages(id, projectId) {
    const c = document.getElementById(id); if (!c) return;
    const msgs = AppState.messages.filter(m => m.projectId === projectId);
    c.innerHTML = `<div class="message-list">${msgs.map(m => `
        <div class="message-item ${m.senderId === AppState.currentUser?.uid ? 'sent' : ''}"><div class="message-avatar">${getInitials(m.senderName)}</div>
        <div class="message-bubble"><div class="message-sender">${m.senderName}</div><div class="message-text">${m.text}</div><div class="message-time">${timeAgo(m.timestamp)}</div></div></div>`).join('')}</div>`;
    c.scrollTop = c.scrollHeight;
}

function updateUserInfo() {
    const n = document.getElementById('user-name'), r = document.getElementById('user-role'), a = document.getElementById('user-avatar');
    if (n) n.textContent = AppState.currentUser?.displayName || 'User';
    if (r) r.textContent = AppState.isAdmin ? 'Administrator' : 'Client';
    if (a) a.textContent = getInitials(AppState.currentUser?.displayName || 'U');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = AppState.isAdmin ? '' : 'none');
    document.querySelectorAll('.client-only').forEach(el => el.style.display = AppState.isAdmin ? 'none' : '');
}

// ============================================
// Navigation & View Functions
// ============================================

function viewLead(id) { window.location.href = `lead-detail.html?id=${id}`; }
function viewProject(id) { window.location.href = `project-detail.html?id=${id}`; }
function viewArchived(id) { window.location.href = `archive-detail.html?id=${id}`; }
function viewTicket(id) { openModal('ticket-modal'); renderTicketDetail(id); }

function renderTicketDetail(id) {
    const t = AppState.tickets.find(x => x.id === id);
    if (!t) return;
    AppState.currentItem = t;
    const modal = document.getElementById('ticket-modal');
    if (!modal) return;
    modal.querySelector('.modal-title').textContent = t.title;
    modal.querySelector('.modal-body').innerHTML = `
        <div class="mb-xl"><span class="tier-badge ${t.tier}">${t.tier}</span> <span class="status-badge ${t.status}">${getStatusLabel(t.status)}</span></div>
        <div class="info-grid mb-xl">
            <div class="info-item"><label>Project</label><span>${t.projectName}</span></div>
            <div class="info-item"><label>Submitted By</label><span>${t.submittedBy}</span></div>
            <div class="info-item"><label>Submitted</label><span>${formatDate(t.submittedAt)}</span></div>
            <div class="info-item"><label>Status</label><span>${getStatusLabel(t.status)}</span></div>
        </div>
        <div class="mb-xl"><label class="form-label">Description</label><p>${t.description}</p></div>
        ${t.adminNotes ? `<div class="mb-xl"><label class="form-label">Admin Notes</label><p>${t.adminNotes}</p></div>` : ''}
        ${t.updates?.length ? `<div class="mb-xl"><label class="form-label">Updates</label>${t.updates.map(u => `<div class="activity-item"><div class="activity-content"><div class="activity-text">${u.note}</div><div class="activity-time">${u.by} • ${formatDate(u.timestamp)}</div></div></div>`).join('')}</div>` : ''}
        ${AppState.isAdmin ? `
        <div class="form-group"><label class="form-label">Add Note</label><textarea class="form-input form-textarea" id="ticket-note-input" placeholder="Add a note for the client..."></textarea></div>
        <div class="form-group"><label class="form-label">Update Status</label>
            <select class="form-input form-select" id="ticket-status-select">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
        </div>` : ''}`;
}

function openModal(id) { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active')); }

// ============================================
// Action Functions
// ============================================

function moveLeadToProject(leadId) {
    const lead = AppState.leads.find(l => l.id === leadId);
    if (!lead) return;
    const newProject = {
        id: 'proj-' + Date.now(),
        ...lead,
        status: 'active',
        tier: 'growth',
        progress: 0,
        assignedClients: [],
        clientFiles: [],
        milestones: [{ id: 'm1', title: 'Kickoff', status: 'current', date: new Date().toISOString().split('T')[0] }],
        invoices: [],
        createdAt: new Date().toISOString()
    };
    AppState.projects.push(newProject);
    AppState.leads = AppState.leads.filter(l => l.id !== leadId);
    alert('Lead moved to Projects!');
    window.location.href = 'projects.html';
}

function archiveItem(type, id) {
    if (!confirm('Are you sure you want to archive this?')) return;
    let item;
    if (type === 'lead') {
        item = AppState.leads.find(l => l.id === id);
        AppState.leads = AppState.leads.filter(l => l.id !== id);
    } else {
        item = AppState.projects.find(p => p.id === id);
        AppState.projects = AppState.projects.filter(p => p.id !== id);
    }
    if (item) {
        AppState.archived.push({ id: 'arch-' + Date.now(), type, companyName: item.companyName, clientName: item.clientName, clientEmail: item.clientEmail, reason: 'Manually archived', archivedAt: new Date().toISOString(), originalData: item });
    }
    alert('Archived!');
    window.location.href = type === 'lead' ? 'leads.html' : 'projects.html';
}

function restoreFromArchive(id) {
    const item = AppState.archived.find(a => a.id === id);
    if (!item) return;
    if (item.type === 'lead') {
        AppState.leads.push({ ...item.originalData, id: 'lead-' + Date.now() });
    } else {
        AppState.projects.push({ ...item.originalData, id: 'proj-' + Date.now(), status: 'paused' });
    }
    AppState.archived = AppState.archived.filter(a => a.id !== id);
    alert('Restored!');
    window.location.href = 'archive.html';
}

function returnProjectToLead(projectId) {
    const proj = AppState.projects.find(p => p.id === projectId);
    if (!proj) return;
    const lead = { id: 'lead-' + Date.now(), companyName: proj.companyName, clientName: proj.clientName, clientEmail: proj.clientEmail, clientPhone: proj.clientPhone, websiteUrl: proj.websiteUrl, logo: proj.logo, location: proj.location, businessType: proj.businessType, githubLink: proj.githubLink, githubUrl: proj.githubUrl, status: 'noted', demoFiles: proj.demoFiles || [], notes: 'Returned from project', createdAt: new Date().toISOString() };
    AppState.leads.push(lead);
    AppState.projects = AppState.projects.filter(p => p.id !== projectId);
    alert('Returned to Leads!');
    window.location.href = 'leads.html';
}

function updateTicketStatus() {
    const t = AppState.currentItem;
    if (!t) return;
    const note = document.getElementById('ticket-note-input')?.value;
    const status = document.getElementById('ticket-status-select')?.value;
    const ticket = AppState.tickets.find(x => x.id === t.id);
    if (ticket) {
        if (note) { ticket.updates = ticket.updates || []; ticket.updates.push({ note, timestamp: new Date().toISOString(), by: 'Joel' }); ticket.adminNotes = note; }
        if (status) ticket.status = status;
    }
    closeAllModals();
    renderTickets('tickets-list');
    alert('Ticket updated!');
}

function submitTicket(projectId) {
    const title = document.getElementById('new-ticket-title')?.value;
    const desc = document.getElementById('new-ticket-desc')?.value;
    if (!title || !desc) { alert('Please fill in all fields'); return; }
    const proj = AppState.projects.find(p => p.id === projectId);
    AppState.tickets.push({ id: 'tick-' + Date.now(), projectId, projectName: proj?.companyName || 'Unknown', tier: proj?.tier || 'host', title, description: desc, status: 'open', submittedBy: AppState.currentUser?.displayName, submittedAt: new Date().toISOString(), adminNotes: '', updates: [] });
    closeAllModals();
    alert('Ticket submitted!');
    location.reload();
}

function sendMessage(projectId) {
    const input = document.getElementById('message-input');
    if (!input?.value.trim()) return;
    AppState.messages.push({ id: 'msg-' + Date.now(), projectId, senderId: AppState.currentUser.uid, senderName: AppState.currentUser.displayName, text: input.value, timestamp: new Date().toISOString() });
    input.value = '';
    renderMessages('messages-container', projectId);
}

// ============================================
// Form Handlers
// ============================================

function handleLogin(e) {
    e.preventDefault();
    const result = login(document.getElementById('email').value, document.getElementById('password').value);
    if (result.success) { localStorage.setItem('portal_session', JSON.stringify({ uid: AppState.currentUser.uid })); window.location.href = 'dashboard.html'; }
    else { const err = document.getElementById('login-error'); if (err) { err.textContent = result.error; err.style.display = 'block'; } }
}

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop() || 'index.html';
    
    // Login page
    if (page === 'login.html' || page === 'index.html') {
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        return;
    }
    
    // Auth check
    if (!checkAuth()) { location.href = 'login.html'; return; }
    
    // Load data & update UI
    loadData();
    updateUserInfo();
    
    // Page-specific rendering
    switch (page) {
        case 'dashboard.html':
            renderStats();
            if (AppState.isAdmin) {
                renderProjects('projects-grid', AppState.projects.filter(p => p.status === 'active').slice(0, 4));
            } else {
                renderProjects('projects-grid', getClientProjects().slice(0, 4));
            }
            renderActivity('activity-feed');
            break;
        case 'leads.html':
            renderLeads('leads-grid');
            break;
        case 'projects.html':
            renderProjects('projects-grid');
            break;
        case 'archive.html':
            renderArchive('archive-grid');
            break;
        case 'tickets.html':
            renderTickets('tickets-list');
            break;
        case 'lead-detail.html':
            renderLeadDetail();
            break;
        case 'project-detail.html':
            renderProjectDetail();
            break;
    }
    
    // Event listeners
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));
    document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeAllModals(); }));
});

function renderLeadDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const lead = AppState.leads.find(l => l.id === id);
    if (!lead) { location.href = 'leads.html'; return; }
    AppState.currentItem = lead;
    
    document.getElementById('detail-company').textContent = lead.companyName;
    document.getElementById('detail-client').textContent = lead.clientName;
    document.getElementById('detail-status').className = `status-badge ${lead.status}`;
    document.getElementById('detail-status').textContent = getStatusLabel(lead.status);
    
    document.getElementById('detail-info').innerHTML = `
        <div class="info-item"><label>Email</label><span><a href="mailto:${lead.clientEmail}">${lead.clientEmail}</a></span></div>
        <div class="info-item"><label>Phone</label><span>${lead.clientPhone || '-'}</span></div>
        <div class="info-item"><label>Website</label><span>${lead.websiteUrl ? `<a href="https://${lead.websiteUrl}" target="_blank">${lead.websiteUrl}</a>` : '-'}</span></div>
        <div class="info-item"><label>Location</label><span>${lead.location || '-'}</span></div>
        <div class="info-item"><label>Business Type</label><span>${lead.businessType || '-'}</span></div>
        <div class="info-item"><label>Added</label><span>${formatDate(lead.createdAt)}</span></div>
        ${lead.githubLink ? `<div class="info-item"><label>GitHub Repo</label><span><a href="${lead.githubLink}" target="_blank">View Code</a></span></div>` : ''}
        ${lead.githubUrl ? `<div class="info-item"><label>GitHub Preview</label><span><a href="${lead.githubUrl}" target="_blank">View Demo</a></span></div>` : ''}`;
    
    if (lead.notes) document.getElementById('detail-notes').textContent = lead.notes;
    renderFiles('demo-files', lead.demoFiles);
}

function renderProjectDetail() {
    const id = new URLSearchParams(location.search).get('id');
    const proj = AppState.projects.find(p => p.id === id);
    if (!proj) { location.href = 'projects.html'; return; }
    AppState.currentItem = proj;
    
    document.getElementById('detail-company').textContent = proj.companyName;
    document.getElementById('detail-client').textContent = proj.clientName;
    document.getElementById('detail-status').className = `status-badge ${proj.status}`;
    document.getElementById('detail-status').textContent = getStatusLabel(proj.status);
    document.getElementById('detail-tier').className = `tier-badge ${proj.tier}`;
    document.getElementById('detail-tier').textContent = proj.tier;
    document.getElementById('detail-progress').textContent = proj.progress + '%';
    document.getElementById('progress-fill').style.width = proj.progress + '%';
    
    document.getElementById('detail-info').innerHTML = `
        <div class="info-item"><label>Email</label><span><a href="mailto:${proj.clientEmail}">${proj.clientEmail}</a></span></div>
        <div class="info-item"><label>Phone</label><span>${proj.clientPhone || '-'}</span></div>
        <div class="info-item"><label>Website</label><span>${proj.websiteUrl ? `<a href="https://${proj.websiteUrl}" target="_blank">${proj.websiteUrl}</a>` : '-'}</span></div>
        <div class="info-item"><label>Location</label><span>${proj.location || '-'}</span></div>
        <div class="info-item"><label>Business Type</label><span>${proj.businessType || '-'}</span></div>
        ${proj.githubLink ? `<div class="info-item"><label>GitHub</label><span><a href="${proj.githubLink}" target="_blank">View Code</a></span></div>` : ''}`;
    
    renderMilestones('milestones', proj.milestones);
    renderFiles('client-files', proj.clientFiles);
    renderInvoices('invoices', proj.invoices);
    renderMessages('messages-container', proj.id);
    renderTickets('project-tickets', AppState.tickets.filter(t => t.projectId === proj.id));
    
    // Message form
    document.getElementById('message-form')?.addEventListener('submit', e => { e.preventDefault(); sendMessage(proj.id); });
}
