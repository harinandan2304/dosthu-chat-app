/**
 * DOSTHU EMOJI & REACTION MANAGER
 */
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋',
  '😎', '🤩', '🥳', '😏', '🤔', '🤫', '🤗', '🤭',
  '👍', '👎', '👏', '🙌', '🤝', '👊', '✌️', '🤟',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🔥',
  '✨', '⭐', '🎉', '🎊', '🚀', '💯', '☕', '🍕'
];

class EmojiManager {
  constructor() {
    this.popover = null;
    this.targetInput = null;
  }

  init() {
    this.popover = document.getElementById('emoji-popover');
    this.targetInput = document.getElementById('chat-input');
    const toggleBtn = document.getElementById('emoji-toggle-btn');
    const grid = document.getElementById('emoji-grid');

    if (grid) {
      grid.innerHTML = EMOJI_LIST.map(
        emoji => `<button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>`
      ).join('');

      grid.addEventListener('click', e => {
        const btn = e.target.closest('.emoji-btn');
        if (btn && this.targetInput) {
          const emoji = btn.dataset.emoji;
          this.insertEmoji(emoji);
        }
      });
    }

    if (toggleBtn && this.popover) {
      toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.popover.classList.toggle('active');
      });
    }

    // Close emoji popover when clicking outside
    document.addEventListener('click', e => {
      if (
        this.popover &&
        this.popover.classList.contains('active') &&
        !this.popover.contains(e.target) &&
        e.target !== toggleBtn
      ) {
        this.popover.classList.remove('active');
      }
    });

    // Quick reaction buttons in active chat
    const quickBar = document.getElementById('quick-reaction-bar');
    if (quickBar) {
      quickBar.addEventListener('click', e => {
        const btn = e.target.closest('.quick-reaction-btn');
        if (btn && window.chatManager) {
          const emoji = btn.dataset.reaction;
          window.chatManager.sendMessage(emoji, 'emoji');
        }
      });
    }
  }

  insertEmoji(emoji) {
    if (!this.targetInput) return;
    const start = this.targetInput.selectionStart;
    const end = this.targetInput.selectionEnd;
    const text = this.targetInput.value;
    this.targetInput.value = text.substring(0, start) + emoji + text.substring(end);
    this.targetInput.focus();
    this.targetInput.selectionStart = this.targetInput.selectionEnd = start + emoji.length;
    // Auto-trigger input event to resize textarea
    this.targetInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

const emojiManager = new EmojiManager();
window.emojiManager = emojiManager;
