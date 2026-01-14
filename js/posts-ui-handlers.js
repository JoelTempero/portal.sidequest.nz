// ============================================
// POSTS UI HANDLERS - Add to app.js
// ============================================

// Add these imports at the top (merge with existing firebase-portal.js imports):
// loadPosts, subscribeToPosts, createPost, updatePost, deletePost, createPostFromProject, generateSlug

// ============================================
// POSTS STATE
// ============================================

let postEditorState = {
    quill: null,
    featuredImageFile: null,
    featuredImageUrl: null,
    galleryFiles: [],
    galleryUrls: [],
    published: false,
    featured: false,
    editingId: null
};

let postsFilter = 'all';

// ============================================
// POSTS RENDERING
// ============================================

function renderPosts(containerId) {
    const c = document.getElementById(containerId);
    if (!c) return;
    
    let posts = AppState.posts || [];
    
    // Apply filter
    if (postsFilter === 'published') {
        posts = posts.filter(p => p.published);
    } else if (postsFilter === 'draft') {
        posts = posts.filter(p => !p.published);
    } else if (postsFilter === 'featured') {
        posts = posts.filter(p => p.featured);
    }
    
    if (!posts.length) {
        c.innerHTML = `<div class="empty-state"><h3>${postsFilter === 'all' ? 'No posts yet' : 'No ' + postsFilter + ' posts'}</h3><p>Create a post from a project or click "New Post"</p></div>`;
        return;
    }
    
    c.innerHTML = posts.map(post => `
        <div class="post-card" onclick="openEditPostModal('${post.id}')">
            ${post.featuredImage 
                ? `<div class="post-card-image" style="background-image:url('${post.featuredImage}')"></div>`
                : `<div class="post-card-image">No image</div>`
            }
            <div class="post-card-body">
                <div class="post-card-title">${post.title || 'Untitled'}</div>
                <div class="post-card-summary">${post.summary || 'No summary'}</div>
                <div class="post-card-meta">
                    <span class="post-status ${post.published ? 'published' : 'draft'}">${post.published ? 'Published' : 'Draft'}</span>
                    ${post.featured ? '<span class="post-status featured">Featured</span>' : ''}
                </div>
                ${post.tags && post.tags.length ? `
                    <div class="post-tags" style="margin-top:8px;">
                        ${post.tags.map(tag => `<span class="post-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

window.filterPosts = (filter) => {
    postsFilter = filter;
    
    // Update button states
    document.querySelectorAll('.filter-tabs .btn').forEach(btn => {
        btn.classList.remove('active', 'btn-secondary');
        btn.classList.add('btn-ghost');
    });
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-ghost');
        activeBtn.classList.add('btn-secondary', 'active');
    }
    
    renderPosts('posts-grid');
};

// ============================================
// POST EDITOR
// ============================================

function initQuillEditor() {
    if (postEditorState.quill) return;
    
    const editorEl = document.getElementById('post-description-editor');
    if (!editorEl) return;
    
    postEditorState.quill = new Quill('#post-description-editor', {
        theme: 'snow',
        placeholder: 'Write your case study content here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean']
            ]
        }
    });
}

function resetPostEditor() {
    postEditorState = {
        quill: postEditorState.quill,
        featuredImageFile: null,
        featuredImageUrl: null,
        galleryFiles: [],
        galleryUrls: [],
        published: false,
        featured: false,
        editingId: null
    };
    
    // Reset form fields
    document.getElementById('post-id').value = '';
    document.getElementById('post-project-id').value = '';
    document.getElementById('post-title').value = '';
    document.getElementById('post-slug').value = '';
    document.getElementById('post-summary').value = '';
    document.getElementById('post-tags').value = '';
    
    // Reset quill
    if (postEditorState.quill) {
        postEditorState.quill.root.innerHTML = '';
    }
    
    // Reset featured image
    const featuredArea = document.getElementById('featured-image-area');
    if (featuredArea) {
        featuredArea.innerHTML = `<div class="placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>Click to upload featured image</div>`;
        featuredArea.classList.remove('has-image');
    }
    
    // Reset gallery
    document.getElementById('gallery-preview').innerHTML = '';
    
    // Reset toggles
    document.getElementById('toggle-published')?.classList.remove('active');
    document.getElementById('toggle-featured')?.classList.remove('active');
    
    // Reset slug preview
    document.getElementById('slug-preview-text').textContent = '...';
    
    // Hide delete button for new posts
    const deleteBtn = document.getElementById('delete-post-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';
}

window.openNewPostModal = () => {
    resetPostEditor();
    document.getElementById('post-modal-title').textContent = 'New Post';
    initQuillEditor();
    openModal('post-editor-modal');
};

window.openEditPostModal = (postId) => {
    const post = AppState.posts.find(p => p.id === postId);
    if (!post) return;
    
    resetPostEditor();
    postEditorState.editingId = postId;
    
    document.getElementById('post-modal-title').textContent = 'Edit Post';
    document.getElementById('post-id').value = postId;
    document.getElementById('post-project-id').value = post.projectId || '';
    document.getElementById('post-title').value = post.title || '';
    document.getElementById('post-slug').value = post.slug || '';
    document.getElementById('post-summary').value = post.summary || '';
    document.getElementById('post-tags').value = (post.tags || []).join(', ');
    
    // Set featured image
    if (post.featuredImage) {
        postEditorState.featuredImageUrl = post.featuredImage;
        const featuredArea = document.getElementById('featured-image-area');
        featuredArea.innerHTML = `<img src="${post.featuredImage}" alt="Featured">`;
        featuredArea.classList.add('has-image');
    }
    
    // Set gallery images
    if (post.galleryImages && post.galleryImages.length) {
        postEditorState.galleryUrls = [...post.galleryImages];
        renderGalleryPreview();
    }
    
    // Set toggles
    postEditorState.published = post.published || false;
    postEditorState.featured = post.featured || false;
    if (post.published) document.getElementById('toggle-published')?.classList.add('active');
    if (post.featured) document.getElementById('toggle-featured')?.classList.add('active');
    
    // Set slug preview
    updateSlugPreview(post.slug);
    
    // Show delete button for existing posts
    const deleteBtn = document.getElementById('delete-post-btn');
    if (deleteBtn) deleteBtn.style.display = 'block';
    
    // Init quill and set content
    initQuillEditor();
    if (postEditorState.quill && post.description) {
        postEditorState.quill.root.innerHTML = post.description;
    }
    
    openModal('post-editor-modal');
};

window.toggleSwitch = (type) => {
    const toggle = document.getElementById(`toggle-${type}`);
    if (!toggle) return;
    
    if (type === 'published') {
        postEditorState.published = !postEditorState.published;
        toggle.classList.toggle('active', postEditorState.published);
    } else if (type === 'featured') {
        postEditorState.featured = !postEditorState.featured;
        toggle.classList.toggle('active', postEditorState.featured);
    }
};

window.handleFeaturedImageSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    postEditorState.featuredImageFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const featuredArea = document.getElementById('featured-image-area');
        featuredArea.innerHTML = `<img src="${e.target.result}" alt="Featured">`;
        featuredArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
};

window.handleGalleryImagesSelect = (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    
    files.forEach(file => {
        postEditorState.galleryFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            postEditorState.galleryUrls.push(e.target.result);
            renderGalleryPreview();
        };
        reader.readAsDataURL(file);
    });
};

function renderGalleryPreview() {
    const container = document.getElementById('gallery-preview');
    if (!container) return;
    
    container.innerHTML = postEditorState.galleryUrls.map((url, index) => `
        <div class="gallery-item">
            <img src="${url}" alt="Gallery ${index + 1}">
            <button class="remove-btn" onclick="removeGalleryImage(${index}, event)">×</button>
        </div>
    `).join('');
}

window.removeGalleryImage = (index, event) => {
    event.stopPropagation();
    postEditorState.galleryUrls.splice(index, 1);
    postEditorState.galleryFiles.splice(index, 1);
    renderGalleryPreview();
};

function updateSlugPreview(slug) {
    const preview = document.getElementById('slug-preview-text');
    if (preview) {
        preview.textContent = slug || '...';
    }
}

// Auto-generate slug from title
document.getElementById('post-title')?.addEventListener('input', (e) => {
    const slugInput = document.getElementById('post-slug');
    if (slugInput && !slugInput.value) {
        const generatedSlug = generateSlug(e.target.value);
        slugInput.placeholder = generatedSlug;
        updateSlugPreview(generatedSlug);
    }
});

document.getElementById('post-slug')?.addEventListener('input', (e) => {
    updateSlugPreview(e.target.value || document.getElementById('post-slug').placeholder);
});

window.handleSavePost = async () => {
    const title = document.getElementById('post-title').value.trim();
    const slug = document.getElementById('post-slug').value.trim() || generateSlug(title);
    const summary = document.getElementById('post-summary').value.trim();
    const description = postEditorState.quill ? postEditorState.quill.root.innerHTML : '';
    const tagsRaw = document.getElementById('post-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    const projectId = document.getElementById('post-project-id').value || null;
    
    if (!title) {
        showToast('Title is required', 'error');
        return;
    }
    
    const postData = {
        title,
        slug,
        summary,
        description,
        tags,
        projectId,
        published: postEditorState.published,
        featured: postEditorState.featured,
        featuredImage: postEditorState.featuredImageUrl,
        galleryImages: postEditorState.galleryUrls.filter(url => !url.startsWith('data:'))
    };
    
    showLoading(true);
    
    let result;
    if (postEditorState.editingId) {
        // Update existing post
        result = await updatePost(
            postEditorState.editingId, 
            postData, 
            postEditorState.featuredImageFile,
            postEditorState.galleryFiles
        );
    } else {
        // Create new post
        result = await createPost(
            postData,
            postEditorState.featuredImageFile,
            postEditorState.galleryFiles
        );
    }
    
    showLoading(false);
    
    if (result.success) {
        closeAllModals();
    }
};

window.handleDeletePost = async () => {
    if (!postEditorState.editingId) return;
    
    if (confirm('Are you sure you want to delete this post? This cannot be undone.')) {
        showLoading(true);
        const result = await deletePost(postEditorState.editingId);
        showLoading(false);
        
        if (result.success) {
            closeAllModals();
        }
    }
};

// ============================================
// CREATE POST FROM PROJECT
// ============================================

window.handleMakePost = async (projectId) => {
    showLoading(true);
    const result = await createPostFromProject(projectId);
    showLoading(false);
    
    if (result.success) {
        // Redirect to posts page with the new post open
        window.location.href = `posts.html?edit=${result.id}`;
    }
};

// ============================================
// POSTS PAGE INIT
// ============================================

// Add to the page init switch in app.js:
// case 'posts.html':
//     subscribeToPosts(() => renderPosts('posts-grid'));
//     renderPosts('posts-grid');
//     
//     // Check if we should open a post for editing
//     const editId = new URLSearchParams(location.search).get('edit');
//     if (editId) {
//         setTimeout(() => openEditPostModal(editId), 500);
//     }
//     break;
