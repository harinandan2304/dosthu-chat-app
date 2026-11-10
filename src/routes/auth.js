const db = require('../db/database');
const { verifyPassword, generateToken, verifyToken, extractToken } = require('../utils/authHelper');

function handleAuthRoutes(req, res, pathName, method, body) {
  // 1. Register User
  if (pathName === '/api/auth/register' && method === 'POST') {
    const { username, name, email, password, avatar, bio } = body || {};

    if (!username || !password || !name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Username, name, and password are required' }));
    }

    if (username.length < 3) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Username must be at least 3 characters' }));
    }

    if (password.length < 6) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Password must be at least 6 characters' }));
    }

    // Check existing username
    if (db.findUserByUsername(username)) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Username is already taken' }));
    }

    // Check existing email
    if (email && db.findUserByEmail(email)) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Email is already registered' }));
    }

    const newUser = db.createUser({
      username,
      name,
      email: email || `${username}@dosthu.app`,
      password,
      avatar,
      bio
    });

    const token = generateToken({ id: newUser.id, username: newUser.username });

    res.writeHead(201, {
      'Content-Type': 'application/json',
      'Set-Cookie': `dosthu_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
    });
    return res.end(JSON.stringify({ success: true, user: newUser, token }));
  }

  // 2. Login User
  if (pathName === '/api/auth/login' && method === 'POST') {
    const { identifier, password } = body || {};

    if (!identifier || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Username/Email and password are required' }));
    }

    let user = db.findUserByUsername(identifier);
    if (!user) {
      user = db.findUserByEmail(identifier);
    }

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid username or password' }));
    }

    const isMatch = verifyPassword(password, user.password);
    if (!isMatch) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid username or password' }));
    }

    const safeUser = db.sanitizeUser(user);
    const token = generateToken({ id: safeUser.id, username: safeUser.username });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `dosthu_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
    });
    return res.end(JSON.stringify({ success: true, user: safeUser, token }));
  }

  // 3. Get Current User ('/api/auth/me')
  if (pathName === '/api/auth/me' && method === 'GET') {
    const token = extractToken(req);
    const decoded = verifyToken(token);

    if (!decoded || !decoded.id) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }

    const user = db.findUserById(decoded.id);
    if (!user) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'User not found' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, user: db.sanitizeUser(user) }));
  }

  // 4. Logout
  if (pathName === '/api/auth/logout' && method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `dosthu_token=; Path=/; HttpOnly; Max-Age=0`
    });
    return res.end(JSON.stringify({ success: true, message: 'Logged out successfully' }));
  }

  return false;
}

module.exports = { handleAuthRoutes };
