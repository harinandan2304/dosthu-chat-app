/**
 * DOSTHU USER PROFILE MANAGER
 */
class ProfileManager {
  constructor() {
    this.selectedAvatar = 'avatar-1';
  }

  init() {
    const editBtn = document.getElementById('edit-profile-btn');
    const miniProfile = document.getElementById('user-mini-profile');
    const closeBtn = document.getElementById('profile-modal-close');
    const form = document.getElementById('profile-form');
    const avatarGrid = document.getElementById('profile-avatar-grid');

    if (editBtn) editBtn.addEventListener('click', () => this.openModal());
    if (miniProfile) miniProfile.addEventListener('click', () => this.openModal());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());

    // Avatar Selection in Modal
    if (avatarGrid) {
      avatarGrid.addEventListener('click', e => {
        const option = e.target.closest('.avatar-option');
        if (option) {
          avatarGrid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
          option.classList.add('selected');
          this.selectedAvatar = option.dataset.avatar;
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        await this.saveProfile();
      });
    }
  }

  openModal() {
    const user = window.authManager.getCurrentUser();
    if (!user) return;

    const modal = document.getElementById('profile-modal');
    const nameInput = document.getElementById('profile-name-input');
    const bioInput = document.getElementById('profile-bio-input');
    const avatarGrid = document.getElementById('profile-avatar-grid');

    if (nameInput) nameInput.value = user.name || '';
    if (bioInput) bioInput.value = user.bio || '';

    this.selectedAvatar = user.avatar || 'avatar-1';

    if (avatarGrid) {
      avatarGrid.querySelectorAll('.avatar-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.avatar === this.selectedAvatar);
      });
    }

    if (modal) modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
  }

  async saveProfile() {
    const token = window.authManager.getToken();
    const nameInput = document.getElementById('profile-name-input');
    const bioInput = document.getElementById('profile-bio-input');

    const name = nameInput.value.trim();
    const bio = bioInput.value.trim();
    const avatar = this.selectedAvatar;

    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, bio, avatar })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        window.authManager.currentUser = data.user;
        window.app.updateCurrentUserUI(data.user);
        this.closeModal();
        window.app.showToast('Profile updated successfully!', 'success');

        // Notify socket
        if (window.socketClient) {
          window.socketClient.send('profile_update', data.user);
        }
      } else {
        window.app.showToast(data.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      window.app.showToast('Error updating profile', 'error');
    }
  }
}

const profileManager = new ProfileManager();
window.profileManager = profileManager;
