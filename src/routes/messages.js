const db = require('../db/database');
const { verifyToken, extractToken } = require('../utils/authHelper');

function handleMessageRoutes(req, res, pathName, method, body, wsServer) {
  // Authenticate user for all message routes
  const token = extractToken(req);
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized: Valid token required' }));
  }

  const currentUserId = decoded.id;

  // 1. GET /api/messages/:userId - Get conversation messages
  if (pathName.startsWith('/api/messages/') && method === 'GET' && !pathName.includes('/read')) {
    const targetUserId = pathName.split('/')[3];

    if (!targetUserId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Target user ID is required' }));
    }

    const messages = db.getMessagesBetween(currentUserId, targetUserId);

    // Auto mark received messages as read
    const count = db.markMessagesAsRead(targetUserId, currentUserId);
    if (count > 0 && wsServer) {
      wsServer.sendToUser(targetUserId, {
        event: 'messages_read',
        data: {
          readBy: currentUserId,
          readAt: Date.now()
        }
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, messages }));
  }

  // 2. POST /api/messages - Send a new message (REST interface)
  if (pathName === '/api/messages' && method === 'POST') {
    const { receiverId, text, type } = body || {};

    if (!receiverId || !text || !text.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Receiver ID and non-empty text are required' }));
    }

    const message = db.createMessage({
      senderId: currentUserId,
      receiverId,
      text: text.trim(),
      type: type || 'text'
    });

    // Notify receiver and sender via WebSocket
    if (wsServer) {
      wsServer.sendToUser(receiverId, {
        event: 'new_message',
        data: message
      });
      wsServer.sendToUser(currentUserId, {
        event: 'message_sent',
        data: message
      });
    }

    res.writeHead(201, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, message }));
  }

  // 3. POST /api/messages/:userId/read - Mark messages as read
  if (pathName.startsWith('/api/messages/') && pathName.endsWith('/read') && method === 'POST') {
    const parts = pathName.split('/');
    const targetUserId = parts[3];

    const count = db.markMessagesAsRead(targetUserId, currentUserId);
    if (count > 0 && wsServer) {
      wsServer.sendToUser(targetUserId, {
        event: 'messages_read',
        data: {
          readBy: currentUserId,
          readAt: Date.now()
        }
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, updatedCount: count }));
  }

  // 4. DELETE /api/messages/:userId - Clear chat history between current user and target user
  if (pathName.startsWith('/api/messages/') && method === 'DELETE') {
    const targetUserId = pathName.split('/')[3];

    const deletedCount = db.clearChatBetween(currentUserId, targetUserId);

    if (wsServer) {
      wsServer.sendToUser(targetUserId, {
        event: 'chat_cleared',
        data: { clearedBy: currentUserId }
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, deletedCount }));
  }

  return false;
}

module.exports = { handleMessageRoutes };
