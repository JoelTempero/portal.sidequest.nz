/* ============================================
   SIDEQUEST DIGITAL - Firebase Initialization
   ============================================ */

import { FIREBASE_CONFIG } from '../config/constants.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Firebase');

// Firebase SDK imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    serverTimestamp,
    setDoc,
    writeBatch,
    increment,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
    getStorage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import {
    getFunctions,
    httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

// Initialize Firebase
let app;
let auth;
let db;
let storage;
let functions;

try {
    app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    functions = getFunctions(app);
    logger.info('Firebase initialized successfully');
} catch (error) {
    logger.error('Firebase initialization failed', error);
    throw error;
}

// Export Firebase instances
export { app, auth, db, storage, functions };

// Export Firebase modules for use in services
export {
    // Auth
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,

    // Firestore
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    serverTimestamp,
    setDoc,
    writeBatch,
    increment,
    arrayUnion,
    arrayRemove,

    // Storage
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,

    // Functions
    httpsCallable
};

/**
 * Get a Firestore collection reference
 * @param {string} collectionName - Collection name
 * @returns {CollectionReference} Collection reference
 */
export function getCollection(collectionName) {
    return collection(db, collectionName);
}

/**
 * Get a Firestore document reference
 * @param {string} collectionName - Collection name
 * @param {string} docId - Document ID
 * @returns {DocumentReference} Document reference
 */
export function getDocRef(collectionName, docId) {
    return doc(db, collectionName, docId);
}

/**
 * Create a server timestamp
 * @returns {FieldValue} Server timestamp
 */
export function createTimestamp() {
    return serverTimestamp();
}

/**
 * Create a batch write
 * @returns {WriteBatch} Batch instance
 */
export function createBatch() {
    return writeBatch(db);
}

/**
 * Call a Cloud Function
 * @param {string} functionName - Function name
 * @param {Object} data - Data to pass to function
 * @returns {Promise} Function result
 */
export async function callFunction(functionName, data = {}) {
    const fn = httpsCallable(functions, functionName);
    return fn(data);
}

/**
 * Get a storage reference
 * @param {string} path - Storage path
 * @returns {StorageReference} Storage reference
 */
export function getStorageRef(path) {
    return ref(storage, path);
}
