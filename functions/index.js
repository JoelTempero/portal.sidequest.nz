/* ============================================
   SIDEQUEST DIGITAL - Cloud Functions
   Secure backend operations
   ============================================ */

// V2 for callable functions
const { onCall, HttpsError } = require("firebase-functions/v2/https");

// V1 for Firestore triggers (more stable, no Eventarc required)
const functions = require("firebase-functions");

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Initialize Firebase Admin
initializeApp();

const db = getFirestore();

// ============================================
// ERROR CODES - Structured error responses
// ============================================

const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: { code: 'AUTH_001', message: 'Authentication required' },
  PERMISSION_DENIED: { code: 'AUTH_002', message: 'Insufficient permissions' },

  // Validation errors
  INVALID_EMAIL: { code: 'VAL_001', message: 'Invalid email format' },
  INVALID_PASSWORD: { code: 'VAL_002', message: 'Password must be at least 8 characters with mixed case and numbers' },
  INVALID_NAME: { code: 'VAL_003', message: 'Display name must be 2-100 characters' },
  INVALID_USER_ID: { code: 'VAL_004', message: 'Invalid user ID format' },
  INVALID_ROLE: { code: 'VAL_005', message: 'Invalid role specified' },
  MISSING_REQUIRED: { code: 'VAL_006', message: 'Missing required fields' },
  INVALID_AMOUNT: { code: 'VAL_007', message: 'Invalid payment amount' },

  // Resource errors
  USER_NOT_FOUND: { code: 'RES_001', message: 'User not found' },
  EMAIL_EXISTS: { code: 'RES_002', message: 'Email already in use' },
  INVOICE_NOT_FOUND: { code: 'RES_003', message: 'Invoice not found' },

  // Operation errors
  SELF_MODIFICATION: { code: 'OP_001', message: 'Cannot modify your own account this way' },
  CREATE_FAILED: { code: 'OP_002', message: 'Failed to create resource' },
  UPDATE_FAILED: { code: 'OP_003', message: 'Failed to update resource' },
  DELETE_FAILED: { code: 'OP_004', message: 'Failed to delete resource' },
  PAYMENT_FAILED: { code: 'OP_005', message: 'Payment processing failed' }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if caller is admin or manager
 */
async function isAdminOrManager(uid) {
  if (!uid) return false;

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) return false;

  const role = userDoc.data().role;
  return role === 'admin' || role === 'manager';
}

/**
 * Check if caller is admin
 */
async function isAdmin(uid) {
  if (!uid) return false;

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) return false;

  return userDoc.data().role === 'admin';
}

/**
 * Validate email format (RFC 5322 compliant)
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // More robust email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 * Requirements: 8+ chars, at least one uppercase, one lowercase, one number
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8) return false;

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return hasUppercase && hasLowercase && hasNumber;
}

/**
 * Validate Firebase User ID format
 */
function isValidUserId(userId) {
  if (!userId || typeof userId !== 'string') return false;
  // Firebase UIDs are typically 28 characters, alphanumeric
  return /^[a-zA-Z0-9]{20,128}$/.test(userId);
}

/**
 * Sanitize string input
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

/**
 * Create structured error response
 */
function createError(errorType, httpCode, details = null) {
  const error = ERROR_CODES[errorType] || { code: 'UNKNOWN', message: 'An error occurred' };
  const message = details ? `${error.message}: ${details}` : error.message;
  return new HttpsError(httpCode, message, { errorCode: error.code });
}

// ============================================
// CREATE CLIENT (Admin/Manager only)
// ============================================

exports.createClient = onCall(async (request) => {
  // Authentication check
  if (!request.auth) {
    throw createError('AUTH_REQUIRED', 'unauthenticated');
  }

  // Authorization check
  const authorized = await isAdminOrManager(request.auth.uid);
  if (!authorized) {
    throw createError('PERMISSION_DENIED', 'permission-denied', 'Only admins and managers can create clients');
  }

  const { email, password, displayName, company } = request.data;

  // Validate inputs with specific error messages
  if (!email || !isValidEmail(email)) {
    throw createError('INVALID_EMAIL', 'invalid-argument');
  }

  if (!password || !isValidPassword(password)) {
    throw createError('INVALID_PASSWORD', 'invalid-argument');
  }

  if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 100) {
    throw createError('INVALID_NAME', 'invalid-argument');
  }

  try {
    // Create the user in Firebase Auth
    const userRecord = await getAuth().createUser({
      email: sanitizeString(email, 254),
      password: password,
      displayName: sanitizeString(displayName, 100),
    });

    // Create user document in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: sanitizeString(displayName, 100),
      company: sanitizeString(company || '', 200),
      role: 'client',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid
    });

    // Log activity
    await db.collection('activity').add({
      type: 'client_created',
      data: {
        clientId: userRecord.uid,
        displayName: displayName,
        email: userRecord.email
      },
      userId: request.auth.uid,
      timestamp: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email,
    };
  } catch (error) {
    console.error("Error creating user:", error.code, error.message);

    if (error.code === "auth/email-already-exists") {
      throw createError('EMAIL_EXISTS', 'already-exists');
    }
    if (error.code === "auth/invalid-email") {
      throw createError('INVALID_EMAIL', 'invalid-argument');
    }
    if (error.code === "auth/weak-password") {
      throw createError('INVALID_PASSWORD', 'invalid-argument');
    }

    throw createError('CREATE_FAILED', 'internal', 'User creation failed');
  }
});

// ============================================
// UPDATE USER ROLE (Admin only)
// ============================================

exports.updateUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw createError('AUTH_REQUIRED', 'unauthenticated');
  }

  const authorized = await isAdmin(request.auth.uid);
  if (!authorized) {
    throw createError('PERMISSION_DENIED', 'permission-denied', 'Only admins can change user roles');
  }

  const { userId, role } = request.data;

  // Validate user ID format
  if (!isValidUserId(userId)) {
    throw createError('INVALID_USER_ID', 'invalid-argument');
  }

  // Validate role
  const validRoles = ['admin', 'manager', 'support', 'client'];
  if (!validRoles.includes(role)) {
    throw createError('INVALID_ROLE', 'invalid-argument', `Valid roles: ${validRoles.join(', ')}`);
  }

  // Prevent changing own role
  if (userId === request.auth.uid) {
    throw createError('SELF_MODIFICATION', 'invalid-argument');
  }

  // Verify user exists
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw createError('USER_NOT_FOUND', 'not-found');
  }

  try {
    const oldRole = userDoc.data().role;

    await db.collection('users').doc(userId).update({
      role: role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    });

    // Log role change for audit
    await db.collection('activity').add({
      type: 'role_changed',
      data: {
        userId: userId,
        oldRole: oldRole,
        newRole: role,
        changedBy: request.auth.uid
      },
      userId: request.auth.uid,
      timestamp: FieldValue.serverTimestamp()
    });

    return { success: true, previousRole: oldRole, newRole: role };
  } catch (error) {
    console.error("Error updating role:", error.code, error.message);
    throw createError('UPDATE_FAILED', 'internal', 'Role update failed');
  }
});

// ============================================
// DELETE USER (Admin only) - With Cascade Cleanup
// ============================================

exports.deleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw createError('AUTH_REQUIRED', 'unauthenticated');
  }

  const authorized = await isAdmin(request.auth.uid);
  if (!authorized) {
    throw createError('PERMISSION_DENIED', 'permission-denied', 'Only admins can delete users');
  }

  const { userId } = request.data;

  // Validate user ID
  if (!isValidUserId(userId)) {
    throw createError('INVALID_USER_ID', 'invalid-argument');
  }

  // Prevent self-deletion
  if (userId === request.auth.uid) {
    throw createError('SELF_MODIFICATION', 'invalid-argument', 'Cannot delete yourself');
  }

  try {
    // Get user document before deletion for archiving
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      throw createError('USER_NOT_FOUND', 'not-found');
    }

    const userData = userDoc.data();
    const batch = db.batch();

    // 1. Archive user document
    const archiveRef = db.collection('archived').doc();
    batch.set(archiveRef, {
      type: 'client',
      originalId: userId,
      originalData: userData,
      reason: 'User deleted',
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: request.auth.uid
    });

    // 2. Reassign or mark tickets from this user
    const ticketsSnapshot = await db.collection('tickets')
      .where('clientId', '==', userId)
      .get();

    ticketsSnapshot.docs.forEach(ticketDoc => {
      batch.update(ticketDoc.ref, {
        clientId: null,
        clientDeleted: true,
        clientDeletedName: userData.displayName || 'Deleted User',
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    // 3. Remove user from project assignments
    const projectsSnapshot = await db.collection('projects')
      .where('assignedClients', 'array-contains', userId)
      .get();

    projectsSnapshot.docs.forEach(projectDoc => {
      const currentClients = projectDoc.data().assignedClients || [];
      const updatedClients = currentClients.filter(id => id !== userId);
      batch.update(projectDoc.ref, {
        assignedClients: updatedClients,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    // 4. Delete user notifications
    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .get();

    notificationsSnapshot.docs.forEach(notifDoc => {
      batch.delete(notifDoc.ref);
    });

    // 5. Delete user document
    batch.delete(db.collection('users').doc(userId));

    // Commit batch (handles up to 500 operations)
    await batch.commit();

    // Delete from Firebase Auth
    await getAuth().deleteUser(userId);

    // Log activity
    await db.collection('activity').add({
      type: 'user_deleted',
      data: {
        userId: userId,
        displayName: userData.displayName,
        email: userData.email,
        ticketsReassigned: ticketsSnapshot.size,
        projectsUpdated: projectsSnapshot.size,
        notificationsDeleted: notificationsSnapshot.size
      },
      userId: request.auth.uid,
      timestamp: FieldValue.serverTimestamp()
    });

    return {
      success: true,
      cleanup: {
        ticketsReassigned: ticketsSnapshot.size,
        projectsUpdated: projectsSnapshot.size,
        notificationsDeleted: notificationsSnapshot.size
      }
    };
  } catch (error) {
    console.error("Error deleting user:", error.code, error.message);

    if (error.code === "auth/user-not-found") {
      throw createError('USER_NOT_FOUND', 'not-found');
    }

    if (error instanceof HttpsError) {
      throw error;
    }

    throw createError('DELETE_FAILED', 'internal', 'User deletion failed');
  }
});

// ============================================
// RESET USER PASSWORD (Admin only)
// ============================================

exports.resetUserPassword = onCall(async (request) => {
  if (!request.auth) {
    throw createError('AUTH_REQUIRED', 'unauthenticated');
  }

  const authorized = await isAdmin(request.auth.uid);
  if (!authorized) {
    throw createError('PERMISSION_DENIED', 'permission-denied', 'Only admins can reset passwords');
  }

  const { userId, newPassword } = request.data;

  // Validate user ID
  if (!isValidUserId(userId)) {
    throw createError('INVALID_USER_ID', 'invalid-argument');
  }

  // Validate password strength
  if (!newPassword || !isValidPassword(newPassword)) {
    throw createError('INVALID_PASSWORD', 'invalid-argument');
  }

  // Verify user exists
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw createError('USER_NOT_FOUND', 'not-found');
  }

  try {
    await getAuth().updateUser(userId, {
      password: newPassword
    });

    // Log password reset for audit
    await db.collection('activity').add({
      type: 'password_reset',
      data: {
        userId: userId,
        resetBy: request.auth.uid
      },
      userId: request.auth.uid,
      timestamp: FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error.code, error.message);

    if (error.code === "auth/user-not-found") {
      throw createError('USER_NOT_FOUND', 'not-found');
    }

    throw createError('UPDATE_FAILED', 'internal', 'Password reset failed');
  }
});

// ============================================
// PROCESS PAYMENT (Stub for future Stripe integration)
// ============================================

exports.processPayment = onCall(async (request) => {
  if (!request.auth) {
    throw createError('AUTH_REQUIRED', 'unauthenticated');
  }

  const { invoiceId, paymentMethodId, amount } = request.data;

  // Validate inputs
  if (!invoiceId || typeof invoiceId !== 'string') {
    throw createError('MISSING_REQUIRED', 'invalid-argument', 'Invoice ID required');
  }

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    throw createError('INVALID_AMOUNT', 'invalid-argument');
  }

  // Verify invoice exists and belongs to user or user is admin
  const invoiceQuery = await db.collection('projects')
    .where('invoices', 'array-contains', { id: invoiceId })
    .limit(1)
    .get();

  // For now, return a stub response indicating payment integration is not yet configured
  // TODO: Integrate with Stripe when ready
  // 1. Create Stripe PaymentIntent
  // 2. Confirm payment
  // 3. Update invoice status
  // 4. Send receipt email

  console.log(`Payment attempt for invoice ${invoiceId}, amount: ${amount}`);

  return {
    success: false,
    message: 'Payment processing is not yet configured. Please contact support for payment options.',
    invoiceId: invoiceId,
    amount: amount,
    currency: 'NZD',
    status: 'pending_configuration'
  };
});

// ============================================
// GET SLA BREACHED TICKETS (Callable)
// ============================================

exports.getSLABreachedTickets = onCall(async (request) => {
  if (!request.auth) {
    throw createError('AUTH_REQUIRED', 'unauthenticated');
  }

  const authorized = await isAdminOrManager(request.auth.uid);
  if (!authorized) {
    throw createError('PERMISSION_DENIED', 'permission-denied', 'Only admins and managers can view SLA data');
  }

  // SLA hours by priority
  const SLA_HOURS = {
    'asap': 4,
    'day': 24,
    'week': 168,
    'medium': 48,
    'high': 24,
    'low': 72
  };

  const openStatuses = ['open', 'in-progress'];
  const ticketsSnapshot = await db.collection('tickets')
    .where('status', 'in', openStatuses)
    .get();

  const now = new Date();
  const breachedTickets = [];

  ticketsSnapshot.docs.forEach(doc => {
    const ticket = doc.data();
    const priority = ticket.priority || ticket.urgency || 'medium';
    const slaHours = SLA_HOURS[priority] || 48;

    const createdAt = ticket.createdAt?.toDate() || new Date();
    const deadline = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

    if (now > deadline) {
      breachedTickets.push({
        id: doc.id,
        ...ticket,
        slaDeadline: deadline.toISOString(),
        hoursOverdue: Math.round((now - deadline) / (1000 * 60 * 60))
      });
    }
  });

  return { tickets: breachedTickets, count: breachedTickets.length };
});

// ============================================
// FIRESTORE TRIGGERS (V1 - More Stable)
// ============================================

// New Ticket Created - Notify Staff
exports.onTicketCreated = functions.firestore
  .document('tickets/{ticketId}')
  .onCreate(async (snapshot, context) => {
    const ticket = snapshot.data();
    const ticketId = context.params.ticketId;

    console.log(`New ticket created: ${ticketId}`, ticket.title);

    // Create notification for admins/support staff
    const staffSnapshot = await db.collection('users')
      .where('role', 'in', ['admin', 'manager', 'support'])
      .get();

    const batch = db.batch();

    staffSnapshot.docs.forEach(doc => {
      const notificationRef = db.collection('notifications').doc();
      batch.set(notificationRef, {
        userId: doc.id,
        type: 'new_ticket',
        title: 'New Support Ticket',
        body: `${ticket.clientName || ticket.submittedBy || 'A client'} submitted: ${ticket.title}`,
        data: {
          ticketId: ticketId,
          projectId: ticket.projectId,
          priority: ticket.priority
        },
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    // Log activity
    await db.collection('activity').add({
      type: 'ticket_created',
      data: {
        ticketId: ticketId,
        title: ticket.title,
        clientName: ticket.clientName,
        projectName: ticket.projectName,
        priority: ticket.priority
      },
      timestamp: FieldValue.serverTimestamp()
    });
  });

// Ticket Updated - Handle status changes, assignments, and comments
exports.onTicketUpdated = functions.firestore
  .document('tickets/{ticketId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const ticketId = context.params.ticketId;

    // Check for status change
    if (before.status !== after.status) {
      console.log(`Ticket ${ticketId} status changed: ${before.status} -> ${after.status}`);

      // Notify the client about status change
      if (after.clientId) {
        await db.collection('notifications').add({
          userId: after.clientId,
          type: 'ticket_status_changed',
          title: `Ticket ${after.status === 'resolved' ? 'Resolved' : 'Updated'}`,
          body: `Your ticket "${after.title}" is now ${after.status.replace('-', ' ')}`,
          data: {
            ticketId: ticketId,
            oldStatus: before.status,
            newStatus: after.status
          },
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }

      // Log activity
      await db.collection('activity').add({
        type: 'ticket_status_changed',
        data: {
          ticketId: ticketId,
          title: after.title,
          oldStatus: before.status,
          newStatus: after.status,
          changedBy: after.lastUpdatedBy
        },
        timestamp: FieldValue.serverTimestamp()
      });
    }

    // Check for assignment change
    if (before.assignedTo !== after.assignedTo && after.assignedTo) {
      console.log(`Ticket ${ticketId} assigned to: ${after.assignedTo}`);

      // Notify the assigned person
      await db.collection('notifications').add({
        userId: after.assignedTo,
        type: 'ticket_assigned',
        title: 'Ticket Assigned to You',
        body: `You have been assigned to: "${after.title}"`,
        data: {
          ticketId: ticketId,
          priority: after.priority,
          clientName: after.clientName
        },
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    // Check for new comments (compare comment count)
    const beforeCommentCount = (before.comments || []).length;
    const afterCommentCount = (after.comments || []).length;

    if (afterCommentCount > beforeCommentCount) {
      const newComment = after.comments[afterCommentCount - 1];

      // If comment is from staff, notify client
      if (newComment && !newComment.isInternal && newComment.authorRole !== 'client') {
        if (after.clientId) {
          await db.collection('notifications').add({
            userId: after.clientId,
            type: 'ticket_reply',
            title: 'New Reply on Your Ticket',
            body: `${newComment.authorName || 'Support'} replied to "${after.title}"`,
            data: {
              ticketId: ticketId,
              commentId: newComment.id
            },
            read: false,
            createdAt: FieldValue.serverTimestamp()
          });
        }
      }

      // If comment is from client, notify assigned staff
      if (newComment && newComment.authorRole === 'client') {
        const notifyUserId = after.assignedTo;
        if (notifyUserId) {
          await db.collection('notifications').add({
            userId: notifyUserId,
            type: 'ticket_client_reply',
            title: 'Client Replied to Ticket',
            body: `${after.clientName || 'Client'} replied to "${after.title}"`,
            data: {
              ticketId: ticketId,
              commentId: newComment.id
            },
            read: false,
            createdAt: FieldValue.serverTimestamp()
          });
        }
      }
    }
  });
