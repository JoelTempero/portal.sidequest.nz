const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

// Admin UID - only this user can create clients
const ADMIN_UID = "XQINsp8rRqh9xmgQBrBjI4M2Z7e2";

exports.createClient = onCall(async (request) => {
  // Check if caller is admin
  if (!request.auth || request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Only admin can create clients");
  }

  const { email, password, displayName } = request.data;

  // Validate inputs
  if (!email || !password || !displayName) {
    throw new HttpsError("invalid-argument", "Email, password, and displayName are required");
  }

  if (password.length < 6) {
    throw new HttpsError("invalid-argument", "Password must be at least 6 characters");
  }

  try {
    // Create the user in Firebase Auth
    const userRecord = await getAuth().createUser({
      email: email,
      password: password,
      displayName: displayName,
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
    
    throw new HttpsError("internal", "Failed to create user");
  }
});