/* ============================================
   SIDEQUEST DIGITAL - XSS Sanitization
   ============================================ */

/**
 * HTML entities for escaping
 */
const HTML_ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

/**
 * Allowed HTML tags for rich text content
 */
const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span'
];

/**
 * Allowed HTML attributes per tag
 */
const ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class', 'id']
};

/**
 * URL schemes allowed in href/src attributes
 */
const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';

    return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Unescape HTML entities
 * @param {string} str - String to unescape
 * @returns {string} Unescaped string
 */
export function unescapeHtml(str) {
    if (!str || typeof str !== 'string') return '';

    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
}

/**
 * Sanitize a URL to prevent javascript: and data: attacks
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';

    const trimmed = url.trim();

    // Check for javascript: data: vbscript: etc.
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
        return '';
    }

    // If it's a relative URL or has an allowed scheme, return it
    if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) {
        return trimmed;
    }

    try {
        const parsed = new URL(trimmed, window.location.origin);
        if (ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
            return trimmed;
        }
    } catch {
        // If URL parsing fails for relative URLs without protocol
        if (!trimmed.includes(':')) {
            return trimmed;
        }
    }

    return '';
}

/**
 * Check if a tag is allowed
 * @param {string} tagName - Tag name to check
 * @returns {boolean} True if allowed
 */
function isAllowedTag(tagName) {
    return ALLOWED_TAGS.includes(tagName.toLowerCase());
}

/**
 * Check if an attribute is allowed for a tag
 * @param {string} tagName - Tag name
 * @param {string} attrName - Attribute name
 * @returns {boolean} True if allowed
 */
function isAllowedAttribute(tagName, attrName) {
    const globalAllowed = ALLOWED_ATTRIBUTES['*'] || [];
    const tagAllowed = ALLOWED_ATTRIBUTES[tagName.toLowerCase()] || [];
    return globalAllowed.includes(attrName) || tagAllowed.includes(attrName);
}

/**
 * Sanitize an attribute value
 * @param {string} attrName - Attribute name
 * @param {string} attrValue - Attribute value
 * @returns {string} Sanitized attribute value
 */
function sanitizeAttribute(attrName, attrValue) {
    // Sanitize URL attributes
    if (['href', 'src', 'action'].includes(attrName.toLowerCase())) {
        return sanitizeUrl(attrValue);
    }

    // Sanitize event handlers (remove them)
    if (attrName.toLowerCase().startsWith('on')) {
        return '';
    }

    // Escape other attribute values
    return escapeHtml(attrValue);
}

/**
 * Sanitize HTML content (allows safe tags and attributes)
 * Use this for rich text content from Quill editor
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') return '';

    // Create a temporary DOM element
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Process all elements
    const processNode = (node) => {
        // Handle text nodes
        if (node.nodeType === Node.TEXT_NODE) {
            return document.createTextNode(node.textContent);
        }

        // Handle element nodes
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            // If tag is not allowed, replace with its content
            if (!isAllowedTag(tagName)) {
                const fragment = document.createDocumentFragment();
                for (const child of node.childNodes) {
                    const processed = processNode(child);
                    if (processed) fragment.appendChild(processed);
                }
                return fragment;
            }

            // Create a new clean element
            const newElement = document.createElement(tagName);

            // Copy allowed attributes
            for (const attr of node.attributes) {
                if (isAllowedAttribute(tagName, attr.name)) {
                    const sanitizedValue = sanitizeAttribute(attr.name, attr.value);
                    if (sanitizedValue) {
                        newElement.setAttribute(attr.name, sanitizedValue);
                    }
                }
            }

            // Add rel="noopener noreferrer" to external links
            if (tagName === 'a' && newElement.hasAttribute('href')) {
                const href = newElement.getAttribute('href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    newElement.setAttribute('rel', 'noopener noreferrer');
                    if (!newElement.hasAttribute('target')) {
                        newElement.setAttribute('target', '_blank');
                    }
                }
            }

            // Process children
            for (const child of node.childNodes) {
                const processed = processNode(child);
                if (processed) newElement.appendChild(processed);
            }

            return newElement;
        }

        return null;
    };

    // Process and return
    const result = document.createElement('div');
    for (const child of temp.childNodes) {
        const processed = processNode(child);
        if (processed) result.appendChild(processed);
    }

    return result.innerHTML;
}

/**
 * Strip all HTML tags and return plain text
 * @param {string} html - HTML to strip
 * @returns {string} Plain text
 */
export function stripHtml(html) {
    if (!html || typeof html !== 'string') return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

/**
 * Truncate HTML content while preserving tags
 * @param {string} html - HTML to truncate
 * @param {number} maxLength - Maximum text length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated HTML
 */
export function truncateHtml(html, maxLength, suffix = '...') {
    if (!html || typeof html !== 'string') return '';

    const stripped = stripHtml(html);
    if (stripped.length <= maxLength) return html;

    // For simplicity, we'll truncate to plain text
    // A more complex implementation would preserve tags
    return escapeHtml(stripped.substring(0, maxLength)) + suffix;
}

/**
 * Sanitize object properties (deep)
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized object
 */
export function sanitizeObject(obj, options = {}) {
    const { htmlFields = [], preserveHtml = false } = options;

    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item, options));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            // Check if this field should preserve HTML
            if (htmlFields.includes(key) || preserveHtml) {
                result[key] = sanitizeHtml(value);
            } else {
                result[key] = escapeHtml(value);
            }
        } else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeObject(value, options);
        } else {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Create safe HTML element with escaped content
 * @param {string} tag - Tag name
 * @param {Object} attributes - Element attributes
 * @param {string} content - Text content (will be escaped)
 * @returns {HTMLElement} Safe HTML element
 */
export function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);

    // Set attributes safely
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('data')) {
            element.setAttribute(key, escapeHtml(String(value)));
        } else if (!key.startsWith('on')) {
            // Don't allow event handlers through attributes
            element.setAttribute(key, escapeHtml(String(value)));
        }
    }

    // Set text content safely (automatically escaped)
    if (content) {
        element.textContent = content;
    }

    return element;
}

/**
 * Safely set innerHTML with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML to set
 * @param {boolean} allowHtml - Allow rich HTML (default: false)
 */
export function setInnerHTML(element, html, allowHtml = false) {
    if (allowHtml) {
        element.innerHTML = sanitizeHtml(html);
    } else {
        element.textContent = stripHtml(html);
    }
}

/**
 * Create a safe template literal tag for HTML
 * @param {TemplateStringsArray} strings - Template strings
 * @param {...*} values - Template values
 * @returns {string} Safe HTML string
 */
export function safeHtml(strings, ...values) {
    let result = '';

    strings.forEach((str, i) => {
        result += str;
        if (i < values.length) {
            const value = values[i];
            if (value && value.__html) {
                // Pre-sanitized HTML
                result += value.__html;
            } else if (value && typeof value === 'object') {
                result += escapeHtml(JSON.stringify(value));
            } else {
                result += escapeHtml(String(value ?? ''));
            }
        }
    });

    return result;
}

/**
 * Mark a string as pre-sanitized HTML (use with caution)
 * @param {string} html - Pre-sanitized HTML
 * @returns {Object} Marked HTML object
 */
export function rawHtml(html) {
    return { __html: sanitizeHtml(html) };
}

/**
 * Sanitize CSS to prevent injection
 * @param {string} css - CSS to sanitize
 * @returns {string} Sanitized CSS
 */
export function sanitizeCss(css) {
    if (!css || typeof css !== 'string') return '';

    // Remove potentially dangerous CSS
    return css
        .replace(/expression\s*\(/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/behavior\s*:/gi, '')
        .replace(/-moz-binding/gi, '')
        .replace(/url\s*\([^)]*javascript/gi, 'url(')
        .replace(/url\s*\([^)]*data:/gi, 'url(');
}

/**
 * Sanitize JSON string before parsing
 * @param {string} json - JSON string to sanitize
 * @returns {string} Sanitized JSON string
 */
export function sanitizeJson(json) {
    if (!json || typeof json !== 'string') return '';

    // Remove potential script injections from JSON
    return json.replace(/<\s*\/?\s*script/gi, '');
}

/**
 * Validate and sanitize a filename
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return 'unnamed';

    return filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid chars
        .replace(/^\.+/, '') // Remove leading dots
        .replace(/\.+$/, '') // Remove trailing dots
        .trim() || 'unnamed';
}
