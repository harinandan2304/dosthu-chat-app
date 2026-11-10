const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hashPassword } = require('../utils/authHelper');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'dosthu.json');

class Database {
  constructor() {
    this.data = {
      users: [],
      messages: []
    };
    this.init();
  }

  init() {
    try {
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = [];
        if (!this.data.messages) this.data.messages = [];
      } else {
        this.seedInitialData();
        this.save();
      }
    } catch (err) {
      console.error('Error initializing database, falling back to seed:', err);
      this.seedInitialData();
      this.save();
    }
  }

  save() {
    try {
      const tempPath = `${DB_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_PATH);
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  seedInitialData() {
    const defaultPassword = hashPassword('dosthu123');
    const now = Date.now();

    this.data.users = [
      {
        id: 'usr_harish',
        username: 'harish',
        name: 'Harish Kumar',
        email: 'harish@dosthu.app',
        password: defaultPassword,
        avatar: 'avatar-1',
        bio: 'Coding the future with Dosthu! 🚀',
        status: 'online',
        lastSeen: now,
        createdAt: now - 86400000 * 7
      },
      {
        id: 'usr_ananya',
        username: 'ananya',
        name: 'Ananya Sharma',
        email: 'ananya@dosthu.app',
        password: defaultPassword,
        avatar: 'avatar-2',
        bio: 'Designing clean UI/UX & aesthetic vibes ✨',
        status: 'online',
        lastSeen: now - 120000,
        createdAt: now - 86400000 * 5
      },
      {
        id: 'usr_karthik',
        username: 'karthik',
        name: 'Karthik Raja',
        email: 'karthik@dosthu.app',
        password: defaultPassword,
        avatar: 'avatar-3',
        bio: 'Full-stack enthusiast | Building cool stuff 💻',
        status: 'offline',
        lastSeen: now - 3600000 * 2,
        createdAt: now - 86400000 * 4
      },
      {
        id: 'usr_sneha',
        username: 'sneha',
        name: 'Sneha Patel',
        email: 'sneha@dosthu.app',
        password: defaultPassword,
        avatar: 'avatar-4',
        bio: 'Coffee, Code & Curiosity ☕',
        status: 'online',
        lastSeen: now - 60000,
        createdAt: now - 86400000 * 3
      },
      {
        id: 'usr_vikram',
        username: 'vikram',
        name: 'Vikram Singh',
        email: 'vikram@dosthu.app',
        password: defaultPassword,
        avatar: 'avatar-5',
        bio: 'Always up for a quick tech chat! 🎯',
        status: 'offline',
        lastSeen: now - 3600000 * 5,
        createdAt: now - 86400000 * 2
      }
    ];

    // Seed realistic chat history
    this.data.messages = [
      {
        id: 'msg_1',
        senderId: 'usr_ananya',
        receiverId: 'usr_harish',
        text: 'Hey Harish! Have you checked out the new Dosthu UI palette?',
        read: true,
        readAt: now - 3600000 * 3,
        createdAt: now - 3600000 * 3.5
      },
      {
        id: 'msg_2',
        senderId: 'usr_harish',
        receiverId: 'usr_ananya',
        text: 'Yes! The indigo and neon accents look super sleek and responsive 🔥',
        read: true,
        readAt: now - 3600000 * 2.8,
        createdAt: now - 3600000 * 3
      },
      {
        id: 'msg_3',
        senderId: 'usr_ananya',
        receiverId: 'usr_harish',
        text: 'Awesome! Real-time WebSockets are working seamlessly without any page refresh.',
        read: true,
        readAt: now - 3600000 * 2,
        createdAt: now - 3600000 * 2.5
      },
      {
        id: 'msg_4',
        senderId: 'usr_karthik',
        receiverId: 'usr_harish',
        text: 'Bro, the FSWD project submission is looking top notch! 🚀',
        read: false,
        readAt: null,
        createdAt: now - 3600000 * 1.5
      },
      {
        id: 'msg_5',
        senderId: 'usr_sneha',
        receiverId: 'usr_harish',
        text: 'Hey Harish, testing out the instant delivery & read receipts! 👋',
        read: true,
        readAt: now - 1800000,
        createdAt: now - 1860000
      }
    ];
  }

  // --- User Operations ---

  findUserById(id) {
    return this.data.users.find(u => u.id === id) || null;
  }

  findUserByUsername(username) {
    if (!username) return null;
    return this.data.users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  createUser({ username, name, email, password, avatar, bio }) {
    const newUser = {
      id: 'usr_' + crypto.randomBytes(6).toString('hex'),
      username: username.trim(),
      name: name.trim(),
      email: email.trim(),
      password: hashPassword(password),
      avatar: avatar || 'avatar-1',
      bio: bio || 'Hello! I am using Dosthu 💬',
      status: 'offline',
      lastSeen: Date.now(),
      createdAt: Date.now()
    };
    this.data.users.push(newUser);
    this.save();
    return this.sanitizeUser(newUser);
  }

  updateUser(id, updates) {
    const user = this.findUserById(id);
    if (!user) return null;

    const allowed = ['name', 'bio', 'avatar', 'status', 'lastSeen'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        user[key] = updates[key];
      }
    }
    this.save();
    return this.sanitizeUser(user);
  }

  setUserStatus(id, status) {
    const user = this.findUserById(id);
    if (!user) return null;
    user.status = status;
    user.lastSeen = Date.now();
    this.save();
    return this.sanitizeUser(user);
  }

  getAllUsers(currentUserId) {
    return this.data.users
      .filter(u => u.id !== currentUserId)
      .map(u => {
        // Calculate unread count and last message with this user
        const unreadCount = this.data.messages.filter(
          m => m.senderId === u.id && m.receiverId === currentUserId && !m.read
        ).length;

        const lastMsg = this.data.messages
          .filter(m => (m.senderId === u.id && m.receiverId === currentUserId) ||
                       (m.senderId === currentUserId && m.receiverId === u.id))
          .sort((a, b) => b.createdAt - a.createdAt)[0] || null;

        return {
          ...this.sanitizeUser(u),
          unreadCount,
          lastMessage: lastMsg ? {
            id: lastMsg.id,
            text: lastMsg.text,
            createdAt: lastMsg.createdAt,
            senderId: lastMsg.senderId,
            read: lastMsg.read
          } : null
        };
      })
      .sort((a, b) => {
        const timeA = a.lastMessage ? a.lastMessage.createdAt : a.createdAt;
        const timeB = b.lastMessage ? b.lastMessage.createdAt : b.createdAt;
        return timeB - timeA;
      });
  }

  sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  // --- Message Operations ---

  getMessagesBetween(user1Id, user2Id) {
    return this.data.messages
      .filter(m => (m.senderId === user1Id && m.receiverId === user2Id) ||
                   (m.senderId === user2Id && m.receiverId === user1Id))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  createMessage({ senderId, receiverId, text, type = 'text' }) {
    const message = {
      id: 'msg_' + crypto.randomBytes(8).toString('hex'),
      senderId,
      receiverId,
      text: text.trim(),
      type,
      read: false,
      readAt: null,
      createdAt: Date.now()
    };
    this.data.messages.push(message);
    this.save();
    return message;
  }

  markMessagesAsRead(senderId, receiverId) {
    let updatedCount = 0;
    const now = Date.now();
    for (const msg of this.data.messages) {
      if (msg.senderId === senderId && msg.receiverId === receiverId && !msg.read) {
        msg.read = true;
        msg.readAt = now;
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      this.save();
    }
    return updatedCount;
  }

  clearChatBetween(user1Id, user2Id) {
    const originalLen = this.data.messages.length;
    this.data.messages = this.data.messages.filter(
      m => !((m.senderId === user1Id && m.receiverId === user2Id) ||
             (m.senderId === user2Id && m.receiverId === user1Id))
    );
    this.save();
    return originalLen - this.data.messages.length;
  }
}

// Singleton database instance
const db = new Database();

module.exports = db;
