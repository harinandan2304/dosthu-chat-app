/**
 * DOSTHU MAIN APPLICATION BOOTSTRAP
 */
class App {
  constructor() {
    this.currentTheme = localStorage.getItem('dosthu_theme') || 'dark';
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.bindGlobalControls();

    // Initialize Subsystems
    window.emojiManager.init();
    window.profileManager.init();
    window.chatManager.init();

    // Auth Initialization
    window.authManager.checkAuth();
  }

  bindGlobalControls() {
    // 1. Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('dosthu_theme', this.currentTheme);
      });
    }

    // 2. Sound Toggle
    const soundBtn = document.getElementById('sound-toggle-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const enabled = window.audioManager.toggleSound();
        soundBtn.innerHTML = enabled ? '🔔' : '🔕';
        this.showToast(`Sound ${enabled ? 'enabled' : 'muted'}`, 'info');
      });
    }

    // 3. Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to log out of Dosthu?')) {
          window.authManager.logout();
        }
      });
    }

    // 4. Auth Modal Tabs Switcher
    const loginTabBtn = document.getElementById('auth-tab-login');
    const registerTabBtn = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginTabBtn && registerTabBtn) {
      loginTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      });

      registerTabBtn.addEventListener('click', () => {
        registerTabBtn.classList.add('active');
        loginTabBtn.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
      });
    }

    // 5. Auth Form Submissions
    if (loginForm) {
      loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        const result = await window.authManager.login(identifier, password);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In to Dosthu';

        if (!result.success) {
          this.showToast(result.error, 'error');
        } else {
          this.showToast(`Welcome back, ${result.user.name}! 👋`, 'success');
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('register-name').value.trim();
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const bio = document.getElementById('register-bio').value.trim();
        const submitBtn = registerForm.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        const result = await window.authManager.register({
          name,
          username,
          email,
          password,
          bio,
          avatar: 'avatar-1'
        });

        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Free Account';

        if (!result.success) {
          this.showToast(result.error, 'error');
        } else {
          this.showToast(`Welcome to Dosthu, ${result.user.name}! 🎉`, 'success');
        }
      });
    }

    // 6. Quick Demo Login Pills
    document.querySelectorAll('.demo-pill').forEach(pill => {
      pill.addEventListener('click', async () => {
        const username = pill.dataset.username;
        const identInput = document.getElementById('login-identifier');
        const passInput = document.getElementById('login-password');
        if (identInput && passInput) {
          identInput.value = username;
          passInput.value = 'dosthu123';
          this.showToast(`Logging in as Demo User: ${username}...`, 'info');
          const res = await window.authManager.login(username, 'dosthu123');
          if (res.success) {
            this.showToast(`Logged in as ${res.user.name}! 🚀`, 'success');
          }
        }
      });
    });

    // 7. Global Keyboard Shortcuts
    document.addEventListener('keydown', e => {
      // Ctrl/Cmd + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('user-search-input');
        if (searchInput) searchInput.focus();
      }

      // Escape key closes modals/drawer
      if (e.key === 'Escape') {
        window.profileManager.closeModal();
        const emojiPop = document.getElementById('emoji-popover');
        if (emojiPop) emojiPop.classList.remove('active');
      }
    });
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  onUserLoggedIn(user, token) {
    this.updateCurrentUserUI(user);
    // Connect WebSocket
    window.socketClient.connect(token);
    // Load conversations
    window.chatManager.loadUsers();
  }

  updateCurrentUserUI(user) {
    const avatarEl = document.getElementById('current-user-avatar');
    const nameEl = document.getElementById('current-user-name');
    if (avatarEl) avatarEl.src = `/assets/avatars/${user.avatar || 'avatar-1'}.svg`;
    if (nameEl) nameEl.textContent = user.name;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
}

// Instantiate App
const app = new App();
window.app = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
