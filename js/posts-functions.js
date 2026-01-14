// ============================================
// POSTS FUNCTIONS - Add to firebase-portal.js
// ============================================

// Add these imports at the top (merge with existing):
// import { ... deleteDoc ... } from firebase-firestore

// Add to AppState object:
// posts: [],

// POSTS CRUD Functions - Add after TICKETS section:

async function loadPosts() {
    try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const s = await getDocs(q);
        AppState.posts = s.docs.map(d => ({ id: d.id, ...d.data() }));
        return AppState.posts;
    } catch (e) {
        console.error('Load posts error:', e);
        return [];
    }
}

function subscribeToPosts(cb) {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const u = onSnapshot(q, s => {
        AppState.posts = s.docs.map(d => ({ id: d.id, ...d.data() }));
        if (cb) cb(AppState.posts);
    });
    AppState.unsubscribers.push(u);
    return u;
}

async function createPost(data, featuredImageFile = null, galleryFiles = []) {
    try {
        // Create the post first
        const postData = {
            title: data.title || '',
            slug: data.slug || generateSlug(data.title),
            summary: data.summary || '',
            description: data.description || '',
            featuredImage: data.featuredImage || null,
            galleryImages: data.galleryImages || [],
            tags: data.tags || [],
            projectId: data.projectId || null,
            published: data.published || false,
            featured: data.featured || false,
            publishedAt: data.published ? serverTimestamp() : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const ref = await addDoc(collection(db, 'posts'), postData);
        
        // Upload featured image if provided
        if (featuredImageFile) {
            const url = await uploadFile(featuredImageFile, `posts/${ref.id}/featured_${Date.now()}_${featuredImageFile.name}`);
            if (url) await updateDoc(doc(db, 'posts', ref.id), { featuredImage: url });
        }
        
        // Upload gallery images if provided
        if (galleryFiles.length > 0) {
            const galleryUrls = [];
            for (const file of galleryFiles) {
                const url = await uploadFile(file, `posts/${ref.id}/gallery_${Date.now()}_${file.name}`);
                if (url) galleryUrls.push(url);
            }
            if (galleryUrls.length > 0) {
                await updateDoc(doc(db, 'posts', ref.id), { galleryImages: galleryUrls });
            }
        }
        
        showToast('Post created!', 'success');
        return { success: true, id: ref.id };
    } catch (e) {
        console.error('Create post error:', e);
        showToast('Failed to create post', 'error');
        return { success: false };
    }
}

async function updatePost(id, updates, featuredImageFile = null, newGalleryFiles = []) {
    try {
        const updateData = {
            ...updates,
            updatedAt: serverTimestamp()
        };
        
        // If publishing for first time, set publishedAt
        if (updates.published && !updates.publishedAt) {
            updateData.publishedAt = serverTimestamp();
        }
        
        // Upload new featured image if provided
        if (featuredImageFile) {
            const url = await uploadFile(featuredImageFile, `posts/${id}/featured_${Date.now()}_${featuredImageFile.name}`);
            if (url) updateData.featuredImage = url;
        }
        
        // Upload new gallery images if provided
        if (newGalleryFiles.length > 0) {
            const existingGallery = updates.galleryImages || [];
            const newUrls = [];
            for (const file of newGalleryFiles) {
                const url = await uploadFile(file, `posts/${id}/gallery_${Date.now()}_${file.name}`);
                if (url) newUrls.push(url);
            }
            updateData.galleryImages = [...existingGallery, ...newUrls];
        }
        
        await updateDoc(doc(db, 'posts', id), updateData);
        showToast('Post updated!', 'success');
        return { success: true };
    } catch (e) {
        console.error('Update post error:', e);
        showToast('Failed to update post', 'error');
        return { success: false };
    }
}

async function deletePost(id) {
    try {
        await deleteDoc(doc(db, 'posts', id));
        showToast('Post deleted!', 'success');
        return { success: true };
    } catch (e) {
        console.error('Delete post error:', e);
        showToast('Failed to delete post', 'error');
        return { success: false };
    }
}

async function createPostFromProject(projectId) {
    try {
        const snap = await getDoc(doc(db, 'projects', projectId));
        if (!snap.exists()) {
            showToast('Project not found', 'error');
            return { success: false };
        }
        
        const project = snap.data();
        
        // Create draft post pre-populated with project data
        const postData = {
            title: project.companyName || 'Untitled Project',
            slug: generateSlug(project.companyName),
            summary: '',
            description: '',
            featuredImage: project.logo || null,
            galleryImages: [],
            tags: [project.businessType, project.location].filter(Boolean),
            projectId: projectId,
            published: false,
            featured: false,
            publishedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const ref = await addDoc(collection(db, 'posts'), postData);
        showToast('Draft post created! Opening editor...', 'success');
        return { success: true, id: ref.id };
    } catch (e) {
        console.error('Create post from project error:', e);
        showToast('Failed to create post', 'error');
        return { success: false };
    }
}

function generateSlug(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Add to exports:
// loadPosts, subscribeToPosts, createPost, updatePost, deletePost, createPostFromProject, generateSlug
