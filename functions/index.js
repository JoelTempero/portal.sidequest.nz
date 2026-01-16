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
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string input
 */
function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

// ============================================
// CREATE CLIENT (Admin/Manager only)
// ============================================

exports.createClient = onCall(async (request) => {
  // Authentication check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // Authorization check
  const authorized = await isAdminOrManager(request.auth.uid);
  if (!authorized) {
    throw new HttpsError("permission-denied", "Only admins and managers can create clients");
  }

  const { email, password, displayName, company } = request.data;

  // Validate inputs
  if (!email || !isValidEmail(email)) {
    throw new HttpsError("invalid-argument", "Valid email is required");
  }

  if (!password || password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters");
  }

  if (!displayName || displayName.trim().length < 2) {
    throw new HttpsError("invalid-argument", "Display name is required");
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
    console.error("Error creating user:", error);

    if (error.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Email already in use");
    }
    if (error.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Invalid email format");
    }
    if (error.code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Password is too weak");
    }

    throw new HttpsError("internal", "Failed to create user");
  }
});

// ============================================
// UPDATE USER ROLE (Admin only)
// ============================================

exports.updateUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const authorized = await isAdmin(request.auth.uid);
  if (!authorized) {
    throw new HttpsError("permission-denied", "Only admins can change user roles");
  }

  const { userId, role } = request.data;

  // Validate role
  const validRoles = ['admin', 'manager', 'support', 'client'];
  if (!validRoles.includes(role)) {
    throw new HttpsError("invalid-argument", "Invalid role");
  }

  // Prevent changing own role
  if (userId === request.auth.uid) {
    throw new HttpsError("invalid-argument", "Cannot change your own role");
  }

  try {
    await db.collection('users').doc(userId).update({
      role: role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating role:", error);
    throw new HttpsError("internal", "Failed to update role");
  }
});

// ============================================
// DELETE USER (Admin only)
// ============================================

exports.deleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const authorized = await isAdmin(request.auth.uid);
  if (!authorized) {
    throw new HttpsError("permission-denied", "Only admins can delete users");
  }

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required");
  }

  // Prevent self-deletion
  if (userId === request.auth.uid) {
    throw new HttpsError("invalid-argument", "Cannot delete yourself");
  }

  try {
    // Delete from Auth
    await getAuth().deleteUser(userId);

    // Archive user document instead of deleting
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      await db.collection('archived').add({
        type: 'client',
        originalId: userId,
        originalData: userDoc.data(),
        reason: 'User deleted',
        archivedAt: FieldValue.serverTimestamp(),
        archivedBy: request.auth.uid
      });

      await db.collection('users').doc(userId).delete();
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);

    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "User not found");
    }

    throw new HttpsError("internal", "Failed to delete user");
  }
});

// ============================================
// RESET USER PASSWORD (Admin only)
// ============================================

exports.resetUserPassword = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const authorized = await isAdmin(request.auth.uid);
  if (!authorized) {
    throw new HttpsError("permission-denied", "Only admins can reset passwords");
  }

  const { userId, newPassword } = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters");
  }

  try {
    await getAuth().updateUser(userId, {
      password: newPassword
    });

    return { success: true };
  } catch (error) {
    console.error("Error resetting password:", error);

    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "User not found");
    }

    throw new HttpsError("internal", "Failed to reset password");
  }
});

// ============================================
// GET SLA BREACHED TICKETS (Callable)
// ============================================

exports.getSLABreachedTickets = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const authorized = await isAdminOrManager(request.auth.uid);
  if (!authorized) {
    throw new HttpsError("permission-denied", "Only admins and managers can view SLA data");
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
