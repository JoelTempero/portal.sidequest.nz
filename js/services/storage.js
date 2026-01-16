/* ============================================
   SIDEQUEST DIGITAL - Storage Service
   ============================================ */

import {
    storage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject
} from './firebase-init.js';

import { createLogger } from '../utils/logger.js';
import { validateFile, validateImage } from '../utils/validation.js';
import { sanitizeFilename } from '../utils/sanitize.js';
import { showToast } from '../components/toast.js';
import { FILE_CONFIG, STORAGE_PATHS } from '../config/constants.js';
import { formatFileSize } from '../utils/helpers.js';

const logger = createLogger('Storage');

/**
 * Upload a file to Firebase Storage
 * @param {File} file - File to upload
 * @param {string} path - Storage path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Result with URL
 */
export async function uploadFile(file, path, options = {}) {
    const {
        onProgress = null,
        validateFn = validateFile
    } = options;

    try {
        // Validate file
        const validation = validateFn(file);
        if (!validation.valid) {
            logger.warn('File validation failed', validation.errors);
            showToast(validation.errors[0], 'error');
            return { success: false, error: validation.errors[0] };
        }

        // Sanitize filename and create path
        const sanitizedName = sanitizeFilename(file.name);
        const fullPath = `${path}/${Date.now()}_${sanitizedName}`;
        const storageRef = ref(storage, fullPath);

        logger.info('Uploading file', { path: fullPath, size: file.size });

        // Use resumable upload if progress callback provided
        if (onProgress) {
            return await uploadWithProgress(file, storageRef, onProgress);
        }

        // Simple upload
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        logger.info('File uploaded successfully', { url });

        return {
            success: true,
            url,
            path: fullPath,
            size: file.size,
            name: sanitizedName
        };
    } catch (error) {
        logger.error('File upload failed', error);
        showToast('Failed to upload file', 'error');
        return { success: false, error: error.message };
    }
}

/**
 * Upload file with progress tracking
 * @param {File} file - File to upload
 * @param {StorageReference} storageRef - Storage reference
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Result with URL
 */
async function uploadWithProgress(file, storageRef, onProgress) {
    return new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress({
                    progress,
                    bytesTransferred: snapshot.bytesTransferred,
                    totalBytes: snapshot.totalBytes,
                    state: snapshot.state
                });
            },
            (error) => {
                logger.error('Upload error', error);
                reject({ success: false, error: error.message });
            },
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({
                    success: true,
                    url,
                    path: storageRef.fullPath,
                    size: file.size
                });
            }
        );
    });
}

/**
 * Upload an image file
 * @param {File} file - Image file
 * @param {string} path - Storage path
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Result with URL
 */
export async function uploadImage(file, path, options = {}) {
    return uploadFile(file, path, {
        ...options,
        validateFn: validateImage
    });
}

/**
 * Upload a logo for a lead/project
 * @param {File} file - Logo file
 * @param {string} itemId - Lead or project ID
 * @param {string} type - 'lead' or 'project'
 * @returns {Promise<Object>} Result with URL
 */
export async function uploadLogo(file, itemId, type = 'project') {
    const path = `${STORAGE_PATHS.LOGOS}/${type}s/${itemId}`;
    const result = await uploadImage(file, path);

    if (result.success) {
        showToast('Logo uploaded!', 'success');
    }

    return result;
}

/**
 * Upload an avatar
 * @param {File} file - Avatar file
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result with URL
 */
export async function uploadAvatar(file, userId) {
    const path = `${STORAGE_PATHS.AVATARS}/${userId}`;
    const result = await uploadImage(file, path);

    if (result.success) {
        showToast('Avatar uploaded!', 'success');
    }

    return result;
}

/**
 * Upload a post image
 * @param {File} file - Image file
 * @param {string} postId - Post ID
 * @param {string} imageType - 'featured', 'gallery', or 'logo'
 * @returns {Promise<Object>} Result with URL
 */
export async function uploadPostImage(file, postId, imageType = 'featured') {
    const path = `${STORAGE_PATHS.POSTS}/${postId}/${imageType}`;
    return uploadImage(file, path);
}

/**
 * Upload multiple files
 * @param {FileList|File[]} files - Files to upload
 * @param {string} basePath - Base storage path
 * @param {Object} options - Upload options
 * @returns {Promise<Object[]>} Array of results
 */
export async function uploadMultipleFiles(files, basePath, options = {}) {
    const { onFileProgress = null, onOverallProgress = null } = options;

    const fileArray = Array.from(files);
    const results = [];
    let completedCount = 0;

    for (const file of fileArray) {
        const result = await uploadFile(file, basePath, {
            onProgress: onFileProgress ? (progress) => {
                onFileProgress(file.name, progress);
            } : null
        });

        results.push({
            file: file.name,
            ...result
        });

        completedCount++;
        if (onOverallProgress) {
            onOverallProgress({
                completed: completedCount,
                total: fileArray.length,
                percentage: (completedCount / fileArray.length) * 100
            });
        }
    }

    return results;
}

/**
 * Delete a file from storage
 * @param {string} path - Storage path
 * @returns {Promise<Object>} Result
 */
export async function deleteFile(path) {
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        logger.info('File deleted', { path });
        return { success: true };
    } catch (error) {
        // Ignore if file doesn't exist
        if (error.code === 'storage/object-not-found') {
            logger.info('File not found, skipping delete', { path });
            return { success: true };
        }
        logger.error('Failed to delete file', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a file by URL
 * @param {string} url - File URL
 * @returns {Promise<Object>} Result
 */
export async function deleteFileByUrl(url) {
    try {
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
        return { success: true };
    } catch (error) {
        if (error.code === 'storage/object-not-found') {
            return { success: true };
        }
        logger.error('Failed to delete file by URL', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get download URL for a path
 * @param {string} path - Storage path
 * @returns {Promise<string|null>} Download URL
 */
export async function getFileUrl(path) {
    try {
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
    } catch (error) {
        logger.error('Failed to get file URL', error);
        return null;
    }
}

/**
 * Create an object URL for preview
 * @param {File} file - File to preview
 * @returns {string} Object URL
 */
export function createPreviewUrl(file) {
    return URL.createObjectURL(file);
}

/**
 * Revoke an object URL
 * @param {string} url - Object URL to revoke
 */
export function revokePreviewUrl(url) {
    URL.revokeObjectURL(url);
}

/**
 * Compress an image before upload
 * @param {File} file - Image file
 * @param {Object} options - Compression options
 * @returns {Promise<File>} Compressed file
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
        type = 'image/jpeg'
    } = options;

    // Skip compression for small files or non-images
    if (file.size < 100 * 1024 || !file.type.startsWith('image/')) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            let { width, height } = img;

            // Calculate new dimensions
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type,
                            lastModified: Date.now()
                        });
                        logger.debug('Image compressed', {
                            original: formatFileSize(file.size),
                            compressed: formatFileSize(compressedFile.size)
                        });
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                },
                type,
                quality
            );

            URL.revokeObjectURL(img.src);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * Check if file type is allowed
 * @param {File} file - File to check
 * @param {string[]} allowedTypes - Allowed MIME types
 * @returns {boolean} True if allowed
 */
export function isFileTypeAllowed(file, allowedTypes = FILE_CONFIG.ALLOWED_TYPES) {
    return allowedTypes.includes(file.type);
}

/**
 * Check if file size is within limit
 * @param {File} file - File to check
 * @param {number} maxSize - Max size in bytes
 * @returns {boolean} True if within limit
 */
export function isFileSizeValid(file, maxSize = FILE_CONFIG.MAX_SIZE_BYTES) {
    return file.size <= maxSize;
}

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} Extension without dot
 */
export function getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if file is an image
 * @param {File} file - File to check
 * @returns {boolean} True if image
 */
export function isImage(file) {
    return file.type.startsWith('image/');
}

/**
 * Check if file is a PDF
 * @param {File} file - File to check
 * @returns {boolean} True if PDF
 */
export function isPdf(file) {
    return file.type === 'application/pdf';
}
