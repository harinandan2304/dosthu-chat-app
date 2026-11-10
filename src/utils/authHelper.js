const crypto = require('crypto');

// Secret key for HMAC token signing (falls back to a default if not set in process.env)
const JWT_SECRET = process.env.JWT_SECRET || 'dosthu-fswd-super-secret-key-2026';

/**
 * Hash password with PBKDF2 (SHA-512, 100,000 iterations)
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a plain password against the stored salt:hash string
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hashToVerify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(hashToVerify, 'hex'));
}

/**
 * Generate a signed session/auth token (Payload + Expiration + HMAC-SHA256 signature)
 */
function generateToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + expiresInMs;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Date.now()) {
      return null; // Expired
    }
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Extract auth token from Authorization Header ('Bearer <token>') or Cookie
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['cookie']) {
    const match = req.headers['cookie'].match(/dosthu_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractToken
};
