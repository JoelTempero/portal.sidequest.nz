/* ============================================
   SIDEQUEST DIGITAL - Modal Component
   ============================================ */

import { escapeHtml } from '../utils/sanitize.js';

/**
 * Active modal stack
 */
const modalStack = [];

/**
 * Open a modal by ID
 * @param {string} modalId - Modal element ID
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('active');
    modalStack.push(modalId);

    // Focus first focusable element
    const focusable = modal.querySelector('input, select, textarea, button:not(.modal-close)');
    if (focusable) {
        setTimeout(() => focusable.focus(), 100);
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

/**
 * Close a modal by ID
 * @param {string} modalId - Modal element ID
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('active');

    // Remove from stack
    const index = modalStack.indexOf(modalId);
    if (index > -1) {
        modalStack.splice(index, 1);
    }

    // Restore body scroll if no modals open
    if (modalStack.length === 0) {
        document.body.style.overflow = '';
    }
}

/**
 * Close all open modals
 */
export function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        modal.classList.remove('active');
    });
    modalStack.length = 0;
    document.body.style.overflow = '';
}

/**
 * Close topmost modal
 */
export function closeTopModal() {
    if (modalStack.length > 0) {
        closeModal(modalStack[modalStack.length - 1]);
    }
}

/**
 * Create a modal dynamically
 * @param {Object} options - Modal options
 * @returns {Object} Modal control object
 */
export function createModal(options = {}) {
    const {
        id = 'dynamic-modal-' + Date.now(),
        title = '',
        content = '',
        footer = null,
        size = 'default',
        closeOnBackdrop = true,
        closeOnEscape = true,
        onClose = null
    } = options;

    // Create modal element
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = `modal-overlay ${size === 'large' ? 'modal-large' : ''}`;

    modal.innerHTML = `
        <div class="modal ${size === 'large' ? 'large' : ''}">
            <div class="modal-header">
                <h3 class="modal-title">${escapeHtml(title)}</h3>
                <button class="modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">${content}</div>
            ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
    `;

    // Add to document
    document.body.appendChild(modal);

    // Event handlers
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn?.addEventListener('click', () => close());

    if (closeOnBackdrop) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    }

    if (closeOnEscape) {
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                close();
            }
        };
        document.addEventListener('keydown', escapeHandler);
        modal._escapeHandler = escapeHandler;
    }

    // Control functions
    const open = () => {
        openModal(id);
    };

    const close = () => {
        closeModal(id);
        if (onClose) onClose();
    };

    const destroy = () => {
        close();
        if (modal._escapeHandler) {
            document.removeEventListener('keydown', modal._escapeHandler);
        }
        modal.remove();
    };

    const setContent = (html) => {
        const body = modal.querySelector('.modal-body');
        if (body) body.innerHTML = html;
    };

    const setTitle = (text) => {
        const titleEl = modal.querySelector('.modal-title');
        if (titleEl) titleEl.textContent = text;
    };

    return {
        id,
        element: modal,
        open,
        close,
        destroy,
        setContent,
        setTitle
    };
}

/**
 * Show a confirmation modal
 * @param {string} message - Confirmation message
 * @param {Object} options - Options
 * @returns {Promise<boolean>} True if confirmed
 */
export function showConfirmModal(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            confirmClass = 'btn-primary',
            destructive = false
        } = options;

        const modal = createModal({
            title,
            content: `<p class="confirm-message">${escapeHtml(message)}</p>`,
            footer: `
                <button class="btn btn-ghost" data-action="cancel">${cancelText}</button>
                <button class="btn ${destructive ? 'btn-danger' : confirmClass}" data-action="confirm">${confirmText}</button>
            `,
            closeOnBackdrop: false
        });

        const confirmBtn = modal.element.querySelector('[data-action="confirm"]');
        const cancelBtn = modal.element.querySelector('[data-action="cancel"]');

        confirmBtn?.addEventListener('click', () => {
            modal.destroy();
            resolve(true);
        });

        cancelBtn?.addEventListener('click', () => {
            modal.destroy();
            resolve(false);
        });

        modal.open();
    });
}

/**
 * Show an alert modal
 * @param {string} message - Alert message
 * @param {Object} options - Options
 * @returns {Promise} Resolves when closed
 */
export function showAlertModal(message, options = {}) {
    return new Promise((resolve) => {
        const { title = 'Alert', buttonText = 'OK' } = options;

        const modal = createModal({
            title,
            content: `<p>${escapeHtml(message)}</p>`,
            footer: `<button class="btn btn-primary">${buttonText}</button>`
        });

        const button = modal.element.querySelector('.modal-footer button');
        button?.addEventListener('click', () => {
            modal.destroy();
            resolve();
        });

        modal.open();
    });
}

/**
 * Show a prompt modal
 * @param {string} message - Prompt message
 * @param {Object} options - Options
 * @returns {Promise<string|null>} Input value or null if cancelled
 */
export function showPromptModal(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Input',
            placeholder = '',
            defaultValue = '',
            inputType = 'text',
            submitText = 'Submit',
            cancelText = 'Cancel'
        } = options;

        const inputId = 'prompt-input-' + Date.now();

        const modal = createModal({
            title,
            content: `
                <p style="margin-bottom: 16px;">${escapeHtml(message)}</p>
                <input type="${inputType}" id="${inputId}" class="form-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}">
            `,
            footer: `
                <button class="btn btn-ghost" data-action="cancel">${cancelText}</button>
                <button class="btn btn-primary" data-action="submit">${submitText}</button>
            `
        });

        const input = modal.element.querySelector(`#${inputId}`);
        const submitBtn = modal.element.querySelector('[data-action="submit"]');
        const cancelBtn = modal.element.querySelector('[data-action="cancel"]');

        const submit = () => {
            const value = input?.value || '';
            modal.destroy();
            resolve(value);
        };

        submitBtn?.addEventListener('click', submit);
        input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
        });

        cancelBtn?.addEventListener('click', () => {
            modal.destroy();
            resolve(null);
        });

        modal.open();
    });
}

/**
 * Initialize modal event handlers
 */
export function initModalHandlers() {
    // Close button handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // Backdrop click handlers
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTopModal();
        }
    });
}

// Expose to window for inline handlers
if (typeof window !== 'undefined') {
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.closeAllModals = closeAllModals;
}

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initModalHandlers);
    } else {
        initModalHandlers();
    }
}

// Additional modal styles
const styles = `
/* Modal Improvements */
.modal-overlay {
    backdrop-filter: blur(4px);
}

.modal {
    animation: modalEnter 0.2s ease-out;
}

@keyframes modalEnter {
    from {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.modal-overlay:not(.active) .modal {
    animation: modalExit 0.15s ease-in;
}

@keyframes modalExit {
    from {
        opacity: 1;
        transform: scale(1);
    }
    to {
        opacity: 0;
        transform: scale(0.95);
    }
}

.btn-danger {
    background: var(--color-error);
    color: white;
}

.btn-danger:hover {
    background: #dc2626;
}

/* Focus trap styles */
.modal:focus {
    outline: none;
}

.modal :focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
}
