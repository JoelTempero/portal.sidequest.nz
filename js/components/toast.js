/* ============================================
   SIDEQUEST DIGITAL - Toast Notifications
   ============================================ */

import { TOAST_CONFIG } from '../config/constants.js';
import { escapeHtml } from '../utils/sanitize.js';

/**
 * Toast container element
 */
let toastContainer = null;

/**
 * Toast queue for stacking
 */
const toastQueue = [];

/**
 * Max visible toasts
 */
const MAX_VISIBLE_TOASTS = 5;

/**
 * Get or create toast container
 * @returns {HTMLElement} Toast container
 */
function getToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

/**
 * Get icon for toast type
 * @param {string} type - Toast type
 * @returns {string} SVG icon HTML
 */
function getToastIcon(type) {
    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>`
    };
    return icons[type] || icons.info;
}

/**
 * Create a toast element
 * @param {string} message - Toast message
 * @param {string} type - Toast type
 * @param {Object} options - Toast options
 * @returns {HTMLElement} Toast element
 */
function createToastElement(message, type, options) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    toast.innerHTML = `
        <div class="toast-icon">${getToastIcon(type)}</div>
        <div class="toast-content">
            <div class="toast-message">${escapeHtml(message)}</div>
            ${options.description ? `<div class="toast-description">${escapeHtml(options.description)}</div>` : ''}
        </div>
        ${options.dismissible !== false ? `
            <button class="toast-close" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        ` : ''}
        <div class="toast-progress">
            <div class="toast-progress-bar"></div>
        </div>
    `;

    return toast;
}

/**
 * Remove a toast
 * @param {HTMLElement} toast - Toast element
 */
function removeToast(toast) {
    toast.classList.add('toast-exit');

    toast.addEventListener('animationend', () => {
        toast.remove();

        // Remove from queue
        const index = toastQueue.indexOf(toast);
        if (index > -1) {
            toastQueue.splice(index, 1);
        }
    }, { once: true });
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {Object} options - Additional options
 * @returns {Object} Toast control object
 */
export function showToast(message, type = 'info', options = {}) {
    const {
        duration = TOAST_CONFIG.DURATION_MS,
        description = null,
        dismissible = true,
        onClose = null,
        action = null
    } = options;

    const container = getToastContainer();

    // Remove oldest toasts if too many
    while (toastQueue.length >= MAX_VISIBLE_TOASTS) {
        const oldest = toastQueue.shift();
        removeToast(oldest);
    }

    // Create toast
    const toast = createToastElement(message, type, { description, dismissible });
    toastQueue.push(toast);

    // Add action button if provided
    if (action) {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'toast-action';
        actionBtn.textContent = action.label;
        actionBtn.addEventListener('click', () => {
            action.onClick();
            removeToast(toast);
        });
        toast.querySelector('.toast-content').appendChild(actionBtn);
    }

    // Add close handler
    if (dismissible) {
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', () => {
            removeToast(toast);
            if (onClose) onClose();
        });
    }

    // Add to container
    container.appendChild(toast);

    // Animate progress bar
    const progressBar = toast.querySelector('.toast-progress-bar');
    if (progressBar && duration > 0) {
        progressBar.style.animationDuration = `${duration}ms`;
    }

    // Auto-remove after duration
    let timeoutId = null;
    if (duration > 0) {
        timeoutId = setTimeout(() => {
            removeToast(toast);
            if (onClose) onClose();
        }, duration);
    }

    // Pause on hover
    toast.addEventListener('mouseenter', () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            progressBar?.classList.add('paused');
        }
    });

    toast.addEventListener('mouseleave', () => {
        if (duration > 0) {
            timeoutId = setTimeout(() => {
                removeToast(toast);
                if (onClose) onClose();
            }, 1000);
            progressBar?.classList.remove('paused');
        }
    });

    // Return control object
    return {
        dismiss: () => {
            if (timeoutId) clearTimeout(timeoutId);
            removeToast(toast);
        },
        update: (newMessage) => {
            const msgEl = toast.querySelector('.toast-message');
            if (msgEl) msgEl.textContent = newMessage;
        }
    };
}

/**
 * Show success toast
 * @param {string} message - Toast message
 * @param {Object} options - Additional options
 * @returns {Object} Toast control object
 */
export function showSuccess(message, options = {}) {
    return showToast(message, TOAST_CONFIG.TYPES.SUCCESS, options);
}

/**
 * Show error toast
 * @param {string} message - Toast message
 * @param {Object} options - Additional options
 * @returns {Object} Toast control object
 */
export function showError(message, options = {}) {
    return showToast(message, TOAST_CONFIG.TYPES.ERROR, {
        ...options,
        duration: options.duration || 5000 // Longer duration for errors
    });
}

/**
 * Show warning toast
 * @param {string} message - Toast message
 * @param {Object} options - Additional options
 * @returns {Object} Toast control object
 */
export function showWarning(message, options = {}) {
    return showToast(message, TOAST_CONFIG.TYPES.WARNING, options);
}

/**
 * Show info toast
 * @param {string} message - Toast message
 * @param {Object} options - Additional options
 * @returns {Object} Toast control object
 */
export function showInfo(message, options = {}) {
    return showToast(message, TOAST_CONFIG.TYPES.INFO, options);
}

/**
 * Clear all toasts
 */
export function clearAllToasts() {
    [...toastQueue].forEach(toast => removeToast(toast));
}

/**
 * Show a loading toast that can be updated
 * @param {string} message - Initial message
 * @returns {Object} Toast control with loading-specific methods
 */
export function showLoadingToast(message) {
    const toast = showToast(message, 'info', {
        duration: 0,
        dismissible: false
    });

    return {
        ...toast,
        success: (successMessage) => {
            toast.dismiss();
            showSuccess(successMessage);
        },
        error: (errorMessage) => {
            toast.dismiss();
            showError(errorMessage);
        }
    };
}

/**
 * Show a confirmation toast with action
 * @param {string} message - Confirmation message
 * @param {Object} options - Options
 * @returns {Promise<boolean>} True if confirmed
 */
export function showConfirmToast(message, options = {}) {
    return new Promise((resolve) => {
        const {
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel'
        } = options;

        const toast = showToast(message, 'warning', {
            duration: 0,
            dismissible: false,
            action: {
                label: confirmLabel,
                onClick: () => resolve(true)
            }
        });

        // Add cancel button
        const content = document.querySelector('.toast-content');
        if (content) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'toast-action toast-action-secondary';
            cancelBtn.textContent = cancelLabel;
            cancelBtn.addEventListener('click', () => {
                toast.dismiss();
                resolve(false);
            });
            content.appendChild(cancelBtn);
        }
    });
}

// Add styles dynamically
const styles = `
.toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 8px;
    max-width: 400px;
    width: 100%;
    pointer-events: none;
}

.toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border-subtle);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    pointer-events: auto;
    animation: toastEnter 0.3s ease-out;
    position: relative;
    overflow: hidden;
}

.toast-exit {
    animation: toastExit 0.2s ease-in forwards;
}

@keyframes toastEnter {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes toastExit {
    from {
        opacity: 1;
        transform: translateX(0);
    }
    to {
        opacity: 0;
        transform: translateX(100%);
    }
}

.toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
}

.toast-icon svg {
    width: 100%;
    height: 100%;
}

.toast-success .toast-icon { color: var(--color-success); }
.toast-error .toast-icon { color: var(--color-error); }
.toast-warning .toast-icon { color: var(--color-warning); }
.toast-info .toast-icon { color: var(--color-info); }

.toast-content {
    flex: 1;
    min-width: 0;
}

.toast-message {
    font-weight: 500;
    font-size: 14px;
    line-height: 1.4;
}

.toast-description {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-top: 4px;
}

.toast-close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s;
}

.toast-close:hover {
    color: var(--color-text-primary);
}

.toast-close svg {
    width: 100%;
    height: 100%;
}

.toast-action {
    margin-top: 8px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    border-radius: 6px;
    background: var(--color-primary);
    color: white;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
}

.toast-action:hover {
    background: var(--color-primary-hover);
}

.toast-action-secondary {
    background: transparent;
    color: var(--color-text-secondary);
    margin-left: 8px;
}

.toast-action-secondary:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}

.toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-border-subtle);
}

.toast-progress-bar {
    height: 100%;
    background: var(--color-primary);
    animation: progressShrink linear forwards;
}

.toast-progress-bar.paused {
    animation-play-state: paused;
}

@keyframes progressShrink {
    from { width: 100%; }
    to { width: 0%; }
}

.toast-success .toast-progress-bar { background: var(--color-success); }
.toast-error .toast-progress-bar { background: var(--color-error); }
.toast-warning .toast-progress-bar { background: var(--color-warning); }

@media (max-width: 480px) {
    .toast-container {
        bottom: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
    }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
}
