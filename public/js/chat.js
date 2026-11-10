/**
 * DOSTHU REAL-TIME CHAT MANAGER
 * Handles conversations, real-time message stream, typing, and presence
 */
class ChatManager {
  constructor() {
    this.users = [];
    this.activeUser = null;
    this.messages = [];
    this.typingTimeout = null;
    this.isTyping = false;
  }

  init() {
    this.bindEvents();
    this.setupSocketListeners();
  }

  bindEvents() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send-message');
    const searchInput = document.getElementById('user-search-input');
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    const toggleInfoBtn = document.getElementById('toggle-info-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');

    // Auto-expand textarea & typing indicator
    if (chatInput) {
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        this.handleTyping();
      });

      chatInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submitMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.submitMessage());
    }

    // Filter search
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const query = e.target.value.toLowerCase().trim();
        this.filterUsers(query);
      });
    }

    // Mobile back button
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('hidden-mobile');
        this.activeUser = null;
        this.updateEmptyState();
      });
    }

    // Toggle info drawer
    if (toggleInfoBtn) {
      toggleInfoBtn.addEventListener('click', () => {
        const drawer = document.getElementById('info-drawer');
        if (drawer) drawer.classList.toggle('collapsed');
      });
    }

    // Clear chat
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => this.clearActiveChat());
    }
  }

  setupSocketListeners() {
    const socket = window.socketClient;
    if (!socket) return;

    // 1. Incoming new message
    socket.on('new_message', msg => {
      const current = window.authManager.getCurrentUser();
      if (!current) return;

      if (this.activeUser && this.activeUser.id === msg.senderId) {
        // In active chat: append & mark read
        this.messages.push(msg);
        this.appendMessageElement(msg);
        this.scrollToBottom();
        window.audioManager.playReceived();

        // Mark read immediately
        socket.send('mark_read', { senderId: msg.senderId });
      } else {
        // Notification for other user
        window.audioManager.playReceived();
        this.updateUserUnreadBadge(msg.senderId, 1);
        const sender = this.users.find(u => u.id === msg.senderId);
        const senderName = sender ? sender.name : 'Dosthu Friend';
        window.app.showToast(`New message from ${senderName}: "${msg.text}"`, 'info');
      }

      this.updateConversationPreview(msg.senderId, msg.text, msg.createdAt);
    });

    // 2. Outgoing message delivery confirmation
    socket.on('message_sent', msg => {
      // Find if message exists or append
      const existing = this.messages.find(m => m.id === msg.id);
      if (!existing && this.activeUser && this.activeUser.id === msg.receiverId) {
        this.messages.push(msg);
        this.appendMessageElement(msg);
        this.scrollToBottom();
      }
      this.updateConversationPreview(msg.receiverId, msg.text, msg.createdAt);
    });

    // 3. Messages read receipts (Turn checkmarks blue)
    socket.on('messages_read', data => {
      if (this.activeUser && this.activeUser.id === data.readBy) {
        document.querySelectorAll('.message-item.sent .read-ticks').forEach(el => {
          el.classList.add('read');
          el.innerHTML = '✓✓';
        });
      }
    });

    // 4. Typing indicator from other user
    socket.on('user_typing', data => {
      if (this.activeUser && this.activeUser.id === data.senderId) {
        this.setTypingIndicator(data.isTyping);
      }
      this.setConversationTypingSnippet(data.senderId, data.isTyping);
    });

    // 5. User online / offline status change
    socket.on('user_status', data => {
      const user = this.users.find(u => u.id === data.userId);
      if (user) {
        user.status = data.status;
        user.lastSeen = data.lastSeen;
        this.renderUserLists();
        if (this.activeUser && this.activeUser.id === data.userId) {
          this.updateActiveUserHeader();
        }
      }
    });

    // 6. User profile updated
    socket.on('user_profile_updated', user => {
      const idx = this.users.findIndex(u => u.id === user.id);
      if (idx !== -1) {
        this.users[idx] = { ...this.users[idx], ...user };
        this.renderUserLists();
        if (this.activeUser && this.activeUser.id === user.id) {
          this.activeUser = this.users[idx];
          this.updateActiveUserHeader();
          this.updateInfoDrawer();
        }
      }
    });

    // 7. Chat cleared
    socket.on('chat_cleared', data => {
      if (this.activeUser && this.activeUser.id === data.clearedBy) {
        this.messages = [];
        this.renderMessages();
      }
    });
  }

  async loadUsers() {
    const token = window.authManager.getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        this.users = data.users;
        this.renderUserLists();
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  renderUserLists() {
    this.renderConversationList(this.users);
    this.renderOnlineStrip(this.users.filter(u => u.status === 'online'));
  }

  renderOnlineStrip(onlineUsers) {
    const strip = document.getElementById('online-strip');
    if (!strip) return;

    if (onlineUsers.length === 0) {
      strip.style.display = 'none';
      return;
    }

    strip.style.display = 'flex';
    strip.innerHTML = onlineUsers
      .map(
        u => `
        <div class="online-strip-item" data-id="${u.id}">
          <div class="online-avatar-ring">
            <img src="/assets/avatars/${u.avatar || 'avatar-1'}.svg" alt="${u.name}">
          </div>
          <span class="online-strip-name">${u.name.split(' ')[0]}</span>
        </div>
      `
      )
      .join('');

    strip.querySelectorAll('.online-strip-item').forEach(el => {
      el.addEventListener('click', () => {
        const user = this.users.find(u => u.id === el.dataset.id);
        if (user) this.selectUser(user);
      });
    });
  }

  renderConversationList(usersToRender) {
    const list = document.getElementById('conversation-list');
    if (!list) return;

    if (usersToRender.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 13px;">
          No friends found
        </div>
      `;
      return;
    }

    list.innerHTML = usersToRender
      .map(u => {
        const isActive = this.activeUser && this.activeUser.id === u.id;
        const lastMsgText = u.lastMessage ? u.lastMessage.text : u.bio || 'Say hello!';
        const timeStr = u.lastMessage ? this.formatTime(u.lastMessage.createdAt) : '';
        const unreadHtml =
          u.unreadCount > 0
            ? `<span class="badge badge-unread">${u.unreadCount}</span>`
            : '';

        return `
        <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${u.id}">
          <div class="convo-avatar-wrapper">
            <img class="convo-avatar" src="/assets/avatars/${u.avatar || 'avatar-1'}.svg" alt="${u.name}">
            <span class="status-dot ${u.status === 'online' ? 'online' : 'offline'}"></span>
          </div>
          <div class="convo-info">
            <div class="convo-top-row">
              <span class="convo-name">${u.name}</span>
              <span class="convo-time">${timeStr}</span>
            </div>
            <div class="convo-bottom-row">
              <span class="convo-preview" id="preview-${u.id}">${lastMsgText}</span>
              ${unreadHtml}
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    list.querySelectorAll('.conversation-item').forEach(el => {
      el.addEventListener('click', () => {
        const user = this.users.find(u => u.id === el.dataset.id);
        if (user) this.selectUser(user);
      });
    });
  }

  filterUsers(query) {
    if (!query) {
      this.renderConversationList(this.users);
      return;
    }
    const filtered = this.users.filter(
      u =>
        u.name.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        (u.lastMessage && u.lastMessage.text.toLowerCase().includes(query))
    );
    this.renderConversationList(filtered);
  }

  async selectUser(user) {
    this.activeUser = user;
    user.unreadCount = 0; // Clear unread locally

    // Update active state in sidebar
    document.querySelectorAll('.conversation-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === user.id);
      if (el.dataset.id === user.id) {
        const badge = el.querySelector('.badge-unread');
        if (badge) badge.remove();
      }
    });

    // Mobile layout toggle
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 680) {
      sidebar.classList.add('hidden-mobile');
    }

    this.updateEmptyState();
    this.updateActiveUserHeader();
    this.updateInfoDrawer();

    // Fetch conversation messages
    await this.loadMessages(user.id);
  }

  updateEmptyState() {
    const emptyState = document.getElementById('empty-chat-state');
    const activeState = document.getElementById('active-chat-content');

    if (!this.activeUser) {
      if (emptyState) emptyState.style.display = 'flex';
      if (activeState) activeState.style.display = 'none';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      if (activeState) activeState.style.display = 'flex';
    }
  }

  updateActiveUserHeader() {
    if (!this.activeUser) return;
    const nameEl = document.getElementById('chat-header-name');
    const avatarEl = document.getElementById('chat-header-avatar');
    const statusEl = document.getElementById('chat-header-status');

    if (nameEl) nameEl.textContent = this.activeUser.name;
    if (avatarEl) avatarEl.src = `/assets/avatars/${this.activeUser.avatar || 'avatar-1'}.svg`;
    if (statusEl) {
      const isOnline = this.activeUser.status === 'online';
      statusEl.className = `chat-header-status ${isOnline ? 'online' : ''}`;
      statusEl.innerHTML = isOnline
        ? `<span class="status-dot online"></span> Online now`
        : `<span class="status-dot offline"></span> Last seen ${this.formatLastSeen(this.activeUser.lastSeen)}`;
    }
  }

  updateInfoDrawer() {
    if (!this.activeUser) return;
    const drawerAvatar = document.getElementById('info-drawer-avatar');
    const drawerName = document.getElementById('info-drawer-name');
    const drawerUsername = document.getElementById('info-drawer-username');
    const drawerBio = document.getElementById('info-drawer-bio');

    if (drawerAvatar) drawerAvatar.src = `/assets/avatars/${this.activeUser.avatar || 'avatar-1'}.svg`;
    if (drawerName) drawerName.textContent = this.activeUser.name;
    if (drawerUsername) drawerUsername.textContent = `@${this.activeUser.username}`;
    if (drawerBio) drawerBio.textContent = this.activeUser.bio || 'Hey there! I am using Dosthu 💬';
  }

  async loadMessages(userId) {
    const token = window.authManager.getToken();
    const container = document.getElementById('messages-container');
    if (container) {
      container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; height:100%; color:var(--text-muted);">
          Loading chat history...
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok && data.success) {
        this.messages = data.messages;
        this.renderMessages();
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  renderMessages() {
    const container = document.getElementById('messages-container');
    if (!container) return;

    if (this.messages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; margin:auto; color:var(--text-muted); font-size:13.5px;">
          <div style="font-size:32px; margin-bottom:8px;">👋</div>
          Say hello to <strong>${this.activeUser.name}</strong> to start chatting!
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    let lastDate = null;

    this.messages.forEach(msg => {
      const msgDate = new Date(msg.createdAt).toLocaleDateString();
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const datePill = document.createElement('div');
        datePill.className = 'date-separator';
        datePill.innerHTML = `<span>${this.formatDateHeader(msg.createdAt)}</span>`;
        container.appendChild(datePill);
      }
      this.appendMessageElement(msg, false);
    });

    this.scrollToBottom();
  }

  appendMessageElement(msg, animate = true) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const current = window.authManager.getCurrentUser();
    const isSent = msg.senderId === current.id;
    const avatar = isSent
      ? current.avatar || 'avatar-1'
      : (this.activeUser ? this.activeUser.avatar : 'avatar-1');

    const msgEl = document.createElement('div');
    msgEl.className = `message-item ${isSent ? 'sent' : 'received'}`;
    if (!animate) msgEl.style.animation = 'none';

    const checkmarks = isSent
      ? `<span class="read-ticks ${msg.read ? 'read' : ''}">${msg.read ? '✓✓' : '✓'}</span>`
      : '';

    msgEl.innerHTML = `
      <img class="message-avatar" src="/assets/avatars/${avatar}.svg" alt="Avatar">
      <div class="message-content">
        <div class="message-bubble ${msg.type === 'emoji' ? 'reaction-pop' : ''}" style="${msg.type === 'emoji' ? 'font-size: 32px; background: transparent; box-shadow: none; padding: 2px;' : ''}">
          ${this.escapeHtml(msg.text)}
        </div>
        <div class="message-meta">
          <span>${this.formatTime(msg.createdAt)}</span>
          ${checkmarks}
        </div>
      </div>
    `;

    container.appendChild(msgEl);
  }

  submitMessage() {
    const input = document.getElementById('chat-input');
    if (!input || !this.activeUser) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    this.sendMessage(text, 'text');
  }

  sendMessage(text, type = 'text') {
    if (!this.activeUser || !text) return;

    const socket = window.socketClient;
    const sent = socket.send('send_message', {
      receiverId: this.activeUser.id,
      text,
      type
    });

    // Sound effect
    window.audioManager.playSent();

    if (!sent) {
      // Fallback to REST API if socket is disconnected
      this.sendMessageViaRest(text, type);
    }
  }

  async sendMessageViaRest(text, type) {
    const token = window.authManager.getToken();
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId: this.activeUser.id,
          text,
          type
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.messages.push(data.message);
        this.appendMessageElement(data.message);
        this.scrollToBottom();
      }
    } catch (e) {
      console.error('REST send fallback error:', e);
    }
  }

  async clearActiveChat() {
    if (!this.activeUser) return;
    if (!confirm(`Are you sure you want to clear your chat with ${this.activeUser.name}?`)) return;

    const token = window.authManager.getToken();
    try {
      const res = await fetch(`/api/messages/${this.activeUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        this.messages = [];
        this.renderMessages();
        window.app.showToast('Chat cleared', 'info');
      }
    } catch (e) {
      console.error('Failed to clear chat:', e);
    }
  }

  handleTyping() {
    if (!this.activeUser) return;
    const socket = window.socketClient;

    if (!this.isTyping) {
      this.isTyping = true;
      socket.send('typing_start', { receiverId: this.activeUser.id });
    }

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      socket.send('typing_stop', { receiverId: this.activeUser.id });
    }, 1500);
  }

  setTypingIndicator(isTyping) {
    const bubble = document.getElementById('typing-bubble');
    if (!bubble) return;
    if (isTyping) {
      bubble.classList.add('active');
      this.scrollToBottom();
    } else {
      bubble.classList.remove('active');
    }
  }

  setConversationTypingSnippet(userId, isTyping) {
    const previewEl = document.getElementById(`preview-${userId}`);
    if (!previewEl) return;
    if (isTyping) {
      previewEl.textContent = 'Typing...';
      previewEl.classList.add('typing');
    } else {
      const user = this.users.find(u => u.id === userId);
      previewEl.textContent = user && user.lastMessage ? user.lastMessage.text : (user ? user.bio : '');
      previewEl.classList.remove('typing');
    }
  }

  updateConversationPreview(userId, text, time) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.lastMessage = { text, createdAt: time };
      // Re-sort conversation list so active moves to top
      this.users.sort((a, b) => {
        const timeA = a.lastMessage ? a.lastMessage.createdAt : a.createdAt;
        const timeB = b.lastMessage ? b.lastMessage.createdAt : b.createdAt;
        return timeB - timeA;
      });
      this.renderConversationList(this.users);
    }
  }

  updateUserUnreadBadge(userId, delta) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      user.unreadCount = (user.unreadCount || 0) + delta;
      this.renderConversationList(this.users);
    }
  }

  scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatDateHeader(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatLastSeen(timestamp) {
    if (!timestamp) return 'recently';
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

const chatManager = new ChatManager();
window.chatManager = chatManager;
