/* ============================================
   SIDEQUEST DIGITAL - Input Validation
   ============================================ */

import { FILE_CONFIG } from '../config/constants.js';

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 */

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * URL validation regex (simple)
 */
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

/**
 * Phone validation regex (NZ format)
 */
const PHONE_REGEX = /^(\+64|0)?\s*[2-9]\d{1,3}[\s-]?\d{3}[\s-]?\d{3,4}$/;

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {ValidationResult}
 */
export function validateEmail(email) {
    const errors = [];

    if (!email || typeof email !== 'string') {
        errors.push('Email is required');
        return { valid: false, errors };
    }

    const trimmed = email.trim();

    if (trimmed.length === 0) {
        errors.push('Email is required');
    } else if (trimmed.length > 254) {
        errors.push('Email is too long');
    } else if (!EMAIL_REGEX.test(trimmed)) {
        errors.push('Please enter a valid email address');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validatePassword(password, options = {}) {
    const {
        minLength = 6,
        maxLength = 128,
        requireUppercase = false,
        requireLowercase = false,
        requireNumber = false,
        requireSpecial = false
    } = options;

    const errors = [];

    if (!password || typeof password !== 'string') {
        errors.push('Password is required');
        return { valid: false, errors };
    }

    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters`);
    }

    if (password.length > maxLength) {
        errors.push(`Password must be less than ${maxLength} characters`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (requireNumber && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate required field
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @returns {ValidationResult}
 */
export function validateRequired(value, fieldName = 'This field') {
    const errors = [];

    if (value === null || value === undefined) {
        errors.push(`${fieldName} is required`);
    } else if (typeof value === 'string' && value.trim() === '') {
        errors.push(`${fieldName} is required`);
    } else if (Array.isArray(value) && value.length === 0) {
        errors.push(`${fieldName} is required`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate string length
 * @param {string} value - String to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateLength(value, options = {}) {
    const { min = 0, max = Infinity, fieldName = 'This field' } = options;
    const errors = [];

    if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
        return { valid: false, errors };
    }

    const length = value.trim().length;

    if (length < min) {
        errors.push(`${fieldName} must be at least ${min} characters`);
    }

    if (length > max) {
        errors.push(`${fieldName} must be less than ${max} characters`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @param {boolean} required - Whether the field is required
 * @returns {ValidationResult}
 */
export function validateUrl(url, required = false) {
    const errors = [];

    if (!url || typeof url !== 'string' || url.trim() === '') {
        if (required) {
            errors.push('URL is required');
        }
        return { valid: !required, errors };
    }

    const trimmed = url.trim();

    if (!URL_REGEX.test(trimmed)) {
        errors.push('Please enter a valid URL');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate phone number (NZ format)
 * @param {string} phone - Phone number to validate
 * @param {boolean} required - Whether the field is required
 * @returns {ValidationResult}
 */
export function validatePhone(phone, required = false) {
    const errors = [];

    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
        if (required) {
            errors.push('Phone number is required');
        }
        return { valid: !required, errors };
    }

    const trimmed = phone.trim();

    if (!PHONE_REGEX.test(trimmed)) {
        errors.push('Please enter a valid phone number');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate number
 * @param {*} value - Value to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateNumber(value, options = {}) {
    const { min, max, integer = false, fieldName = 'This field' } = options;
    const errors = [];

    const num = Number(value);

    if (isNaN(num)) {
        errors.push(`${fieldName} must be a valid number`);
        return { valid: false, errors };
    }

    if (integer && !Number.isInteger(num)) {
        errors.push(`${fieldName} must be a whole number`);
    }

    if (min !== undefined && num < min) {
        errors.push(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && num > max) {
        errors.push(`${fieldName} must be no more than ${max}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate file upload
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateFile(file, options = {}) {
    const {
        maxSize = FILE_CONFIG.MAX_SIZE_BYTES,
        allowedTypes = FILE_CONFIG.ALLOWED_TYPES,
        required = false
    } = options;

    const errors = [];

    if (!file) {
        if (required) {
            errors.push('File is required');
        }
        return { valid: !required, errors };
    }

    if (file.size > maxSize) {
        const maxMB = maxSize / (1024 * 1024);
        errors.push(`File size must be less than ${maxMB}MB`);
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate image file
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateImage(file, options = {}) {
    return validateFile(file, {
        ...options,
        allowedTypes: FILE_CONFIG.ALLOWED_IMAGE_TYPES
    });
}

/**
 * Validate date
 * @param {string|Date} date - Date to validate
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateDate(date, options = {}) {
    const { minDate, maxDate, fieldName = 'Date', required = false } = options;
    const errors = [];

    if (!date) {
        if (required) {
            errors.push(`${fieldName} is required`);
        }
        return { valid: !required, errors };
    }

    const d = new Date(date);

    if (isNaN(d.getTime())) {
        errors.push(`${fieldName} is not a valid date`);
        return { valid: false, errors };
    }

    if (minDate && d < new Date(minDate)) {
        errors.push(`${fieldName} must be after ${new Date(minDate).toLocaleDateString()}`);
    }

    if (maxDate && d > new Date(maxDate)) {
        errors.push(`${fieldName} must be before ${new Date(maxDate).toLocaleDateString()}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate select/dropdown value
 * @param {string} value - Selected value
 * @param {Array} allowedValues - Array of allowed values
 * @param {Object} options - Validation options
 * @returns {ValidationResult}
 */
export function validateSelect(value, allowedValues, options = {}) {
    const { required = false, fieldName = 'Selection' } = options;
    const errors = [];

    if (!value || value === '') {
        if (required) {
            errors.push(`${fieldName} is required`);
        }
        return { valid: !required, errors };
    }

    if (!allowedValues.includes(value)) {
        errors.push(`${fieldName} contains an invalid value`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a lead form
 * @param {Object} data - Lead form data
 * @returns {ValidationResult}
 */
export function validateLeadForm(data) {
    const errors = [];

    // Company name is required
    const companyResult = validateRequired(data.companyName, 'Company name');
    if (!companyResult.valid) errors.push(...companyResult.errors);

    // Client name is required
    const nameResult = validateRequired(data.clientName, 'Client name');
    if (!nameResult.valid) errors.push(...nameResult.errors);

    // Email validation (if provided)
    if (data.clientEmail) {
        const emailResult = validateEmail(data.clientEmail);
        if (!emailResult.valid) errors.push(...emailResult.errors);
    }

    // Phone validation (if provided)
    if (data.clientPhone) {
        const phoneResult = validatePhone(data.clientPhone);
        if (!phoneResult.valid) errors.push(...phoneResult.errors);
    }

    // URL validation (if provided)
    if (data.websiteUrl) {
        const urlResult = validateUrl(data.websiteUrl);
        if (!urlResult.valid) errors.push(...urlResult.errors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a project form
 * @param {Object} data - Project form data
 * @returns {ValidationResult}
 */
export function validateProjectForm(data) {
    const errors = [];

    // Company name is required
    const companyResult = validateRequired(data.companyName, 'Company name');
    if (!companyResult.valid) errors.push(...companyResult.errors);

    // Progress validation
    if (data.progress !== undefined) {
        const progressResult = validateNumber(data.progress, {
            min: 0,
            max: 100,
            integer: true,
            fieldName: 'Progress'
        });
        if (!progressResult.valid) errors.push(...progressResult.errors);
    }

    // Email validation (if provided)
    if (data.clientEmail) {
        const emailResult = validateEmail(data.clientEmail);
        if (!emailResult.valid) errors.push(...emailResult.errors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a client form
 * @param {Object} data - Client form data
 * @returns {ValidationResult}
 */
export function validateClientForm(data) {
    const errors = [];

    // Email is required
    const emailResult = validateEmail(data.email);
    if (!emailResult.valid) errors.push(...emailResult.errors);

    // Display name is required
    const nameResult = validateRequired(data.displayName, 'Display name');
    if (!nameResult.valid) errors.push(...nameResult.errors);

    // Password validation (for new clients)
    if (data.password !== undefined) {
        const passwordResult = validatePassword(data.password);
        if (!passwordResult.valid) errors.push(...passwordResult.errors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a ticket form
 * @param {Object} data - Ticket form data
 * @returns {ValidationResult}
 */
export function validateTicketForm(data) {
    const errors = [];

    // Title is required
    const titleResult = validateRequired(data.title, 'Title');
    if (!titleResult.valid) errors.push(...titleResult.errors);

    // Description is required
    const descResult = validateRequired(data.description, 'Description');
    if (!descResult.valid) errors.push(...descResult.errors);

    // Project ID is required
    const projectResult = validateRequired(data.projectId, 'Project');
    if (!projectResult.valid) errors.push(...projectResult.errors);

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a post form
 * @param {Object} data - Post form data
 * @returns {ValidationResult}
 */
export function validatePostForm(data) {
    const errors = [];

    // Title is required
    const titleResult = validateRequired(data.title, 'Title');
    if (!titleResult.valid) errors.push(...titleResult.errors);

    // Slug validation (if provided)
    if (data.slug) {
        const slugResult = validateLength(data.slug, {
            min: 1,
            max: 100,
            fieldName: 'Slug'
        });
        if (!slugResult.valid) errors.push(...slugResult.errors);

        // Check slug format
        if (!/^[a-z0-9-]+$/.test(data.slug)) {
            errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate an invoice form
 * @param {Object} data - Invoice form data
 * @returns {ValidationResult}
 */
export function validateInvoiceForm(data) {
    const errors = [];

    // Invoice number is required
    const numberResult = validateRequired(data.number, 'Invoice number');
    if (!numberResult.valid) errors.push(...numberResult.errors);

    // Amount validation
    const amountResult = validateNumber(data.amount, {
        min: 0,
        fieldName: 'Amount'
    });
    if (!amountResult.valid) errors.push(...amountResult.errors);

    // Due date validation
    const dateResult = validateDate(data.dueDate, {
        required: true,
        fieldName: 'Due date'
    });
    if (!dateResult.valid) errors.push(...dateResult.errors);

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a milestone form
 * @param {Object} data - Milestone form data
 * @returns {ValidationResult}
 */
export function validateMilestoneForm(data) {
    const errors = [];

    // Title is required
    const titleResult = validateRequired(data.title, 'Title');
    if (!titleResult.valid) errors.push(...titleResult.errors);

    // Date validation (if provided)
    if (data.date) {
        const dateResult = validateDate(data.date, { fieldName: 'Date' });
        if (!dateResult.valid) errors.push(...dateResult.errors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Create a form validator
 * @param {Object} rules - Validation rules object
 * @returns {Function} Validator function
 */
export function createFormValidator(rules) {
    return (data) => {
        const errors = {};
        let valid = true;

        for (const [field, fieldRules] of Object.entries(rules)) {
            const fieldErrors = [];
            const value = data[field];

            for (const rule of fieldRules) {
                const result = rule(value, data);
                if (!result.valid) {
                    fieldErrors.push(...result.errors);
                }
            }

            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
                valid = false;
            }
        }

        return { valid, errors };
    };
}
