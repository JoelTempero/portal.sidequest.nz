/* ============================================
   SIDEQUEST DIGITAL - Constants & Configuration
   ============================================ */

// Firebase Configuration
export const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCHBw5_1925Bno5CHVEMUpdBgqQR_UHbAk",
    authDomain: "sidequest-digital.firebaseapp.com",
    projectId: "sidequest-digital",
    storageBucket: "sidequest-digital.firebasestorage.app",
    messagingSenderId: "576711179044",
    appId: "1:576711179044:web:bef810a231f00c0b9c11b1"
};

// Tier Configuration
export const TIERS = {
    WATCHFUL_EYE: 'watchfuleye',
    FARMER: 'farmer',
    BUG_CATCHER: 'bugcatcher',
    HOST: 'host'
};

export const TIER_NAMES = {
    [TIERS.WATCHFUL_EYE]: 'Watchful Eye',
    [TIERS.FARMER]: 'Farmer',
    [TIERS.BUG_CATCHER]: 'Bug Catcher',
    [TIERS.HOST]: 'Host'
};

export const TIER_ORDER = {
    [TIERS.WATCHFUL_EYE]: 0,
    [TIERS.FARMER]: 1,
    [TIERS.BUG_CATCHER]: 2,
    [TIERS.HOST]: 3
};

// Legacy tier mapping for backwards compatibility
export const LEGACY_TIER_MAP = {
    premium: TIERS.WATCHFUL_EYE,
    enterprise: TIERS.WATCHFUL_EYE,
    professional: TIERS.FARMER,
    growth: TIERS.FARMER,
    starter: TIERS.BUG_CATCHER,
    basic: TIERS.HOST
};

// Lead Status Configuration
export const LEAD_STATUSES = {
    NOTED: 'noted',
    DEMO_SENT: 'demo-sent',
    DEMO_COMPLETE: 'demo-complete'
};

export const LEAD_STATUS_LABELS = {
    [LEAD_STATUSES.NOTED]: 'Noted',
    [LEAD_STATUSES.DEMO_SENT]: 'Demo Sent',
    [LEAD_STATUSES.DEMO_COMPLETE]: 'Demo Complete'
};

// Project Status Configuration
export const PROJECT_STATUSES = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed'
};

export const PROJECT_STATUS_LABELS = {
    [PROJECT_STATUSES.ACTIVE]: 'Active',
    [PROJECT_STATUSES.PAUSED]: 'Paused',
    [PROJECT_STATUSES.COMPLETED]: 'Completed'
};

// Ticket Status Configuration
export const TICKET_STATUSES = {
    OPEN: 'open',
    IN_PROGRESS: 'in-progress',
    RESOLVED: 'resolved'
};

export const TICKET_STATUS_LABELS = {
    [TICKET_STATUSES.OPEN]: 'Open',
    [TICKET_STATUSES.IN_PROGRESS]: 'In Progress',
    [TICKET_STATUSES.RESOLVED]: 'Resolved'
};

// Ticket Urgency Configuration
export const TICKET_URGENCIES = {
    ASAP: 'asap',
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month'
};

export const TICKET_URGENCY_LABELS = {
    [TICKET_URGENCIES.ASAP]: 'ASAP',
    [TICKET_URGENCIES.DAY]: 'Within a Day',
    [TICKET_URGENCIES.WEEK]: 'Within a Week',
    [TICKET_URGENCIES.MONTH]: 'Within a Month'
};

// Milestone Status Configuration
export const MILESTONE_STATUSES = {
    PENDING: 'pending',
    CURRENT: 'current',
    COMPLETED: 'completed'
};

export const MILESTONE_STATUS_LABELS = {
    [MILESTONE_STATUSES.PENDING]: 'Upcoming',
    [MILESTONE_STATUSES.CURRENT]: 'In Progress',
    [MILESTONE_STATUSES.COMPLETED]: 'Completed'
};

// Invoice Status Configuration
export const INVOICE_STATUSES = {
    PENDING: 'pending',
    PAID: 'paid',
    OVERDUE: 'overdue'
};

export const INVOICE_STATUS_LABELS = {
    [INVOICE_STATUSES.PENDING]: 'Pending',
    [INVOICE_STATUSES.PAID]: 'Paid',
    [INVOICE_STATUSES.OVERDUE]: 'Overdue'
};

// User Roles
export const USER_ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    SUPPORT: 'support',
    CLIENT: 'client'
};

export const USER_ROLE_LABELS = {
    [USER_ROLES.ADMIN]: 'Administrator',
    [USER_ROLES.MANAGER]: 'Project Manager',
    [USER_ROLES.SUPPORT]: 'Support Agent',
    [USER_ROLES.CLIENT]: 'Client'
};

// Role Permissions
export const ROLE_PERMISSIONS = {
    [USER_ROLES.ADMIN]: ['*'],  // All permissions
    [USER_ROLES.MANAGER]: ['leads', 'projects', 'tickets', 'clients', 'messages', 'posts'],
    [USER_ROLES.SUPPORT]: ['tickets', 'messages'],
    [USER_ROLES.CLIENT]: ['view_projects', 'tickets', 'messages']
};

// File Upload Configuration
export const FILE_CONFIG = {
    MAX_SIZE_MB: 10,
    MAX_SIZE_BYTES: 10 * 1024 * 1024,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// Pagination Configuration
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 20,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
};

// Cache Configuration
export const CACHE_CONFIG = {
    TTL_MS: 5 * 60 * 1000, // 5 minutes
    STALE_WHILE_REVALIDATE_MS: 60 * 1000 // 1 minute
};

// Toast Configuration
export const TOAST_CONFIG = {
    DURATION_MS: 3000,
    TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    }
};

// Date Format Configuration
export const DATE_CONFIG = {
    LOCALE: 'en-NZ',
    SHORT_OPTIONS: { month: 'short', day: 'numeric', year: 'numeric' },
    LONG_OPTIONS: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    TIME_OPTIONS: { hour: '2-digit', minute: '2-digit' }
};

// Currency Configuration
export const CURRENCY_CONFIG = {
    LOCALE: 'en-NZ',
    CURRENCY: 'NZD',
    OPTIONS: { style: 'currency', currency: 'NZD' }
};

// Location Options (NZ Cities)
export const LOCATIONS = [
    'Auckland',
    'Wellington',
    'Christchurch',
    'Hamilton',
    'Tauranga',
    'Dunedin',
    'Palmerston North',
    'Napier-Hastings',
    'Nelson',
    'Rotorua',
    'New Plymouth',
    'Whangarei',
    'Invercargill',
    'Whanganui',
    'Gisborne',
    'Other'
];

// Business Type Options
export const BUSINESS_TYPES = [
    'Education',
    'Healthcare',
    'Legal',
    'Hospitality',
    'Retail',
    'Professional Services',
    'Trades',
    'Sports',
    'Technology',
    'Real Estate',
    'Finance',
    'Non-Profit',
    'Government',
    'Manufacturing',
    'Other'
];

// Activity Log Types
export const ACTIVITY_TYPES = {
    LEAD_CREATED: 'lead_created',
    LEAD_UPDATED: 'lead_updated',
    LEAD_ARCHIVED: 'lead_archived',
    PROJECT_CREATED: 'project_created',
    PROJECT_UPDATED: 'project_updated',
    PROJECT_ARCHIVED: 'project_archived',
    TICKET_CREATED: 'ticket_created',
    TICKET_UPDATED: 'ticket_updated',
    TICKET_RESOLVED: 'ticket_resolved',
    MESSAGE_SENT: 'message_sent',
    INVOICE_CREATED: 'invoice_created',
    INVOICE_PAID: 'invoice_paid',
    MILESTONE_COMPLETED: 'milestone_completed',
    CLIENT_CREATED: 'client_created',
    FILE_UPLOADED: 'file_uploaded',
    POST_PUBLISHED: 'post_published'
};

// Collection Names (Firestore)
export const COLLECTIONS = {
    USERS: 'users',
    LEADS: 'leads',
    PROJECTS: 'projects',
    TICKETS: 'tickets',
    MESSAGES: 'messages',
    POSTS: 'posts',
    ARCHIVED: 'archived',
    ACTIVITY: 'activity',
    NOTIFICATIONS: 'notifications'
};

// Storage Paths
export const STORAGE_PATHS = {
    LOGOS: 'logos',
    AVATARS: 'avatars',
    POSTS: 'posts',
    FILES: 'files'
};

// API Endpoints (for future use)
export const API_ENDPOINTS = {
    CREATE_CLIENT: 'createClient',
    SEND_EMAIL: 'sendEmail',
    PROCESS_PAYMENT: 'processPayment'
};

// Feature Flags
export const FEATURES = {
    OFFLINE_MODE: true,
    REAL_TIME_PRESENCE: true,
    EMAIL_NOTIFICATIONS: false, // Enable when email service is configured
    PAYMENT_INTEGRATION: false, // Enable when Stripe is configured
    DARK_LIGHT_TOGGLE: true,
    ACTIVITY_LOG: true
};

// Get all status labels combined
export function getStatusLabel(status) {
    return LEAD_STATUS_LABELS[status] ||
           PROJECT_STATUS_LABELS[status] ||
           TICKET_STATUS_LABELS[status] ||
           MILESTONE_STATUS_LABELS[status] ||
           INVOICE_STATUS_LABELS[status] ||
           status;
}

// Get tier name with legacy support
export function getTierName(tier) {
    const mapped = LEGACY_TIER_MAP[tier] || tier;
    return TIER_NAMES[mapped] || tier;
}

// Get tier order for sorting
export function getTierOrder(tier) {
    const mapped = LEGACY_TIER_MAP[tier] || tier;
    return TIER_ORDER[mapped] ?? 4;
}
