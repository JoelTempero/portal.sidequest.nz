/* ============================================
   SIDEQUEST DIGITAL - Cloud Functions
   Secure backend operations
   ============================================ */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
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
// FIRESTORE TRIGGERS - New Ticket Notification
// ============================================

exports.onTicketCreated = onDocumentCreated("tickets/{ticketId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const ticket = snapshot.data();
  const ticketId = event.params.ticketId;

  console.log(`New ticket created: ${ticketId}`, ticket.title);

  // Create notification for admins
  const adminsSnapshot = await db.collection('users')
    .where('role', 'in', ['admin', 'manager', 'support'])
    .get();

  const batch = db.batch();

  adminsSnapshot.docs.forEach(doc => {
    const notificationRef = db.collection('notifications').doc();
    batch.set(notificationRef, {
      userId: doc.id,
      type: 'new_ticket',
      title: 'New Support Ticket',
      body: `${ticket.submittedBy} submitted: ${ticket.title}`,
      data: {
        ticketId: ticketId,
        projectId: ticket.projectId
      },
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
});

// ============================================
// FIRESTORE TRIGGERS - Ticket Resolved Notification
// ============================================

exports.onTicketUpdated = onDocumentUpdated("tickets/{ticketId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();

  if (!before || !after) return;

  // Check if status changed to resolved
  if (before.status !== 'resolved' && after.status === 'resolved') {
    console.log(`Ticket resolved: ${event.params.ticketId}`);

    // Find the submitter
    const usersSnapshot = await db.collection('users')
      .where('displayName', '==', after.submittedBy)
      .limit(1)
      .get();

    if (!usersSnapshot.empty) {
      const userId = usersSnapshot.docs[0].id;

      await db.collection('notifications').add({
        userId: userId,
        type: 'ticket_resolved',
        title: 'Ticket Resolved',
        body: `Your ticket "${after.title}" has been resolved`,
        data: {
          ticketId: event.params.ticketId
        },
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    }
  }
});
