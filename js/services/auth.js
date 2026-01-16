/* ============================================
   SIDEQUEST DIGITAL - Authentication Service
   ============================================ */

import {
    auth,
    db,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    callFunction
} from './firebase-init.js';

import {
    setCurrentUser,
    setUserProfile,
    clearSubscriptions,
    getCurrentUserId,
    getState
} from './state.js';

import { createLogger } from '../utils/logger.js';
import { USER_ROLES, COLLECTIONS } from '../config/constants.js';
import { showToast } from '../components/toast.js';
import { showLoading } from '../components/loaders.js';

const logger = createLogger('Auth');

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Result object
 */
export async function login(email, password) {
    try {
        showLoading(true);
        logger.info('Attempting login', { email });

        const credential = await signInWithEmailAndPassword(auth, email, password);
        logger.info('Login successful', { uid: credential.user.uid });

        return { success: true, user: credential.user };
    } catch (error) {
        logger.error('Login failed', error);

        let message = 'Login failed. Please try again.';
        if (error.code === 'auth/invalid-credential' ||
            error.code === 'auth/wrong-password' ||
            error.code === 'auth/user-not-found') {
            message = 'Invalid email or password.';
        } else if (error.code === 'auth/too-many-requests') {
            message = 'Too many failed attempts. Please try again later.';
        } else if (error.code === 'auth/user-disabled') {
            message = 'This account has been disabled.';
        }

        return { success: false, error: message };
    } finally {
        showLoading(false);
    }
}

/**
 * Logout current user
 */
export async function logout() {
    try {
        logger.info('Logging out');

        // Clear all subscriptions
        clearSubscriptions();

        // Sign out from Firebase
        await signOut(auth);

        // Redirect to login
        window.location.href = 'index.html';
    } catch (error) {
        logger.error('Logout failed', error);
        showToast('Logout failed', 'error');
    }
}

/**
 * Change user password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Result object
 */
export async function changePassword(currentPassword, newPassword) {
    try {
        const user = auth.currentUser;
        if (!user || !user.email) {
            return { success: false, error: 'Not authenticated' };
        }

        // Re-authenticate user
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);

        // Update password
        await updatePassword(user, newPassword);

        logger.info('Password changed successfully');
        showToast('Password changed successfully', 'success');

        return { success: true };
    } catch (error) {
        logger.error('Password change failed', error);

        let message = 'Failed to change password.';
        if (error.code === 'auth/wrong-password') {
            message = 'Current password is incorrect.';
        } else if (error.code === 'auth/weak-password') {
            message = 'New password is too weak.';
        }

        return { success: false, error: message };
    }
}

/**
 * Load user profile from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} User profile
 */
export async function loadUserProfile(uid) {
    try {
        const userRef = doc(db, COLLECTIONS.USERS, uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            return userSnap.data();
        }

        return null;
    } catch (error) {
        logger.error('Failed to load user profile', error);
        return null;
    }
}

/**
 * Create or update user profile
 * @param {string} uid - User ID
 * @param {Object} data - Profile data
 * @returns {Promise<Object>} Result object
 */
export async function saveUserProfile(uid, data) {
    try {
        const userRef = doc(db, COLLECTIONS.USERS, uid);
        await setDoc(userRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });

        logger.info('Profile saved', { uid });
        return { success: true };
    } catch (error) {
        logger.error('Failed to save profile', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a new client user (admin only)
 * @param {Object} data - Client data
 * @returns {Promise<Object>} Result object
 */
export async function createClient(data) {
    try {
        const { email, password, displayName, company } = data;

        logger.info('Creating client via Cloud Function', { email, displayName });

        // Call Cloud Function to create Auth user
        const result = await callFunction('createClient', {
            email,
            password,
            displayName
        });

        // Create Firestore document
        await setDoc(doc(db, COLLECTIONS.USERS, result.data.uid), {
            email,
            displayName,
            company: company || '',
            role: USER_ROLES.CLIENT,
            status: 'active',
            createdAt: serverTimestamp(),
            createdBy: getCurrentUserId()
        });

        logger.info('Client created', { uid: result.data.uid });
        showToast('Client created successfully', 'success');

        return {
            success: true,
            id: result.data.uid,
            email
        };
    } catch (error) {
        logger.error('Failed to create client', error);

        let message = 'Failed to create client.';
        if (error.message?.includes('already-exists') ||
            error.message?.includes('email-already-in-use')) {
            message = 'Email address is already in use.';
        }

        showToast(message, 'error');
        return { success: false, error: message };
    }
}

/**
 * Initialize authentication state listener
 * @param {Function} callback - Callback when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function initAuthListener(callback) {
    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            logger.info('User authenticated', { uid: user.uid, email: user.email });
            setCurrentUser(user);

            // Load user profile
            let profile = await loadUserProfile(user.uid);

            // Create profile if doesn't exist
            if (!profile) {
                profile = {
                    email: user.email,
                    displayName: user.displayName || user.email.split('@')[0],
                    role: USER_ROLES.CLIENT,
                    createdAt: serverTimestamp()
                };
                await saveUserProfile(user.uid, profile);
            }

            setUserProfile(profile);
        } else {
            logger.info('User not authenticated');
            setCurrentUser(null);
            setUserProfile(null);
        }

        if (callback) {
            callback(user);
        }
    });
}

/**
 * Check if current page requires authentication
 * @returns {boolean} True if auth required
 */
export function requiresAuth() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['index.html', 'login.html'];
    return !publicPages.includes(page);
}

/**
 * Redirect based on auth state
 * @param {Object|null} user - Current user
 */
export function handleAuthRedirect(user) {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const isLoginPage = page === 'index.html' || page === 'login.html';

    if (user && isLoginPage) {
        window.location.href = 'dashboard.html';
    } else if (!user && !isLoginPage) {
        window.location.href = 'index.html';
    }
}

/**
 * Check if user has admin access
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} True if admin
 */
export async function checkAdminAccess(uid) {
    try {
        const profile = await loadUserProfile(uid);
        return profile?.role === USER_ROLES.ADMIN ||
               profile?.role === USER_ROLES.MANAGER;
    } catch (error) {
        logger.error('Failed to check admin access', error);
        return false;
    }
}

/**
 * Update last login timestamp
 * @param {string} uid - User ID
 */
export async function updateLastLogin(uid) {
    try {
        await saveUserProfile(uid, {
            lastLoginAt: serverTimestamp()
        });
    } catch (error) {
        logger.error('Failed to update last login', error);
    }
}
