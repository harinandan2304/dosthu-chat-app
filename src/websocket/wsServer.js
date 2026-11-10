const crypto = require('crypto');
const db = require('../db/database');
const { verifyToken } = require('../utils/authHelper');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WSServer {
  constructor(httpServer) {
    this.httpServer = httpServer;
    // Map of userId -> Set of connected sockets
    this.userSockets = new Map();
    // Map of socket -> { userId, isAlive }
    this.socketMeta = new Map();

    this.init();
  }

  init() {
    this.httpServer.on('upgrade', (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });

    // Heartbeat cleanup interval (every 30 seconds)
    setInterval(() => {
      for (const [socket, meta] of this.socketMeta.entries()) {
        if (!meta.isAlive) {
          socket.destroy();
          this.handleDisconnect(socket);
        } else {
          meta.isAlive = false;
          this.sendPing(socket);
        }
      }
    }, 30000);
  }

  handleUpgrade(req, socket, head) {
    // Verify WebSocket upgrade headers
    const upgrade = req.headers['upgrade'];
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    // Compute accept key
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + WS_GUID)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '\r\n'
    ];

    socket.write(responseHeaders.join('\r\n'));

    // Setup socket meta
    this.socketMeta.set(socket, { userId: null, isAlive: true });

    let buffer = Buffer.alloc(0);

    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 2) {
        const firstByte = buffer[0];
        const secondByte = buffer[1];

        const isFinal = (firstByte & 0x80) !== 0;
        const opcode = firstByte & 0x0f;
        const isMasked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;

        let offset = 2;
        if (payloadLen === 126) {
          if (buffer.length < 4) break;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) break;
          // For simplicity in JS, read lower 32 bits of 64-bit length
          payloadLen = buffer.readUInt32BE(6);
          offset = 10;
        }

        const maskLen = isMasked ? 4 : 0;
        const totalFrameLen = offset + maskLen + payloadLen;

        if (buffer.length < totalFrameLen) {
          break; // Frame incomplete, wait for more chunks
        }

        let payload = buffer.subarray(offset + maskLen, totalFrameLen);

        if (isMasked) {
          const mask = buffer.subarray(offset, offset + 4);
          const unmasked = Buffer.alloc(payloadLen);
          for (let i = 0; i < payloadLen; i++) {
            unmasked[i] = payload[i] ^ mask[i % 4];
          }
          payload = unmasked;
        }

        // Advance buffer
        buffer = buffer.subarray(totalFrameLen);

        // Process Frame by Opcode
        if (opcode === 0x8) {
          // Close frame
          socket.end();
          this.handleDisconnect(socket);
          return;
        } else if (opcode === 0x9) {
          // Ping frame -> reply with Pong
          this.sendPong(socket);
        } else if (opcode === 0xa) {
          // Pong frame
          const meta = this.socketMeta.get(socket);
          if (meta) meta.isAlive = true;
        } else if (opcode === 0x1) {
          // Text frame
          try {
            const text = payload.toString('utf8');
            const data = JSON.parse(text);
            this.handleMessage(socket, data);
          } catch (e) {
            console.error('Invalid WS frame payload:', e);
          }
        }
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(socket);
    });

    socket.on('error', err => {
      this.handleDisconnect(socket);
    });
  }

  sendFrame(socket, payloadText) {
    if (!socket || socket.destroyed || !socket.writable) return;
    try {
      const payloadBuf = Buffer.from(payloadText, 'utf8');
      const len = payloadBuf.length;

      let header;
      if (len < 126) {
        header = Buffer.from([0x81, len]);
      } else if (len <= 65535) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(len, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
      }

      socket.write(Buffer.concat([header, payloadBuf]));
    } catch (e) {
      console.error('Error sending WS frame:', e);
    }
  }

  sendPing(socket) {
    if (!socket || socket.destroyed || !socket.writable) return;
    try {
      socket.write(Buffer.from([0x89, 0x00]));
    } catch (e) {}
  }

  sendPong(socket) {
    if (!socket || socket.destroyed || !socket.writable) return;
    try {
      socket.write(Buffer.from([0x8a, 0x00]));
    } catch (e) {}
  }

  sendJson(socket, obj) {
    this.sendFrame(socket, JSON.stringify(obj));
  }

  sendToUser(userId, obj) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return false;
    let sent = false;
    for (const s of sockets) {
      this.sendJson(s, obj);
      sent = true;
    }
    return sent;
  }

  broadcast(obj, excludeUserId = null) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (excludeUserId && userId === excludeUserId) continue;
      for (const s of sockets) {
        this.sendJson(s, obj);
      }
    }
  }

  handleDisconnect(socket) {
    const meta = this.socketMeta.get(socket);
    if (!meta) return;

    const { userId } = meta;
    this.socketMeta.delete(socket);

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          // Mark user as offline in DB
          db.setUserStatus(userId, 'offline');
          // Broadcast status update
          this.broadcast({
            event: 'user_status',
            data: {
              userId,
              status: 'offline',
              lastSeen: Date.now()
            }
          });
        }
      }
    }
  }

  handleMessage(socket, msg) {
    const { event, data } = msg;

    switch (event) {
      // 1. Authenticate WebSocket Connection
      case 'auth': {
        const token = data && data.token;
        const decoded = verifyToken(token);
        if (!decoded || !decoded.id) {
          this.sendJson(socket, {
            event: 'error',
            data: { message: 'Authentication failed for WebSocket' }
          });
          return;
        }

        const userId = decoded.id;
        const meta = this.socketMeta.get(socket);
        if (meta) {
          meta.userId = userId;
          meta.isAlive = true;
        }

        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket);

        // Mark user online
        db.setUserStatus(userId, 'online');

        // Confirm auth
        this.sendJson(socket, {
          event: 'auth_success',
          data: {
            userId,
            onlineUsers: Array.from(this.userSockets.keys())
          }
        });

        // Broadcast to everyone that this user is online
        this.broadcast(
          {
            event: 'user_status',
            data: {
              userId,
              status: 'online',
              lastSeen: Date.now()
            }
          },
          userId
        );
        break;
      }

      // 2. Real-time Message Dispatch
      case 'send_message': {
        const meta = this.socketMeta.get(socket);
        if (!meta || !meta.userId) return;

        const senderId = meta.userId;
        const { receiverId, text, type } = data || {};

        if (!receiverId || !text || !text.trim()) {
          this.sendJson(socket, {
            event: 'error',
            data: { message: 'Receiver and text are required' }
          });
          return;
        }

        // Store message in database
        const newMsg = db.createMessage({
          senderId,
          receiverId,
          text: text.trim(),
          type: type || 'text'
        });

        // Echo back to sender's own devices/tabs
        this.sendToUser(senderId, {
          event: 'message_sent',
          data: newMsg
        });

        // Deliver in real-time to receiver
        const delivered = this.sendToUser(receiverId, {
          event: 'new_message',
          data: newMsg
        });

        if (delivered) {
          // If receiver is currently viewing this chat, read receipt will trigger
        }
        break;
      }

      // 3. Typing Indicators
      case 'typing_start': {
        const meta = this.socketMeta.get(socket);
        if (!meta || !meta.userId) return;
        const { receiverId } = data || {};
        if (receiverId) {
          this.sendToUser(receiverId, {
            event: 'user_typing',
            data: {
              senderId: meta.userId,
              isTyping: true
            }
          });
        }
        break;
      }

      case 'typing_stop': {
        const meta = this.socketMeta.get(socket);
        if (!meta || !meta.userId) return;
        const { receiverId } = data || {};
        if (receiverId) {
          this.sendToUser(receiverId, {
            event: 'user_typing',
            data: {
              senderId: meta.userId,
              isTyping: false
            }
          });
        }
        break;
      }

      // 4. Mark Messages Read (Double Checks)
      case 'mark_read': {
        const meta = this.socketMeta.get(socket);
        if (!meta || !meta.userId) return;
        const { senderId } = data || {}; // senderId is the user whose messages were read
        if (senderId) {
          const count = db.markMessagesAsRead(senderId, meta.userId);
          if (count > 0) {
            // Notify the original sender that their messages were read
            this.sendToUser(senderId, {
              event: 'messages_read',
              data: {
                readBy: meta.userId,
                readAt: Date.now()
              }
            });
          }
        }
        break;
      }

      // 5. Profile Update Notification
      case 'profile_update': {
        const meta = this.socketMeta.get(socket);
        if (!meta || !meta.userId) return;
        this.broadcast({
          event: 'user_profile_updated',
          data: data
        });
        break;
      }

      default:
        break;
    }
  }

  isUserOnline(userId) {
    const sockets = this.userSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }
}

module.exports = WSServer;
