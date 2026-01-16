/* ============================================
   SIDEQUEST DIGITAL - Loading States & Skeletons
   ============================================ */

import { setLoading as setStateLoading } from '../services/state.js';

/**
 * Loading overlay element
 */
let loadingOverlay = null;

/**
 * Get or create loading overlay
 * @returns {HTMLElement} Loading overlay
 */
function getLoadingOverlay() {
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
                <div class="spinner-ring"></div>
            </div>
            <div class="loading-text">Loading...</div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    return loadingOverlay;
}

/**
 * Show or hide loading overlay
 * @param {boolean} show - Show or hide
 * @param {string} text - Loading text (optional)
 */
export function showLoading(show = true, text = 'Loading...') {
    const overlay = getLoadingOverlay();
    overlay.style.display = show ? 'flex' : 'none';

    const textEl = overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = text;

    setStateLoading(show);
}

/**
 * Show loading overlay with promise
 * @param {Promise} promise - Promise to wait for
 * @param {string} text - Loading text
 * @returns {Promise} Original promise
 */
export async function withLoading(promise, text = 'Loading...') {
    showLoading(true, text);
    try {
        return await promise;
    } finally {
        showLoading(false);
    }
}

/**
 * Create a skeleton element
 * @param {string} type - Skeleton type
 * @param {Object} options - Options
 * @returns {HTMLElement} Skeleton element
 */
export function createSkeleton(type = 'text', options = {}) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${type}`;

    const { width, height, count = 1 } = options;

    if (width) skeleton.style.width = width;
    if (height) skeleton.style.height = height;

    if (count > 1) {
        const container = document.createElement('div');
        container.className = 'skeleton-group';
        for (let i = 0; i < count; i++) {
            const clone = skeleton.cloneNode(true);
            container.appendChild(clone);
        }
        return container;
    }

    return skeleton;
}

/**
 * Create card skeleton
 * @param {number} count - Number of skeletons
 * @returns {string} HTML string
 */
export function createCardSkeletons(count = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="item-card skeleton-card">
                <div class="skeleton skeleton-image"></div>
                <div class="item-card-body">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-badge"></div>
                    <div class="skeleton-row">
                        <div class="skeleton skeleton-tag"></div>
                        <div class="skeleton skeleton-tag"></div>
                    </div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Create table skeleton
 * @param {number} rows - Number of rows
 * @param {number} cols - Number of columns
 * @returns {string} HTML string
 */
export function createTableSkeleton(rows = 5, cols = 4) {
    let html = '<table class="table skeleton-table"><tbody>';
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            html += `<td><div class="skeleton skeleton-text"></div></td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

/**
 * Create ticket skeleton
 * @param {number} count - Number of skeletons
 * @returns {string} HTML string
 */
export function createTicketSkeletons(count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="ticket-row skeleton-ticket">
                <div class="skeleton skeleton-priority"></div>
                <div class="ticket-info">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text" style="width: 60%"></div>
                </div>
                <div class="skeleton-row">
                    <div class="skeleton skeleton-badge"></div>
                    <div class="skeleton skeleton-badge"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Create stats skeleton
 * @param {number} count - Number of stat cards
 * @returns {string} HTML string
 */
export function createStatSkeletons(count = 4) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="stat-card skeleton-stat">
                <div class="skeleton skeleton-icon"></div>
                <div class="stat-content">
                    <div class="skeleton skeleton-text" style="width: 80px"></div>
                    <div class="skeleton skeleton-number"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Create detail page skeleton
 * @returns {string} HTML string
 */
export function createDetailSkeleton() {
    return `
        <div class="detail-header skeleton-detail">
            <div class="skeleton skeleton-logo-large"></div>
            <div class="detail-info">
                <div class="skeleton skeleton-title-large"></div>
                <div class="skeleton skeleton-text"></div>
                <div class="skeleton-row">
                    <div class="skeleton skeleton-badge"></div>
                    <div class="skeleton skeleton-badge"></div>
                </div>
            </div>
        </div>
        <div class="info-grid">
            ${Array(6).fill('<div class="info-item"><div class="skeleton skeleton-label"></div><div class="skeleton skeleton-text"></div></div>').join('')}
        </div>
    `;
}

/**
 * Create message skeleton
 * @param {number} count - Number of messages
 * @returns {string} HTML string
 */
export function createMessageSkeletons(count = 5) {
    let html = '';
    for (let i = 0; i < count; i++) {
        const sent = i % 3 === 0;
        html += `
            <div class="message skeleton-message ${sent ? 'sent' : ''}">
                <div class="skeleton skeleton-avatar"></div>
                <div class="message-bubble">
                    <div class="skeleton skeleton-text" style="width: 60px"></div>
                    <div class="skeleton skeleton-text" style="width: ${80 + Math.random() * 100}px"></div>
                    <div class="skeleton skeleton-text" style="width: 40px"></div>
                </div>
            </div>
        `;
    }
    return html;
}

/**
 * Show skeleton in container
 * @param {string|HTMLElement} container - Container ID or element
 * @param {string} type - Skeleton type
 * @param {Object} options - Options
 */
export function showSkeleton(container, type = 'cards', options = {}) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const { count = 4 } = options;

    let skeleton = '';
    switch (type) {
        case 'cards':
            skeleton = createCardSkeletons(count);
            break;
        case 'table':
            skeleton = createTableSkeleton(options.rows || 5, options.cols || 4);
            break;
        case 'tickets':
            skeleton = createTicketSkeletons(count);
            break;
        case 'stats':
            skeleton = createStatSkeletons(count);
            break;
        case 'detail':
            skeleton = createDetailSkeleton();
            break;
        case 'messages':
            skeleton = createMessageSkeletons(count);
            break;
        default:
            skeleton = `<div class="skeleton skeleton-text"></div>`;
    }

    el.innerHTML = skeleton;
}

/**
 * Button loading state
 * @param {HTMLButtonElement} button - Button element
 * @param {boolean} loading - Loading state
 */
export function setButtonLoading(button, loading = true) {
    if (!button) return;

    if (loading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = `
            <span class="btn-spinner"></span>
            <span class="btn-loading-text">Loading...</span>
        `;
        button.classList.add('btn-loading');
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || 'Submit';
        button.classList.remove('btn-loading');
    }
}

/**
 * Inline loading indicator
 * @param {string} text - Loading text
 * @returns {string} HTML string
 */
export function inlineLoader(text = 'Loading') {
    return `
        <div class="inline-loader">
            <span class="inline-spinner"></span>
            <span>${text}</span>
        </div>
    `;
}

/**
 * Progress bar component
 * @param {number} progress - Progress percentage (0-100)
 * @param {Object} options - Options
 * @returns {string} HTML string
 */
export function progressBar(progress = 0, options = {}) {
    const { showLabel = true, label = '', animated = true } = options;
    const percentage = Math.min(100, Math.max(0, progress));

    return `
        <div class="progress-wrapper">
            ${showLabel ? `
                <div class="progress-header">
                    <span class="progress-label">${label || 'Progress'}</span>
                    <span class="progress-value">${percentage}%</span>
                </div>
            ` : ''}
            <div class="progress-bar">
                <div class="progress-fill ${animated ? 'animated' : ''}" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

/**
 * File upload progress
 * @param {string} filename - File name
 * @param {number} progress - Progress percentage
 * @param {string} status - Status (uploading, complete, error)
 * @returns {string} HTML string
 */
export function fileUploadProgress(filename, progress = 0, status = 'uploading') {
    const statusIcons = {
        uploading: '<span class="inline-spinner"></span>',
        complete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
    };

    return `
        <div class="file-upload-progress ${status}">
            <div class="file-upload-info">
                <span class="file-upload-name">${filename}</span>
                <span class="file-upload-status">${statusIcons[status] || ''}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
        </div>
    `;
}

// Inject loading styles
const styles = `
/* Loading Overlay */
.loading-overlay {
    position: fixed;
    inset: 0;
    background: rgba(18, 19, 26, 0.9);
    z-index: 10000;
    display: none;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
}

.loading-spinner {
    position: relative;
    width: 60px;
    height: 60px;
}

.spinner-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid transparent;
    animation: spinnerRotate 1.5s linear infinite;
}

.spinner-ring:nth-child(1) {
    border-top-color: var(--color-primary);
    animation-delay: 0s;
}

.spinner-ring:nth-child(2) {
    border-right-color: #f97316;
    animation-delay: 0.15s;
    width: 80%;
    height: 80%;
    top: 10%;
    left: 10%;
}

.spinner-ring:nth-child(3) {
    border-bottom-color: var(--color-success);
    animation-delay: 0.3s;
    width: 60%;
    height: 60%;
    top: 20%;
    left: 20%;
}

@keyframes spinnerRotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.loading-text {
    font-size: 14px;
    color: var(--color-text-secondary);
}

/* Skeletons */
.skeleton {
    background: linear-gradient(90deg, var(--color-bg-tertiary) 25%, var(--color-bg-hover) 50%, var(--color-bg-tertiary) 75%);
    background-size: 200% 100%;
    animation: skeletonShimmer 1.5s infinite;
    border-radius: var(--radius-sm);
}

@keyframes skeletonShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.skeleton-text {
    height: 14px;
    margin-bottom: 8px;
}

.skeleton-title {
    height: 18px;
    width: 70%;
    margin-bottom: 8px;
}

.skeleton-title-large {
    height: 28px;
    width: 50%;
    margin-bottom: 12px;
}

.skeleton-image {
    width: 100%;
    height: 140px;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.skeleton-badge {
    height: 24px;
    width: 80px;
    border-radius: var(--radius-full);
}

.skeleton-tag {
    height: 24px;
    width: 60px;
    border-radius: var(--radius-full);
}

.skeleton-icon {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
}

.skeleton-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
}

.skeleton-logo-large {
    width: 120px;
    height: 120px;
    border-radius: var(--radius-lg);
}

.skeleton-number {
    height: 32px;
    width: 60px;
}

.skeleton-priority {
    width: 4px;
    height: 40px;
    border-radius: 2px;
}

.skeleton-label {
    height: 10px;
    width: 60px;
    margin-bottom: 4px;
}

.skeleton-row {
    display: flex;
    gap: 8px;
}

.skeleton-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.skeleton-card {
    pointer-events: none;
}

/* Button Loading */
.btn-loading {
    pointer-events: none;
    opacity: 0.8;
}

.btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spinnerRotate 0.8s linear infinite;
    display: inline-block;
}

.btn-loading-text {
    margin-left: 8px;
}

/* Inline Loader */
.inline-loader {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-muted);
    font-size: 14px;
}

.inline-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spinnerRotate 0.8s linear infinite;
    display: inline-block;
}

/* Progress */
.progress-wrapper {
    width: 100%;
}

.progress-fill.animated {
    transition: width 0.3s ease;
}

/* File Upload Progress */
.file-upload-progress {
    padding: 12px;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-md);
    margin-bottom: 8px;
}

.file-upload-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.file-upload-name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-upload-status {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.file-upload-status svg {
    width: 16px;
    height: 16px;
}

.file-upload-progress.complete .file-upload-status {
    color: var(--color-success);
}

.file-upload-progress.error .file-upload-status {
    color: var(--color-error);
}

.file-upload-progress.error .progress-fill {
    background: var(--color-error);
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
}
