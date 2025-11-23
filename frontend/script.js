// ==================== AUTH CHECK ====================
const token = localStorage.getItem('authToken');

// Redirect to login if no token
if (!token) {
    window.location.href = '/login.html';
}

// ==================== API HELPER ====================
async function fetchAPI(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const response = await fetch(`http://localhost:3000${endpoint}`, {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
    });

    if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
        return;
    }

    return response.json();
}

// ==================== LOAD USER DATA ====================
async function loadUserData() {
    try {
        const user = await fetchAPI('/api/users/me');
        
        // Update sidebar with user info
        const displayName = user.displayName || user.username;
        document.querySelector('.account-info h3').textContent = displayName;
        document.querySelector('.account-info p').textContent = `@${user.username}`;
        
        // Update avatar if available
        const avatarElement = document.querySelector('.account-avatar');
        if (user.avatarUrl && user.avatarUrl.trim() !== '') {
            avatarElement.innerHTML = `<img src="${user.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="Avatar">`;
        } else {
            avatarElement.innerHTML = '👤';
        }
        
        console.log('User loaded:', user);
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

// ==================== LOAD FEED ====================
async function loadFeed() {
    try {
        const posts = await fetchAPI('/api/posts/feed');
        
        const feedContainer = document.querySelector('#feed-view');
        const storiesSection = feedContainer.querySelector('.stories');
        
        // Clear existing posts (keep stories)
        const existingPosts = feedContainer.querySelectorAll('.post');
        existingPosts.forEach(post => post.remove());
        
        // Add posts after stories
        posts.forEach(post => {
            const postElement = createPostElement(post);
            feedContainer.appendChild(postElement);
        });
        
        console.log('Feed loaded:', posts);
    } catch (error) {
        console.error('Error loading feed:', error);
    }
}

// ==================== CREATE POST ELEMENT ====================
function createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'post';
    div.innerHTML = `
        <div class="post-header">
            <div class="post-author">
                <div class="post-avatar-small">${post.avatar || '👤'}</div>
                <div class="author-info">
                    <h4>${post.displayName || post.username}</h4>
                    <p>@${post.username} • ${post.timestamp || 'Just now'}</p>
                </div>
            </div>
            <button class="post-menu">⋯</button>
        </div>
        <div class="post-text">${post.content}</div>
        ${post.mediaUrl ? `<img src="${post.mediaUrl}" style="width:100%;border-radius:8px;margin:10px 0;">` : ''}
        <div class="post-buttons">
            <button class="post-btn" onclick="likePost('${post.id}')">🤍 Like ${post.likes > 0 ? `(${post.likes})` : ''}</button>
            <button class="post-btn">💬 Comment ${post.comments > 0 ? `(${post.comments})` : ''}</button>
            <button class="post-btn">↗️ Share</button>
        </div>
    `;
    return div;
}

// ==================== POST ACTIONS ====================
async function likePost(postId) {
    try {
        // Implement like functionality
        console.log('Liked post:', postId);
    } catch (error) {
        console.error('Error liking post:', error);
    }
}

// ==================== TOGGLE VIEWS ====================
function showFeed() {
    document.getElementById('feed-view').classList.add('active');
    document.getElementById('messages-view').classList.remove('active');
    document.querySelectorAll('.toggle-btn')[0].classList.add('active');
    document.querySelectorAll('.toggle-btn')[1].classList.remove('active');
}

function showMessages() {
    document.getElementById('feed-view').classList.remove('active');
    document.getElementById('messages-view').classList.add('active');
    document.querySelectorAll('.toggle-btn')[0].classList.remove('active');
    document.querySelectorAll('.toggle-btn')[1].classList.add('active');
}

// ==================== POST MODAL ====================
function showPostModal() {
    document.getElementById('postModal').classList.add('active');
}

function closePostModal() {
    document.getElementById('postModal').classList.remove('active');
}

function selectPostType(type) {
    const buttons = document.querySelectorAll('.type-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('textForm').classList.remove('active');
    document.getElementById('fileForm').classList.remove('active');

    if (type === 'text') {
        document.getElementById('textForm').classList.add('active');
    } else {
        document.getElementById('fileForm').classList.add('active');
    }
}

// Close modal when clicking outside
document.getElementById('postModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closePostModal();
    }
});

// ==================== CREATE POST ====================
document.querySelector('.btn-post').addEventListener('click', async function() {
    try {
        const textForm = document.getElementById('textForm');
        const fileForm = document.getElementById('fileForm');
        
        let postData = {};
        
        if (textForm.classList.contains('active')) {
            const content = textForm.querySelector('textarea').value.trim();
            if (!content) {
                alert('Please enter some text');
                return;
            }
            postData = { content, type: 'text' };
        } else {
            const fileInput = fileForm.querySelector('input[type="file"]');
            const caption = fileForm.querySelector('input[type="text"]').value.trim();
            
            if (!fileInput.files[0]) {
                alert('Please select a file');
                return;
            }
            
            // For now, just use caption as content
            // In production, you'd upload the file to a server/cloud storage
            postData = { content: caption || 'Shared a file', type: 'file' };
        }
        
        const response = await fetchAPI('/api/posts', {
            method: 'POST',
            body: JSON.stringify(postData)
        });
        
        console.log('Post created:', response);
        
        // Clear form and close modal
        textForm.querySelector('textarea').value = '';
        fileForm.querySelector('input[type="text"]').value = '';
        fileForm.querySelector('input[type="file"]').value = '';
        closePostModal();
        
        // Reload feed
        await loadFeed();
        
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post');
    }
});

// ==================== SEARCH MODAL ====================
let searchTimeout = null;

function showSearchModal() {
    document.getElementById('searchModal').classList.add('active');
    document.getElementById('searchInput').focus();
}

function closeSearchModal() {
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
}

async function searchUsers() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsContainer = document.getElementById('searchResults');

    if (query.length < 2) {
        resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#8b8d91;font-size:14px;">Type at least 2 characters to search</div>';
        return;
    }

    // Debounce search
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        try {
            resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#8b8d91;">Searching...</div>';

            const users = await fetchAPI(`/api/users/search?q=${encodeURIComponent(query)}`);

            if (users.length === 0) {
                resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#8b8d91;font-size:14px;">No users found</div>';
                return;
            }

            resultsContainer.innerHTML = users.map(user => `
                <div class="search-result-item" data-user-id="${user.id}">
                    <div class="search-user-avatar">${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="">` : '👤'}</div>
                    <div class="search-user-info">
                        <div class="search-user-name">${user.displayName}</div>
                        <div class="search-user-username">@${user.username}</div>
                        <div class="search-user-stats">${user.followersCount} followers</div>
                    </div>
                    <button class="follow-btn" onclick="toggleFollow('${user.id}')" id="followBtn-${user.id}">
                        Loading...
                    </button>
                </div>
            `).join('');

            // Check follow status for each user
            users.forEach(user => checkFollowStatus(user.id));

        } catch (error) {
            console.error('Search error:', error);
            resultsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#ff7979;">Error searching users</div>';
        }
    }, 500);
}

async function checkFollowStatus(userId) {
    try {
        const result = await fetchAPI(`/api/users/${userId}/following`);
        const btn = document.getElementById(`followBtn-${userId}`);
        if (btn) {
            btn.textContent = result.following ? 'Unfollow' : 'Follow';
            btn.classList.toggle('following', result.following);
        }
    } catch (error) {
        console.error('Check follow status error:', error);
    }
}

async function toggleFollow(userId) {
    const btn = document.getElementById(`followBtn-${userId}`);
    const isFollowing = btn.classList.contains('following');

    try {
        btn.disabled = true;
        btn.textContent = isFollowing ? 'Unfollowing...' : 'Following...';

        if (isFollowing) {
            await fetchAPI(`/api/users/${userId}/follow`, { method: 'DELETE' });
            btn.textContent = 'Follow';
            btn.classList.remove('following');
        } else {
            await fetchAPI(`/api/users/${userId}/follow`, { method: 'POST' });
            btn.textContent = 'Unfollow';
            btn.classList.add('following');
        }
    } catch (error) {
        console.error('Toggle follow error:', error);
        btn.textContent = isFollowing ? 'Unfollow' : 'Follow';
    } finally {
        btn.disabled = false;
    }
}

// Close search modal when clicking outside
document.getElementById('searchModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeSearchModal();
    }
});

// ==================== LOGOUT ====================
function logout() {
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', async function() {
    await loadUserData();
    await loadFeed();
});