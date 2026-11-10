const db = require('../db/database');
const { verifyToken, extractToken } = require('../utils/authHelper');

function handleUserRoutes(req, res, pathName, method, body, wsServer) {
  // Authenticate user for all user routes
  const token = extractToken(req);
  const decoded = verifyToken(token);

  if (!decoded || !decoded.id) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Unauthorized: Valid token required' }));
  }

  const currentUserId = decoded.id;

  // 1. GET /api/users - List all other users with unread count and presence
  if (pathName === '/api/users' && method === 'GET') {
    const users = db.getAllUsers(currentUserId);
    // Dynamic real-time socket status check
    const enrichedUsers = users.map(u => ({
      ...u,
      status: wsServer && wsServer.isUserOnline(u.id) ? 'online' : (u.status || 'offline')
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, users: enrichedUsers }));
  }

  // 2. PUT /api/users/profile - Update Current User Profile
  if (pathName === '/api/users/profile' && method === 'PUT') {
    const { name, bio, avatar } = body || {};

    const updatedUser = db.updateUser(currentUserId, { name, bio, avatar });
    if (!updatedUser) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'User not found' }));
    }

    // Broadcast profile update event via WebSocket if online
    if (wsServer) {
      wsServer.broadcast({
        event: 'user_profile_updated',
        data: updatedUser
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user: updatedUser }));
  }

  // 3. GET /api/users/:id - Get specific user profile
  if (pathName.startsWith('/api/users/') && method === 'GET') {
    const targetUserId = pathName.split('/')[3];
    const user = db.findUserById(targetUserId);

    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'User not found' }));
    }

    const safeUser = db.sanitizeUser(user);
    safeUser.status = wsServer && wsServer.isUserOnline(user.id) ? 'online' : user.status;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user: safeUser }));
  }

  return false;
}

module.exports = { handleUserRoutes };
