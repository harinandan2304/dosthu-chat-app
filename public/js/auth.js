/**
 * DOSTHU AUTHENTICATION MANAGER
 */
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('dosthu_jwt') || null;
  }

  async checkAuth() {
    if (!this.token) {
      this.showAuthModal();
      return null;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        this.currentUser = data.user;
        this.onAuthSuccess(this.currentUser, this.token);
        return this.currentUser;
      } else {
        this.logout();
        return null;
      }
    } catch (err) {
      console.error('Auth verification error:', err);
      this.showAuthModal();
      return null;
    }
  }

  async login(identifier, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('dosthu_jwt', this.token);

      this.onAuthSuccess(this.currentUser, this.token);
      return { success: true, user: this.currentUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async register({ username, name, email, password, bio, avatar }) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, email, password, bio, avatar })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('dosthu_jwt', this.token);

      this.onAuthSuccess(this.currentUser, this.token);
      return { success: true, user: this.currentUser };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('dosthu_jwt');

    if (window.socketClient) {
      window.socketClient.disconnect();
    }

    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.showAuthModal();
  }

  onAuthSuccess(user, token) {
    this.hideAuthModal();
    if (window.app) {
      window.app.onUserLoggedIn(user, token);
    }
  }

  showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('active');
  }

  hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('active');
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getToken() {
    return this.token;
  }
}

const authManager = new AuthManager();
window.authManager = authManager;
