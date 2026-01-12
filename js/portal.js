/* ============================================
   SIDEQUEST DIGITAL - Client Portal JS
   ============================================ */

const DEMO_MODE = true;

const DEMO_DATA = {
    users: {
        'client-demo': { uid: 'client-demo', email: 'demo@client.com', displayName: 'Sarah Mitchell', role: 'client', company: 'Greenfield Primary' },
        'admin-demo': { uid: 'admin-demo', email: 'admin@sidequest.nz', displayName: 'Joel', role: 'admin', company: 'Sidequest Digital' }
    },
    projects: [
        { id: 'proj-001', name: 'Website Redesign', clientId: 'client-demo', clientCompany: 'Greenfield Primary', status: 'active', phase: 'Build', progress: 65, dueDate: '2025-02-15', type: 'Website',
          milestones: [
            { title: 'Discovery & Planning', status: 'completed', date: '2024-11-08' },
            { title: 'Design Mockups', status: 'completed', date: '2024-11-22' },
            { title: 'Homepage Development', status: 'completed', date: '2024-12-15' },
            { title: 'Inner Pages', status: 'current', date: '2025-01-10' },
            { title: 'CMS Integration', status: 'pending', date: '2025-01-25' },
            { title: 'Testing & Launch', status: 'pending', date: '2025-02-15' }
          ]
        },
        { id: 'proj-002', name: 'Parent Communication Hub', clientId: 'client-demo', clientCompany: 'Greenfield Primary', status: 'pending', phase: 'Discovery', progress: 15, dueDate: '2025-04-30', type: 'Web App',
          milestones: [
            { title: 'Requirements', status: 'current', date: '2025-01-22' },
            { title: 'Design', status: 'pending', date: '2025-02-10' },
            { title: 'Development', status: 'pending', date: '2025-03-15' },
            { title: 'Launch', status: 'pending', date: '2025-04-30' }
          ]
        },
        { id: 'proj-003', name: 'Henderson Legal Portal', clientId: 'client-002', clientCompany: 'Henderson Legal', status: 'completed', phase: 'Complete', progress: 100, dueDate: '2024-10-15', type: 'Portal', milestones: [] }
    ],
    files: [
        { id: 'file-001', name: 'Homepage_Mockup_v3.pdf', projectId: 'proj-001', type: 'pdf', size: '2.4 MB', uploadedBy: 'Joel', uploadedAt: '2024-12-10T14:30:00Z' },
        { id: 'file-002', name: 'Brand_Guidelines.pdf', projectId: 'proj-001', type: 'pdf', size: '5.1 MB', uploadedBy: 'Sarah', uploadedAt: '2024-11-05T09:15:00Z' },
        { id: 'file-003', name: 'Event_Calendar_Screenshot.png', projectId: 'proj-001', type: 'image', size: '340 KB', uploadedBy: 'Joel', uploadedAt: '2024-12-20T11:00:00Z' }
    ],
    messages: [
        { id: 'msg-001', projectId: 'proj-001', senderId: 'admin-demo', senderName: 'Joel', text: "Hey Sarah! I've uploaded the latest homepage mockup. Let me know what you think!", timestamp: '2024-12-10T14:35:00Z' },
        { id: 'msg-002', projectId: 'proj-001', senderId: 'client-demo', senderName: 'Sarah', text: 'This looks amazing! Love the colors. Could we make the Events section more prominent?', timestamp: '2024-12-10T15:20:00Z' },
        { id: 'msg-003', projectId: 'proj-001', senderId: 'admin-demo', senderName: 'Joel', text: "Absolutely! I'll have an updated version by tomorrow.", timestamp: '2024-12-10T15:25:00Z' }
    ],
    invoices: [
        { id: 'inv-001', clientId: 'client-demo', number: 'INV-2024-001', amount: 1500, status: 'paid', dueDate: '2024-11-15', description: 'Website Redesign - 50% Deposit' },
        { id: 'inv-002', clientId: 'client-demo', number: 'INV-2024-002', amount: 750, status: 'pending', dueDate: '2025-01-15', description: 'Website Redesign - Milestone Payment' },
        { id: 'inv-003', clientId: 'client-demo', number: 'INV-2025-001', amount: 2000, status: 'pending', dueDate: '2025-01-30', description: 'Parent Hub - Initial Deposit' }
    ],
    activity: [
        { type: 'file', text: '<strong>Joel</strong> uploaded <strong>Homepage_Mockup_v3.pdf</strong>', timestamp: '2024-12-10T14:30:00Z' },
        { type: 'milestone', text: '<strong>Homepage Development</strong> completed', timestamp: '2024-12-15T10:00:00Z' },
        { type: 'message', text: 'New message from <strong>Joel</strong>', timestamp: '2024-12-10T14:35:00Z' },
        { type: 'invoice', text: 'Invoice <strong>INV-2024-001</strong> paid', timestamp: '2024-11-12T09:30:00Z' }
    ],
    clients: [
        { id: 'client-demo', name: 'Sarah Mitchell', email: 'sarah@greenfield.school.nz', company: 'Greenfield Primary', projects: 2, status: 'active' },
        { id: 'client-002', name: 'David Chen', email: 'david@hendersonlegal.co.nz', company: 'Henderson Legal', projects: 1, status: 'active' },
        { id: 'client-003', name: 'Mike Thompson', email: 'mike@northshore.co.nz', company: 'Northshore Sports', projects: 1, status: 'active' }
    ]
};

const AppState = { currentUser: null, isAdmin: false, projects: [], files: [], messages: [], invoices: [], activity: [], clients: [], currentProject: null };

// Utilities
const formatDate = d => new Date(d).toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', year: 'numeric' });
const formatCurrency = n => new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
const timeAgo = d => { const s = Math.floor((new Date() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s/60) + 'm ago'; if (s < 86400) return Math.floor(s/3600) + 'h ago'; return Math.floor(s/86400) + 'd ago'; };
const getInitials = n => n.split(' ').map(x => x[0]).join('').slice(0,2).toUpperCase();

// Auth
function login(email, password) {
    if (email === 'demo@client.com' && password === 'demo123') {
        AppState.currentUser = DEMO_DATA.users['client-demo']; AppState.isAdmin = false; return { success: true };
    } else if (email === 'admin@sidequest.nz' && password === 'admin123') {
        AppState.currentUser = DEMO_DATA.users['admin-demo']; AppState.isAdmin = true; return { success: true };
    }
    return { success: false, error: 'Invalid credentials. Try demo@client.com / demo123 or admin@sidequest.nz / admin123' };
}

function checkAuth() {
    const session = localStorage.getItem('portal_session');
    if (session) {
        const { uid } = JSON.parse(session);
        AppState.currentUser = DEMO_DATA.users[uid];
        AppState.isAdmin = AppState.currentUser?.role === 'admin';
        return !!AppState.currentUser;
    }
    return false;
}

function logout() { localStorage.removeItem('portal_session'); window.location.href = 'login.html'; }

// Data Loading
function loadProjects() {
    AppState.projects = AppState.isAdmin ? DEMO_DATA.projects : DEMO_DATA.projects.filter(p => p.clientId === AppState.currentUser?.uid);
}
function loadFiles(pid) { AppState.files = DEMO_DATA.files.filter(f => f.projectId === pid); }
function loadMessages(pid) { AppState.messages = DEMO_DATA.messages.filter(m => m.projectId === pid); }
function loadInvoices() { AppState.invoices = AppState.isAdmin ? DEMO_DATA.invoices : DEMO_DATA.invoices.filter(i => i.clientId === AppState.currentUser?.uid); }
function loadActivity() { AppState.activity = DEMO_DATA.activity; }
function loadClients() { AppState.clients = DEMO_DATA.clients; }

// Rendering
function renderProjects(id, projects) {
    const c = document.getElementById(id); if (!c) return;
    if (!projects.length) { c.innerHTML = '<div class="empty-state"><h3>No projects yet</h3></div>'; return; }
    c.innerHTML = projects.map(p => `
        <div class="project-card" onclick="location.href='project.html?id=${p.id}'">
            <div class="project-header"><div><h3 class="project-title">${p.name}</h3><p class="project-client">${AppState.isAdmin ? p.clientCompany : p.type}</p></div><span class="project-status ${p.status}">${p.status}</span></div>
            <div class="project-progress"><div class="progress-header"><span class="progress-label">Progress</span><span class="progress-value">${p.progress}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${p.progress}%"></div></div></div>
            <div class="project-meta"><span class="project-phase">Phase: <strong>${p.phase}</strong></span><span class="project-due">Due: ${formatDate(p.dueDate)}</span></div>
        </div>`).join('');
}

function renderFiles(id, files) {
    const c = document.getElementById(id); if (!c) return;
    const icons = { pdf: 'file-text', image: 'image', other: 'file' };
    c.innerHTML = files.length ? `<div class="file-list">${files.map(f => `
        <div class="file-item"><div class="file-icon ${f.type}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="file-info"><div class="file-name">${f.name}</div><div class="file-meta">${f.size} • ${f.uploadedBy} • ${timeAgo(f.uploadedAt)}</div></div>
        <button class="btn btn-ghost btn-sm">Download</button></div>`).join('')}</div>` : '<div class="empty-state"><h3>No files yet</h3></div>';
}

function renderMessages(id, messages) {
    const c = document.getElementById(id); if (!c) return;
    c.innerHTML = `<div class="message-list">${messages.map(m => `
        <div class="message-item ${m.senderId === AppState.currentUser?.uid ? 'sent' : ''}">
            <div class="message-avatar">${getInitials(m.senderName)}</div>
            <div class="message-bubble"><div class="message-sender">${m.senderName}</div><div class="message-text">${m.text}</div><div class="message-time">${timeAgo(m.timestamp)}</div></div>
        </div>`).join('')}</div>`;
    c.scrollTop = c.scrollHeight;
}

function renderInvoices(id, invoices) {
    const c = document.getElementById(id); if (!c) return;
    c.innerHTML = `<table class="table"><thead><tr><th>Invoice</th><th>Description</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>${invoices.map(i => `<tr><td><strong>${i.number}</strong></td><td>${i.description}</td><td>${formatCurrency(i.amount)}</td><td>${formatDate(i.dueDate)}</td><td><span class="badge badge-${i.status === 'paid' ? 'success' : 'warning'}">${i.status}</span></td></tr>`).join('')}</tbody></table>`;
}

function renderClients(id, clients) {
    const c = document.getElementById(id); if (!c) return;
    c.innerHTML = `<table class="table"><thead><tr><th>Client</th><th>Company</th><th>Email</th><th>Projects</th><th>Status</th></tr></thead>
        <tbody>${clients.map(cl => `<tr><td><div class="flex items-center gap-md"><div class="user-avatar" style="width:32px;height:32px;font-size:0.7rem">${getInitials(cl.name)}</div><strong>${cl.name}</strong></div></td><td>${cl.company}</td><td>${cl.email}</td><td>${cl.projects}</td><td><span class="badge badge-success">${cl.status}</span></td></tr>`).join('')}</tbody></table>`;
}

function renderActivity(id) {
    const c = document.getElementById(id); if (!c) return;
    c.innerHTML = `<div class="activity-list">${AppState.activity.slice(0,8).map(a => `
        <div class="activity-item"><div class="activity-icon stat-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div>
        <div class="activity-content"><div class="activity-text">${a.text}</div><div class="activity-time">${timeAgo(a.timestamp)}</div></div></div>`).join('')}</div>`;
}

function renderStats() {
    const c = document.getElementById('stats-grid'); if (!c) return;
    const active = AppState.projects.filter(p => p.status === 'active').length;
    const pending = AppState.invoices.filter(i => i.status === 'pending').reduce((s,i) => s + i.amount, 0);
    const paid = AppState.invoices.filter(i => i.status === 'paid').reduce((s,i) => s + i.amount, 0);
    
    const stats = AppState.isAdmin ? [
        { label: 'Active Projects', value: active, color: 'purple' },
        { label: 'Total Clients', value: AppState.clients.length, color: 'blue' },
        { label: 'Pending Revenue', value: formatCurrency(pending), color: 'orange' },
        { label: 'Collected', value: formatCurrency(paid), color: 'green' }
    ] : [
        { label: 'Active Projects', value: active, color: 'purple' },
        { label: 'Completed', value: AppState.projects.filter(p => p.status === 'completed').length, color: 'green' },
        { label: 'Pending Invoices', value: AppState.invoices.filter(i => i.status === 'pending').length, color: 'orange' },
        { label: 'Messages', value: '3', color: 'blue' }
    ];
    
    c.innerHTML = stats.map(s => `<div class="stat-card"><div class="stat-icon ${s.color}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div class="stat-content"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div></div>`).join('');
}

function renderMilestones(id, milestones) {
    const c = document.getElementById(id); if (!c || !milestones) return;
    c.innerHTML = `<div class="timeline">${milestones.map(m => `
        <div class="timeline-item ${m.status}"><div class="timeline-dot"></div><div class="timeline-content"><h4>${m.title}</h4><p>${m.status === 'completed' ? 'Completed' : m.status === 'current' ? 'In Progress' : 'Upcoming'}</p><div class="timeline-date">${formatDate(m.date)}</div></div></div>`).join('')}</div>`;
}

function updateUserInfo() {
    const n = document.getElementById('user-name'), r = document.getElementById('user-role'), a = document.getElementById('user-avatar');
    if (n) n.textContent = AppState.currentUser?.displayName || 'User';
    if (r) r.textContent = AppState.isAdmin ? 'Administrator' : 'Client';
    if (a) a.textContent = getInitials(AppState.currentUser?.displayName || 'U');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = AppState.isAdmin ? '' : 'none');
}

// Event Handlers
function handleLogin(e) {
    e.preventDefault();
    const result = login(document.getElementById('email').value, document.getElementById('password').value);
    if (result.success) {
        localStorage.setItem('portal_session', JSON.stringify({ uid: AppState.currentUser.uid }));
        window.location.href = 'dashboard.html';
    } else {
        const err = document.getElementById('login-error');
        if (err) { err.textContent = result.error; err.style.display = 'block'; }
    }
}

function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('message-input');
    if (!input.value.trim()) return;
    AppState.messages.push({ id: 'msg-' + Date.now(), senderId: AppState.currentUser.uid, senderName: AppState.currentUser.displayName, text: input.value, timestamp: new Date().toISOString() });
    renderMessages('messages-container', AppState.messages);
    input.value = '';
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop() || 'index.html';
    
    if (page === 'login.html' || page === 'index.html') {
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        return;
    }
    
    if (!checkAuth()) { location.href = 'login.html'; return; }
    
    loadProjects(); loadInvoices(); loadActivity(); if (AppState.isAdmin) loadClients();
    updateUserInfo();
    
    if (page === 'dashboard.html') {
        renderStats();
        renderProjects('projects-grid', AppState.projects.filter(p => p.status !== 'completed').slice(0,4));
        renderActivity('activity-feed');
    } else if (page === 'project.html') {
        const pid = new URLSearchParams(location.search).get('id');
        AppState.currentProject = AppState.projects.find(p => p.id === pid);
        if (!AppState.currentProject) { location.href = 'dashboard.html'; return; }
        loadFiles(pid); loadMessages(pid);
        document.getElementById('project-name').textContent = AppState.currentProject.name;
        document.getElementById('project-phase').textContent = AppState.currentProject.phase;
        document.getElementById('project-progress').textContent = AppState.currentProject.progress + '%';
        document.querySelector('.progress-fill').style.width = AppState.currentProject.progress + '%';
        renderMilestones('milestones', AppState.currentProject.milestones);
        renderFiles('files-container', AppState.files);
        renderMessages('messages-container', AppState.messages);
        document.getElementById('message-form')?.addEventListener('submit', handleSendMessage);
    } else if (page === 'projects.html') {
        renderProjects('all-projects', AppState.projects);
    } else if (page === 'invoices.html') {
        renderInvoices('invoices-table', AppState.invoices);
    } else if (page === 'clients.html') {
        if (!AppState.isAdmin) { location.href = 'dashboard.html'; return; }
        renderClients('clients-table', AppState.clients);
    }
    
    document.getElementById('logout-btn')?.addEventListener('click', logout);
});
