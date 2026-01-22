/* ============================================
   PRODUCT TASK TEMPLATES

   Task templates for each product type.
   Tasks are organized by categories.
   ============================================ */

// Task categories in display order
export const TASK_CATEGORIES = [
    { id: 'research', name: 'Research & Planning' },
    { id: 'design', name: 'Design' },
    { id: 'demo', name: 'Demo' },
    { id: 'data', name: 'Data & Content' },
    { id: 'security', name: 'Security & Efficiency' },
    { id: 'seo', name: 'SEO', products: ['website'] }, // Only for websites
    { id: 'developing', name: 'Developing' },
    { id: 'testing', name: 'Testing' },
    { id: 'feedback', name: 'Feedback' },
    { id: 'publishing', name: 'Publishing' }
];

// Product types
export const PRODUCT_TYPES = [
    { id: 'website', name: 'Website', icon: '🌐' },
    { id: 'customApp', name: 'Custom App', icon: '📱' },
    { id: 'clientPortal', name: 'Client Portal', icon: '🔐' },
    { id: 'managementSystem', name: 'Management System', icon: '⚙️' }
];

// Task templates per product type
export const PRODUCT_TASKS = {
    website: {
        research: [
            'Define project scope and objectives',
            'Research target audience and competitors',
            'Document technical requirements',
            'Create sitemap structure',
            'Define hosting requirements (Firebase/GitHub Pages)'
        ],
        design: [
            'Create wireframes for key pages',
            'Design color scheme and typography',
            'Create responsive mockups (desktop/tablet/mobile)',
            'Design navigation and user flow',
            'Create/source brand assets and imagery'
        ],
        demo: [
            'Deploy preview to GitHub Pages/Firebase Hosting',
            'Share preview link with client',
            'Gather initial feedback on design direction'
        ],
        data: [
            'Collect copy and written content',
            'Optimize and compress images',
            'Set up Firebase collections if needed',
            'Import/migrate existing content',
            'Create content management workflow'
        ],
        security: [
            'Configure HTTPS/SSL certificates',
            'Set up Firebase security rules',
            'Implement form validation and sanitization',
            'Configure authentication if required',
            'Set up proper error handling'
        ],
        seo: [
            'Research and implement target keywords',
            'Write meta titles and descriptions',
            'Create sitemap.xml',
            'Set up robots.txt',
            'Configure Open Graph and social meta tags',
            'Implement structured data (JSON-LD)',
            'Optimize page load speed',
            'Set up Google Search Console'
        ],
        developing: [
            'Set up GitHub repository',
            'Build responsive HTML/CSS structure',
            'Implement JavaScript functionality',
            'Connect to Firebase services',
            'Build contact forms and interactions',
            'Implement animations and transitions'
        ],
        testing: [
            'Test on multiple browsers (Chrome, Safari, Firefox)',
            'Test responsive design on real devices',
            'Run Lighthouse performance audit',
            'Test all forms and interactive elements',
            'Validate HTML and accessibility (WCAG)',
            'Test Firebase functions and data flow'
        ],
        feedback: [
            'Client review of complete build',
            'Collect and document change requests',
            'Implement requested revisions',
            'Final client sign-off'
        ],
        publishing: [
            'Connect custom domain',
            'Configure DNS settings',
            'Deploy to production hosting',
            'Set up analytics (Google Analytics/Firebase)',
            'Create backup and recovery plan',
            'Hand over documentation and credentials'
        ]
    },

    customApp: {
        research: [
            'Define app purpose and core features',
            'Document user stories and requirements',
            'Research technical architecture options',
            'Plan Firebase/backend structure',
            'Define data models and relationships'
        ],
        design: [
            'Create user flow diagrams',
            'Design UI wireframes',
            'Create high-fidelity mockups',
            'Design component library/style guide',
            'Plan responsive breakpoints'
        ],
        demo: [
            'Build clickable prototype',
            'Deploy alpha version for review',
            'Demonstrate core functionality',
            'Gather stakeholder feedback'
        ],
        data: [
            'Design Firestore database schema',
            'Create seed data for testing',
            'Plan data migration strategy',
            'Set up Cloud Storage structure',
            'Document API endpoints'
        ],
        security: [
            'Implement Firebase Authentication',
            'Write Firestore security rules',
            'Set up Cloud Storage security rules',
            'Implement input validation',
            'Configure rate limiting',
            'Set up error logging and monitoring'
        ],
        developing: [
            'Initialize GitHub repository',
            'Set up development environment',
            'Build core UI components',
            'Implement authentication flow',
            'Build CRUD operations',
            'Implement real-time subscriptions',
            'Add offline support if needed',
            'Build admin/dashboard features'
        ],
        testing: [
            'Write unit tests for core functions',
            'Test authentication flows',
            'Test data operations (create/read/update/delete)',
            'Test real-time functionality',
            'Test edge cases and error states',
            'Performance testing under load',
            'Security penetration testing'
        ],
        feedback: [
            'Beta testing with select users',
            'Collect user feedback and bugs',
            'Prioritize and implement fixes',
            'Final review with stakeholders'
        ],
        publishing: [
            'Configure production Firebase project',
            'Deploy Cloud Functions',
            'Deploy hosting and set up domain',
            'Set up monitoring and alerts',
            'Create user documentation',
            'Plan maintenance schedule'
        ]
    },

    clientPortal: {
        research: [
            'Define portal features and access levels',
            'Document client user requirements',
            'Plan integration with existing systems',
            'Define authentication requirements',
            'Map out user roles and permissions'
        ],
        design: [
            'Design login and onboarding flow',
            'Create dashboard layout',
            'Design data visualization components',
            'Create notification/alert system design',
            'Design mobile-responsive views'
        ],
        demo: [
            'Build demo with sample client data',
            'Create walkthrough documentation',
            'Present portal features to stakeholders',
            'Gather feedback on usability'
        ],
        data: [
            'Design client data structure',
            'Plan document/file storage',
            'Create notification templates',
            'Set up email integration',
            'Plan data export features'
        ],
        security: [
            'Implement secure client authentication',
            'Set up row-level security rules',
            'Implement session management',
            'Add audit logging for actions',
            'Configure data encryption',
            'Set up 2FA if required'
        ],
        developing: [
            'Build authentication and registration',
            'Create client dashboard views',
            'Implement project/data listings',
            'Build messaging/communication features',
            'Implement file upload/download',
            'Create notification system',
            'Build settings and preferences'
        ],
        testing: [
            'Test login/logout flows',
            'Test permission boundaries',
            'Verify data isolation between clients',
            'Test notification delivery',
            'Test file operations',
            'Cross-browser compatibility testing'
        ],
        feedback: [
            'Pilot with initial client group',
            'Gather usability feedback',
            'Identify and fix pain points',
            'Document FAQ and common issues'
        ],
        publishing: [
            'Deploy to production environment',
            'Send client onboarding invitations',
            'Create help documentation',
            'Set up support workflow',
            'Monitor initial usage and errors'
        ]
    },

    managementSystem: {
        research: [
            'Document business processes to digitize',
            'Map existing workflows',
            'Define automation requirements',
            'Plan integration points',
            'Identify reporting needs'
        ],
        design: [
            'Design admin dashboard layout',
            'Create data entry form designs',
            'Design reporting/analytics views',
            'Plan workflow automation UI',
            'Create role-based view designs'
        ],
        demo: [
            'Build proof-of-concept with core workflow',
            'Demonstrate automation features',
            'Present reporting capabilities',
            'Validate approach with stakeholders'
        ],
        data: [
            'Design comprehensive data schema',
            'Plan data import from existing sources',
            'Create reference/lookup data',
            'Set up backup procedures',
            'Plan archival strategy'
        ],
        security: [
            'Implement role-based access control',
            'Set up admin/manager/user tiers',
            'Configure action-level permissions',
            'Implement audit trails',
            'Set up data backup automation'
        ],
        developing: [
            'Build core data models',
            'Create CRUD interfaces',
            'Implement search and filtering',
            'Build reporting engine',
            'Create workflow automation',
            'Implement batch operations',
            'Build import/export tools',
            'Create admin configuration panel'
        ],
        testing: [
            'Test all CRUD operations',
            'Validate calculations and aggregations',
            'Test workflow automation triggers',
            'Verify report accuracy',
            'Load testing with realistic data volume',
            'Test role-based permissions'
        ],
        feedback: [
            'Train key users on system',
            'Parallel run with existing process',
            'Collect improvement suggestions',
            'Iterate on workflow efficiency'
        ],
        publishing: [
            'Migrate production data',
            'Deploy to production',
            'Provide user training',
            'Create operations manual',
            'Establish support procedures',
            'Schedule regular maintenance'
        ]
    }
};

/**
 * Get tasks for a specific product, optionally filtered by category
 * @param {string} productId - Product type ID
 * @param {string} categoryId - Optional category filter
 * @returns {Array} Array of task objects with id, text, category
 */
export function getProductTasks(productId, categoryId = null) {
    const productTasks = PRODUCT_TASKS[productId];
    if (!productTasks) return [];

    const tasks = [];
    const categories = categoryId ? [categoryId] : Object.keys(productTasks);

    categories.forEach(cat => {
        const categoryTasks = productTasks[cat] || [];
        categoryTasks.forEach((text, index) => {
            tasks.push({
                id: `${productId}-${cat}-${index}`,
                text,
                category: cat,
                product: productId
            });
        });
    });

    return tasks;
}

/**
 * Get all categories that apply to a product
 * @param {string} productId - Product type ID
 * @returns {Array} Array of category objects
 */
export function getCategoriesForProduct(productId) {
    return TASK_CATEGORIES.filter(cat => {
        // Include if no product restriction, or if product matches
        return !cat.products || cat.products.includes(productId);
    });
}
