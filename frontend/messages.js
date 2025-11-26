// message.js - API-backed client (fixed: buttons + token handling + redirects)
document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = '/api';
  const convListContainer = document.querySelector('.conversations-list');
  const navItems = document.querySelectorAll('.nav-item');

  // Elements that might exist on page
  const feedBtn = document.querySelector('.feed-btn');
  const newMsgBtn = document.querySelector('.new-message-btn');
  const logoutBtn = document.querySelector('.logout-btn');
  const searchBtn = document.querySelector('.search-btn');
if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openSearchOverlay();
    });
}


  // If no token -> send user to login immediately (prevent 401s)
  if (!localStorage.getItem('token')) {
    // If you want a different path, change 'login.html'
    window.location.href = 'login.html';
    return;
  }

  // load conversations
  loadConversations();

  // -------------------------
  // Nav behavior (fixed)
  // -------------------------
  if (navItems && navItems.length) {
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't handle clicks on the logout button
        if (e.target.closest('.logout-btn')) {
          return;
        }

        // allow anchors that actually point to pages to navigate
        const href = item.getAttribute('href');
        if (href && href !== '#') {
          // let the browser navigate naturally (no SPA interception)
          return;
        }

        // If this is the search item (icon or label) -> open overlay
        const icon = item.querySelector('.nav-icon')?.textContent?.trim();
        const label = item.textContent.trim().toLowerCase();
        if (icon === '🔍' || label.includes('search')) {
          e.preventDefault();
          e.stopPropagation();
          openSearchOverlay();
          return;
        }

        // For other href="#" items we want SPA behavior for UI only (no navigation)
        e.preventDefault();
        e.stopPropagation();

        // Toggle active state visually
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // (Optional) add custom behavior for other items here:
        // if (label.includes('home')) { showHomeView(); }
        // else if (label.includes('profile')) { showProfileView(); }
      });
    });
  }

  // feed button navigation (if exists)
  if (feedBtn) {
    feedBtn.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  // new message button -> open search overlay
  if (newMsgBtn) {
    newMsgBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openSearchOverlay();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // prevent bubbling to any parent nav click handlers
      if (confirm('Logout from SocialSync?')) {
        localStorage.removeItem('token');
        // redirect to login or landing
        window.location.href = 'login.html';
      }
    });
  }

  // click conversation (delegation)
  if (convListContainer) {
    convListContainer.addEventListener('click', (ev) => {
      const item = ev.target.closest('.conversation-item');
      if (!item) return;
      const username = item.dataset.username;
      if (!username) return;
      openChatThread(username);
    });
  }

  /* ----- Robust API helper (reads token on each call, sanitizes it, checks expiry) ----- */
  async function apiFetch(path, opts = {}) {
    // Normalise headers whether opts.headers is a Headers object or plain object
    const userHeaders = {};
    if (opts.headers instanceof Headers) {
      // copy Headers into plain object
      for (const pair of opts.headers.entries()) userHeaders[pair[0]] = pair[1];
    } else {
      Object.assign(userHeaders, opts.headers || {});
    }

    userHeaders['Content-Type'] = userHeaders['Content-Type'] || 'application/json';

    // get token and sanitize (strip wrapping quotes if accidentally stored via JSON.stringify)
    let token = localStorage.getItem('token') || '';
    if (!token) {
      // immediately redirect to login to avoid repeated 401s
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      throw new Error('No token found – redirecting to login');
    }
    // remove potential wrapping double-quotes: "ey..." => ey...
    token = token.replace(/^"(.*)"$/, '$1').trim();

    // quick expiry check (if token is malformed this try/catch will continue so we still send it)
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload && payload.exp && Date.now() >= payload.exp * 1000) {
          localStorage.removeItem('token');
          window.location.href = 'login.html';
          throw new Error('Token expired – please login again');
        }
      }
    } catch (e) {
      // decoding failed -> still attempt to send token; server will reject but we don't break here
      console.warn('Unable to decode token payload locally (may be malformed):', e);
    }

    // attach sanitized token
    userHeaders['Authorization'] = `Bearer ${token}`;

    // build fetch options (ensure headers replaced by our plain object)
    const fetchOpts = { ...opts, headers: userHeaders };

    // remove `body` for GET requests (some fetch impls throw if body on GET)
    const method = (fetchOpts.method || 'GET').toUpperCase();
    if (method === 'GET' && fetchOpts.body) delete fetchOpts.body;

    const res = await fetch(API_BASE + path, fetchOpts);

    if (res.status === 401) {
      // help debugging: attempt to get body text, but don't crash
      const txt = await res.text().catch(()=>res.statusText);
      console.error('401 from API:', txt);
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      throw new Error('Unauthorized – token rejected by server');
    }

    if (!res.ok) {
      const body = await res.json().catch(()=>({}));
      const errMsg = body.error || body.message || res.statusText;
      throw new Error(errMsg);
    }
    return res.json();
  }

  /* ----- Load conversations from backend ----- */
  async function loadConversations(){
    try {
      const data = await apiFetch('/conversations');
      if (!convListContainer) return;
      convListContainer.innerHTML = '';
      if (!data.conversations || !data.conversations.length) {
        convListContainer.innerHTML = `<div style="color:var(--muted);padding:12px;border-radius:8px;background:var(--glass)">No conversations yet. Use search to find someone.</div>`;
        return;
      }
      
      data.conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.username = conv.with.username;
        
        const displayName = conv.with.displayName || conv.with.username;
        const lastMsg = conv.lastMessage?.text || 'No messages yet';
        const timeStr = conv.lastMessage?.createdAt ? timeAgo(new Date(conv.lastMessage.createdAt).getTime()) : '';
        
        item.innerHTML = `
          <div class="conversation-avatar">
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
              <circle cx="25" cy="25" r="25" fill="#6B7FD7"/>
              <path d="M25 25C28.866 25 32 21.866 32 18C32 14.134 28.866 11 25 11C21.134 11 18 14.134 18 18C18 21.866 21.134 25 25 25Z" fill="white"/>
              <path d="M25 27.5C17.2156 27.5 11 33.7156 11 41.5V45H39V41.5C39 33.7156 32.7844 27.5 25 27.5Z" fill="white"/>
            </svg>
          </div>
          <div class="conversation-info">
            <h3>${escapeHtml(displayName)}</h3>
            <p class="last-message">${escapeHtml(lastMsg)}</p>
          </div>
          <div class="conversation-meta">
            <span class="time">${escapeHtml(timeStr)}</span>
          </div>
        `;
        
        convListContainer.appendChild(item);
      });
    } catch (err) {
      console.error('loadConversations error:', err);
      if (!convListContainer) return;
      if (err.code === 401 || /token/i.test(err.message)) {
        // show a non-invasive UI so user can re-login
        convListContainer.innerHTML = `
          <div style="color:var(--muted);padding:12px;border-radius:8px;background:var(--glass);display:flex;flex-direction:column;gap:8px">
            <div>Session expired or unauthorized. Please <strong>log in</strong> to continue.</div>
            <div style="display:flex;gap:8px">
              <button id="loginAgainBtn" style="padding:8px 12px;border-radius:8px;border:none;background:var(--accent);color:white;cursor:pointer">Login</button>
              <button id="retryConvoBtn" style="padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:inherit;cursor:pointer">Retry</button>
            </div>
          </div>
        `;
        document.getElementById('loginAgainBtn').addEventListener('click', () => {
          localStorage.removeItem('token');
          window.location.href = 'login.html';
        });
        document.getElementById('retryConvoBtn').addEventListener('click', () => {
          loadConversations();
        });
      } else {
        convListContainer.innerHTML = `<div style="color:#f66">Failed to load conversations: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  /* ----- Search overlay (calls backend) ----- */
  function openSearchOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(3,6,10,0.6)';
    overlay.style.zIndex = 9999;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = `
      <div style="width:720px;max-width:94%;background:linear-gradient(180deg,#0f0f10,#0b0b0b);border:1px solid rgba(255,255,255,0.04);padding:18px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.7)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <strong style="color:#fff;font-size:16px">Search users</strong>
          <button id="closeSearch" style="background:transparent;border:none;color:#bdbdbd;font-weight:700;cursor:pointer">✕</button>
        </div>
        <input id="searchInput" placeholder="Search by username or name (e.g. avani, admin, shekhar)" style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit" />
        <div id="searchResults" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#closeSearch').addEventListener('click', close);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
    const input = overlay.querySelector('#searchInput');
    const results = overlay.querySelector('#searchResults');

    let delay;
    input.addEventListener('input', () => {
      clearTimeout(delay);
      delay = setTimeout(async () => {
        const q = input.value.trim();
        if (!q) { results.innerHTML = ''; return; }
        try {
          const r = await apiFetch(`/search-users?q=${encodeURIComponent(q)}`);
          results.innerHTML = '';
          if (!r.results || !r.results.length) {
            results.innerHTML = `<div style="color:var(--muted);padding:12px;border-radius:8px;background:var(--glass)">No users found</div>`;
            return;
          }
          r.results.forEach(u => {
            const node = document.createElement('div');
            node.style.display = 'flex';
            node.style.alignItems = 'center';
            node.style.justifyContent = 'space-between';
            node.style.padding = '8px';
            node.style.borderRadius = '8px';
            node.style.background = 'rgba(255,255,255,0.01)';
            const display = u.displayName || u.username || 'Unknown';
            node.innerHTML = `
              <div style="display:flex;gap:10px;align-items:center">
                <div style="width:44px;height:44px;border-radius:50%;background:#6b7fd7;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${escapeHtml(display.charAt(0).toUpperCase())}</div>
                <div>
                  <div style="font-weight:800">${escapeHtml(display)}</div>
                  <div style="color:var(--muted);font-size:13px">@${escapeHtml(u.username)}</div>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="msgBtn" data-username="${escapeHtml(u.username)}" style="padding:8px 12px;border-radius:8px;border:none;background:var(--accent);color:white;cursor:pointer;font-weight:700">Message</button>
              </div>
            `;
            results.appendChild(node);
          });

          results.querySelectorAll('.msgBtn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const to = btn.dataset.username;
              // open server-backed thread for this user
              close();
              openChatThread(to);
            });
          });
        } catch (err) {
          results.innerHTML = `<div style="color:#f66;padding:8px">Search failed: ${escapeHtml(err.message)}</div>`;
        }
      }, 220);
    });

    input.focus();
  }

  /* ----- Chat modal (API-backed) ----- */
  async function openChatThread(username) {
    try {
      const data = await apiFetch(`/conversations/user/${encodeURIComponent(username)}`);
      const convUser = data.with;
      const messages = data.messages || [];

      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(3,6,10,0.6)';
      overlay.style.zIndex = 9999;
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.innerHTML = `
        <div style="width:760px;max-width:96%;height:80vh;max-height:760px;background:linear-gradient(180deg,#0f0f10,#0b0b0b);border:1px solid rgba(255,255,255,0.04);padding:12px;border-radius:12px;display:flex;flex-direction:column;overflow:hidden">
          <div style="display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid rgba(255,255,255,0.03)">
            <div style="width:44px;height:44px;border-radius:50%;background:#6b7fd7;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${escapeHtml((convUser.displayName||convUser.username).charAt(0).toUpperCase())}</div>
            <div style="flex:1">
              <div style="font-weight:800">${escapeHtml(convUser.displayName || convUser.username)}</div>
              <div style="color:var(--muted);font-size:13px">@${escapeHtml(convUser.username)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button id="closeThread" style="background:transparent;border:none;color:#bdbdbd;font-weight:700;cursor:pointer">✕</button>
            </div>
          </div>

          <div id="msgScroll" style="flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(180deg, rgba(255,255,255,0.00), rgba(255,255,255,0.01))"></div>

          <div style="padding:10px;border-top:1px solid rgba(255,255,255,0.03);display:flex;gap:8px;align-items:center">
            <input id="chatInput" placeholder="Write a message..." style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit" />
            <button id="sendChat" style="padding:10px 14px;border-radius:10px;border:none;background:var(--accent);color:white;font-weight:700;cursor:pointer">Send</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const close = () => {
        overlay.remove();
        loadConversations();
      };
      overlay.querySelector('#closeThread').addEventListener('click', close);
      overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });

      const msgScroll = overlay.querySelector('#msgScroll');
      const chatInput = overlay.querySelector('#chatInput');
      const sendBtn = overlay.querySelector('#sendChat');

      function renderMessages(msgs) {
        msgScroll.innerHTML = '';
        msgs.forEach(m => {
          const bubble = document.createElement('div');
          const mine = String((m.sender && (m.sender._id || m.sender))) === String(getMyIdFromToken());
          bubble.style.alignSelf = mine ? 'flex-end' : 'flex-start';
          bubble.style.maxWidth = '78%';
          bubble.style.padding = '10px 12px';
          bubble.style.borderRadius = '10px';
          bubble.style.background = mine ? 'linear-gradient(90deg,#6b7fd7,#5563c8)' : 'rgba(255,255,255,0.02)';
          bubble.style.color = mine ? '#fff' : 'var(--text)';
          bubble.style.fontSize = '14px';
          bubble.innerHTML = `
            <div>${escapeHtml(m.text)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:6px;text-align:right">${timeAgo(new Date(m.createdAt).getTime())}</div>
          `;
          msgScroll.appendChild(bubble);
        });
        msgScroll.scrollTop = msgScroll.scrollHeight;
      }

      renderMessages(messages);

      sendBtn.addEventListener('click', () => sendMessage());
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;
        try {
          const body = { text };
          await apiFetch(`/conversations/user/${encodeURIComponent(convUser.username)}/messages`, {
            method: 'POST',
            body: JSON.stringify(body)
          });
          // reload messages after send
          const refreshed = await apiFetch(`/conversations/user/${encodeURIComponent(convUser.username)}`);
          renderMessages(refreshed.messages || []);
          chatInput.value = '';
          loadConversations();
        } catch (err) {
          alert('Send failed: ' + err.message);
        }
      }

    } catch (err) {
      alert('Failed to open conversation: ' + err.message);
    }
  }

  /* ----- Robust JWT decode used only locally to mark own messages ----- */
  function getMyIdFromToken() {
    try {
      let tk = localStorage.getItem('token');
      if (!tk) return null;
      tk = tk.replace(/^"(.*)"$/, '$1').trim();     // strip accidental quotes
      const parts = tk.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      // common token claim names
      return String(payload.userId || payload.id || payload._id || payload.sub || '');
    } catch (e) {
      console.warn('Failed to decode token locally:', e);
      return null;
    }
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});